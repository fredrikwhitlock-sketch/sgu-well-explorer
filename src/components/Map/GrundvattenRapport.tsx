import { useEffect, useState, useRef, useCallback } from "react";
import { X, Droplets, Loader2, MapPin, AlertCircle, RefreshCw, Info } from "lucide-react";
import proj4 from "proj4";
import { getSoilTypeColor } from "../../lib/soilTypeColors";

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
  omradeId?: number;
  hypoDate?: string;
  fyllnadsgradSma?: number | null;
  fyllnadsgradStora?: number | null;
  sitSma?: number | null;
  sitStora?: number | null;
  gvTillgangLdha?: number | null;
  jordartNamn?: string;
  jordartKod?: string;
  gvForekomstNamn?: string;
  gvForekomstEuKod?: string;
  brunnar?: BrunnInfo[];
}

// ── Aquifer classification ────────────────────────────────────────────────────

type AquiferType = 'porous-fine' | 'porous-coarse' | 'till' | 'rock' | 'confining' | 'unknown';

interface AquiferClass {
  type: AquiferType;
  label: string;
  depthMin: number; // typical depth to water table, m below surface
  depthMax: number;
  capacityLabel: string; // qualitative capacity description
  useStoraMagasin: boolean; // use stora vs sma HYPE layer
}

function classifyAquifer(jordart: string | undefined): AquiferClass {
  if (!jordart) return {
    type: 'unknown', label: 'Okänd jordart',
    depthMin: 2, depthMax: 15,
    capacityLabel: 'Okänd', useStoraMagasin: false,
  };

  // Normalise: uppercase, trim, take first token
  const j = jordart.trim().toUpperCase();

  // Coarse porous (sand, grus) – excellent shallow aquifer
  if (/^(GR|GV|SA|S\b|MO\b|MO,|SAND|GRUS|KLARJORD)/.test(j) ||
      j.includes('SAND') || j.includes('GRUS') || j.includes('KLARJORD')) {
    return {
      type: 'porous-coarse', label: 'Sand/grus – poröst magasin',
      depthMin: 0.5, depthMax: 4,
      capacityLabel: '500–10 000 l/h (grävd/borrad infiltrationsbrunn)',
      useStoraMagasin: true,
    };
  }

  // Fine-grained porous (finmo, mjäla) – poor to moderate
  if (/^(MO\.|FMO|MJÄLA|FINMO|SI\b|SIL)/.test(j) || j.includes('MJÄLA') || j.includes('FINMO')) {
    return {
      type: 'porous-fine', label: 'Finmo/mjäla – svagt poröst magasin',
      depthMin: 1, depthMax: 8,
      capacityLabel: '50–500 l/h',
      useStoraMagasin: false,
    };
  }

  // Clay / silt – confining layer, not an aquifer itself
  if (/^(LE|LER|LERA|SILT|VARV)/.test(j) || j.includes('LERA') || j.includes('SILT')) {
    return {
      type: 'confining', label: 'Lera/silt – täckande lager',
      depthMin: 5, depthMax: 30,
      capacityLabel: 'Ej lämpligt för ytlig brunn; tätande lager kan dölja djupare magasin',
      useStoraMagasin: false,
    };
  }

  // Till / moraine
  if (/^(MO|TM|MMH|MMG|MORÄN|TILL)/.test(j) || j.includes('MORÄN')) {
    return {
      type: 'till', label: 'Morän – varierande magasin',
      depthMin: 2, depthMax: 12,
      capacityLabel: '50–600 l/h (bergborrad brunn vanligast)',
      useStoraMagasin: false,
    };
  }

  // Bedrock outcrops
  if (/^(BE|BERG|HÄLL)/.test(j) || j.includes('BERG') || j.includes('HÄLL')) {
    return {
      type: 'rock', label: 'Berg i dagen – sprickzonsmagasin',
      depthMin: 5, depthMax: 20,
      capacityLabel: 'Se grundvattentillgång nedan (bergborrad brunn)',
      useStoraMagasin: false,
    };
  }

  // Peat / wetland – poor but indicates shallow water
  if (/^(TO|TORV|KÄRRMARK|MY)/.test(j) || j.includes('TORV')) {
    return {
      type: 'porous-fine', label: 'Torv/organisk jord – ytligt grundvatten',
      depthMin: 0.2, depthMax: 2,
      capacityLabel: 'Ej lämpligt för dricksvattenbrunn',
      useStoraMagasin: false,
    };
  }

  return {
    type: 'unknown', label: jordart,
    depthMin: 2, depthMax: 15,
    capacityLabel: 'Okänd',
    useStoraMagasin: false,
  };
}

// Adjust typical depth range based on HYPE fyllnadsgrad percentile
function depthAdjustment(fyllnad: number | null | undefined): {
  factor: number;
  label: string;
  color: string;
} {
  if (fyllnad == null || fyllnad === -1) return { factor: 1.0, label: 'okänd nivå', color: 'text-muted-foreground' };
  if (fyllnad < 10) return { factor: 1.7, label: 'mycket låg (+50–80% djupare än normalt)', color: 'text-red-700 dark:text-red-400' };
  if (fyllnad < 25) return { factor: 1.3, label: 'låg (+20–35% djupare än normalt)',         color: 'text-orange-600 dark:text-orange-400' };
  if (fyllnad < 75) return { factor: 1.0, label: 'normal nivå',                               color: 'text-yellow-700 dark:text-yellow-400' };
  if (fyllnad < 90) return { factor: 0.75, label: 'hög (20–30% grundare än normalt)',         color: 'text-green-600 dark:text-green-400' };
  return { factor: 0.55, label: 'mycket hög (40–50% grundare än normalt)',                    color: 'text-green-800 dark:text-green-300' };
}

function estimatedDepth(aq: AquiferClass, fyllnad: number | null | undefined) {
  const adj = depthAdjustment(fyllnad);
  const lo = Math.round(aq.depthMin * adj.factor * 10) / 10;
  const hi = Math.round(aq.depthMax * adj.factor * 10) / 10;
  return { lo, hi, adj };
}

// ── Presentation helpers ──────────────────────────────────────────────────────

function fyllnadLabel(v: number | null | undefined): string {
  if (v == null || v === -1) return 'Ingen data';
  if (v < 10) return 'Mycket låg';
  if (v < 25) return 'Låg';
  if (v < 75) return 'Normal';
  if (v < 90) return 'Hög';
  return 'Mycket hög';
}

function fyllnadColor(v: number | null | undefined): string {
  if (v == null || v === -1) return 'text-muted-foreground';
  if (v < 10) return 'text-red-700 dark:text-red-400';
  if (v < 25) return 'text-orange-600 dark:text-orange-400';
  if (v < 75) return 'text-yellow-700 dark:text-yellow-400';
  if (v < 90) return 'text-green-600 dark:text-green-400';
  return 'text-green-800 dark:text-green-300';
}

function fyllnadBg(v: number | null | undefined): string {
  if (v == null || v === -1) return 'bg-secondary/40';
  if (v < 10) return 'bg-red-50 dark:bg-red-950/30';
  if (v < 25) return 'bg-orange-50 dark:bg-orange-950/30';
  if (v < 75) return 'bg-yellow-50 dark:bg-yellow-950/30';
  if (v < 90) return 'bg-green-50 dark:bg-green-950/30';
  return 'bg-green-100 dark:bg-green-900/30';
}

function mercatorToWGS84(x: number, y: number): [number, number] {
  const lon = (x / 20037508.34) * 180;
  const lat = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
  return [lon, lat];
}

// ── Component ─────────────────────────────────────────────────────────────────

export const GrundvattenRapport = ({ coordinate, wmsProxyUrl, onClose }: Props) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startLeft: 80, startTop: 80 });
  const [position, setPosition] = useState({ left: 80, top: 80 });
  const abortRef = useRef<AbortController | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, startLeft: position.left, startTop: position.top };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      setPosition({ left: dragRef.current.startLeft + (e.clientX - dragRef.current.startX), top: dragRef.current.startTop + (e.clientY - dragRef.current.startY) });
    };
    const onUp = () => { dragRef.current.dragging = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const fetchData = useCallback(async () => {
    // Cancel any in-flight request from a previous call
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setLoading(true);
    setError(null);
    try {
      const [lon, lat] = mercatorToWGS84(coordinate[0], coordinate[1]);
      const sweref = proj4('EPSG:4326', 'EPSG:3006', [lon, lat]) as [number, number];

      // Tight bbox for WMS GFI (~100 m) – faster than 200 m
      const delta = 0.001;
      const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
      // Smaller brunnar radius (8 km) to keep response fast
      const brunnarDelta = 0.07;
      const brunnarBbox = `${lon - brunnarDelta},${lat - brunnarDelta},${lon + brunnarDelta},${lat + brunnarDelta}`;

      // GV Tillgång via proxy (api.sgu.se WMS may lack CORS headers)
      const gvTillgangUrl =
        `${wmsProxyUrl}?url=${encodeURIComponent('https://api.sgu.se/oppnadata/grundvattentillgang-sma-magasin/wms')}&LAYERS=grundvattentillgang-sma-magasin&VERSION=1.1.1&SERVICE=WMS&REQUEST=GetFeatureInfo&QUERY_LAYERS=grundvattentillgang-sma-magasin&INFO_FORMAT=application%2Fjson&BBOX=${bbox}&SRS=EPSG:4326&WIDTH=101&HEIGHT=101&X=50&Y=50`;
      // Jordart via OGC API (direct – no proxy needed)
      const jordartUrl =
        `https://api.sgu.se/oppnadata/jordarter25k-100k/ogc/features/v1/collections/grundlager/items?f=json&bbox=${bbox}&limit=1`;

      // Chain HYPE levels fetch onto the omraden response so it fires as soon as
      // omrade_id is known. Fire BOTH specific-date AND latest-available queries
      // simultaneously so we always have a fallback if today's date has no data
      // (HYPE is a monthly model and may lag behind by weeks/months).
      let levelsPromise: Promise<[any, any]> | null = null;
      let omradeIdCapture: number | undefined;

      const levelBase = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/grundvattennivaer-tidigare/items?f=json`;

      const omradenChain = fetch(
        `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/omraden/items?f=json&bbox=${bbox}&limit=1`,
        { signal }
      )
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          const id = d?.features?.[0]?.properties?.omrade_id;
          if (id !== undefined) {
            omradeIdCapture = id;
            const safeJson = (r: Response) => r.ok ? r.json().catch(() => null) : null;
            // Fire specific-date and latest-available in parallel
            levelsPromise = Promise.all([
              fetch(`${levelBase}&filter=${encodeURIComponent(`omrade_id=${id} AND datum='${selectedDate}'`)}&limit=1`, { signal }).then(safeJson).catch(() => null),
              fetch(`${levelBase}&filter=${encodeURIComponent(`omrade_id=${id}`)}&limit=1`, { signal }).then(safeJson).catch(() => null),
            ]);
          }
          return d;
        })
        .catch(() => null);

      // All other fetches kick off at t=0 alongside the omraden chain
      const [omradenRes, gvTillgangRes, jordartRes, forekomstRes, brunnarRes] = await Promise.allSettled([
        omradenChain,
        fetch(gvTillgangUrl, { signal }),
        fetch(jordartUrl, { signal }),
        fetch(`https://api.sgu.se/oppnadata/grundvattenforekomster-eu/ogc/features/v1/collections/grundvattenforekomster/items?f=json&bbox=${bbox}&limit=3`, { signal }),
        fetch(`https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items?f=json&bbox=${brunnarBbox}&limit=25`, { signal }),
      ]);

      if (signal.aborted) return;

      // Await both level results (already in-flight since omraden resolved)
      const [dateResult, latestResult] = levelsPromise ? await levelsPromise : [null, null];

      if (signal.aborted) return;

      const result: ReportData = { lon, lat, sweref };

      // HYPE omrade id
      if (omradenRes.status === 'fulfilled' && omradeIdCapture !== undefined) {
        result.omradeId = omradeIdCapture;
      }

      // Prefer specific-date result; fall back to latest available
      const levelFeature =
        (dateResult?.features?.length > 0 ? dateResult : latestResult)?.features?.[0];
      if (levelFeature) {
        const p = levelFeature.properties;
        result.hypoDate = p.datum;
        result.fyllnadsgradSma = p.fyllnadsgrad_sma;
        result.fyllnadsgradStora = p.fyllnadsgrad_stora;
        result.sitSma = p.grundvattensituation_sma;
        result.sitStora = p.grundvattensituation_stora;
      }

      // GV Tillgång
      if (gvTillgangRes.status === 'fulfilled' && gvTillgangRes.value.ok) {
        try {
          const d = await gvTillgangRes.value.json();
          if (d.features?.length > 0) result.gvTillgangLdha = d.features[0].properties?.GRAY_INDEX ?? null;
        } catch { /* ignore */ }
      }

      // Jordart (OGC API – property jg2 is the numeric soil type code)
      if (jordartRes.status === 'fulfilled' && jordartRes.value.ok) {
        try {
          const d = await jordartRes.value.json();
          if (d.features?.length > 0) {
            const p = d.features[0].properties ?? {};
            const jg2 = p.jg2 ?? p.JG2;
            if (jg2 != null) {
              const soilInfo = getSoilTypeColor(Number(jg2));
              result.jordartNamn = soilInfo.name;
              result.jordartKod = String(jg2);
            }
          }
        } catch { /* ignore */ }
      }

      // GV Förekomst
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

      // Brunnar
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
    } catch (e: any) {
      if (signal.aborted) return;
      console.error("GrundvattenRapport error:", e);
      setError("Kunde inte hämta data. Kontrollera din internetanslutning.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [coordinate, wmsProxyUrl, selectedDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived interpretation ─────────────────────────────────────────────────
  const aquifer = data ? classifyAquifer(data.jordartKod ?? data.jordartNamn) : null;
  const hasStoraMagasin = !!data?.gvForekomstNamn;
  const relevantFyllnad = aquifer?.useStoraMagasin || hasStoraMagasin
    ? data?.fyllnadsgradStora
    : data?.fyllnadsgradSma;
  const depth = aquifer && data ? estimatedDepth(aquifer, relevantFyllnad) : null;

  // Median capacity from nearby brunnar
  const medianKapacitet = (() => {
    const vals = (data?.brunnar ?? []).map(b => b.kapacitet_lh!).filter(Boolean).sort((a, b) => a - b);
    if (!vals.length) return null;
    return vals[Math.floor(vals.length / 2)];
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="absolute z-30 bg-card shadow-xl border border-border rounded-xl overflow-hidden flex flex-col"
      style={{ left: position.left, top: position.top, width: 400, maxHeight: '85vh' }}
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

      {/* Date picker */}
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
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        ) : data ? (
          <div className="p-4 space-y-4 text-sm">

            {/* Coordinates */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Koordinater</span>
              </div>
              <div className="text-xs space-y-0.5">
                <div>WGS84: {data.lat.toFixed(5)}°N, {data.lon.toFixed(5)}°E</div>
                <div className="text-muted-foreground">SWEREF99 TM: {Math.round(data.sweref[0])} E, {Math.round(data.sweref[1])} N</div>
              </div>
            </div>

            <hr className="border-border" />

            {/* ── TOLKNING ── */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tolkning</h3>

              {/* Aquifer type */}
              {aquifer && (
                <div className="bg-secondary/40 rounded-lg p-3 mb-2">
                  <div className="text-xs text-muted-foreground mb-0.5">Akvifer (utifrån jordart)</div>
                  <div className="font-semibold">{aquifer.label}</div>
                  {hasStoraMagasin && data.gvForekomstNamn && (
                    <div className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                      Ingår i grundvattenförekomst: {data.gvForekomstNamn}
                    </div>
                  )}
                </div>
              )}

              {/* Estimated depth */}
              {depth && (
                <div className={`rounded-lg p-3 mb-2 ${fyllnadBg(relevantFyllnad)}`}>
                  <div className="text-xs text-muted-foreground mb-1">
                    Uppskattad grundvattennivå under markyta
                    {data.hypoDate && <span className="ml-1">· {data.hypoDate}</span>}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-bold leading-none ${fyllnadColor(relevantFyllnad)}`}>
                      {depth.lo}–{depth.hi}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">m</span>
                  </div>
                  <div className={`text-xs mt-1 ${depth.adj.color}`}>
                    Aktuell situation: {depth.adj.label}
                  </div>
                  <div className="flex items-start gap-1 mt-2 text-xs text-muted-foreground">
                    <Info className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>Uppskattning baserad på jordart och SGU-HYPE-modellen. Osäkerheten är betydande – lokala förhållanden kan avvika.</span>
                  </div>
                </div>
              )}

              {/* Capacity interpretation */}
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground mb-1">Kapacitet – uppskattning</div>
                {aquifer && (
                  <div className="text-xs mb-1.5">
                    <span className="font-medium">Typisk kapacitet ({aquifer.label.split('–')[0].trim()}):</span>
                    <span className="ml-1">{aquifer.capacityLabel}</span>
                  </div>
                )}
                {data.gvTillgangLdha != null && (
                  <div className="text-xs mb-1.5">
                    <span className="font-medium">Bergborrad brunn (SGU-raster):</span>
                    <span className="ml-1 text-blue-700 dark:text-blue-400 font-semibold">
                      {Math.round(data.gvTillgangLdha / 24)} l/h/ha
                    </span>
                    <span className="text-muted-foreground ml-1">({Math.round(data.gvTillgangLdha)} l/dygn/ha)</span>
                  </div>
                )}
                {medianKapacitet != null && (
                  <div className="text-xs">
                    <span className="font-medium">Mediankapacitet, brunnar i närheten:</span>
                    <span className="ml-1 text-blue-700 dark:text-blue-400 font-semibold">
                      {medianKapacitet} l/h
                    </span>
                    <span className="text-muted-foreground ml-1">({data.brunnar?.length} brunnar, ca 15 km)</span>
                  </div>
                )}
              </div>
            </div>

            <hr className="border-border" />

            {/* ── UNDERLAGSDATA ── */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Underlagsdata</h3>

              {/* HYPE fyllnadsgrad */}
              {data.omradeId !== undefined ? (
                <>
                  <div className="text-xs text-muted-foreground mb-2">
                    SGU-HYPE område {data.omradeId}{data.hypoDate ? ` · ${data.hypoDate}` : ''}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      { label: 'Fyllnadsgrad\nSmå magasin', val: data.fyllnadsgradSma },
                      { label: 'Fyllnadsgrad\nStora magasin', val: data.fyllnadsgradStora },
                    ].map(({ label, val }) => (
                      <div key={label} className={`rounded-lg p-2.5 ${fyllnadBg(val)}`}>
                        <div className="text-xs text-muted-foreground mb-1 whitespace-pre-line leading-tight">{label}</div>
                        {val != null ? (
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
                <div className="text-xs text-muted-foreground mb-3">Ingen HYPE-data för denna punkt</div>
              )}

              {/* Jordart */}
              {data.jordartNamn && (
                <div className="flex justify-between items-baseline text-xs mb-1.5">
                  <span className="text-muted-foreground">Jordart (1:25k–100k)</span>
                  <span className="font-medium ml-2 text-right">{data.jordartNamn}</span>
                </div>
              )}

              {/* GV Förekomst */}
              {(data.gvForekomstNamn || data.gvForekomstEuKod) && (
                <div className="flex justify-between items-baseline text-xs mb-1.5">
                  <span className="text-muted-foreground">Grundvattenförekomst (EU)</span>
                  <span className="font-medium ml-2 text-right">
                    {data.gvForekomstNamn}
                    {data.gvForekomstEuKod && <span className="text-muted-foreground ml-1">({data.gvForekomstEuKod})</span>}
                  </span>
                </div>
              )}
            </div>

            {/* Brunnar i närheten */}
            {data.brunnar && data.brunnar.length > 0 && (
              <>
                <hr className="border-border" />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Brunnar med kapacitetsdata i närheten
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
                </div>
              </>
            )}

            <div className="text-xs text-muted-foreground pt-1 border-t border-border">
              Källa: SGU OGC API · Tolkningar är uppskattningar och ersätter inte platsspecifik undersökning.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
