import { useState, useEffect, useRef } from "react";
import { fetchAnalysCSV, type AnalysRow } from "@/lib/parseCSV";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Trash2, Loader2, ExternalLink, GripHorizontal, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from "recharts";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { fitHypeToObservations, type HypeFit } from "@/lib/hypeCalibration";
import { fitChemToHype, PARAM_CLASS_LABEL, type ChemFit } from "@/lib/chemCalibration";

interface ChartLocation {
  id: string;
  name: string;
  type: 'level' | 'quality';
  platsbeteckning?: string;
  provplatsid?: string;
  lon?: number;
  lat?: number;
}

interface ChartViewerProps {
  initialLocation: ChartLocation;
  locations: ChartLocation[];
  onLocationsChange: (locations: ChartLocation[]) => void;
  onClose: () => void;
}

interface ChartData {
  date: string;
  /** Numeric timestamp used for the time-proportional X axis. */
  ts: number;
  [key: string]: string | number;
}

interface StationStat {
  name: string;
  color: string;
  antal: number;
  latest: number | null;
  latestDate: string;
  min: number | null;
  max: number | null;
  trend: 'up' | 'down' | 'flat' | null; // for levels: 'up' = rising (lower value), 'down' = falling (higher value)
}

const CHART_COLORS = [
  "hsl(220, 70%, 50%)",
  "hsl(340, 70%, 50%)",
  "hsl(120, 70%, 40%)",
  "hsl(40, 70%, 50%)",
  "hsl(280, 70%, 50%)",
  "hsl(180, 70%, 40%)",
];

/** Muted, lighter variant of a station color — used for that station's HYPE-area fyllnadsgrad line. */
const mutedColor = (hsl: string) => hsl.replace(/hsl\((\d+),\s*\d+%,\s*\d+%\)/, 'hsl($1, 45%, 68%)');

const QUALITY_PARAMETERS = [
  { value: "pH", label: "pH" },
  { value: "Konduktivitet", label: "Konduktivitet (mS/m)" },
  { value: "Alkalinitet", label: "Alkalinitet (mg/l)" },
  { value: "Klorid", label: "Klorid (mg/l)" },
  { value: "Sulfat", label: "Sulfat (mg/l)" },
  { value: "Nitrat", label: "Nitrat (mg/l)" },
  { value: "Järn", label: "Järn (µg/l)" },
  { value: "Mangan", label: "Mangan (µg/l)" },
  { value: "Kalcium", label: "Kalcium (mg/l)" },
  { value: "Magnesium", label: "Magnesium (mg/l)" },
  { value: "Natrium", label: "Natrium (mg/l)" },
  { value: "Kalium", label: "Kalium (mg/l)" },
  { value: "Fluorid", label: "Fluorid (mg/l)" },
  { value: "Arsenik", label: "Arsenik (µg/l)" },
  { value: "Uran", label: "Uran (µg/l)" },
];

export const ChartViewer = ({ initialLocation, locations, onLocationsChange, onClose }: ChartViewerProps) => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [stationStats, setStationStats] = useState<StationStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedParameter, setSelectedParameter] = useState("pH");
  const [availableQualityParameters, setAvailableQualityParameters] = useState<Array<{ value: string; label: string }>>([]);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const qualityCacheRef = useRef<Map<string, AnalysRow[]>>(new Map());
  const hypeSeriesCacheRef = useRef<Map<string, { omradeId: number; series: Array<{ ts: number; fyllSma: number | null; fyllStora: number | null }> } | null>>(new Map());
  const [modelKeys, setModelKeys] = useState<Set<string>>(new Set());
  const [fyllnadInfo, setFyllnadInfo] = useState<Map<string, { color: string; stations: string[]; magasin: 'sma' | 'stora' }>>(new Map());
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [hypeFits, setHypeFits] = useState<Map<string, HypeFit>>(new Map());
  const [chemFits, setChemFits] = useState<Map<string, ChemFit>>(new Map());
  const [censoredCount, setCensoredCount] = useState(0);

  const chartType = initialLocation.type;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.initialX + deltaX,
        y: dragRef.current.initialY + deltaY
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    fetchAllData();
  }, [locations, selectedParameter]);

  const fetchAllData = async () => {
    if (locations.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch observations and HYPE data in parallel (HYPE is used both for
      // the level model and for the chemistry transfer model)
      const [observationResults, hypeResults] = await Promise.all([
        Promise.all(
          locations.map(location =>
            (chartType === 'level'
              ? fetchLevelData(location)
              : fetchQualityData(location, selectedParameter)
            ).then(data => ({ location, data }))
          )
        ),
        Promise.all(
          locations.map(location =>
            location.lon != null && location.lat != null
              ? fetchHypeForLocation(location.lon, location.lat).catch(() => null)
              : Promise.resolve(null)
          )
        ),
      ]);

      const allData: Map<string, ChartData> = new Map();
      const newModelKeys = new Set<string>();
      const newHypeFits = new Map<string, HypeFit>();

      for (const { location, data } of observationResults) {
        for (const item of data) {
          const existing = allData.get(item.date) || { date: item.date, ts: new Date(item.date).getTime() };
          existing[location.name] = item.value;
          allData.set(item.date, existing);
        }
      }

      // Calibrate HYPE model against observations for each level station with coordinates
      if (chartType === 'level') {
        for (let i = 0; i < observationResults.length; i++) {
          const { location, data } = observationResults[i];
          const hyp = hypeResults[i];
          if (!hyp || hyp.series.length < 30 || data.length < 8) continue;

          const obs = data.map(d => ({ ts: new Date(d.date).getTime(), djup: d.value }));
          const fit = fitHypeToObservations(obs, hyp.series);
          if (!fit) continue;

          const modelKey = `${location.name} (modell)`;
          newModelKeys.add(modelKey);
          newHypeFits.set(modelKey, fit);

          // The model line covers the full HYPE record (back to the 1960s).
          // Daily resolution inside the observation window (gap filling),
          // weekly outside it to keep the chart responsive.
          const obsMinTs = Math.min(...obs.map(o => o.ts));
          const obsMaxTs = Math.max(...obs.map(o => o.ts)) + 30 * 86400000;
          let lastIncludedTs = -Infinity;

          for (const point of fit.series) {
            const inObsRange = point.ts >= obsMinTs && point.ts <= obsMaxTs;
            if (!inObsRange && point.ts - lastIncludedTs < 7 * 86400000) continue;
            lastIncludedTs = point.ts;
            const date = new Date(point.ts).toISOString().substring(0, 10);
            const existing = allData.get(date) || { date, ts: new Date(date).getTime() };
            existing[modelKey] = Math.round(point.niva * 100) / 100;
            allData.set(date, existing);
          }
        }
      }

      // Chemistry transfer model: regress the selected parameter against the
      // HYPE fyllnadsgrad of the provplats's area. Censored values ("<DL")
      // enter the calibration at half the detection limit.
      const newChemFits = new Map<string, ChemFit>();
      let nCensored = 0;
      if (chartType === 'quality') {
        for (let i = 0; i < observationResults.length; i++) {
          const { location, data } = observationResults[i];
          const hyp = hypeResults[i];
          nCensored += data.filter(d => d.censored).length;
          if (!hyp || hyp.series.length < 30 || data.length < 10) continue;

          const obs = data.map(d => ({
            ts: new Date(d.date).getTime(),
            v: d.censored ? d.value / 2 : d.value,
          }));
          const fit = fitChemToHype(obs, hyp.series, selectedParameter);
          if (!fit) continue;

          const modelKey = `${location.name} (modell)`;
          newModelKeys.add(modelKey);
          newChemFits.set(modelKey, fit);

          const obsMinTs = Math.min(...obs.map(o => o.ts));
          const obsMaxTs = Math.max(...obs.map(o => o.ts)) + 30 * 86400000;
          let lastIncludedTs = -Infinity;

          for (const point of fit.series) {
            const inObsRange = point.ts >= obsMinTs && point.ts <= obsMaxTs;
            if (!inObsRange && point.ts - lastIncludedTs < 7 * 86400000) continue;
            lastIncludedTs = point.ts;
            const date = new Date(point.ts).toISOString().substring(0, 10);
            const existing = allData.get(date) || { date, ts: new Date(date).getTime() };
            existing[modelKey] = Number(point.value.toPrecision(3));
            allData.set(date, existing);
          }
        }
      }

      // HYPE fyllnadsgrad (percentile 0-100, right Y axis) — two series per
      // unique HYPE area (sma + stora), labeled with the station names.
      const newFyllnadInfo = new Map<string, { color: string; stations: string[]; magasin: 'sma' | 'stora' }>();
      if (chartType === 'level') {
        const areaInfo = new Map<number, { series: NonNullable<typeof hypeResults[number]>['series']; stations: string[] }>();
        for (let i = 0; i < hypeResults.length; i++) {
          const hyp = hypeResults[i];
          if (!hyp || hyp.series.length === 0) continue;
          const name = observationResults[i].location.name;
          const prev = areaInfo.get(hyp.omradeId);
          if (prev) { prev.stations.push(name); continue; }
          areaInfo.set(hyp.omradeId, { series: hyp.series, stations: [name] });
        }

        let gMin = Infinity, gMax = -Infinity;
        for (const { data } of observationResults) {
          for (const d of data) {
            const t = new Date(d.date).getTime();
            if (t < gMin) gMin = t;
            if (t > gMax) gMax = t;
          }
        }
        gMax += 30 * 86400000;

        for (const { series, stations } of areaInfo.values()) {
          const idx = locations.findIndex(loc => loc.name === stations[0]);
          const base = CHART_COLORS[(idx >= 0 ? idx : 0) % CHART_COLORS.length];
          const color = mutedColor(base);
          const stLabel = stations.join(', ');

          for (const magasin of ['sma', 'stora'] as const) {
            const key = `Fyllnadsgrad HYPE ${magasin} (${stLabel})`;
            let last = -Infinity;
            let any = false;
            for (const p of series) {
              const v = magasin === 'sma' ? p.fyllSma : p.fyllStora;
              if (v == null) continue;
              const inObs = p.ts >= gMin && p.ts <= gMax;
              if (!inObs && p.ts - last < 7 * 86400000) continue;
              last = p.ts;
              const date = new Date(p.ts).toISOString().substring(0, 10);
              const existing = allData.get(date) || { date, ts: new Date(date).getTime() };
              existing[key] = v;
              allData.set(date, existing);
              any = true;
            }
            if (any) newFyllnadInfo.set(key, { color, stations, magasin });
          }
        }
      }

      setModelKeys(newModelKeys);
      setFyllnadInfo(newFyllnadInfo);
      setHypeFits(newHypeFits);
      setChemFits(newChemFits);
      setCensoredCount(nCensored);

      const sortedData = Array.from(allData.values())
        .sort((a, b) => a.ts - b.ts);

      setChartData(sortedData);
    } catch (err) {
      setError("Kunde inte hämta data. Försök igen senare.");
      console.error("Chart data fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHypeForLocation = async (lon: number, lat: number): Promise<{ omradeId: number; series: Array<{ ts: number; fyllSma: number | null; fyllStora: number | null }> } | null> => {
    const cacheKey = `${lon.toFixed(4)},${lat.toFixed(4)}`;
    if (hypeSeriesCacheRef.current.has(cacheKey)) return hypeSeriesCacheRef.current.get(cacheKey)!;

    const omradeUrl = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/omraden/items?f=json&filter=${encodeURIComponent(`S_INTERSECTS(geom,POINT(${lon} ${lat}))`)}&filter-lang=cql2-text&limit=1`;
    const omradeRes = await fetch(omradeUrl);
    if (!omradeRes.ok) { hypeSeriesCacheRef.current.set(cacheKey, null); return null; }
    const omradeData = await omradeRes.json();
    const omradeId: number | undefined = omradeData.features?.[0]?.properties?.omrade_id;
    if (typeof omradeId !== 'number') { hypeSeriesCacheRef.current.set(cacheKey, null); return null; }

    // HYPE goes back to the early 1960s; ~24 000 daily rows in total, so fetch
    // in parallel date chunks to stay well below the per-request row limit.
    const ymd = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const today = ymd(new Date());
    const ranges: Array<[string, string]> = [
      ['1960-01-01', '1979-12-31'],
      ['1980-01-01', '1999-12-31'],
      ['2000-01-01', '2014-12-31'],
      ['2015-01-01', today],
    ];
    const chunks = await Promise.all(ranges.map(async ([from, to]) => {
      const filter = `datum>='${from}' AND datum<='${to}' AND omrade_id=${omradeId}`;
      const hypeUrl = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/grundvattennivaer-tidigare/items?f=json&filter=${encodeURIComponent(filter)}&filter-lang=cql2-text&limit=10000`;
      const res = await fetch(hypeUrl);
      if (!res.ok) return [];
      const data = await res.json().catch(() => null);
      return (data?.features ?? []) as Array<{ properties?: Record<string, unknown> }>;
    }));

    const clean = (x: unknown): number | null => { const n = Number(x); return Number.isFinite(n) && n > 0 ? n : null; };
    const series = chunks.flat()
      .map((f: { properties?: Record<string, unknown> }) => {
        const p = f.properties ?? {};
        const datum = typeof p.datum === 'string' ? p.datum.substring(0, 10) : null;
        if (!datum) return null;
        const ts = new Date(datum).getTime();
        return Number.isFinite(ts) ? { ts, fyllSma: clean(p.fyllnadsgrad_sma), fyllStora: clean(p.fyllnadsgrad_stora) } : null;
      })
      .filter((x: unknown): x is { ts: number; fyllSma: number | null; fyllStora: number | null } => x !== null)
      .sort((a: { ts: number }, b: { ts: number }) => a.ts - b.ts);

    const result = { omradeId, series };
    hypeSeriesCacheRef.current.set(cacheKey, result);
    return result;
  };


  /** Minimal RFC 4180 CSV row parser – handles quoted fields with embedded commas/newlines. */
  const parseCSVRow = (line: string): string[] => {
    const cols: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    return cols;
  };

  /**
   * Fetch level data using the CSV endpoint.
   * One HTTP request returns all measurements, sorted chronologically.
   * Significantly faster than JSON pagination (5–10 requests → 1).
   */
  const fetchLevelData = async (location: ChartLocation): Promise<{ date: string; value: number; censored?: boolean }[]> => {
    const encodedId = encodeURIComponent(location.platsbeteckning || '').replace(/'/g, '%27');
    const url =
      `https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/nivaer/items` +
      `?filter=platsbeteckning%20%3D%20%27${encodedId}%27&sortby=obsdatum&f=text/csv`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();

    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = parseCSVRow(lines[0]);
    const dateCol  = headers.findIndex(h => h === 'obsdatum');
    const levelCol = headers.findIndex(h => h === 'grundvattenniva_m_u_markyta');
    const level2Col = headers.findIndex(h => h === 'grundvattenniva_m_urok');
    if (dateCol < 0) return [];
    const valCol = levelCol >= 0 ? levelCol : level2Col;
    if (valCol < 0) return [];

    return lines.slice(1).flatMap(line => {
      if (!line.trim()) return [];
      const cols = parseCSVRow(line);
      const date  = (cols[dateCol] ?? '').split('T')[0];
      const value = parseFloat((cols[valCol] ?? '').replace(',', '.'));
      if (!date || isNaN(value) || value === 0) return [];
      return [{ date, value }];
    });
  };

  const fetchQualityData = async (location: ChartLocation, parameter: string): Promise<{ date: string; value: number; censored?: boolean }[]> => {
    const nationelltProvplatsid = location.provplatsid;
    if (!nationelltProvplatsid) return [];

    let rows = qualityCacheRef.current.get(nationelltProvplatsid);
    if (!rows) {
      rows = await fetchAnalysCSV(nationelltProvplatsid);
      qualityCacheRef.current.set(nationelltProvplatsid, rows);

      const unique = Array.from(new Set(rows.map(r => r.parameternamn).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'sv'));
      const mapped = unique.map(p => {
        const known = QUALITY_PARAMETERS.find(kp => kp.value === p);
        return { value: p, label: known?.label ?? p };
      });
      if (mapped.length > 0) {
        setAvailableQualityParameters(mapped);
        if (!unique.includes(parameter)) setSelectedParameter(unique[0]);
      }
    }

    return rows
      .filter(r => r.parameternamn === parameter)
      .flatMap(r => {
        const censored = r.matvardetal.trim().startsWith('<');
        const raw = r.matvardetal.replace(/^\s*</, '').replace(/\s/g, '').replace(',', '.');
        const value = Number.parseFloat(raw);
        if (!r.datum || isNaN(value)) return [];
        return [{ date: r.datum, value, censored }];
      });
  };

  // Compute per-station statistics whenever chartData or locations change
  useEffect(() => {
    if (chartData.length === 0) { setStationStats([]); return; }
    const computed: StationStat[] = locations.map((loc, idx) => {
      const withValue = chartData.filter(d => d[loc.name] !== undefined && d[loc.name] !== null);
      if (withValue.length === 0) return null;
      const vals = withValue.map(d => d[loc.name] as number);
      const latestEntry = withValue[withValue.length - 1];
      // Trend: compare median of last 20% vs first 20%
      const slice = Math.max(1, Math.floor(vals.length * 0.2));
      const early = vals.slice(0, slice).reduce((a, b) => a + b, 0) / slice;
      const recent = vals.slice(-slice).reduce((a, b) => a + b, 0) / slice;
      const diff = recent - early;
      const trend: StationStat['trend'] = Math.abs(diff) < 0.1 ? 'flat'
        : chartType === 'level'
          ? (diff < 0 ? 'up' : 'down')   // level: lower value = higher water table = rising
          : (diff > 0 ? 'up' : 'down');
      return {
        name: loc.name,
        color: CHART_COLORS[idx % CHART_COLORS.length],
        antal: vals.length,
        latest: Math.round(latestEntry[loc.name] as number * 100) / 100,
        latestDate: latestEntry.date,
        min: Math.round(Math.min(...vals) * 100) / 100,
        max: Math.round(Math.max(...vals) * 100) / 100,
        trend,
      };
    }).filter(Boolean) as StationStat[];
    setStationStats(computed);
  }, [chartData, locations, chartType]);

  const removeLocation = (id: string) => {
    if (locations.length > 1) {
      onLocationsChange(locations.filter(l => l.id !== id));
    }
  };

  const toggleKey = (key: string) => {
    setHiddenKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const getYAxisLabel = () => {
    if (chartType === 'level') {
      return "Nivå under markyta (m)";
    }
    const known = QUALITY_PARAMETERS.find(p => p.value === selectedParameter);
    const fromApi = availableQualityParameters.find(p => p.value === selectedParameter);
    return known?.label || fromApi?.label || selectedParameter;
  };

  return (
    <Card
      className="fixed w-[min(700px,calc(100vw-1rem))] max-h-[calc(100vh-120px)] overflow-y-auto bg-card/95 backdrop-blur-sm shadow-lg border-border z-50"
      style={{ 
        top: `calc(80px + ${position.y}px)`, 
        left: `calc(50% + ${position.x}px)`,
        transform: 'translateX(-50%)',
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      <div 
        className="sticky top-0 bg-sgu-maroon border-b border-border p-4 flex items-center justify-between z-10 cursor-grab select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-4 w-4 text-white/60" />
          <h3 className="font-semibold text-lg text-white">
            {chartType === 'level' ? 'Grundvattennivå - Diagram' : 'Grundvattenkvalitet - Diagram'}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="h-8 w-8 p-0 text-white hover:bg-sgu-dark-maroon"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {chartType === 'quality' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Välj parameter</label>
            <Select value={selectedParameter} onValueChange={setSelectedParameter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Välj parameter" />
              </SelectTrigger>
              <SelectContent>
                {(availableQualityParameters.length > 0 ? availableQualityParameters : QUALITY_PARAMETERS).map(param => (
                  <SelectItem key={param.value} value={param.value}>
                    {param.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Parametrar från API: {availableQualityParameters.length > 0 ? `${availableQualityParameters.length} st (t.ex. ${availableQualityParameters.slice(0, 8).map(p => p.value).join(", ")}${availableQualityParameters.length > 8 ? "…" : ""})` : "(hämtas…)"}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Serier i diagrammet</label>
          <div className="flex flex-wrap gap-2">
            {locations.map((location, index) => {
              const color = CHART_COLORS[index % CHART_COLORS.length];
              const hidden = hiddenKeys.has(location.name);
              return (
                <div
                  key={location.id}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm ${hidden ? 'opacity-50' : ''}`}
                  style={{ backgroundColor: `${color}20`, borderColor: color, borderWidth: 1 }}
                >
                  <Checkbox
                    checked={!hidden}
                    onCheckedChange={() => toggleKey(location.name)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-foreground">{location.name}</span>
                  {locations.length > 1 && (
                    <button
                      onClick={() => removeLocation(location.id)}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
            {Array.from(modelKeys).map(modelKey => {
              const baseName = modelKey.replace(' (modell)', '');
              const idx = locations.findIndex(loc => loc.name === baseName);
              const color = idx >= 0 ? CHART_COLORS[idx % CHART_COLORS.length] : '#888';
              const hidden = hiddenKeys.has(modelKey);
              return (
                <div
                  key={modelKey}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm border border-dashed ${hidden ? 'opacity-50' : ''}`}
                  style={{ borderColor: color }}
                >
                  <Checkbox
                    checked={!hidden}
                    onCheckedChange={() => toggleKey(modelKey)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="w-4 border-t-2 border-dashed" style={{ borderColor: color }} />
                  <span className="text-foreground">{modelKey}</span>
                </div>
              );
            })}
            {Array.from(fyllnadInfo.entries()).map(([key, info]) => {
              const hidden = hiddenKeys.has(key);
              const isDashed = info.magasin === 'stora';
              return (
                <div
                  key={key}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm border ${isDashed ? 'border-dashed' : ''} ${hidden ? 'opacity-50' : ''}`}
                  style={{ borderColor: info.color }}
                >
                  <Checkbox
                    checked={!hidden}
                    onCheckedChange={() => toggleKey(key)}
                    className="h-3.5 w-3.5"
                  />
                  <span
                    className="w-4 border-t-2"
                    style={{ borderColor: info.color, borderStyle: isDashed ? 'dashed' : 'solid' }}
                  />
                  <span className="text-foreground">{key}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Tips: Klicka på en annan station på kartan och välj "Lägg till i diagram" för att jämföra. Kryssrutorna döljer/visar serier.
          </p>
        </div>

        <Separator />

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Hämtar mätdata{locations.length === 1 ? ` för ${locations[0].name}` : ` (${locations.length} stationer)`}…
            </span>
            {chartType === 'level' && (
              <span className="text-xs text-muted-foreground/70">Alla mätningar hämtas i ett anrop (CSV)</span>
            )}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-destructive">
            {error}
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Ingen data tillgänglig för vald parameter/plats
          </div>
        ) : (
          <div className="space-y-3">
            {/* Per-station statistics */}
            {stationStats.length > 0 && (
              <div className="space-y-2">
                {stationStats.map(s => (
                  <div
                    key={s.name}
                    className="rounded-lg border px-3 py-2 text-xs"
                    style={{ borderColor: s.color + '60', background: s.color + '10' }}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="font-semibold truncate">{s.name}</span>
                      <span className="text-muted-foreground ml-auto">{s.antal} mätningar</span>
                    </div>
                    <div className="grid grid-cols-3 gap-x-3 text-muted-foreground">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide">Senaste</span>
                        <span className="font-medium text-foreground">
                          {s.latest !== null ? `${s.latest} m` : '—'}
                          {s.trend === 'up' && <TrendingUp className="inline w-3 h-3 ml-0.5 text-blue-500" />}
                          {s.trend === 'down' && <TrendingDown className="inline w-3 h-3 ml-0.5 text-orange-500" />}
                          {s.trend === 'flat' && <Minus className="inline w-3 h-3 ml-0.5 text-muted-foreground" />}
                        </span>
                        <span className="block text-[10px]">{s.latestDate}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide">{chartType === 'level' ? 'Högst gv-yta' : 'Min'}</span>
                        <span className="font-medium text-foreground">{s.min !== null ? `${s.min} m` : '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide">{chartType === 'level' ? 'Lägst gv-yta' : 'Max'}</span>
                        <span className="font-medium text-foreground">{s.max !== null ? `${s.max} m` : '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Chart */}
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="ts"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    label={{
                      value: getYAxisLabel(),
                      angle: -90,
                      position: 'insideLeft',
                      dy: 50,
                      style: { fontSize: 10 }
                    }}
                    width={55}
                    className="text-muted-foreground"
                    reversed={chartType === 'level'}
                    domain={['auto', 'auto']}
                  />
                  {fyllnadInfo.size > 0 && (
                    <YAxis
                      yAxisId="fyllnad"
                      orientation="right"
                      domain={[0, 100]}
                      tick={{ fontSize: 10 }}
                      width={32}
                      label={{
                        value: 'Fyllnadsgrad (%)',
                        angle: 90,
                        position: 'insideRight',
                        dy: -40,
                        style: { fontSize: 9 }
                      }}
                      className="text-muted-foreground"
                    />
                  )}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelFormatter={(value) => `Datum: ${new Date(value).toISOString().substring(0, 10)}`}
                    formatter={(value: number, name: string) => [
                      name.startsWith('Fyllnadsgrad')
                        ? `${value} % (percentil)`
                        : `${value} ${chartType === 'level' ? 'm u. markyta' : ''}`,
                      name
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  {locations.map((location, index) => (
                    <Line
                      key={location.id}
                      type="linear"
                      dataKey={location.name}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={1.5}
                      dot={chartData.length < 200 ? { r: 2 } : false}
                      connectNulls={false}
                      hide={hiddenKeys.has(location.name)}
                    />
                  ))}
                  {/* Dashed HYPE-calibrated model lines — one per observed station.
                      Opacity is graded by validation confidence. */}
                  {Array.from(modelKeys).map(modelKey => {
                    const baseName = modelKey.replace(' (modell)', '');
                    const idx = locations.findIndex(loc => loc.name === baseName);
                    const color = idx >= 0 ? CHART_COLORS[idx % CHART_COLORS.length] : '#888';
                    const conf = (hypeFits.get(modelKey) ?? chemFits.get(modelKey))?.confidence ?? 'low';
                    const lineOpacity = conf === 'high' ? 0.8 : conf === 'medium' ? 0.55 : 0.35;
                    return (
                      <Line
                        key={modelKey}
                        type="monotone"
                        dataKey={modelKey}
                        stroke={color}
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        dot={false}
                        connectNulls={true}
                        opacity={lineOpacity}
                        hide={hiddenKeys.has(modelKey)}
                      />
                    );
                  })}
                  {/* HYPE fyllnadsgrad (percentile) on the right axis, muted station color.
                      sma = solid, stora = dashed */}
                  {Array.from(fyllnadInfo.entries()).map(([key, info]) => (
                    <Line
                      key={key}
                      yAxisId="fyllnad"
                      type="monotone"
                      dataKey={key}
                      stroke={info.color}
                      strokeWidth={1}
                      strokeDasharray={info.magasin === 'stora' ? '4 3' : undefined}
                      dot={false}
                      connectNulls={true}
                      opacity={0.6}
                      hide={hiddenKeys.has(key)}
                    />
                  ))}
                  <Brush
                    dataKey="ts"
                    height={28}
                    stroke="hsl(var(--border))"
                    fill="hsl(var(--muted))"
                    tickFormatter={(value) => new Date(value).getFullYear().toString()}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {chartType === 'level' && (
              <p className="text-xs text-muted-foreground text-center">
                Y-axeln är inverterad: lägre värde = grundvatten närmare markytan. Dra i det nedre fältet för att zooma.
              </p>
            )}
            {fyllnadInfo.size > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Tunna linjer i dämpad färg: SGU-HYPE fyllnadsgrad för respektive stations HYPE-område (höger axel, percentil 0–100 mot 1961–idag; 25–75 = normalt). Heldragen = små magasin, streckad = stora magasin. Etiketten anger vilka stationer området representerar.
              </p>
            )}
            {hypeFits.size > 0 && (
              <div className="text-xs text-muted-foreground text-center space-y-0.5">
                <p>Streckad linje: HYPE-kalibrerad modellnivå (Pastas-metod, exponentiell kärna) — fyller luckor mellan observationer och sträcker sig tillbaka till HYPE-seriens start på 1960-talet. Linjens styrka speglar tillförlitligheten.</p>
                {Array.from(hypeFits.entries()).map(([key, fit]) => (
                  <p key={key}>
                    {key}: R²={fit.r2.toFixed(2)}
                    {fit.valR2 != null && <>, validerings-R²={fit.valR2.toFixed(2)}</>}
                    , RMSE={fit.rmse.toFixed(2)} m, minne={fit.memoryDays} d ({fit.source}
                    , tillförlitlighet: {fit.confidence === 'high' ? 'hög' : fit.confidence === 'medium' ? 'medel' : 'låg'})
                  </p>
                ))}
              </div>
            )}
            {chemFits.size > 0 && (
              <div className="text-xs text-muted-foreground text-center space-y-0.5">
                <p>
                  Streckad linje: modellerad halt utifrån SGU-HYPE fyllnadsgrad (samma Pastas-metod som nivåmodellen, med trendterm) — fyller luckor mellan provtagningar.
                  Modellen interpolerar inom observerat intervall och fångar inte regimskiften (t.ex. redoxomslag) utanför historiskt spann.
                </p>
                {Array.from(chemFits.entries()).map(([key, fit]) => (
                  <p key={key}>
                    {key}: R²={fit.r2.toFixed(2)}
                    {fit.valR2 != null && <>, validerings-R²={fit.valR2.toFixed(2)}</>}
                    {fit.logTransform
                      ? <>, typiskt fel ±{Math.round((Math.exp(fit.rmse) - 1) * 100)} %</>
                      : <>, RMSE={fit.rmse.toFixed(2)}</>}
                    , minne={fit.memoryDays} d ({fit.source}, {PARAM_CLASS_LABEL[fit.paramClass]}
                    {fit.logTransform ? ', log-skala' : ''}
                    , tillförlitlighet: {fit.confidence === 'high' ? 'hög' : fit.confidence === 'medium' ? 'medel' : 'låg'})
                  </p>
                ))}
                {censoredCount > 0 && (
                  <p>{censoredCount} värden under detektionsgräns har satts till halva gränsen i kalibreringen.</p>
                )}
              </div>
            )}
            {chartType === 'quality' && chemFits.size === 0 && chartData.length > 0 &&
              locations.some(l => l.lon != null && l.lat != null) && (
              <p className="text-xs text-muted-foreground text-center">
                Ingen modellinje visas för {selectedParameter}: sambandet med grundvattennivån (HYPE) är för svagt på denna plats, eller för få prov — vanligt för redoxkänsliga parametrar.
              </p>
            )}
          </div>
        )}

      </div>
    </Card>
  );
};
