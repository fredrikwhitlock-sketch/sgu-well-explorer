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
}

const PAGE_LIMIT = 1000;

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
              fyllnadsgrad_sma:
                p.fyllnadsgrad_sma === -1 || p.fyllnadsgrad_sma == null
                  ? null
                  : Number(p.fyllnadsgrad_sma),
              fyllnadsgrad_stora:
                p.fyllnadsgrad_stora === -1 || p.fyllnadsgrad_stora == null
                  ? null
                  : Number(p.fyllnadsgrad_stora),
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

  const tickFmt = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          {/* Normal-band 25–75 percentil */}
          <ReferenceArea y1={25} y2={75} fill="rgba(254,224,70,0.15)" stroke="none" />
          <XAxis
            dataKey="ts"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={tickFmt}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            scale="time"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            label={{
              value: "Percentil",
              angle: -90,
              position: "insideLeft",
              offset: 20,
              style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
            }}
          />
          <Tooltip
            labelFormatter={(ts: any) =>
              new Date(Number(ts)).toISOString().slice(0, 10)
            }
            formatter={(v: any, name: any) => [v == null ? "—" : `${v}%`, name]}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 11,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line
            type="monotone"
            dataKey="fyllnadsgrad_sma"
            name="Små magasin"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          {hasStora && (
            <Line
              type="monotone"
              dataKey="fyllnadsgrad_stora"
              name="Stora magasin"
              stroke="rgb(0,104,160)"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
