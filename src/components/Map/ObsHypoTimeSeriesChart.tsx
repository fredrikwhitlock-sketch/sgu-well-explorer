import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { fmtMonthYear } from "@/lib/utils";
import { fitHypeToObservations, type HypeFit } from "@/lib/hypeCalibration";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
  ComposedChart,
} from "recharts";
import { Loader2, Download } from "lucide-react";

interface ObsStation {
  id: string;        // platsbeteckning
  namn: string;
  distKm: number;
}

interface Props {
  /** Observation stations (platsbeteckning) — typically the closest ones. */
  stations: ObsStation[];
  /** SGU-HYPE area id used for the background percentile series. */
  omradeId?: number;
  /** Which HYPE series to overlay – matches aquifer (small vs large). */
  useStora: boolean;
  /** Years of history to load (default 2). */
  years?: number;
  /** Max number of stations to plot (default 5 nearest). */
  maxStations?: number;
  /** Pre-fetched HYPE series (from the report) – avoids a second request when it covers `years`. */
  hypeSeries?: Array<{ ts: number; fyllSma: number | null; fyllStora: number | null }>;
}

const PAGE_LIMIT = 1000;

const HYPE_LEVEL_BASE =
  "https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/grundvattennivaer-tidigare/items?f=json";

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// A *bounded* datum range + omrade_id lets the API use its datum index and
// returns the full daily series in <1s. An open-ended omrade_id filter (or
// sortby=-datum, which the API silently ignores and returns 1968 first) times
// out or yields wrong data on this 100M+ record collection.
async function fetchHypeSeriesForArea(
  omradeId: number,
  years: number,
  signal: AbortSignal,
): Promise<Array<{ ts: number; fyllSma: number | null; fyllStora: number | null }>> {
  const hi = new Date();
  const lo = new Date();
  lo.setFullYear(lo.getFullYear() - years);
  const filter = `datum>='${ymd(lo)}' AND datum<='${ymd(hi)}' AND omrade_id=${omradeId}`;

  const results: any[] = [];
  let url: string | null =
    `${HYPE_LEVEL_BASE}&filter=${encodeURIComponent(filter)}&filter-lang=cql2-text&limit=1000`;

  let safety = 0;
  while (url && safety < 12 && !signal.aborted) {
    const r = await fetch(url, { signal }).catch(() => null);
    if (!r?.ok) break;
    const d = await r.json().catch(() => null);
    const features: any[] = d?.features ?? [];
    results.push(...features);
    if (features.length === 0) break;
    const next = (d?.links ?? []).find((l: any) => l.rel === "next");
    url = next?.href ?? null;
    safety++;
  }

  return results
    .map((f: any) => {
      const p = f.properties ?? {};
      const ts = new Date(String(p.datum ?? "").slice(0, 10)).getTime();
      return {
        ts,
        fyllSma:   cleanNum(p.fyllnadsgrad_sma),
        fyllStora: cleanNum(p.fyllnadsgrad_stora),
      };
    })
    .filter(p => Number.isFinite(p.ts))
    .sort((a, b) => a.ts - b.ts);
}

const cleanNum = (x: any): number | null => {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  if (!Number.isFinite(n) || n === -1 || n === 99) return null;
  return n;
};

// SGU palette for stations – maroon-leaning
const STATION_COLORS = [
  "hsl(var(--primary))",
  "rgb(0, 104, 160)",
  "rgb(180, 120, 40)",
  "rgb(120, 40, 140)",
  "rgb(20, 130, 90)",
];

async function fetchNivaerForStations(ids: string[], fromDate: string, signal?: AbortSignal): Promise<Map<string, Array<{ ts: number; djup: number }>>> {
  const out = new Map<string, Array<{ ts: number; djup: number }>>();
  if (ids.length === 0) return out;

  const obsBase =
    "https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections";
  const idList = ids.map((i) => `'${String(i).replace(/'/g, "''")}'`).join(",");
  const filter = `platsbeteckning IN (${idList}) AND obsdatum >= '${fromDate}'`;
  const base = `${obsBase}/nivaer/items?f=json&filter=${encodeURIComponent(filter)}&filter-lang=cql2-text&sortby=obsdatum&limit=${PAGE_LIMIT}`;

  let url: string | null = base;
  let safety = 0;
  while (url && safety < 50) {
    const r = await fetch(url, { signal });
    if (!r.ok) break;
    const j = await r.json();
    for (const f of j.features ?? []) {
      const p = f.properties ?? {};
      const id = String(p.platsbeteckning ?? "");
      const datum = String(p.obsdatum ?? "").slice(0, 10);
      const djup = cleanNum(p.grundvattenniva_m_u_markyta ?? p.grundvattenniva_m_urok);
      if (!id || !datum || djup == null) continue;
      const ts = new Date(datum).getTime();
      if (!Number.isFinite(ts)) continue;
      let arr = out.get(id);
      if (!arr) {
        arr = [];
        out.set(id, arr);
      }
      arr.push({ ts, djup });
    }
    const next = (j.links ?? []).find((l: any) => l.rel === "next");
    url = next?.href ?? null;
    safety++;
  }

  for (const arr of out.values()) arr.sort((a, b) => a.ts - b.ts);
  return out;
}


// Resolves CSS custom properties (var(--xxx)) in a cloned SVG to their
// computed values so the SVG renders correctly when drawn on a canvas.
function resolveSvgCssVars(el: Element) {
  const root = document.documentElement;
  for (const attr of ['stroke', 'fill', 'color', 'stop-color']) {
    const v = el.getAttribute(attr);
    if (v?.includes('var('))
      el.setAttribute(attr, v.replace(/var\((--[^),\s]+)\)/g, (_, n) =>
        getComputedStyle(root).getPropertyValue(n).trim() || 'inherit'));
  }
  const s = el.getAttribute('style');
  if (s?.includes('var('))
    el.setAttribute('style', s.replace(/var\((--[^),\s]+)\)/g, (_, n) =>
      getComputedStyle(root).getPropertyValue(n).trim() || 'inherit'));
  for (const child of Array.from(el.children)) resolveSvgCssVars(child);
}

export const ObsHypoTimeSeriesChart = ({
  stations,
  omradeId,
  useStora,
  years = 2,
  maxStations = 5,
  hypeSeries: prefetchedHype,
}: Props) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [obsByStation, setObsByStation] = useState<Map<string, Array<{ ts: number; djup: number }>>>(
    new Map(),
  );
  const [hypoSeries, setHypoSeries] = useState<Array<{ ts: number; fyllSma: number | null; fyllStora: number | null }>>([]);

  // Stable string key so a new array reference with same IDs doesn't re-trigger the fetch
  const stationKey = useMemo(
    () => stations.slice(0, maxStations).map(s => s.id).join(','),
    [stations, maxStations],
  );

  const stationsToShow = useMemo(
    () => stations.slice(0, maxStations),
    [stationKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    const from = new Date();
    from.setFullYear(from.getFullYear() - years);
    const fromStr = from.toISOString().slice(0, 10);

    const ids = stationsToShow.map((s) => s.id).filter(Boolean);

    // Try Cloudflare Worker, then Supabase, then SGU API.
    // Always supplement with a direct SGU API fetch for recent data when the
    // cached source ends more than 45 days ago — this guards against both
    // stale Supabase syncs and the default Supabase 1000-row cap (which, with
    // ascending order, silently returns the oldest rows and drops recent ones).
    const fetchNivaer = async (): Promise<Map<string, Array<{ ts: number; djup: number }>>> => {
      if (ids.length === 0) return new Map();

      const parseRows = (rows: Array<{ platsbeteckning: string; obsdatum: string; nivaer_m: number | null }>) => {
        const out = new Map<string, Array<{ ts: number; djup: number }>>();
        for (const r of rows) {
          if (r.nivaer_m == null) continue;
          const ts = new Date(r.obsdatum).getTime();
          if (!Number.isFinite(ts)) continue;
          const arr = out.get(r.platsbeteckning) ?? [];
          arr.push({ ts, djup: r.nivaer_m });
          out.set(r.platsbeteckning, arr);
        }
        for (const arr of out.values()) arr.sort((a, b) => a.ts - b.ts);
        return out;
      };

      // Validate cached data and supplement or replace with SGU API as needed.
      // Three cases:
      //  1. Cache covers the full requested range AND is current → return as-is
      //  2. Cache covers the range but ends >45 days ago → add recent from SGU
      //  3. Cache starts >60 days after fromStr (partial history) → discard cache,
      //     fall through to full SGU fetch so the chart shows the complete 2-year window
      const withSupplement = async (
        data: Map<string, Array<{ ts: number; djup: number }>>,
      ): Promise<Map<string, Array<{ ts: number; djup: number }>>> => {
        if (ctrl.signal.aborted) return data;
        const fromMs = new Date(fromStr).getTime();
        const staleCutoff = Date.now() - 45 * 86_400_000;
        let earliest = Infinity;
        let latest = 0;
        for (const arr of data.values()) for (const p of arr) {
          if (p.ts < earliest) earliest = p.ts;
          if (p.ts > latest) latest = p.ts;
        }
        // If cache doesn't start within 60 days of the requested start, it's too
        // partial to be useful — fall through to the SGU API for the full range.
        if (earliest > fromMs + 60 * 86_400_000) {
          return fetchNivaerForStations(ids, fromStr, ctrl.signal);
        }
        // Cache covers history — only supplement recent observations if stale.
        if (latest >= staleCutoff) return data;
        const recentFrom = ymd(new Date(Math.max(latest + 86_400_000, Date.now() - 90 * 86_400_000)));
        const recent = await fetchNivaerForStations(ids, recentFrom, ctrl.signal);
        for (const [id, arr] of recent) {
          const existing = data.get(id) ?? [];
          const existingTs = new Set(existing.map(p => p.ts));
          const newPts = arr.filter(p => !existingTs.has(p.ts));
          if (newPts.length > 0) {
            data.set(id, [...existing, ...newPts].sort((a, b) => a.ts - b.ts));
          }
        }
        return data;
      };

      const cfWorkerUrl = import.meta.env.VITE_CF_WORKER_URL;
      if (cfWorkerUrl) {
        try {
          const res = await fetch(`${cfWorkerUrl}/obs-nivaer?ids=${ids.join(',')}&from=${fromStr}`, { signal: ctrl.signal });
          if (res.ok) {
            const d = await res.json();
            if (d?.nivaer?.length > 0) return withSupplement(parseRows(d.nivaer));
          }
        } catch { /* fall through */ }
      }

      return fetchNivaerForStations(ids, fromStr, ctrl.signal);
    };

    // Reuse the series already fetched by the report when it covers the window
    // (prefetched is 2 years); only fetch separately for longer ranges (e.g. popup).
    const cutoff = Date.now() - years * 365.25 * 86_400_000;
    const hypePromise =
      omradeId == null
        ? Promise.resolve([])
        : prefetchedHype != null && years <= 2
          ? Promise.resolve(prefetchedHype.filter(p => p.ts > cutoff))
          : fetchHypeSeriesForArea(omradeId, years, ctrl.signal);

    Promise.all([fetchNivaer(), hypePromise])
      .then(([obs, hypo]: any) => {
        if (ctrl.signal.aborted) return;
        setObsByStation(obs);
        setHypoSeries(hypo);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e?.message ?? "Kunde inte hämta tidsserie");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  // stationsToShow is derived from stationKey — use the key to avoid re-fetching on same-content re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationKey, omradeId, years, prefetchedHype]);

  // Pastas-style calibration: fit HYPE fyllnadsgrad against the nearest
  // station's observations and derive a modeled daily level series that fills
  // gaps in the sparse observed record.
  const calibration = useMemo<{ stationId: string; fit: HypeFit } | null>(() => {
    if (hypoSeries.length === 0) return null;
    for (const s of stationsToShow) {
      const obs = obsByStation.get(s.id);
      if (!obs || obs.length < 8) continue;
      const fit = fitHypeToObservations(obs, hypoSeries);
      if (fit) return { stationId: s.id, fit };
    }
    return null;
  }, [obsByStation, hypoSeries, stationsToShow]);

  const handleExport = useCallback(() => {
    const svg = chartRef.current?.querySelector('svg');
    if (!svg) return;
    const { width, height } = svg.getBoundingClientRect();
    if (!width || !height) return;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    resolveSvgCssVars(clone);

    // White background behind the chart content
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', String(width));
    bg.setAttribute('height', String(height));
    bg.setAttribute('fill', 'white');
    clone.insertBefore(bg, clone.firstChild);
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));

    const svgStr = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const scale = 2; // retina quality
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.download = `grundvattenniva-${stationsToShow[0]?.id ?? 'diagram'}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [stationsToShow]);

  // Merge all series into a single sorted-by-ts array of rows for recharts
  const merged = useMemo(() => {
    const map = new Map<number, Record<string, any>>();
    for (const s of stationsToShow) {
      const arr = obsByStation.get(s.id) ?? [];
      for (const p of arr) {
        let row = map.get(p.ts);
        if (!row) {
          row = { ts: p.ts };
          map.set(p.ts, row);
        }
        row[`obs_${s.id}`] = p.djup;
      }
    }
    for (const p of hypoSeries) {
      let row = map.get(p.ts);
      if (!row) {
        row = { ts: p.ts };
        map.set(p.ts, row);
      }
      row.hypoFyllSma = p.fyllSma;
      row.hypoFyllStora = p.fyllStora;
    }
    if (calibration) {
      for (const p of calibration.fit.series) {
        let row = map.get(p.ts);
        if (!row) {
          row = { ts: p.ts };
          map.set(p.ts, row);
        }
        row.hypeCalNiva = p.niva;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.ts - b.ts);
  }, [obsByStation, hypoSeries, stationsToShow, calibration]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-44 text-xs text-muted-foreground">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Hämtar nivåer (senaste {years} åren)…
      </div>
    );
  }

  if (error) return <div className="text-xs text-destructive">{error}</div>;

  const hasAnyObs = stationsToShow.some((s) => (obsByStation.get(s.id)?.length ?? 0) > 0);
  const hasHypo = hypoSeries.some((p) => p.fyllSma != null || p.fyllStora != null);

  if (!hasAnyObs && !hasHypo) {
    return <div className="text-xs text-muted-foreground">Ingen tidsseriedata tillgänglig.</div>;
  }


  // HYPE-only mode: no observation stations provided or none have data
  const hypoOnly = !hasAnyObs;

  // Compute Y-axis domain for observations, inverted (depth grows downward)
  const allDepths: number[] = [];
  for (const s of stationsToShow) {
    const arr = obsByStation.get(s.id) ?? [];
    for (const p of arr) allDepths.push(p.djup);
  }
  if (calibration) for (const p of calibration.fit.series) allDepths.push(p.niva);
  const minDepth = allDepths.length ? Math.min(...allDepths) : 0;
  const maxDepth = allDepths.length ? Math.max(...allDepths) : 1;
  const pad = Math.max(0.2, (maxDepth - minDepth) * 0.1);

  return (
    <div>
      <div className="flex items-start justify-between mb-1 gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {hypoOnly
            ? `HYPE fyllnadsgrad – senaste ${years} åren`
            : `Grundvattennivå – senaste ${years} åren`}
          {!hypoOnly && hasHypo && (
            <span className="text-muted-foreground/70 normal-case font-normal">
              {" · "}HYPE-fyllnadsgrad (små/stora magasin) i bakgrunden
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={handleExport}
          title="Exportera diagram som PNG"
          className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
      <div ref={chartRef} className="w-full h-44 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={merged} margin={{ top: 8, right: hypoOnly ? 16 : 48, bottom: 4, left: hypoOnly ? 16 : -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            {hasHypo && (
              <ReferenceArea
                yAxisId="hypo"
                y1={25}
                y2={75}
                fill="rgba(254,224,70,0.12)"
                stroke="none"
              />
            )}
            <XAxis
              dataKey="ts"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={fmtMonthYear}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              scale="time"
            />
            {/* Left axis: observed depth – hidden in HYPE-only mode */}
            {!hypoOnly && (
              <YAxis
                yAxisId="obs"
                orientation="left"
                domain={[Math.max(0, minDepth - pad), maxDepth + pad]}
                reversed
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v: number) => v.toFixed(1)}
                label={{
                  value: "m u. markyta",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
                }}
              />
            )}
            {/* In HYPE-only mode we still need a dummy obs axis so Line yAxisId="obs" renders */}
            {hypoOnly && (
              <YAxis yAxisId="obs" orientation="left" hide domain={[0, 1]} />
            )}
            {/* HYPE percentile axis – primary in HYPE-only mode */}
            {hasHypo && (
              <YAxis
                yAxisId="hypo"
                orientation={hypoOnly ? "left" : "right"}
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                label={{
                  value: "percentil",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
                }}
              />
            )}
            <Tooltip
              labelFormatter={(ts: any) => new Date(Number(ts)).toISOString().slice(0, 10)}
              formatter={(v: any, name: any) => {
                if (v == null) return ["—", name];
                if (name === "Fyllnadsgrad små" || name === "Fyllnadsgrad stora") return [`${Math.round(Number(v))} perc.`, name];
                return [`${Number(v).toFixed(2)} m`, name];
              }}
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                fontSize: 11,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {hasHypo && (
              <Line
                yAxisId="hypo"
                type="monotone"
                dataKey="hypoFyllSma"
                name="Fyllnadsgrad små"
                stroke="#3b82f6"
                strokeWidth={1}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            {hasHypo && (
              <Line
                yAxisId="hypo"
                type="monotone"
                dataKey="hypoFyllStora"
                name="Fyllnadsgrad stora"
                stroke="#22c55e"
                strokeWidth={1}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            {calibration && (
              <Line
                yAxisId="obs"
                type="monotone"
                dataKey="hypeCalNiva"
                name="Modellerad nivå (HYPE-kalibrerad)"
                stroke="#dc2626"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            {stationsToShow.map((s, i) => {
              const arr = obsByStation.get(s.id);
              if (!arr || arr.length === 0) return null;
              return (
                <Line
                  key={s.id}
                  yAxisId="obs"
                  type="monotone"
                  dataKey={`obs_${s.id}`}
                  name={`${s.namn || s.id} (${s.distKm.toFixed(1)} km)`}
                  stroke={STATION_COLORS[i % STATION_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {calibration && (
        <p className="text-[10px] text-muted-foreground mt-1">
          Modellerad nivå: exponentiell kärnkalibrering av HYPE-fyllnadsgrad ({calibration.fit.source === 'sma' ? 'små' : 'stora'} magasin)
          mot {calibration.stationId}
          {' · '}R² = {calibration.fit.r2.toFixed(2)}
          {calibration.fit.valR2 != null && <>{' · '}validerings-R² = {calibration.fit.valR2.toFixed(2)}</>}
          {' · '}RMSE = {calibration.fit.rmse.toFixed(2)} m
          {' · '}{calibration.fit.n} matchade observationer
          {calibration.fit.memoryDays > 1 && <>{' · '}minne {calibration.fit.memoryDays} d</>}
          {' '}(Pastas-inspirerad transfermodell)
        </p>
      )}
      {!hasAnyObs && stationsToShow.length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-1">
          Inga observationer hittades för stationerna under de senaste {years} åren.
        </p>
      )}
    </div>
  );
};
