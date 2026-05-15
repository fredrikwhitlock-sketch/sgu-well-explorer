export interface Env {
  DB: D1Database;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const SGU_HYPE_BASE =
  "https://api.sgu.se/oppnadata/grundvatten/ogc/features/v1/collections/grundvattennivaer-sgu-hype-omraden/items";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const path = url.pathname;

    // ── GET /wells ──────────────────────────────────────────────────────────────
    // Same response shape as Supabase wells-query: { wells: [{brunnsid, obsplatsid, lon, lat, properties}] }
    if (path === "/wells" && request.method === "GET") {
      const minLon = url.searchParams.get("minLon") ?? url.searchParams.get("lon_min");
      const maxLon = url.searchParams.get("maxLon") ?? url.searchParams.get("lon_max");
      const minLat = url.searchParams.get("minLat") ?? url.searchParams.get("lat_min");
      const maxLat = url.searchParams.get("maxLat") ?? url.searchParams.get("lat_max");
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 50000), 50000);

      if (!minLon || !maxLon || !minLat || !maxLat) {
        return json({ error: "minLon, maxLon, minLat, maxLat required" }, 400);
      }

      const { results } = await env.DB.prepare(
        `SELECT brunnsid, obsplatsid, lon, lat, properties
         FROM wells_cache
         WHERE lon >= ? AND lon <= ? AND lat >= ? AND lat <= ?
         LIMIT ?`
      )
        .bind(minLon, maxLon, minLat, maxLat, limit)
        .all();

      // Parse stored JSON properties
      const wells = results.map((r: Record<string, unknown>) => ({
        ...r,
        properties: typeof r.properties === "string" ? JSON.parse(r.properties as string) : r.properties,
      }));

      return json({ wells, count: wells.length });
    }

    // ── GET /well-lager ─────────────────────────────────────────────────────────
    if (path === "/well-lager" && request.method === "GET") {
      const obsplatsid = url.searchParams.get("obsplatsid");
      if (!obsplatsid) return json({ error: "obsplatsid required" }, 400);

      const { results } = await env.DB.prepare(
        `SELECT lagerid, lagernr, djup_fran, djup_till, jordart_bergart, lageranmarkning
         FROM well_lager WHERE obsplatsid = ? ORDER BY lagernr`
      )
        .bind(obsplatsid)
        .all();

      return json({ lager: results });
    }

    // ── GET /obs-nivaer ─────────────────────────────────────────────────────────
    // Response: { nivaer: [{platsbeteckning, obsdatum, nivaer_m}] } — matches Supabase schema
    if (path === "/obs-nivaer" && request.method === "GET") {
      const ids = url.searchParams.get("ids"); // comma-separated platsbeteckning
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      if (!ids) return json({ error: "ids required" }, 400);

      const idList = ids.split(",").map((s) => s.trim()).filter(Boolean);
      if (idList.length === 0) return json({ nivaer: [] });

      const placeholders = idList.map(() => "?").join(",");
      const bindings: (string | number)[] = [...idList];
      let sql = `SELECT platsbeteckning, obsdatum, nivaer_m
                 FROM obs_nivaer WHERE platsbeteckning IN (${placeholders})`;
      if (from) { sql += " AND obsdatum >= ?"; bindings.push(from); }
      if (to)   { sql += " AND obsdatum <= ?"; bindings.push(to); }
      sql += " ORDER BY platsbeteckning, obsdatum";

      const { results } = await env.DB.prepare(sql).bind(...bindings).all();
      return json({ nivaer: results });
    }

    // ── GET /hype-nivaer ────────────────────────────────────────────────────────
    if (path === "/hype-nivaer" && request.method === "GET") {
      const omradeId = Number(url.searchParams.get("omrade_id"));
      const years = Number(url.searchParams.get("years") ?? 5);
      if (!omradeId) return json({ error: "omrade_id required" }, 400);

      const fromDate = new Date();
      fromDate.setFullYear(fromDate.getFullYear() - years);
      const from = fromDate.toISOString().slice(0, 10);

      const { results: cached } = await env.DB.prepare(
        `SELECT omrade_id, datum, fyllnadsgrad_sma, fyllnadsgrad_stora,
                grundvattensituation_sma, grundvattensituation_stora
         FROM hype_nivaer WHERE omrade_id = ? AND datum >= ? ORDER BY datum`
      )
        .bind(omradeId, from)
        .all();

      if (cached.length > 0) return json({ nivaer: cached, source: "cache" });

      const fetched = await fetchHypeFromSGU(omradeId, from);
      if (fetched.length > 0) await upsertHype(env.DB, fetched);

      return json({ nivaer: fetched, source: "sgu" });
    }

    // ── POST /sync/wells ────────────────────────────────────────────────────────
    if (path === "/sync/wells" && request.method === "POST") {
      return handleSyncWells(request, env);
    }

    // ── POST /sync/well-lager ───────────────────────────────────────────────────
    if (path === "/sync/well-lager" && request.method === "POST") {
      return handleSyncWellLager(request, env);
    }

    // ── POST /sync/obs-nivaer ───────────────────────────────────────────────────
    if (path === "/sync/obs-nivaer" && request.method === "POST") {
      return handleSyncObsNivaer(request, env);
    }

    return json({ error: "Not found" }, 404);
  },
};

// ── HYPE helpers ───────────────────────────────────────────────────────────────

interface HypeRow {
  omrade_id: number;
  datum: string;
  fyllnadsgrad_sma: number | null;
  fyllnadsgrad_stora: number | null;
  grundvattensituation_sma: number | null;
  grundvattensituation_stora: number | null;
}

async function fetchHypeFromSGU(omradeId: number, from: string): Promise<HypeRow[]> {
  const rows: HypeRow[] = [];
  let startIndex = 0;
  const LIMIT = 1000;

  while (true) {
    const filterCql = `omrade_id=${omradeId} AND datum >= '${from}'`;
    const urlStr = `${SGU_HYPE_BASE}?f=json&limit=${LIMIT}&startIndex=${startIndex}&filter=${encodeURIComponent(filterCql)}&filter-lang=cql-text`;
    const res = await fetch(urlStr);
    if (!res.ok) break;
    const data = await res.json() as { features?: Array<{ properties: Record<string, unknown> }> };
    const features = data.features ?? [];
    for (const f of features) {
      const p = f.properties;
      rows.push({
        omrade_id: Number(p.omrade_id),
        datum: String(p.datum).slice(0, 10),
        fyllnadsgrad_sma: p.fyllnadsgrad_sma != null ? Number(p.fyllnadsgrad_sma) : null,
        fyllnadsgrad_stora: p.fyllnadsgrad_stora != null ? Number(p.fyllnadsgrad_stora) : null,
        grundvattensituation_sma: p.grundvattensituation_sma != null ? Number(p.grundvattensituation_sma) : null,
        grundvattensituation_stora: p.grundvattensituation_stora != null ? Number(p.grundvattensituation_stora) : null,
      });
    }
    if (features.length < LIMIT) break;
    startIndex += LIMIT;
  }

  return rows;
}

async function upsertHype(db: D1Database, rows: HypeRow[]): Promise<void> {
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const stmts = chunk.map((r) =>
      db.prepare(
        `INSERT INTO hype_nivaer (omrade_id, datum, fyllnadsgrad_sma, fyllnadsgrad_stora,
           grundvattensituation_sma, grundvattensituation_stora)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (omrade_id, datum) DO NOTHING`
      ).bind(r.omrade_id, r.datum, r.fyllnadsgrad_sma, r.fyllnadsgrad_stora,
             r.grundvattensituation_sma, r.grundvattensituation_stora)
    );
    await db.batch(stmts);
  }
}

// ── Sync: wells_cache ─────────────────────────────────────────────────────────
// Stores brunnsid (PK), obsplatsid, lon, lat, properties (JSON) — matches Supabase schema

const SGU_WELLS_BASE =
  "https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items";

async function handleSyncWells(request: Request, env: Env): Promise<Response> {
  const body: { startIndex?: number; maxPages?: number } = await request.json().catch(() => ({}));
  const startIndex = body.startIndex ?? 0;
  const LIMIT = 1000;
  const MAX_PAGES = body.maxPages ?? 20;

  let currentIndex = startIndex;
  let totalInserted = 0;
  let hasMore = true;

  for (let page = 0; page < MAX_PAGES && hasMore; page++) {
    const res = await fetch(`${SGU_WELLS_BASE}?f=json&limit=${LIMIT}&startIndex=${currentIndex}`);
    if (!res.ok) return json({ error: `SGU error: ${res.status}` }, 502);
    const data = await res.json() as {
      features?: Array<{
        geometry?: { coordinates?: number[] };
        properties: Record<string, unknown>;
      }>;
    };
    const features = data.features ?? [];
    if (features.length === 0) { hasMore = false; break; }

    const rows = features
      .filter((f) => f.properties?.brunnsid)
      .map((f) => {
        const p = f.properties;
        const coords = f.geometry?.coordinates;
        // Store everything except brunnsid/obsplatsid/coords in the properties blob
        const { brunnsid, obsplatsid, ...rest } = p;
        return {
          brunnsid: String(brunnsid),
          obsplatsid: obsplatsid ? String(obsplatsid) : null,
          lon: coords ? Number(coords[0]) : 0,
          lat: coords ? Number(coords[1]) : 0,
          properties: JSON.stringify(rest),
        };
      })
      .filter((r) => r.lon !== 0 && r.lat !== 0);

    if (rows.length > 0) {
      const CHUNK = 100;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const stmts = chunk.map((r) =>
          env.DB.prepare(
            `INSERT INTO wells_cache (brunnsid, obsplatsid, lon, lat, properties)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (brunnsid) DO UPDATE SET
               obsplatsid=excluded.obsplatsid, lon=excluded.lon, lat=excluded.lat,
               properties=excluded.properties`
          ).bind(r.brunnsid, r.obsplatsid, r.lon, r.lat, r.properties)
        );
        await env.DB.batch(stmts);
        totalInserted += chunk.length;
      }
    }

    currentIndex += LIMIT;
    if (features.length < LIMIT) hasMore = false;
  }

  return json({ success: true, inserted: totalInserted, nextStartIndex: hasMore ? currentIndex : null });
}

// ── Sync: well_lager ──────────────────────────────────────────────────────────

const SGU_LAGER_BASE =
  "https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar-lager/items";

async function handleSyncWellLager(request: Request, env: Env): Promise<Response> {
  const body: { startIndex?: number; maxPages?: number } = await request.json().catch(() => ({}));
  const startIndex = body.startIndex ?? 0;
  const LIMIT = 1000;
  const MAX_PAGES = body.maxPages ?? 5;

  let currentIndex = startIndex;
  let totalInserted = 0;
  let hasMore = true;

  for (let page = 0; page < MAX_PAGES && hasMore; page++) {
    const res = await fetch(`${SGU_LAGER_BASE}?f=json&limit=${LIMIT}&startIndex=${currentIndex}`);
    if (!res.ok) return json({ error: `SGU error: ${res.status}` }, 502);
    const data = await res.json() as { features?: Array<{ properties: Record<string, unknown> }> };
    const features = data.features ?? [];
    if (features.length === 0) { hasMore = false; break; }

    const rows = features
      .filter((f) => f.properties?.lagerid && f.properties?.obsplatsid)
      .map((f) => {
        const p = f.properties;
        return {
          lagerid: String(p.lagerid),
          obsplatsid: String(p.obsplatsid),
          lagernr: Number(p.lagernr) || 0,
          djup_fran: p.djup_fran != null ? Number(p.djup_fran) : null,
          djup_till: p.djup_till != null ? Number(p.djup_till) : null,
          jordart_bergart: p.jordart_bergart ?? null,
          lageranmarkning: p.lageranmarkning ?? null,
        };
      });

    if (rows.length > 0) {
      const CHUNK = 100;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const stmts = chunk.map((r) =>
          env.DB.prepare(
            `INSERT INTO well_lager (lagerid, obsplatsid, lagernr, djup_fran, djup_till, jordart_bergart, lageranmarkning)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (lagerid) DO NOTHING`
          ).bind(r.lagerid, r.obsplatsid, r.lagernr, r.djup_fran, r.djup_till, r.jordart_bergart, r.lageranmarkning)
        );
        await env.DB.batch(stmts);
        totalInserted += chunk.length;
      }
    }

    currentIndex += LIMIT;
    if (features.length < LIMIT) hasMore = false;
  }

  return json({ success: true, inserted: totalInserted, nextStartIndex: hasMore ? currentIndex : null });
}

// ── Sync: obs_nivaer ──────────────────────────────────────────────────────────
// Uses platsbeteckning + nivaer_m to match the existing Supabase schema and app code

const SGU_NIVAER_BASE =
  "https://api.sgu.se/oppnadata/grundvatten/ogc/features/v1/collections/grundvattennivaer-observerade/items";

async function handleSyncObsNivaer(request: Request, env: Env): Promise<Response> {
  const body: { year?: number; month?: number; offset?: number } =
    await request.json().catch(() => ({}));

  const now = new Date();
  const year = body.year ?? now.getFullYear();
  const month = body.month ?? now.getMonth() + 1;
  const offset = body.offset ?? 0;

  const fromDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const toDate = new Date(year, month, 1).toISOString().slice(0, 10);

  const PAGE_SIZE = 1000;
  const MAX_PAGES = 8;

  let currentOffset = offset;
  let totalInserted = 0;
  let pages = 0;
  let lastPageSize = 0;

  for (pages = 0; pages < MAX_PAGES; pages++) {
    const filterCql = `obsdatum >= '${fromDate}' AND obsdatum < '${toDate}'`;
    const urlStr = `${SGU_NIVAER_BASE}?f=json&limit=${PAGE_SIZE}&startIndex=${currentOffset}&filter=${encodeURIComponent(filterCql)}&filter-lang=cql-text`;
    const res = await fetch(urlStr);
    if (!res.ok) return json({ error: `SGU error: ${res.status}` }, 502);
    const data = await res.json() as { features?: Array<{ properties: Record<string, unknown> }> };
    const features = data.features ?? [];
    lastPageSize = features.length;
    if (features.length === 0) break;

    const rows = features
      .filter((f) => f.properties?.platsbeteckning && f.properties?.obsdatum)
      .map((f) => {
        const p = f.properties;
        return {
          platsbeteckning: String(p.platsbeteckning),
          obsdatum: String(p.obsdatum).slice(0, 10),
          nivaer_m: p.nivaer_m != null ? Number(p.nivaer_m) : null,
        };
      });

    if (rows.length > 0) {
      const CHUNK = 100;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const stmts = chunk.map((r) =>
          env.DB.prepare(
            `INSERT INTO obs_nivaer (platsbeteckning, obsdatum, nivaer_m)
             VALUES (?, ?, ?)
             ON CONFLICT (platsbeteckning, obsdatum) DO NOTHING`
          ).bind(r.platsbeteckning, r.obsdatum, r.nivaer_m)
        );
        await env.DB.batch(stmts);
        totalInserted += chunk.length;
      }
    }

    currentOffset += PAGE_SIZE;
    if (features.length < PAGE_SIZE) break;
  }

  const hasMore = pages === MAX_PAGES && lastPageSize === PAGE_SIZE;
  return json({
    success: true,
    inserted: totalInserted,
    year,
    month,
    nextOffset: hasMore ? currentOffset : null,
  });
}
