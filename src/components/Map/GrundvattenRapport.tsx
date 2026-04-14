import { useEffect, useState, useRef, useCallback } from "react";
import { X, Droplets, Loader2, MapPin, AlertCircle, RefreshCw, Info, ChevronDown } from "lucide-react";
import proj4 from "proj4";
import { getSoilTypeColor } from "../../lib/soilTypeColors";

interface Props {
  coordinate: [number, number]; // Web Mercator EPSG:3857
  wmsProxyUrl: string;
  onClose: () => void;
}

interface BrunnInfo {
  id: string;
  kapacitet?: number;    // l/h
  djup?: number;         // totaldjup m
  jorddjup?: number;     // soil cover m
  isBergborrad: boolean; // totaldjup - jorddjup > 15 m
}

interface ReportData {
  lon: number;
  lat: number;
  sweref: [number, number];
  omradeId?: number;
  hypoDate?: string;
  hypoDateIsFallback?: boolean; // true when selected date had no data → latest available used
  fyllnadsgradSma?: number | null;
  fyllnadsgradStora?: number | null;
  sitSma?: number | null;
  sitStora?: number | null;
  gvTillgangLdha?: number | null;
  jordartNamn?: string;
  jordartKod?: string;
  // Jorddjup från jorddjupsmodell – avståndsviktad, expanderande radier
  jorddjup?: { median: number; p25: number; p75: number; antal: number; radieM: number };
  // Grundvattenmagasin (SGU karteringsdata – mer detaljerat än EU-förekomster)
  magasin?: {
    namn: string;
    akvifertyp?: string;           // "porakvifer" | "sprickakvifer" | …
    genes?: string;                // "isälvssediment" | "morän" | …
    tillrinningLs?: number;        // l/s recharge from mapped recharge areas
    medelmaktighetMattad?: string; // "medelmäktighet 10–20 meter" etc.
    lankBeskrivning?: string;      // URL to detailed SGU report
    magasinsposition?: string;     // "J1" | "J2" | "B1" | "B2"
  };
  brunnar?: BrunnInfo[];
  // Nearby observed groundwater levels for calibration
  // aquiferGroup: derived from 'akvifer' code (B*=rock, J*=jord, XX/null=unknown)
  obsFeatures?: Array<{ djup: number; jordart?: string; aquiferGroup?: 'rock' | 'jord' }>;
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

  const j = jordart.trim().toUpperCase();

  // Torv/organiska jordar – indikerar ytligt grundvatten
  if (j.includes('TORV') || j.includes('MOSSE') || j.includes('GYTTJA') || j.includes('KÄRR')) {
    return {
      type: 'porous-fine', label: 'Torv/organisk jord – ytligt grundvatten',
      depthMin: 0.2, depthMax: 2,
      capacityLabel: 'Ej lämpligt för dricksvattenbrunn',
      useStoraMagasin: false,
    };
  }

  // Morän MÅSTE kontrolleras FÖRE sand/grus – "Sandig morän" och "Grusig morän"
  // innehåller "SAND"/"GRUS" och klassas annars fel.
  if (j.includes('MORÄN')) {
    // Moränlera och moränfinlera är täckande lager utan bra magasinsegenskaper
    if (j.includes('LERA') || j.includes('LERIG')) {
      return {
        type: 'confining', label: 'Moränlera – täckande lager',
        depthMin: 5, depthMax: 30,
        capacityLabel: 'Ej lämpligt för ytlig brunn; kan täcka djupare magasin',
        useStoraMagasin: false,
      };
    }
    return {
      type: 'till', label: 'Morän – varierande magasin',
      depthMin: 2, depthMax: 12,
      capacityLabel: '50–600 l/h (bergborrad brunn vanligast)',
      useStoraMagasin: false,
    };
  }

  // Isälvssediment (glacifluvialt) – kontrolleras före generellt sand/grus
  if (j.includes('ISÄLV') || j.includes('RULLSTENS')) {
    return {
      type: 'porous-coarse', label: 'Isälvssediment – poröst grovkornigt magasin',
      depthMin: 0.5, depthMax: 4,
      capacityLabel: '500–10 000 l/h (grävd/borrad infiltrationsbrunn)',
      useStoraMagasin: true,
    };
  }

  // Berg
  if (j.includes('BERG') || j.includes('HÄLL') || j.includes('DIABAS') ||
      j.includes('SANDSTEN') || j.includes('KALKSTEN') || j.includes('SEDIMENTÄRT') ||
      j.includes('TALUS') || j.includes('VITTRING')) {
    return {
      type: 'rock', label: 'Berg i dagen – sprickzonsmagasin',
      depthMin: 5, depthMax: 20,
      capacityLabel: 'Se grundvattentillgång nedan (bergborrad brunn)',
      useStoraMagasin: false,
    };
  }

  // Lera/silt – täckande lager
  if (j.includes('LERA') || j.includes('SILT') || j.includes('VARV')) {
    return {
      type: 'confining', label: 'Lera/silt – täckande lager',
      depthMin: 5, depthMax: 30,
      capacityLabel: 'Ej lämpligt för ytlig brunn; tätande lager kan dölja djupare magasin',
      useStoraMagasin: false,
    };
  }

  // Grovkornigt poröst (sand, grus) – rent sand/grus utan morän eller isälv
  if (j.includes('SAND') || j.includes('GRUS') || j.includes('KLARJORD') ||
      j.includes('SVALL') || j.includes('KLAPPER') || j.includes('SKALJORD')) {
    return {
      type: 'porous-coarse', label: 'Sand/grus – poröst magasin',
      depthMin: 0.5, depthMax: 4,
      capacityLabel: '500–10 000 l/h (grävd/borrad infiltrationsbrunn)',
      useStoraMagasin: true,
    };
  }

  // Finkornigt poröst (svämsediment, älvsediment, finmo)
  if (j.includes('SVÄM') || j.includes('ÄLV') || j.includes('FINMO') ||
      j.includes('MJÄLA') || j.includes('FLYGSAND')) {
    return {
      type: 'porous-fine', label: 'Finkornigt sediment – svagt poröst magasin',
      depthMin: 1, depthMax: 8,
      capacityLabel: '50–500 l/h',
      useStoraMagasin: false,
    };
  }

  // Fyllning
  if (j.includes('FYLLNING')) {
    return {
      type: 'unknown', label: 'Fyllning – varierande egenskaper',
      depthMin: 1, depthMax: 10,
      capacityLabel: 'Okänd (fyllnadsmassor)',
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

function formatRadie(m: number): string {
  if (m < 1000) return `~${m} m`;
  return `~${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)} km`;
}

// ── Source documentation helper ───────────────────────────────────────────────

function SourceRow({ label, source, note, url }: {
  label: string; source: string; note: string; url: string;
}) {
  return (
    <div className="pl-1 border-l-2 border-border">
      <div className="font-medium">{label}</div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-700 dark:text-blue-400 underline underline-offset-2 break-all"
      >
        {source}
      </a>
      <div className="text-muted-foreground mt-0.5 leading-relaxed">{note}</div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export const GrundvattenRapport = ({ coordinate, wmsProxyUrl, onClose }: Props) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);

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
      // ~15 km radius for brunnar
      const brunnarDelta = 0.13;
      const brunnarBbox = `${lon - brunnarDelta},${lat - brunnarDelta},${lon + brunnarDelta},${lat + brunnarDelta}`;
      // 5 km radius for jorddjup observations – fetch wide, then filter by actual distance
      const djupLatD = 5000 / 111111;                                       // ≈ 0.045°
      const djupLonD = djupLatD / Math.cos((lat * Math.PI) / 180);         // wider near equator
      const djupBbox = `${lon - djupLonD},${lat - djupLatD},${lon + djupLonD},${lat + djupLatD}`;

      // GV Tillgång via proxy (api.sgu.se WMS may lack CORS headers)
      const gvTillgangUrl =
        `${wmsProxyUrl}?url=${encodeURIComponent('https://api.sgu.se/oppnadata/grundvattentillgang-sma-magasin/wms')}&LAYERS=grundvattentillgang-sma-magasin&VERSION=1.1.1&SERVICE=WMS&REQUEST=GetFeatureInfo&QUERY_LAYERS=grundvattentillgang-sma-magasin&INFO_FORMAT=application%2Fjson&BBOX=${bbox}&SRS=EPSG:4326&WIDTH=101&HEIGHT=101&X=50&Y=50`;
      // Jordart: fire CQL2 point-in-polygon AND bbox simultaneously.
      // CQL2 is precise but may not be supported by all SGU endpoints.
      // Bbox fallback picks the first non-water feature (code 91) so rivers
      // don't shadow the surrounding soil type.
      const jordartBase = `https://api.sgu.se/oppnadata/jordarter25k-100k/ogc/features/v1/collections/grundlager/items?f=json`;
      const jordartCql2Url = `${jordartBase}&filter=${encodeURIComponent(`S_INTERSECTS(geometry,POINT(${lon} ${lat}))`)}&filter-lang=cql2-text&limit=1`;
      const jordartBboxUrl = `${jordartBase}&bbox=${bbox}&limit=5`;

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
              fetch(`${levelBase}&filter=${encodeURIComponent(`omrade_id=${id}`)}&sortby=-datum&limit=1`, { signal }).then(safeJson).catch(() => null),
            ]);
          }
          return d;
        })
        .catch(() => null);

      // 50 km bbox for observed groundwater level stations
      const latD50 = 0.45; // ≈ 50 km
      const lonD50 = latD50 / Math.cos((lat * Math.PI) / 180);
      const obs50Bbox = `${lon - lonD50},${lat - latD50},${lon + lonD50},${lat + latD50}`;
      const obsBase = 'https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections';

      // Chain: nivaer has no geometry so bbox filtering fails with 400.
      // Fetch stationer spatially first → extract platsbeteckning IDs → query
      // nivaer via CQL2 IN filter.  Same promise-chain pattern as HYPE omraden→levels.
      const stJordart   = new Map<string, string>();
      const stAkvifer   = new Map<string, 'rock' | 'jord'>(); // akvifer B*=rock, J*=jord
      let nivaerPromise: Promise<any> | null = null;

      const obsStationerChain = fetch(
        `${obsBase}/stationer/items?f=json&bbox=${obs50Bbox}&limit=500`,
        { signal }
      ).then(r => r.ok ? r.json() : null)
       .then(d => {
         const ids: string[] = [];
         for (const f of d?.features ?? []) {
           const p = f.properties ?? {};
           const id = p.platsbeteckning;
           if (!id) continue;
           stJordart.set(String(id), p.jordart_tx ?? p.jordart ?? '');
           // akvifer code: B* = berg (rock), J* = jord (soil), XX = unknown
           const akv = String(p.akvifer ?? '').toUpperCase();
           if (akv.startsWith('B')) stAkvifer.set(String(id), 'rock');
           else if (akv.startsWith('J')) stAkvifer.set(String(id), 'jord');
           ids.push(String(id));
         }
         if (ids.length > 0) {
           // Limit IN list to avoid very long URLs
           const idList = ids.slice(0, 200).map(id => `'${id.replace(/'/g, "''")}'`).join(',');
           const filter = `platsbeteckning IN (${idList}) AND obsdatum > '2020-01-01'`;
           nivaerPromise = fetch(
             `${obsBase}/nivaer/items?f=json&filter=${encodeURIComponent(filter)}&filter-lang=cql2-text&sortby=-obsdatum&limit=1500`,
             { signal }
           ).then(r => r.ok ? r.json().catch(() => null) : null).catch(() => null);
         }
         return d;
       }).catch(() => null);

      // All fetches at t=0 — obsStationerChain included so nivaer fires as soon
      // as stationer resolves (overlaps with the other 6 parallel fetches).
      const allResults = await Promise.allSettled([
        omradenChain,
        fetch(gvTillgangUrl, { signal }),
        fetch(jordartCql2Url, { signal }),
        fetch(jordartBboxUrl, { signal }),
        fetch(`https://api.sgu.se/oppnadata/grundvattenmagasin/ogc/features/v1/collections/grundvattenmagasin/items?f=json&bbox=${bbox}&limit=3`, { signal }),
        fetch(`https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items?f=json&bbox=${brunnarBbox}&limit=25`, { signal }),
        fetch(`https://api.sgu.se/oppnadata/jorddjupsmodell/ogc/features/v1/collections/underlag-jorddjup/items?f=json&bbox=${djupBbox}&limit=100`, { signal }),
        obsStationerChain, // side-effects: fills stJordart, sets nivaerPromise
      ]);
      const [omradenRes, gvTillgangRes, jordartCql2Res, jordartBboxRes, forekomstRes, brunnarRes, jorddjupRes] = allResults;

      if (signal.aborted) return;

      // Await HYPE levels + observed nivaer in parallel (both already in-flight)
      const [[dateResult, latestResult], nivaerData] = await Promise.all([
        levelsPromise ?? Promise.resolve([null, null]),
        nivaerPromise ?? Promise.resolve(null),
      ]);

      if (signal.aborted) return;

      const result: ReportData = { lon, lat, sweref };

      // HYPE omrade id
      if (omradenRes.status === 'fulfilled' && omradeIdCapture !== undefined) {
        result.omradeId = omradeIdCapture;
      }

      // Prefer specific-date result; fall back to latest available
      const usedLatest = !(dateResult?.features?.length > 0);
      const levelFeature = (usedLatest ? latestResult : dateResult)?.features?.[0];
      if (levelFeature) {
        const p = levelFeature.properties;
        result.hypoDate = p.datum;
        result.hypoDateIsFallback = usedLatest;
        result.fyllnadsgradSma = p.fyllnadsgrad_sma;
        result.fyllnadsgradStora = p.fyllnadsgrad_stora;
        result.sitSma = p.grundvattensituation_sma;
        result.sitStora = p.grundvattensituation_stora;
      }

      // GV Tillgång små magasin (raster, l/dygn/ha)
      if (gvTillgangRes.status === 'fulfilled' && gvTillgangRes.value.ok) {
        try {
          const d = await gvTillgangRes.value.json();
          if (d.features?.length > 0) {
            const p = d.features[0].properties ?? {};
            result.gvTillgangLdha =
              p.Grundvattentillgang_i_sma_magasin_l_dygn_ha ??
              p.GRAY_INDEX ?? null;
          }
        } catch { /* ignore */ }
      }

      // Jordart: prefer CQL2 (exact point containment), fall back to bbox
      // (first non-water feature). Suppresses "Okänd" when neither has data.
      const extractJordart = (features: any[]): { name: string; kod: string } | null => {
        if (!features?.length) return null;
        const f = features.find(f => (f.properties?.jg2 ?? f.properties?.JG2) !== 91) ?? features[0];
        const jg2 = f.properties?.jg2 ?? f.properties?.JG2;
        if (jg2 == null) return null;
        return { name: getSoilTypeColor(Number(jg2)).name, kod: String(jg2) };
      };
      try {
        let jordart: { name: string; kod: string } | null = null;
        if (jordartCql2Res.status === 'fulfilled' && jordartCql2Res.value.ok) {
          const d = await jordartCql2Res.value.json().catch(() => null);
          jordart = extractJordart(d?.features);
        }
        if (!jordart && jordartBboxRes.status === 'fulfilled' && jordartBboxRes.value.ok) {
          const d = await jordartBboxRes.value.json().catch(() => null);
          jordart = extractJordart(d?.features);
        }
        if (jordart) { result.jordartNamn = jordart.name; result.jordartKod = jordart.kod; }
      } catch { /* ignore */ }

      // Grundvattenmagasin
      // Properties verified against live API: magasinsnamn, akvifertyp, genes,
      // tillrinning_fran_tillrinningsomraden_l_per_s, medelmaktighet_mattad_zon,
      // lank_magasinsbeskrivning, magasinsposition
      if (forekomstRes.status === 'fulfilled' && forekomstRes.value.ok) {
        try {
          const d = await forekomstRes.value.json();
          if (d.features?.length > 0) {
            const p = d.features[0].properties ?? {};
            const namn = p.magasinsnamn;
            if (namn) {
              result.magasin = {
                namn,
                akvifertyp:           p.akvifertyp          || undefined,
                genes:                p.genes               || undefined,
                tillrinningLs:        typeof p.tillrinning_fran_tillrinningsomraden_l_per_s === 'number'
                                        ? p.tillrinning_fran_tillrinningsomraden_l_per_s : undefined,
                medelmaktighetMattad: p.medelmaktighet_mattad_zon_kod > 0
                                        ? p.medelmaktighet_mattad_zon : undefined,
                lankBeskrivning:      p.lank_magasinsbeskrivning     || undefined,
                magasinsposition:     p.magasinsposition_kod > 0
                                        ? p.magasinsposition : undefined,
              };
            }
          }
        } catch { /* ignore */ }
      }

      // Brunnar – actual property is 'kapacitet' (l/h), not 'kapacitet_lh'
      if (brunnarRes.status === 'fulfilled' && brunnarRes.value.ok) {
        try {
          const d = await brunnarRes.value.json();
          if (d.features?.length > 0) {
            result.brunnar = d.features
              .filter((f: any) => {
                const kap = f.properties?.kapacitet;
                return kap != null && kap > 0;
              })
              .slice(0, 20)
              .map((f: any) => {
                const p = f.properties ?? {};
                const totaldjup = p.totaldjup ?? p.borrhalsdjup ?? null;
                const jorddjup  = p.jorddjup ?? 0;
                return {
                  id: p.brunnsid || p.id || f.id || '?',
                  kapacitet: p.kapacitet,
                  djup: totaldjup,
                  jorddjup,
                  isBergborrad: totaldjup != null && (totaldjup - jorddjup) > 15,
                };
              });
          }
        } catch { /* ignore */ }
      }

      // Jorddjup from jorddjupsmodell – distance-weighted with expanding radius tiers.
      // Fetch up to 5 km, compute actual great-circle distance per observation, then
      // try 100 m → 500 m → 2 000 m → 5 000 m and use the first tier with ≥ 3 points.
      if (jorddjupRes.status === 'fulfilled' && jorddjupRes.value.ok) {
        try {
          const d = await jorddjupRes.value.json();
          // Attach distance (m) to each valid observation
          type DjupObs = { djup: number; distM: number };
          const cosLat = Math.cos((lat * Math.PI) / 180);
          const withDist: DjupObs[] = (d.features ?? [])
            .map((f: any): DjupObs | null => {
              const djup = f.properties?.djup;
              if (typeof djup !== 'number' || djup <= 0) return null;
              const [fLon, fLat] = f.geometry?.coordinates ?? [null, null];
              if (fLon == null || fLat == null) return null;
              const dLat = (fLat - lat) * (Math.PI / 180) * 6371000;
              const dLon = (fLon - lon) * (Math.PI / 180) * 6371000 * cosLat;
              return { djup, distM: Math.sqrt(dLat * dLat + dLon * dLon) };
            })
            .filter((v): v is DjupObs => v != null)
            .sort((a, b) => a.distM - b.distM);  // nearest first

          // Expanding radius: pick smallest tier with ≥ 3 observations
          const TIERS = [100, 500, 2000, 5000];
          let pool: DjupObs[] = [];
          let radieM = 5000;
          for (const r of TIERS) {
            const inR = withDist.filter(o => o.distM <= r);
            if (inR.length >= 3) { pool = inR; radieM = r; break; }
          }
          if (pool.length === 0 && withDist.length >= 2) {
            pool = withDist;           // use whatever exists beyond 5 km if really sparse
            radieM = Math.ceil(withDist[withDist.length - 1].distM / 100) * 100;
          }

          if (pool.length >= 2) {
            const sorted = pool.map(o => o.djup).sort((a, b) => a - b);
            result.jorddjup = {
              median: sorted[Math.floor(sorted.length / 2)],
              p25:    sorted[Math.floor(sorted.length * 0.25)],
              p75:    sorted[Math.floor(sorted.length * 0.75)],
              antal:  pool.length,
              radieM,
            };
          }
        } catch { /* ignore */ }
      }

      // Parse observed nivaer: take most recent reading per station (sorted -obsdatum),
      // join with stJordart map for soil type. Both property names verified against API.
      const seenSt = new Set<string>();
      const obsArr: Array<{ djup: number; jordart?: string; aquiferGroup?: 'rock' | 'jord' }> = [];
      try {
        for (const f of nivaerData?.features ?? []) {
          const p = f.properties ?? {};
          const sid = p.platsbeteckning;
          if (!sid || seenSt.has(String(sid))) continue;
          seenSt.add(String(sid));
          const djup = p.grundvattenniva_m_u_markyta;
          if (typeof djup !== 'number' || djup <= 0 || djup > 100) continue;
          obsArr.push({
            djup,
            jordart:      stJordart.get(String(sid)) || undefined,
            aquiferGroup: stAkvifer.get(String(sid)),
          });
        }
      } catch { /* ignore */ }
      if (obsArr.length) result.obsFeatures = obsArr;

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
  const aquifer = data ? classifyAquifer(data.jordartNamn) : null;
  const hasStoraMagasin = !!data?.magasin;
  const relevantFyllnad = aquifer?.useStoraMagasin || hasStoraMagasin
    ? data?.fyllnadsgradStora
    : data?.fyllnadsgradSma;
  const depth = aquifer && data ? estimatedDepth(aquifer, relevantFyllnad) : null;

  // Observation calibration – two-level filter:
  //   1. Primary: bergborrade (B*) vs jordbrunnar (J*) split
  //      Morän ('till') is grouped with rock: in morän terrain people typically
  //      drill through to bedrock, so nearby rock observations are the right anchor.
  //   2. Secondary: within group, prefer matching classifyAquifer sub-type
  const obsKalibr = (() => {
    if (!data?.obsFeatures?.length || !aquifer || aquifer.type === 'unknown') return null;
    // Confining layers: nearby jord observations (sand/grus at 1–3 m) would give
    // a misleadingly shallow depth for drilling through clay.  Exception: when there
    // IS a known EU groundwater body beneath (wb_type known), we can calibrate
    // against the pool that matches that underlying aquifer type.
    if (aquifer.type === 'confining' && !data?.magasin) return null;

    // Determine which observation pool to use:
    //  - rock / till / bergakvifer → B* stations (bergborrade)
    //  - porous sediment aquifers  → J* stations (jordbrunnar)
    let useRockPool: boolean;
    if (aquifer.type === 'confining' && data?.magasin) {
      // Use the underlying magasin genesis/type to pick the pool
      const g = (data.magasin.genes ?? data.magasin.akvifertyp ?? '').toUpperCase();
      useRockPool = g.includes('BERG') || g.includes('SPRICK') || g.includes('SEDIMENTÄR');
    } else {
      // Morän → bergborrad is the dominant well type → use rock observations
      useRockPool = aquifer.type === 'rock' || aquifer.type === 'till';
    }

    // Level 1: hard berg/jord split
    const groupMatch = data.obsFeatures.filter(o =>
      o.aquiferGroup ? o.aquiferGroup === (useRockPool ? 'rock' : 'jord') : true
    );

    // Level 2: within same group, prefer matching sub-type (morän/sand/lera etc.)
    // For 'till' this finds rock obs whose station jordart is also morän (overburden).
    const subMatch = groupMatch.filter(o =>
      o.jordart ? classifyAquifer(o.jordart).type === aquifer.type : false
    );

    // Use the most specific pool with ≥3; otherwise widen one level at a time
    const pool = subMatch.length >= 3 ? subMatch :
                 groupMatch.length >= 3 ? groupMatch :
                 data.obsFeatures.length >= 3 ? data.obsFeatures : null;
    if (!pool) return null;

    const sorted = pool.map(o => o.djup).sort((a, b) => a - b);

    const groupLabel = useRockPool ? 'bergbrunnar' : 'jordbrunnar';
    return {
      antal:        pool.length,
      medianDjup:   sorted[Math.floor(sorted.length / 2)],
      p25:          sorted[Math.floor(sorted.length * 0.25)],
      p75:          sorted[Math.floor(sorted.length * 0.75)],
      matchLabel:   subMatch.length >= 3  ? 'matchande jordart' :
                    groupMatch.length >= 3 ? groupLabel :
                                             'blandad (få stationer)',
      aquiferMatch: subMatch.length >= 3 || groupMatch.length >= 3,
    };
  })();

  // HYPE-adjusted calibrated estimate: anchor on observed median, scale by HYPE factor
  const calibratedDepth = (() => {
    if (!obsKalibr || !depth) return null;
    const f = depth.adj.factor;
    return {
      median: Math.round(obsKalibr.medianDjup * f * 10) / 10,
      lo:     Math.round(obsKalibr.p25 * f * 10) / 10,
      hi:     Math.round(obsKalibr.p75 * f * 10) / 10,
    };
  })();

  // Separate median capacity for bedrock vs soil wells
  const medianOf = (brunnar: BrunnInfo[]) => {
    const vals = brunnar.map(b => b.kapacitet!).filter(v => v > 0).sort((a, b) => a - b);
    return vals.length ? vals[Math.floor(vals.length / 2)] : null;
  };
  const bergBrunnar = (data?.brunnar ?? []).filter(b => b.isBergborrad);
  const jordBrunnar = (data?.brunnar ?? []).filter(b => !b.isBergborrad);
  const medianBergKapacitet = medianOf(bergBrunnar);
  const medianJordKapacitet = medianOf(jordBrunnar);

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

              {/* Aquifer type – only shown when we have actual jordart data */}
              {aquifer && aquifer.type !== 'unknown' ? (
                <div className="bg-secondary/40 rounded-lg p-3 mb-2">
                  <div className="text-xs text-muted-foreground mb-0.5">Akvifer (utifrån jordart)</div>
                  <div className="font-semibold">{aquifer.label}</div>
                  {data.magasin && (
                    <div className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                      Grundvattenmagasin: {data.magasin.namn}
                      {data.magasin.genes && <span className="ml-1 text-muted-foreground">({data.magasin.genes})</span>}
                    </div>
                  )}
                </div>
              ) : !data.jordartNamn ? (
                <div className="text-xs text-muted-foreground mb-2">
                  Ingen jordartsinformation tillgänglig för denna punkt
                </div>
              ) : null}

              {/* Depth estimate – calibrated if we have enough nearby observations */}
              {depth && aquifer?.type !== 'unknown' && (
                <div className={`rounded-lg p-3 mb-2 ${fyllnadBg(relevantFyllnad)}`}>
                  {calibratedDepth ? (
                    <>
                      <div className="text-xs text-muted-foreground mb-1">
                        Grundvattennivå under markyta – kalibrerad
                        {data.hypoDate && (
                          <span className="ml-1">
                            · {data.hypoDate.replace(/Z$/, '')}
                            {data.hypoDateIsFallback && <span className="italic"> (senaste tillgängliga)</span>}
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-2xl font-bold leading-none ${fyllnadColor(relevantFyllnad)}`}>
                          {calibratedDepth.lo}–{calibratedDepth.hi}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">m</span>
                      </div>
                      <div className={`text-xs mt-1 ${depth.adj.color}`}>
                        {depth.adj.label}
                      </div>
                      <div className="text-xs mt-1.5 text-muted-foreground">
                        Observerat P25–P75: {obsKalibr!.p25.toFixed(1)}–{obsKalibr!.p75.toFixed(1)} m
                        · median {obsKalibr!.medianDjup.toFixed(1)} m
                        · {obsKalibr!.antal} stationer
                        <span className={`ml-1 ${obsKalibr!.aquiferMatch ? 'text-green-700 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                          · {obsKalibr!.matchLabel}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-muted-foreground mb-1">
                        Uppskattad grundvattennivå under markyta
                        {data.hypoDate && (
                          <span className="ml-1">
                            · {data.hypoDate.replace(/Z$/, '')}
                            {data.hypoDateIsFallback && <span className="italic"> (senaste tillgängliga)</span>}
                          </span>
                        )}
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
                    </>
                  )}
                  <div className="flex items-start gap-1 mt-2 text-xs text-muted-foreground">
                    <Info className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>
                      {calibratedDepth
                        ? `Kalibrerad mot ${obsKalibr!.matchLabel} (SGU) inom 50 km, justerad med SGU-HYPE-situationen. Lokala förhållanden kan avvika.`
                        : 'Uppskattning baserad på jordart och SGU-HYPE-modellen. Osäkerheten är betydande – lokala förhållanden kan avvika.'}
                    </span>
                  </div>
                </div>
              )}

              {/* Capacity interpretation */}
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground mb-0.5">Kapacitet – uppskattning</div>
                {/* For rock/morän terrain the relevant well type is always bergborrad */}
                {(aquifer?.type === 'rock' || aquifer?.type === 'till') && (
                  <div className="text-xs text-muted-foreground italic mb-1.5">
                    Kapacitetssiffror avser bergborrade brunnar
                  </div>
                )}
                {aquifer && aquifer.type !== 'unknown' && (
                  <div className="text-xs mb-1.5">
                    <span className="font-medium">Typisk ({aquifer.label.split('–')[0].trim()}):</span>
                    <span className="ml-1 text-muted-foreground">{aquifer.capacityLabel}</span>
                  </div>
                )}
                {/* Berg + Morän: bedrock wells are the primary reference */}
                {(aquifer?.type === 'rock' || aquifer?.type === 'till') && medianBergKapacitet != null && (
                  <div className="text-xs mb-1.5">
                    <span className="font-medium">Bergborrade brunnar i närheten:</span>
                    <span className="ml-1 text-blue-700 dark:text-blue-400 font-semibold">{medianBergKapacitet} l/h</span>
                    <span className="text-muted-foreground ml-1">(median, {bergBrunnar.length} brunnar, ca 15 km)</span>
                  </div>
                )}
                {/* Magasin tillrinning – actual mapped recharge capacity */}
                {data.magasin?.tillrinningLs != null && (
                  <div className="text-xs mb-1.5">
                    <span className="font-medium">Tillrinning till magasin ({data.magasin.namn.split(' ')[0]}):</span>
                    <span className="ml-1 text-blue-700 dark:text-blue-400 font-semibold">
                      {data.magasin.tillrinningLs} l/s
                    </span>
                  </div>
                )}
                {/* Jorddjup – thickness of soil above bedrock from nearby observations */}
                {data.jorddjup && aquifer?.type !== 'rock' && (
                  <div className="text-xs mb-1.5">
                    <span className="font-medium">Jordlager (jorddjupsmodell):</span>
                    <span className="ml-1 text-blue-700 dark:text-blue-400 font-semibold">
                      {data.jorddjup.median.toFixed(1)} m
                    </span>
                    <span className="text-muted-foreground ml-1">
                      (P25–P75: {data.jorddjup.p25.toFixed(1)}–{data.jorddjup.p75.toFixed(1)} m
                      · {data.jorddjup.antal} obs
                      · {formatRadie(data.jorddjup.radieM)})
                    </span>
                  </div>
                )}
                {/* Sedimentjord: show small-aquifer raster (l/dygn/ha) — not relevant for morän/berg */}
                {aquifer?.type !== 'rock' && aquifer?.type !== 'till' && data.gvTillgangLdha != null && (
                  <div className="text-xs mb-1.5">
                    <span className="font-medium">Grundvattentillgång, små magasin:</span>
                    <span className="ml-1 text-blue-700 dark:text-blue-400 font-semibold">
                      {Math.round(data.gvTillgangLdha)} l/dygn/ha
                    </span>
                  </div>
                )}
                {/* Jord well median – primary for sediment aquifers, reference for morän/rock */}
                {aquifer?.type !== 'rock' && medianJordKapacitet != null && (
                  <div className={`text-xs mb-1.5 ${aquifer?.type === 'till' ? '' : ''}`}>
                    <span className={`font-medium ${aquifer?.type === 'till' ? 'text-muted-foreground' : ''}`}>
                      {aquifer?.type === 'till' ? 'Grävda/rörbrunnars kapacitet nära (referens):' : 'Grävda/rörbrunnars kapacitet nära:'}
                    </span>
                    <span className={`ml-1 font-semibold ${aquifer?.type === 'till' ? 'text-muted-foreground' : 'text-blue-700 dark:text-blue-400'}`}>
                      {medianJordKapacitet} l/h
                    </span>
                    <span className="text-muted-foreground ml-1">(median, {jordBrunnar.length} brunnar)</span>
                  </div>
                )}
                {/* Bedrock wells as reference for pure sediment aquifers only */}
                {aquifer?.type !== 'rock' && aquifer?.type !== 'till' && medianBergKapacitet != null && (
                  <div className="text-xs">
                    <span className="font-medium text-muted-foreground">Bergborrade brunnar nära (referens):</span>
                    <span className="ml-1 text-muted-foreground">{medianBergKapacitet} l/h</span>
                    <span className="text-muted-foreground ml-1">(median, {bergBrunnar.length} st) – alternativ om jordmagasinet otillräckligt</span>
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
                    SGU-HYPE område {data.omradeId}
                    {data.hypoDate && (
                      <span>
                        {' · '}{data.hypoDate.replace(/Z$/, '')}
                        {data.hypoDateIsFallback && <span className="italic"> (senaste tillgängliga)</span>}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      { label: 'Fyllnadsgrad\nSmå magasin', val: data.fyllnadsgradSma },
                      { label: 'Fyllnadsgrad\nStora magasin', val: data.fyllnadsgradStora },
                    ].map(({ label, val }) => (
                      <div key={label} className={`rounded-lg p-2.5 ${fyllnadBg(val)}`}>
                        <div className="text-xs text-muted-foreground mb-1 whitespace-pre-line leading-tight">{label}</div>
                        {val != null && val !== -1 ? (
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

              {/* Jorddjup */}
              {data.jorddjup && (
                <div className="flex justify-between items-baseline text-xs mb-1.5">
                  <span className="text-muted-foreground">Jorddjup ({formatRadie(data.jorddjup.radieM)}, {data.jorddjup.antal} obs)</span>
                  <span className="font-medium ml-2 text-right">
                    {data.jorddjup.median.toFixed(1)} m
                    <span className="text-muted-foreground font-normal ml-1">
                      ({data.jorddjup.p25.toFixed(1)}–{data.jorddjup.p75.toFixed(1)} m)
                    </span>
                  </span>
                </div>
              )}

              {/* Grundvattenmagasin */}
              {data.magasin && (
                <div className="mt-1 space-y-1">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-muted-foreground shrink-0">Grundvattenmagasin</span>
                    <span className="font-medium ml-2 text-right">{data.magasin.namn}</span>
                  </div>
                  {data.magasin.akvifertyp && (
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-muted-foreground shrink-0">Akvifertyp</span>
                      <span className="ml-2 text-right capitalize">{data.magasin.akvifertyp}</span>
                    </div>
                  )}
                  {data.magasin.genes && (
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-muted-foreground shrink-0">Genesis</span>
                      <span className="ml-2 text-right capitalize">{data.magasin.genes}</span>
                    </div>
                  )}
                  {data.magasin.medelmaktighetMattad && (
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-muted-foreground shrink-0">Mättad zon</span>
                      <span className="ml-2 text-right">{data.magasin.medelmaktighetMattad}</span>
                    </div>
                  )}
                  {data.magasin.tillrinningLs != null && (
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-muted-foreground shrink-0">Tillrinning</span>
                      <span className="font-medium ml-2">{data.magasin.tillrinningLs} l/s</span>
                    </div>
                  )}
                  {data.magasin.lankBeskrivning && (
                    <div className="text-xs mt-0.5">
                      <a
                        href={data.magasin.lankBeskrivning}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 dark:text-blue-400 underline underline-offset-2"
                      >
                        Magasinsbeskrivning (SGU) →
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Brunnar i närheten */}
            {data.brunnar && data.brunnar.length > 0 && (() => {
              // Sort: matching aquifer type first, then by capacity descending. Cap display at 8.
              // Berg/morän: bergborrade first; sediment: jord first
              const preferBerg = aquifer?.type === 'rock' || aquifer?.type === 'till';
              const sorted = [...data.brunnar].sort((a, b) => {
                const aMatch = preferBerg ? a.isBergborrad : !a.isBergborrad;
                const bMatch = preferBerg ? b.isBergborrad : !b.isBergborrad;
                if (aMatch !== bMatch) return aMatch ? -1 : 1;
                return (b.kapacitet ?? 0) - (a.kapacitet ?? 0);
              }).slice(0, 8);
              return (
                <>
                  <hr className="border-border" />
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Brunnar med kapacitetsdata i närheten
                      {data.brunnar.length > 8 && <span className="ml-1 font-normal">({data.brunnar.length} totalt, visar 8)</span>}
                    </h3>
                    <div className="space-y-1.5">
                      {sorted.map((b, i) => (
                        <div key={i} className="flex items-center justify-between bg-secondary/30 rounded px-2.5 py-1.5 text-xs">
                          <div>
                            <span className="font-medium">{b.id}</span>
                            <span className="text-muted-foreground ml-1.5">{b.isBergborrad ? 'berg' : 'jord'}</span>
                            {b.djup != null && <span className="text-muted-foreground ml-1.5">{b.djup} m</span>}
                          </div>
                          <div className="font-semibold text-blue-700 dark:text-blue-400 ml-2 shrink-0">{b.kapacitet} l/h</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}

            {/* ── DATAKÄLLOR ── */}
            <div className="pt-1 border-t border-border">
              <button
                onClick={() => setSourcesOpen(v => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full py-0.5 transition-colors"
              >
                <Info className="w-3 h-3 shrink-0" />
                <span>Datakällor</span>
                <ChevronDown className={`w-3 h-3 ml-auto transition-transform duration-150 ${sourcesOpen ? 'rotate-180' : ''}`} />
              </button>

              {sourcesOpen && (
                <div className="mt-2 space-y-2 text-xs">
                  {/* Group: Tolkning */}
                  <div className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Tolkning</div>

                  <SourceRow
                    label="Akvifer / jordart"
                    source="SGU Jordarter 1:25 000–100 000"
                    note="OGC API Features – CQL2-punkt­selektion, bbox-fallback. Klassificering intern (classifyAquifer)."
                    url="https://api.sgu.se/oppnadata/jordarter25k-100k/ogc/features/v1"
                  />
                  <SourceRow
                    label="Grundvattenmagasin"
                    source="SGU Grundvattenmagasin"
                    note="OGC API Features – bbox mot klickad punkt. Fält: magasinsnamn, akvifertyp, genes, tillrinning_fran_tillrinningsomraden_l_per_s, medelmaktighet_mattad_zon."
                    url="https://api.sgu.se/oppnadata/grundvattenmagasin/ogc/features/v1"
                  />
                  <SourceRow
                    label="Grundvattennivå – djupkalibrering"
                    source="SGU Grundvattennivåer observerade"
                    note="OGC API Features – stationer inom 50 km (bbox), nivaer via CQL2 IN-filter. Fält: grundvattenniva_m_u_markyta, akvifer (B*=berg, J*=jord), jordart_tx. Medianen skalas med HYPE-situationsfaktor."
                    url="https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1"
                  />
                  <SourceRow
                    label="Grundvattennivå – situation / fyllnadsgrad"
                    source="SGU-HYPE Grundvattennivåer"
                    note="OGC API Features – omrade_id via bbox, sedan fyllnadsgrad_sma/stora och grundvattensituation via CQL2-filter på datum. Månadsmodell; senaste tillgänglig visas om valt datum saknar data."
                    url="https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1"
                  />

                  {/* Group: Kapacitet */}
                  <div className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5 mt-1">Kapacitet</div>

                  <SourceRow
                    label="Brunnskapacitet (l/h)"
                    source="SGU Brunnar"
                    note="OGC API Features – brunnar inom ~15 km. Fält: kapacitet (l/h), totaldjup, jorddjup. isBergborrad = totaldjup − jorddjup > 15 m."
                    url="https://api.sgu.se/oppnadata/brunnar/ogc/features/v1"
                  />
                  <SourceRow
                    label="Tillrinning till magasin (l/s)"
                    source="SGU Grundvattenmagasin"
                    note="Fält: tillrinning_fran_tillrinningsomraden_l_per_s – karterad tillrinning till det namngivna magasinet."
                    url="https://api.sgu.se/oppnadata/grundvattenmagasin/ogc/features/v1"
                  />
                  <SourceRow
                    label="Jordlager / jorddjup (m)"
                    source="SGU Jorddjupsmodell – underlag-jorddjup"
                    note="OGC API Features – hämtar upp till 5 km, beräknar faktiskt avstånd per observation. Väljer minsta radier (100 m → 500 m → 2 km → 5 km) med ≥ 3 punkter. Fält: djup (m till berg), geometry (WGS84)."
                    url="https://api.sgu.se/oppnadata/jorddjupsmodell/ogc/features/v1"
                  />
                  <SourceRow
                    label="Grundvattentillgång små magasin (l/dygn/ha)"
                    source="SGU GV-tillgång små magasin (WMS)"
                    note="WMS GetFeatureInfo – rastervärde via proxy. Lager: grundvattentillgang-sma-magasin. Fält: Grundvattentillgang_i_sma_magasin_l_dygn_ha."
                    url="https://api.sgu.se/oppnadata/grundvattentillgang-sma-magasin/wms"
                  />

                  <p className="text-muted-foreground pt-1 leading-relaxed">
                    Tolkningar är uppskattningar baserade på modeller och regionala observationer. De ersätter inte platsspecifik hydrogeologisk undersökning.
                  </p>
                </div>
              )}

              {!sourcesOpen && (
                <p className="text-xs text-muted-foreground mt-1">
                  Tolkningar är uppskattningar – ersätter inte platsspecifik undersökning.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
