import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Trash2, Loader2, ExternalLink, GripHorizontal, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from "recharts";
import { Separator } from "@/components/ui/separator";

interface ChartLocation {
  id: string;
  name: string;
  type: 'level' | 'quality';
  platsbeteckning?: string;
  provplatsid?: string;
}

interface ChartViewerProps {
  initialLocation: ChartLocation;
  locations: ChartLocation[];
  onLocationsChange: (locations: ChartLocation[]) => void;
  onClose: () => void;
}

interface ChartData {
  date: string;
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
      const allData: Map<string, ChartData> = new Map();
      
      for (const location of locations) {
        const data = chartType === 'level' 
          ? await fetchLevelData(location)
          : await fetchQualityData(location, selectedParameter);
        
        for (const item of data) {
          const existing = allData.get(item.date) || { date: item.date };
          existing[location.name] = item.value;
          allData.set(item.date, existing);
        }
      }
      
      const sortedData = Array.from(allData.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setChartData(sortedData);
    } catch (err) {
      setError("Kunde inte hämta data. Försök igen senare.");
      console.error("Chart data fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to fetch all pages from OGC API
  const fetchAllPages = async (baseUrl: string): Promise<any[]> => {
    const allFeatures: any[] = [];
    let nextUrl: string | null = `${baseUrl}&limit=1000`;

    while (nextUrl) {
      const response = await fetch(nextUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (data.features) {
        allFeatures.push(...data.features);
      }

      // Check for next page link
      nextUrl = null;
      if (data.links) {
        const nextLink = data.links.find((l: any) => l.rel === 'next');
        if (nextLink) {
          nextUrl = nextLink.href;
        }
      }
    }

    return allFeatures;
  };

  // NOTE: encodeURIComponent does NOT encode apostrophes (') which SGU's OGC API examples use as %27.
  const encodeOgcFilter = (filter: string) => encodeURIComponent(filter).replace(/'/g, "%27");

  const fetchLevelData = async (location: ChartLocation): Promise<{ date: string; value: number }[]> => {
    const baseUrl = `https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/nivaer/items?filter=platsbeteckning%20%3D%20%27${encodeURIComponent(location.platsbeteckning || '')}%27&f=json`;
    
    console.log("Fetching all level data for:", location.platsbeteckning);
    const allFeatures = await fetchAllPages(baseUrl);
    console.log("Level data received:", allFeatures.length, "measurements for", location.platsbeteckning);
    
    return allFeatures.map((f: any) => ({
      date: f.properties.obsdatum?.split('T')[0] || '',
      value: f.properties.grundvattenniva_m_u_markyta ?? f.properties.grundvattenniva_m_urok ?? 0
    })).filter((d: any) => d.date && d.value !== null && d.value !== 0);
  };

  const fetchQualityData = async (location: ChartLocation, parameter: string): Promise<{ date: string; value: number }[]> => {
    // API v2 uses nationellt_provplatsid as the key between provplatser and analysresultat
    const nationelltProvplatsid = location.provplatsid;
    const locationName = location.name;

    if (!nationelltProvplatsid) {
      console.warn("No nationellt_provplatsid available for location:", locationName);
      return [];
    }

    // Build filter using nationellt_provplatsid (integer in v2)
    const siteClause = `nationellt_provplatsid = ${nationelltProvplatsid}`;

    // Populate parameter dropdown from real API values
    // API v2 uses 'parameternamn' instead of 'parameter'
    if (availableQualityParameters.length === 0) {
      const paramsUrl = `https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/analysresultat/items?f=json&limit=1000&filter=${encodeOgcFilter(siteClause)}`;
      try {
        const resp = await fetch(paramsUrl);
        if (resp.ok) {
          const json = await resp.json();
          const features = json.features || [];
          const unique = Array.from(
            new Set<string>(
              features
                .map((f: any) => String(f?.properties?.parameternamn ?? "").trim())
                .filter(Boolean)
            )
          ).sort((a: string, b: string) => a.localeCompare(b, "sv"));

          const mapped: Array<{ value: string; label: string }> = unique.map((p: string) => {
            const known = QUALITY_PARAMETERS.find((kp) => kp.value === p);
            return { value: p, label: known?.label ?? p };
          });

          if (mapped.length > 0) {
            setAvailableQualityParameters(mapped);
            if (!unique.includes(parameter)) {
              setSelectedParameter(unique[0]);
            }
          }
        }
      } catch (e) {
        // Non-fatal – chart can still load using current selection
        console.warn("Failed to build parameter list for quality chart", e);
      }
    }

    // API v2 uses 'parameternamn' instead of 'parameter'
    const filter = `${siteClause} AND parameternamn = '${parameter}'`;
    const baseUrl = `https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/analysresultat/items?f=json&filter=${encodeOgcFilter(filter)}`;

    console.log("Fetching quality data (v2) from:", baseUrl);
    const allFeatures = await fetchAllPages(baseUrl);
    console.log("Quality data received:", allFeatures.length, "features for", locationName, "parameter", parameter);

    return allFeatures
      .map((f: any) => {
        const raw = String(f?.properties?.matvardetal ?? "").trim();
        const normalizedNumber = raw
          .replace(/^</, "") // handle values like "<0,1"
          .replace(/\s/g, "")
          .replace(",", ".");

        return {
          // API v2 uses 'provtagningsdatum' instead of 'provdat'
          date: f?.properties?.provtagningsdatum?.split("T")[0] || "",
          value: Number.parseFloat(normalizedNumber)
        };
      })
      .filter((d: any) => d.date && d.value !== null && !Number.isNaN(d.value));
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
          <label className="text-sm font-medium text-foreground">Platser i diagrammet</label>
          <div className="flex flex-wrap gap-2">
            {locations.map((location, index) => (
              <div 
                key={location.id}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-sm"
                style={{ backgroundColor: `${CHART_COLORS[index % CHART_COLORS.length]}20`, borderColor: CHART_COLORS[index % CHART_COLORS.length], borderWidth: 1 }}
              >
                <span 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                />
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
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Tips: Klicka på en annan station på kartan och välj "Lägg till i diagram" för att jämföra
          </p>
        </div>

        <Separator />

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Hämtar data...</span>
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
                        <span className="block text-[10px] uppercase tracking-wide">{chartType === 'level' ? 'Grundast' : 'Min'}</span>
                        <span className="font-medium text-foreground">{s.min !== null ? `${s.min} m` : '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide">{chartType === 'level' ? 'Högst GV' : 'Max'}</span>
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
                    dataKey="date"
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
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelFormatter={(value) => `Datum: ${value}`}
                    formatter={(value: number, name: string) => [
                      `${value} ${chartType === 'level' ? 'm u. markyta' : ''}`,
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
                    />
                  ))}
                  <Brush
                    dataKey="date"
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
          </div>
        )}

      </div>
    </Card>
  );
};
