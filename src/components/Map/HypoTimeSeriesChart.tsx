import { useEffect, useState } from "react";
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
} from "recharts";
import { Loader2 } from "lucide-react";

interface Props {
  omradeId: number;
  hasStora: boolean;
  /** Number of recent years to load (default 3). */
  years?: number;
}

interface Point {
  datum: string;
  ts: number;
  fyllnadsgrad_sma: number | null;
  fyllnadsgrad_stora: number | null;
  grundvattensituation_sma: number | null;
  grundvattensituation_stora: number | null;
}

const PAGE_LIMIT = 1000;
// SGU sentinel values for "no data": -1, 99
const cleanNum = (x: any): number | null => {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  if (!Number.isFinite(n) || n === -1 || n === 99) return null;
  return n;
};

async function fetchAllForOmrade(omradeId: number, fromDate: string): Promise<any[]> {
  const base = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/grundvattennivaer-tidigare/items?f=json&limit=${PAGE_LIMIT}`;
  const filter = encodeURIComponent(`omrade_id=${omradeId} AND datum>='${fromDate}'`);
  const all: any[] = [];
  let url: string | null = `${base}&filter=${filter}`;
  let safety = 0;
  while (url && safety < 50) {
    const r = await fetch(url);
    if (!r.ok) break;
    const j = await r.json();
    if (Array.isArray(j.features)) all.push(...j.features);
    const next = (j.links ?? []).find((l: any) => l.rel === "next");
    url = next?.href ?? null;
    safety++;
  }
  return all;
}

export const HypoTimeSeriesChart = ({ omradeId, hasStora, years = 3 }: Props) => {
  const [data, setData] = useState<Point[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const from = new Date();
    from.setFullYear(from.getFullYear() - years);
    const fromStr = from.toISOString().slice(0, 10);

    fetchAllForOmrade(omradeId, fromStr)
      .then((feats) => {
        if (cancelled) return;
        const points: Point[] = feats
          .map((f) => {
            const p = f.properties ?? {};
            const datum = String(p.datum ?? "").slice(0, 10);
            if (!datum) return null;
            return {
              datum,
              ts: new Date(datum).getTime(),
              fyllnadsgrad_sma: cleanNum(p.fyllnadsgrad_sma),
              fyllnadsgrad_stora: cleanNum(p.fyllnadsgrad_stora),
              grundvattensituation_sma: cleanNum(p.grundvattensituation_sma),
              grundvattensituation_stora: cleanNum(p.grundvattensituation_stora),
            } as Point;
          })
          .filter((x): x is Point => x !== null)
          .sort((a, b) => a.ts - b.ts);
        setData(points);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Kunde inte hämta tidsserie");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [omradeId, years]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Hämtar tidsserie…
      </div>
    );
  }

  if (error) {
    return <div className="text-xs text-destructive">{error}</div>;
  }

  if (!data || data.length === 0) {
    return <div className="text-xs text-muted-foreground">Ingen tidsseriedata.</div>;
  }

  // Detect which series actually have data
  const hasFyllSma = data.some((d) => d.fyllnadsgrad_sma !== null);
  const hasFyllStora = data.some((d) => d.fyllnadsgrad_stora !== null);
  const hasSitSma = data.some((d) => d.grundvattensituation_sma !== null);
  const hasSitStora = data.some((d) => d.grundvattensituation_stora !== null);

  const tickFmt = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  // Color per series (semantic-ish; HYPE has its own palette so use literal CSS vars where possible)
  const COLORS = {
    fyllSma: "hsl(var(--primary))",
    fyllStora: "rgb(0,104,160)",
    sitSma: "rgb(180,120,40)",
    sitStora: "rgb(120,40,140)",
  };

  const tooltipStyle = {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 6,
    fontSize: 11,
  };

  return (
    <div className="space-y-3">
      {/* Chart 1 – Fyllnadsgrad */}
      {(hasFyllSma || hasFyllStora) && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Fyllnadsgrad (percentil)
          </p>
          <div className="w-full h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 6, right: 8, bottom: 4, left: -16 }}>
                {/* Color class bands – fyllnadsgrad 7-class scale */}
                <ReferenceArea y1={0}    y2={6.5}  fill="rgba(122,60,16,0.13)"    stroke="none" />
                <ReferenceArea y1={6.5}  y2={19.5} fill="rgba(200,168,96,0.13)"   stroke="none" />
                <ReferenceArea y1={19.5} y2={37.5} fill="rgba(232,216,152,0.12)"  stroke="none" />
                <ReferenceArea y1={37.5} y2={62.5} fill="rgba(160,160,160,0.13)"  stroke="none" />
                <ReferenceArea y1={62.5} y2={80.5} fill="rgba(90,180,158,0.13)"   stroke="none" />
                <ReferenceArea y1={80.5} y2={93.5} fill="rgba(42,122,104,0.13)"   stroke="none" />
                <ReferenceArea y1={93.5} y2={100}  fill="rgba(13,79,66,0.15)"     stroke="none" />
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="ts" type="number" domain={["dataMin", "dataMax"]} tickFormatter={tickFmt} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} scale="time" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip labelFormatter={(ts: any) => new Date(Number(ts)).toISOString().slice(0, 10)} formatter={(v: any, name: any) => [v == null ? "—" : `${v}%`, name]} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {hasFyllSma && <Line type="monotone" dataKey="fyllnadsgrad_sma" name="Små magasin" stroke={COLORS.fyllSma} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />}
                {hasFyllStora && <Line type="monotone" dataKey="fyllnadsgrad_stora" name="Stora magasin" stroke={COLORS.fyllStora} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            Grå zon = normalintervall (37,5–62,5:e percentilen)
          </p>
        </div>
      )}

      {/* Chart 2 – Grundvattensituation */}
      {(hasSitSma || hasSitStora) && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Grundvattensituation (percentil)
          </p>
          <div className="w-full h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                {/* Color class bands – situation 5-class scale */}
                <ReferenceArea y1={0}  y2={14} fill="rgba(232,96,48,0.15)"    stroke="none" />
                <ReferenceArea y1={14} y2={34} fill="rgba(240,224,64,0.13)"   stroke="none" />
                <ReferenceArea y1={34} y2={65} fill="rgba(144,184,224,0.15)"  stroke="none" />
                <ReferenceArea y1={65} y2={85} fill="rgba(72,120,200,0.15)"   stroke="none" />
                <ReferenceArea y1={85} y2={100} fill="rgba(30,58,144,0.15)"   stroke="none" />
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="ts" type="number" domain={["dataMin", "dataMax"]} tickFormatter={tickFmt} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} scale="time" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip labelFormatter={(ts: any) => new Date(Number(ts)).toISOString().slice(0, 10)} formatter={(v: any, name: any) => [v == null ? "—" : `${v}%`, name]} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {hasSitSma && <Line type="monotone" dataKey="grundvattensituation_sma" name="Små magasin" stroke={COLORS.sitSma} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />}
                {hasSitStora && <Line type="monotone" dataKey="grundvattensituation_stora" name="Stora magasin" stroke={COLORS.sitStora} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            Ljusblå zon = normalintervall (35–65:e percentilen)
          </p>
        </div>
      )}

      {!hasFyllSma && !hasFyllStora && !hasSitSma && !hasSitStora && (
        <div className="text-xs text-muted-foreground">Ingen användbar tidsseriedata.</div>
      )}
    </div>
  );
};
