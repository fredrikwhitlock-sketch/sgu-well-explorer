import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Trash2, Loader2, ExternalLink, GripHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush, ReferenceArea } from "recharts";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedParameter, setSelectedParameter] = useState("pH");
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

  const fetchLevelData = async (location: ChartLocation): Promise<{ date: string; value: number }[]> => {
    const baseUrl = `https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/nivaer/items?filter=platsbeteckning%20%3D%20%27${encodeURIComponent(location.platsbeteckning || '')}%27&f=json`;
    
    console.log("Fetching all level data for:", location.platsbeteckning);
    const allFeatures = await fetchAllPages(baseUrl);
    console.log("Level data received:", allFeatures.length, "measurements for", location.platsbeteckning);
    
    return allFeatures.map((f: any) => ({
      date: f.properties.obsdatum?.split('T')[0] || '',
      value: f.properties.grundvattenniva_m_urok || f.properties.grundvattenniva_m_u_markyta || 0
    })).filter((d: any) => d.date && d.value !== null && d.value !== 0);
  };

  const fetchQualityData = async (location: ChartLocation, parameter: string): Promise<{ date: string; value: number }[]> => {
    // Use platsbeteckning for filtering - match exact working URL format
    const platsbeteckning = location.name;
    const baseUrl = `https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser/ogc/features/v1/collections/analysresultat/items?f=json&filter=platsbeteckning=%27${encodeURIComponent(platsbeteckning)}%27`;
    
    console.log("Fetching all quality data for:", platsbeteckning);
    const allFeatures = await fetchAllPages(baseUrl);
    console.log("Quality data received:", allFeatures.length, "features for", platsbeteckning);
    
    // Filter by parameter client-side
    return allFeatures
      .filter((f: any) => f.properties.parameter === parameter)
      .map((f: any) => ({
        date: f.properties.provdat?.split('T')[0] || '',
        value: parseFloat(f.properties.matvardetal) || 0
      }))
      .filter((d: any) => d.date && d.value !== null && !isNaN(d.value));
  };

  const removeLocation = (id: string) => {
    if (locations.length > 1) {
      onLocationsChange(locations.filter(l => l.id !== id));
    }
  };

  const getYAxisLabel = () => {
    if (chartType === 'level') {
      return "Nivå under ref (m)";
    }
    const param = QUALITY_PARAMETERS.find(p => p.value === selectedParameter);
    return param?.label || selectedParameter;
  };

  return (
    <Card 
      className="fixed md:w-[700px] max-h-[calc(100vh-120px)] overflow-y-auto bg-card/95 backdrop-blur-sm shadow-lg border-border z-50"
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
                {QUALITY_PARAMETERS.map(param => (
                  <SelectItem key={param.value} value={param.value}>
                    {param.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div className="space-y-2">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
                      style: { fontSize: 11 }
                    }}
                    className="text-muted-foreground"
                    reversed={chartType === 'level'}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelFormatter={(value) => `Datum: ${value}`}
                  />
                  <Legend />
                  {locations.map((location, index) => (
                    <Line
                      key={location.id}
                      type="monotone"
                      dataKey={location.name}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={chartData.length < 100}
                      connectNulls
                    />
                  ))}
                  <Brush 
                    dataKey="date" 
                    height={30} 
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--muted))"
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getFullYear()}`;
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Dra i urvalsområdet nedan för att zooma in på en tidsperiod
            </p>
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <div className="text-xs font-semibold text-foreground">Ytterligare analyser</div>
          <a 
            href="https://ground-chem-dash.lovable.app/"
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1"
          >
            Öppna statistikverktyg för mer avancerade analyser <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </Card>
  );
};
