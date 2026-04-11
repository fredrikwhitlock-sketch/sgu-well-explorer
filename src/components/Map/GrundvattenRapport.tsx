import { useEffect, useState, useRef, useCallback } from "react";
import { X, Droplets, Loader2, MapPin, AlertCircle, RefreshCw } from "lucide-react";
import proj4 from "proj4";

interface Props {
  coordinate: [number, number]; // Web Mercator EPSG:3857
  wmsProxyUrl: string;
  onClose: () => void;
}

interface BrunnInfo {
  id: string;
  kapacitet_lh?: number;
  djup?: number;
}

interface ReportData {
  lon: number;
  lat: number;
  sweref: [number, number];
  // HYPE
  omradeId?: number;
  hypoDate?: string;
  fyllnadsgradSma?: number | null;
  fyllnadsgradStora?: number | null;
  sitSma?: number | null;
  sitStora?: number | null;
  // GV Tillgång (l/dygn/ha)
  gvTillgangLdha?: number | null;
  // Jordart
  jordartNamn?: string;
  // GV Förekomst
  gvForekomstNamn?: string;
  gvForekomstEuKod?: string;
  // Nearby brunnar with kapacitet
  brunnar?: BrunnInfo[];
}

function mercatorToWGS84(x: number, y: number): [number, number] {
  const lon = (x / 20037508.34) * 180;
  const lat = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
  return [lon, lat];
}

function fyllnadLabel(v: number | null | undefined): string {
  if (v === null || v === undefined || v === -1) return "Ingen data";
  if (v < 10) return "Mycket låg";
  if (v < 25) return "Låg";
  if (v < 75) return "Normal";
  if (v < 90) return "Hög";
  return "Mycket hög";
}

function fyllnadColor(v: number | null | undefined): string {
  if (v === null || v === undefined || v === -1) return "text-muted-foreground";
  if (v < 10) return "text-red-700 dark:text-red-400";
  if (v < 25) return "text-orange-600 dark:text-orange-400";
  if (v < 75) return "text-yellow-700 dark:text-yellow-400";
  if (v < 90) return "text-green-600 dark:text-green-400";
  return "text-green-800 dark:text-green-300";
}

function fyllnadBg(v: number | null | undefined): string {
  if (v === null || v === undefined || v === -1) return "bg-secondary/40";
  if (v < 10) return "bg-red-50 dark:bg-red-950/30";
  if (v < 25) return "bg-orange-50 dark:bg-orange-950/30";
  if (v < 75) return "bg-yellow-50 dark:bg-yellow-950/30";
  if (v < 90) return "bg-green-50 dark:bg-green-950/30";
  return "bg-green-100 dark:bg-green-900/30";
}

export const GrundvattenRapport = ({ coordinate, wmsProxyUrl, onClose }: Props) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Drag state
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startLeft: 80, startTop: 80 });
  const [position, setPosition] = useState({ left: 80, top: 80 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: position.left,
      startTop: position.top,
    };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({ left: dragRef.current.startLeft + dx, top: dragRef.current.startTop + dy });
    };
    const onUp = () => { dragRef.current.dragging = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
        const [lon, lat] = mercatorToWGS84(coordinate[0], coordinate[1]);
        const sweref = proj4('EPSG:4326', 'EPSG:3006', [lon, lat]) as [number, number];

        const today = selectedDate;
        const delta = 0.002; // ~200m around point for GFI + omrade
        const deltaBbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
        const brunnarDelta = 0.15; // ~15km for nearby brunnar
        const brunnarBbox = `${lon - brunnarDelta},${lat - brunnarDelta},${lon + brunnarDelta},${lat + brunnarDelta}`;

        // Build WMS GetFeatureInfo URL helper
        const gfiUrl = (wmsUrl: string, layer: string) => {
          const bbox = deltaBbox;
          return `${wmsProxyUrl}?url=${encodeURIComponent(wmsUrl)}&LAYERS=${encodeURIComponent(layer)}&VERSION=1.1.1&SERVICE=WMS&REQUEST=GetFeatureInfo&QUERY_LAYERS=${encodeURIComponent(layer)}&INFO_FORMAT=application%2Fjson&BBOX=${bbox}&SRS=EPSG:4326&WIDTH=101&HEIGHT=101&X=50&Y=50`;
        };

        // Parallel fetch all sources
        const [hypoRes, gvTillgangRes, jordartRes, forekomstRes, brunnarRes] = await Promise.allSettled([
          fetch(`https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/omraden/items?f=json&bbox=${deltaBbox}&limit=1`),
          fetch(gfiUrl('https://api.sgu.se/oppnadata/grundvattentillgang-sma-magasin/wms', 'grundvattentillgang-sma-magasin')),
          fetch(gfiUrl('https://maps3.sgu.se/geoserver/jord/ows', 'jord:SE.GOV.SGU.JORD.GRUNDLAGER.25K')),
          fetch(`https://api.sgu.se/oppnadata/grundvattenforekomster-eu/ogc/features/v1/collections/grundvattenforekomster/items?f=json&bbox=${deltaBbox}&limit=5`),
          fetch(`https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items?f=json&bbox=${brunnarBbox}&limit=50`),
        ]);

        const result: ReportData = { lon, lat, sweref };

        // 1. HYPE omrade + level
        let omradeId: number | undefined;
        if (hypoRes.status === 'fulfilled' && hypoRes.value.ok) {
          try {
            const d = await hypoRes.value.json();
            if (d.features?.length > 0) {
              omradeId = d.features[0].properties.omrade_id;
              result.omradeId = omradeId;
            }
          } catch { /* ignore */ }
        }

        if (omradeId !== undefined) {
          // Try today's date first
          const levelUrl = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/grundvattennivaer-tidigare/items?f=json&filter=${encodeURIComponent(`omrade_id=${omradeId} AND datum='${today}'`)}&limit=1`;
          try {
            const levelRes = await fetch(levelUrl);
            if (levelRes.ok) {
              const levelData = await levelRes.json();
              if (levelData.features?.length > 0) {
                const p = levelData.features[0].properties;
                result.hypoDate = p.datum;
                result.fyllnadsgradSma = p.fyllnadsgrad_sma;
                result.fyllnadsgradStora = p.fyllnadsgrad_stora;
                result.sitSma = p.grundvattensituation_sma;
                result.sitStora = p.grundvattensituation_stora;
              } else {
                // Fallback: fetch most recent record (no date filter)
                const fallbackUrl = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/grundvattennivaer-tidigare/items?f=json&filter=${encodeURIComponent(`omrade_id=${omradeId}`)}&limit=1`;
                const fallbackRes = await fetch(fallbackUrl);
                if (fallbackRes.ok) {
                  const fallbackData = await fallbackRes.json();
                  if (fallbackData.features?.length > 0) {
                    const p = fallbackData.features[0].properties;
                    result.hypoDate = p.datum;
                    result.fyllnadsgradSma = p.fyllnadsgrad_sma;
                    result.fyllnadsgradStora = p.fyllnadsgrad_stora;
                    result.sitSma = p.grundvattensituation_sma;
                    result.sitStora = p.grundvattensituation_stora;
                  }
                }
              }
            }
          } catch { /* ignore */ }
        }

        // 2. GV Tillgång (l/dygn/ha)
        if (gvTillgangRes.status === 'fulfilled' && gvTillgangRes.value.ok) {
          try {
            const d = await gvTillgangRes.value.json();
            if (d.features?.length > 0) {
              result.gvTillgangLdha = d.features[0].properties?.GRAY_INDEX ?? null;
            }
          } catch { /* ignore */ }
        }

        // 3. Jordart
        if (jordartRes.status === 'fulfilled' && jordartRes.value.ok) {
          try {
            const d = await jordartRes.value.json();
            if (d.features?.length > 0) {
              const p = d.features[0].properties ?? {};
              result.jordartNamn = p.JORDART || p.jordart || p.BETECKNING || p.beteckning || p.JORDART_TEXT || p.jordart_text;
            }
          } catch { /* ignore */ }
        }

        // 4. GV Förekomster
        if (forekomstRes.status === 'fulfilled' && forekomstRes.value.ok) {
          try {
            const d = await forekomstRes.value.json();
            if (d.features?.length > 0) {
              const p = d.features[0].properties ?? {};
              result.gvForekomstNamn = p.namn || p.name || p.forekomstnamn || p.NAMN;
              result.gvForekomstEuKod = p.eu_kod || p.eu_code || p.eukod || p.EU_KOD;
            }
          } catch { /* ignore */ }
        }

        // 5. Nearby brunnar with kapacitet
        if (brunnarRes.status === 'fulfilled' && brunnarRes.value.ok) {
          try {
            const d = await brunnarRes.value.json();
            if (d.features?.length > 0) {
              result.brunnar = d.features
                .filter((f: any) => f.properties?.kapacitet_lh != null && f.properties.kapacitet_lh > 0)
                .slice(0, 8)
                .map((f: any) => ({
                  id: f.properties?.brunnsid || f.properties?.id || f.id || '?',
                  kapacitet_lh: f.properties?.kapacitet_lh,
                  djup: f.properties?.borrhalsdjup ?? f.properties?.djup,
                }));
            }
          } catch { /* ignore */ }
        }

        setData(result);
      } catch (e) {
        console.error("GrundvattenRapport error:", e);
        setError("Kunde inte hämta data. Kontrollera din internetanslutning.");
      } finally {
        setLoading(false);
      }
  }, [coordinate, wmsProxyUrl, selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div
      className="absolute z-30 bg-card shadow-xl border border-border rounded-xl overflow-hidden flex flex-col"
      style={{ left: position.left, top: position.top, width: 380, maxHeight: '80vh' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-sgu-maroon text-white cursor-move select-none shrink-0"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4" />
          <span className="font-semibold text-sm">Grundvattenanalys</span>
        </div>
        <button onClick={onClose} className="hover:bg-white/20 rounded p-0.5 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Date selector */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/30 shrink-0">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Datum (HYPE):</span>
        <input
          type="date"
          value={selectedDate}
          min="1961-01-01"
          onChange={e => setSelectedDate(e.target.value)}
          className="flex-1 text-xs bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sgu-maroon"
        />
        <button
          onClick={() => fetchData()}
          disabled={loading}
          className="shrink-0 p-1.5 rounded hover:bg-secondary transition-colors disabled:opacity-50"
          title="Uppdatera"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span className="text-sm">Hämtar grundvattendata...</span>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 p-4 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : data ? (
          <div className="p-4 space-y-4 text-sm">

            {/* Coordinates */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Koordinater</span>
              </div>
              <div className="text-xs space-y-0.5 text-foreground">
                <div>WGS84: {data.lat.toFixed(5)}°N, {data.lon.toFixed(5)}°E</div>
                <div className="text-muted-foreground">SWEREF99 TM: {Math.round(data.sweref[0])} E, {Math.round(data.sweref[1])} N</div>
              </div>
            </div>

            <hr className="border-border" />

            {/* HYPE Grundvattennivåer */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Beräknade grundvattennivåer (SGU-HYPE)
              </h3>
              {data.omradeId !== undefined ? (
                <>
                  <div className="text-xs text-muted-foreground mb-2">
                    Område {data.omradeId}
                    {data.hypoDate ? ` · ${data.hypoDate}` : ''}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Fyllnadsgrad\nSmå magasin', val: data.fyllnadsgradSma },
                      { label: 'Fyllnadsgrad\nStora magasin', val: data.fyllnadsgradStora },
                    ].map(({ label, val }) => (
                      <div key={label} className={`rounded-lg p-2.5 ${fyllnadBg(val)}`}>
                        <div className="text-xs text-muted-foreground mb-1 whitespace-pre-line leading-tight">{label}</div>
                        {val !== null && val !== undefined ? (
                          <>
                            <div className={`text-xl font-bold leading-none ${fyllnadColor(val)}`}>
                              {Math.round(val)}<span className="text-xs font-normal text-muted-foreground">:e perc.</span>
                            </div>
                            <div className={`text-xs mt-1 font-medium ${fyllnadColor(val)}`}>{fyllnadLabel(val)}</div>
                          </>
                        ) : (
                          <div className="text-xs text-muted-foreground">Ingen data</div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">Ingen HYPE-data tillgänglig för denna punkt</div>
              )}
            </div>

            <hr className="border-border" />

            {/* GV Tillgång */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Grundvattentillgång – bergborrad brunn
              </h3>
              {data.gvTillgangLdha !== null && data.gvTillgangLdha !== undefined ? (
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 leading-none">
                    {Math.round(data.gvTillgangLdha / 24)}
                    <span className="text-sm font-normal text-blue-600 dark:text-blue-300"> l/h/ha</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {Math.round(data.gvTillgangLdha)} l/dygn/ha · Raster 1:1M
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Ingen data tillgänglig</div>
              )}
            </div>

            {/* Jordart */}
            {data.jordartNamn && (
              <>
                <hr className="border-border" />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Jordart (1:25k–100k)</h3>
                  <div className="font-medium">{data.jordartNamn}</div>
                </div>
              </>
            )}

            {/* GV Förekomst */}
            {(data.gvForekomstNamn || data.gvForekomstEuKod) && (
              <>
                <hr className="border-border" />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Grundvattenförekomst (EU)
                  </h3>
                  {data.gvForekomstNamn && <div className="font-medium">{data.gvForekomstNamn}</div>}
                  {data.gvForekomstEuKod && <div className="text-xs text-muted-foreground mt-0.5">{data.gvForekomstEuKod}</div>}
                </div>
              </>
            )}

            {/* Brunnar i närheten */}
            {data.brunnar && data.brunnar.length > 0 && (
              <>
                <hr className="border-border" />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Brunnar med kapacitet i närheten
                  </h3>
                  <div className="space-y-1.5">
                    {data.brunnar.map((b, i) => (
                      <div key={i} className="flex items-center justify-between bg-secondary/30 rounded px-2.5 py-1.5 text-xs">
                        <div>
                          <span className="font-medium">{b.id}</span>
                          {b.djup != null && <span className="text-muted-foreground ml-2">{b.djup} m djup</span>}
                        </div>
                        <div className="font-semibold text-blue-700 dark:text-blue-400 ml-2 shrink-0">{b.kapacitet_lh} l/h</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5">
                    Inom ca 15 km · {data.brunnar.length} brunnar med kapacitetsdata
                  </div>
                </div>
              </>
            )}

            {/* Footer note */}
            <div className="text-xs text-muted-foreground pt-1 border-t border-border">
              Källa: SGU OGC API, SGU WMS, Lantmäteriet
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
