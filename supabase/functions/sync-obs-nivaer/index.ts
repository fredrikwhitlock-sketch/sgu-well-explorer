import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Syncs one segment of a calendar month (max 8 pages = 8 000 rows per invocation).
// Supports pagination within a month via { year, month, offset }.
//
// POST /sync-obs-nivaer { "year": 2024, "month": 3 }           → first 8k rows
// POST /sync-obs-nivaer { "year": 2024, "month": 3, "offset": 8000 } → next 8k rows
// Returns nextOffset (null when month is complete).

const SGU_BASE =
  "https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/nivaer/items";
const PAGE_SIZE = 1000;
const MAX_PAGES = 8; // 8 000 rows per invocation

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    const now = new Date();
    const year: number   = body.year   ?? now.getUTCFullYear();
    const month: number  = body.month  ?? now.getUTCMonth() + 1;
    const offset: number = body.offset ?? 0;

    const fromDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const toDate   = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

    console.log(`Syncing nivaer ${fromDate}–${toDate} offset=${offset}`);

    const filter = encodeURIComponent(
      `obsdatum >= '${fromDate}' AND obsdatum <= '${toDate}'`,
    );
    let url: string | null =
      `${SGU_BASE}?f=json&limit=${PAGE_SIZE}&startIndex=${offset}&filter=${filter}&filter-lang=cql2-text&sortby=obsdatum`;

    let totalInserted = 0;
    let pages = 0;
    let lastPageSize = 0;

    while (url && pages < MAX_PAGES) {
      pages++;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`SGU nivaer error: ${res.status}`);
      const data = await res.json();
      const features: any[] = data.features ?? [];
      lastPageSize = features.length;

      const rows = features
        .filter((f) => f.properties?.platsbeteckning && f.properties?.obsdatum)
        .map((f) => {
          const p = f.properties ?? {};
          const rawNiva = p.grundvattenniva_m_u_markyta ?? p.grundvattenniva_m_urok ?? null;
          const niva = rawNiva !== null && rawNiva !== -1 && rawNiva !== 99
            ? Number(rawNiva) : null;
          return {
            platsbeteckning: String(p.platsbeteckning),
            obsdatum:        String(p.obsdatum).slice(0, 10),
            nivaer_m:        Number.isFinite(niva) ? niva : null,
          };
        })
        .filter((r) => r.platsbeteckning && r.obsdatum);

      if (rows.length > 0) {
        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const { error } = await supabase
            .from("obs_nivaer")
            .upsert(rows.slice(i, i + CHUNK), { onConflict: "platsbeteckning,obsdatum", ignoreDuplicates: true });
          if (error) console.error("Upsert error:", error.message);
          else totalInserted += rows.slice(i, i + CHUNK).length;
        }
      }

      const next = (data.links ?? []).find((l: any) => l.rel === "next");
      url = next?.href ?? null;
    }

    const { count } = await supabase
      .from("obs_nivaer")
      .select("*", { count: "exact", head: true });

    // If last page was full and we hit MAX_PAGES, there may be more rows
    const hasMore = pages === MAX_PAGES && lastPageSize === PAGE_SIZE;
    const nextOffset = hasMore ? offset + pages * PAGE_SIZE : null;

    await supabase
      .from("sync_status")
      .update({ status: hasMore ? "partial" : "complete", total_records: count ?? 0, last_synced_at: new Date().toISOString() })
      .eq("id", "obs_nivaer");

    return new Response(
      JSON.stringify({ success: true, period: `${fromDate}/${toDate}`, inserted: totalInserted, totalInDb: count, nextOffset }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sync-obs-nivaer error:", err);
    await supabase.from("sync_status").update({ status: "error" }).eq("id", "obs_nivaer");
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
