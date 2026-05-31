import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtMonthYear } from "@/lib/utils";
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
import { Loader2 } from "lucide-react";

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


export const ObsHypoTimeSeriesChart = ({
  stations,
  omradeId,
  useStora,
  years = 2,
  maxStations = 5,
}: Props) => {
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

    // Try Cloudflare Worker, then Supabase, then SGU API
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

      const cfWorkerUrl = import.meta.env.VITE_CF_WORKER_URL;
      if (cfWorkerUrl) {
        try {
          const res = await fetch(`${cfWorkerUrl}/obs-nivaer?ids=${ids.join(',')}&from=${fromStr}`);
          if (res.ok) {
            const d = await res.json();
            if (d?.nivaer?.length > 0) return parseRows(d.nivaer);
          }
        } catch { /* fall through */ }
      }

      const { data: sbRows } = await supabase
        .from('obs_nivaer')
        .select('platsbeteckning, obsdatum, nivaer_m')
        .in('platsbeteckning', ids)
        .gte('obsdatum', fromStr)
        .order('obsdatum');
      if (sbRows && sbRows.length > 0) return parseRows(sbRows as any);

      return fetchNivaerForStations(ids, fromStr, ctrl.signal);
    };

    Promise.all([
      fetchNivaer(),
      omradeId != null ? fetchHypeSeriesForArea(omradeId, years, ctrl.signal) : Promise.resolve([]),
    ])
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
  }, [stationKey, omradeId, years]);

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
    return Array.from(map.values()).sort((a, b) => a.ts - b.ts);
  }, [obsByStation, hypoSeries, stationsToShow]);

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
  const minDepth = allDepths.length ? Math.min(...allDepths) : 0;
  const maxDepth = allDepths.length ? Math.max(...allDepths) : 1;
  const pad = Math.max(0.2, (maxDepth - minDepth) * 0.1);

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        {hypoOnly
          ? `HYPE fyllnadsgrad – senaste ${years} åren`
          : `Grundvattennivå – senaste ${years} åren`}
        {!hypoOnly && hasHypo && (
          <span className="text-muted-foreground/70 normal-case font-normal">
            {" · "}HYPE-fyllnadsgrad (små/stora magasin) i bakgrunden
          </span>
        )}
      </p>
      <div className="w-full h-44 sm:h-56">
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
      {!hasAnyObs && stationsToShow.length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-1">
          Inga observationer hittades för stationerna under de senaste {years} åren.
        </p>
      )}
    </div>
  );
};
