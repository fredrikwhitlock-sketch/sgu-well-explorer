import proj4 from "proj4";
import { supabase } from "@/integrations/supabase/client";
import { getSoilTypeColor } from "./soilTypeColors";
import { classifyAquifer, classifyByJg2, aquiferToBedgrKat } from "./aquifer";
import { GV_BEDGR, classifyParam, getSeason, mannKendall, analyzeSeasonality } from "./grundvattenKemi";

// Register SWEREF99 TM (EPSG:3006) here so this module is self-contained.
// MapView.tsx also registers it, but we cannot rely on module loading order.
if (!proj4.defs("EPSG:3006")) {
  proj4.defs("EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrunnInfo {
  id: string;
  lon?: number; lat?: number;
  kapacitet?: number;
  djup?: number;
  jorddjup?: number;
  isBergborrad: boolean;
  distKm?: number;
  adress?: string;
  typKod?: string;
}

export interface ReportData {
  lon: number;
  lat: number;
  sweref: [number, number];
  gvTillgangLdha?: number | null;
  jordartNamn?: string;
  jordartKod?: string;
  jordartKalla?: 'oversta-ytlager' | 'ytlager' | 'grundlager';
  jorddjup?: { djup: number };
  elevation?: number | null;
  magasin?: {
    namn: string;
    akvifertyp?: string;
    genes?: string;
    positionKod?: string;
    geomAreaKm2?: number;
    grvbildningstyp?: string;
    tillrinningLs?: number;
    medelmaktighetMattad?: string;
    medelmaktighetOmattad?: string;
    lankBeskrivning?: string;
    magasinsposition?: string;
  };
  brunnar?: BrunnInfo[];
  geokemi?: {
    distKm: number;
    distKmAes?: number;
    artal?: number;
    provtyp?: string;
    elements: Record<string, number | null>;
  };
  gvKemi?: Array<{
    provplatsid: string;
    lon?: number; lat?: number;
    provplatsnamn: string;
    distKm?: number;
    senasteprov?: string;
    seasonalSelection: boolean;
    fromBody: boolean;
    eucdGwb?: string;
    provplatskat?: string;
    region?: string;
    params: Array<{
      name: string;
      label: string;
      value: number;
      unit: string;
      klass: number;
      datum: string;
    }>;
    trend?: {
      yearSpan: number;
      nDates: number;
      params: Array<{
        name: string;
        label: string;
        unit: string;
        klass: number;
        latestValue: number;
        mk: { trend: 'increasing' | 'decreasing' | 'no trend'; significant: boolean; slope: number; n: number };
        hasSeasonality: boolean;
        seasonalAmplitudePct: number;
        series: Array<{ datum: string; value: number }>;
      }>;
    };
  }>;
  gvForekomstId?: string;
  hypeOmradeId?: number;
  hypeFyllnad?: { datum: string; sma: number | null; stora: number | null };
  /** 2-year daily HYPE fyllnadsgrad series – reused by the chart to avoid a second fetch. */
  hypeSeries?: Array<{ ts: number; fyllSma: number | null; fyllStora: number | null }>;
  obsFeatures?: Array<{ djup: number; jordart?: string; aquiferGroup?: 'rock' | 'jord'; aquiferSize?: 'large' | 'small' }>;
  obsStationer?: Array<{ id: string; lon?: number; lat?: number; namn: string; djup: number; obsdatum: string; distKm: number; aquiferGroup?: 'rock' | 'jord'; jordart?: string }>;
  delomrade?: {
    namn?: string;
    magasinsnamn?: string;
    uttagsmojligheter?: string;
    kornstorlek?: string;
    artesiskt?: string;
    nivaforhallande?: string;
    vattenkemi?: string;
    delomradeskvalitet?: string;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function mercatorToWGS84(x: number, y: number): [number, number] {
  const lon = (x / 20037508.34) * 180;
  const lat = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
  return [lon, lat];
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fetchWithTimeout(url: string, ms: number, signal: AbortSignal): Promise<Response> {
  const tc = new AbortController();
  const timer = setTimeout(() => tc.abort(), ms);
  signal.addEventListener('abort', () => { clearTimeout(timer); tc.abort(); }, { once: true });
  return fetch(url, { signal: tc.signal }).finally(() => clearTimeout(timer));
}

function findNearest(features: any[], lat: number, lon: number) {
  let best: { dist: number; p: any; artal?: number; provtyp?: string } | null = null;
  for (const f of features) {
    const coords = f.geometry?.coordinates;
    if (!coords) continue;
    const d = haversineKm(lat, lon, coords[1], coords[0]);
    if (!best || d < best.dist) best = { dist: d, p: f.properties ?? {}, artal: f.properties?.prov_artal, provtyp: f.properties?.provtyp };
  }
  return best;
}

// ── Main fetch function ───────────────────────────────────────────────────────

export async function fetchGrundvattenData(
  coordinate: [number, number],
  wmsProxyUrl: string,
  selectedDate: string,
  signal: AbortSignal,
  onPartial?: (partial: ReportData) => void,
): Promise<ReportData> {
  const [lon, lat] = mercatorToWGS84(coordinate[0], coordinate[1]);
  const sweref = proj4('EPSG:4326', 'EPSG:3006', [lon, lat]) as [number, number];

  const delta = 0.001;
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;

  const gvmBase = `https://api.sgu.se/oppnadata/grundvattenmagasin/ogc/features/v1/collections`;
  const gvmCql2Url = `${gvmBase}/grundvattenmagasin/items?f=json&filter=${encodeURIComponent(`S_INTERSECTS(geom,POINT(${lon} ${lat}))`)}&filter-lang=cql2-text&limit=1`;
  const delomradeUrl = `${gvmBase}/magasinsdelomraden/items?f=json&filter=${encodeURIComponent(`S_INTERSECTS(geom,POINT(${lon} ${lat}))`)}&filter-lang=cql2-text&limit=1`;

  const brunnarBase = `https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items?f=json`;
  const brunnarBbox = (d: number) => `${lon - d},${lat - d},${lon + d},${lat + d}`;
  const brunnarFetchJson = (d: number, limit: number) =>
    fetch(`${brunnarBase}&bbox=${brunnarBbox(d)}&limit=${limit}`, { signal })
      .then(r => r.ok ? r.json().catch(() => null) : null)
      .catch(() => null);

  const brunnarChain: Promise<any> = (async () => {
    const [close, medium] = await Promise.all([
      brunnarFetchJson(0.009, 50),
      brunnarFetchJson(0.045, 100),
    ]);
    const base = (medium?.features ?? []).length < 5
      ? (await brunnarFetchJson(0.13, 100)) ?? medium
      : medium;
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const f of [...(close?.features ?? []), ...(base?.features ?? [])]) {
      const key = String(f.properties?.brunnsid ?? f.id ?? '');
      if (key && !seen.has(key)) { seen.add(key); merged.push(f); }
    }
    return { features: merged };
  })();

  const [cx, cy] = coordinate;
  const djupWmsBbox = `${cx - 50},${cy - 50},${cx + 50},${cy + 50}`;
  const jorddjupWmsUrl =
    `${wmsProxyUrl}?url=${encodeURIComponent('https://maps3.sgu.se/geoserver/misc/ows')}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=SE.GOV.SGU.MISC.JORDDJUPSMODELL.RASTER_INTERVALL&QUERY_LAYERS=SE.GOV.SGU.MISC.JORDDJUPSMODELL.RASTER_INTERVALL&INFO_FORMAT=application%2Fjson&BBOX=${djupWmsBbox}&CRS=EPSG:3857&WIDTH=3&HEIGHT=3&I=1&J=1`;

  const gvTillgangUrl =
    `${wmsProxyUrl}?url=${encodeURIComponent('https://api.sgu.se/oppnadata/grundvattentillgang-sma-magasin/wms')}&LAYERS=grundvattentillgang-sma-magasin&VERSION=1.1.1&SERVICE=WMS&REQUEST=GetFeatureInfo&QUERY_LAYERS=grundvattentillgang-sma-magasin&INFO_FORMAT=application%2Fjson&BBOX=${bbox}&SRS=EPSG:4326&WIDTH=101&HEIGHT=101&X=50&Y=50`;

  const jordartApiBase = `https://api.sgu.se/oppnadata/jordarter25k-100k/ogc/features/v1/collections`;
  const jordartCqlFilter = `filter=${encodeURIComponent(`S_INTERSECTS(geom,POINT(${lon} ${lat}))`)}&filter-lang=cql2-text&limit=1`;
  const jordartCql2Url  = `${jordartApiBase}/grundlager/items?f=json&${jordartCqlFilter}`;
  const jordartBboxUrl  = `${jordartApiBase}/grundlager/items?f=json&bbox=${bbox}&limit=5`;
  const ytlagerCql2Url  = `${jordartApiBase}/ytlager/items?f=json&${jordartCqlFilter}`;
  const overstaCql2Url  = `${jordartApiBase}/oversta-ytlager/items?f=json&${jordartCqlFilter}`;

  // ±7-day window for nivaer
  const nivaerTargetMs2 = new Date(selectedDate).getTime();
  const nivaerWMs = 7 * 24 * 60 * 60 * 1000;
  const nivaerLoDate = new Date(nivaerTargetMs2 - nivaerWMs).toISOString().split('T')[0];
  const nivaerHiDate = new Date(nivaerTargetMs2 + nivaerWMs).toISOString().split('T')[0];

  // Station metadata maps built by obs stationer chain
  const stJordart   = new Map<string, string>();
  const stAkvifer   = new Map<string, 'rock' | 'jord'>();
  const stAkvifSize = new Map<string, 'large' | 'small'>();
  const stNamn      = new Map<string, string>();
  const stCoords    = new Map<string, [number, number]>();
  let nivaerPromise: Promise<any> | null = null;

  const latD50 = 0.45;
  const lonD50 = latD50 / Math.cos((lat * Math.PI) / 180);
  const obs50Bbox = `${lon - lonD50},${lat - latD50},${lon + lonD50},${lat + latD50}`;
  const obsBase = 'https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections';

  const sbStationerPromise = supabase
    .from('obs_stationer')
    .select('platsbeteckning, stationsnamn, jordart_tx, akvifer, lon, lat')
    .gte('lon', lon - lonD50).lte('lon', lon + lonD50)
    .gte('lat', lat - latD50).lte('lat', lat + latD50)
    .limit(500);

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
       const jordartTx = p.jordart_tx ?? p.jordart ?? '';
       stJordart.set(String(id), jordartTx);
       stNamn.set(String(id), String(p.stationsnamn ?? p.namn ?? id));
       const geom = f.geometry;
       if (geom?.type === 'Point' && Array.isArray(geom.coordinates)) {
         stCoords.set(String(id), [geom.coordinates[0], geom.coordinates[1]]);
       }
       const akv = String(p.akvifer ?? '').toUpperCase();
       if (akv.startsWith('B')) stAkvifer.set(String(id), 'rock');
       else if (akv.startsWith('J')) {
         stAkvifer.set(String(id), 'jord');
         stAkvifSize.set(String(id), classifyAquifer(jordartTx).useStoraMagasin ? 'large' : 'small');
       }
       ids.push(String(id));
     }
     if (ids.length > 0) {
       const sorted = ids
         .map(id => ({ id, dist: stCoords.has(id) ? haversineKm(lon, lat, stCoords.get(id)![0], stCoords.get(id)![1]) : 999 }))
         .sort((a, b) => a.dist - b.dist)
         .slice(0, 50)
         .map(x => x.id);
       const idList = sorted.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
       const filter = `platsbeteckning IN (${idList}) AND obsdatum >= '${nivaerLoDate}' AND obsdatum <= '${nivaerHiDate}'`;
       nivaerPromise = fetch(
         `${obsBase}/nivaer/items?f=json&filter=${encodeURIComponent(filter)}&filter-lang=cql2-text&sortby=obsdatum&limit=500`,
         { signal }
       ).then(r => r.ok ? r.json().catch(() => null) : null).catch(() => null);
     }
     return d;
   }).catch(() => null);

  const geokemiBase = `https://api.sgu.se/oppnadata/markgeokemi-regional/ogc/features/v1/collections`;
  const geokemiBbox = `bbox=${lon - 0.5},${lat - 0.35},${lon + 0.5},${lat + 0.35}&limit=30`;
  const geokemiMsBboxUrl  = `${geokemiBase}/moran_0063mm_ar_icpms/items?f=json&${geokemiBbox}`;
  const geokemiAesBboxUrl = `${geokemiBase}/moran_0063mm_ar_icpaes/items?f=json&${geokemiBbox}`;
  const gvKemiProvBboxUrl = `https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/provplatser/items?f=json&bbox=${lon - 0.6},${lat - 0.45},${lon + 0.6},${lat + 0.45}&limit=100`;
  const gvForekomstUrl = `https://api.sgu.se/oppnadata/grundvattenforekomster/ogc/features/v1/collections/grundvattenforekomster/items?f=json&filter=S_INTERSECTS(geom,POINT(${lon}%20${lat}))%20AND%20ms_cd%20LIKE%20'WA%25'&filter-lang=cql2-text&limit=1`;
  const hypeOmradeUrl = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/omraden/items?f=json&filter=${encodeURIComponent(`S_INTERSECTS(geom,POINT(${lon} ${lat}))`)}&filter-lang=cql2-text&limit=1`;

  // Fire all requests immediately so nothing waits needlessly.
  // Slow promises (elevation, geokemi, gvKemi) are kept as handles and awaited
  // after the fast core group, allowing onPartial to fire sooner.
  const elevationP  = fetchWithTimeout(`${wmsProxyUrl}?url=${encodeURIComponent(`https://api.opentopodata.org/v1/eudem25m?locations=${lat},${lon}`)}`, 8_000, signal);
  const geokemiAesP = fetch(geokemiAesBboxUrl, { signal });
  const geokemiMsP  = fetch(geokemiMsBboxUrl,  { signal });
  const gvKemiProvP = fetch(gvKemiProvBboxUrl,  { signal });

  const coreResults = await Promise.allSettled([
    fetchWithTimeout(gvTillgangUrl, 10_000, signal),  // 0
    fetch(jordartCql2Url, { signal }),                 // 1
    fetch(jordartBboxUrl, { signal }),                 // 2
    fetch(gvmCql2Url, { signal }),                     // 3
    fetch(delomradeUrl, { signal }),                   // 4
    fetchWithTimeout(jorddjupWmsUrl, 10_000, signal),  // 5
    obsStationerChain,                                 // 6
    fetch(ytlagerCql2Url, { signal }),                 // 7
    fetch(overstaCql2Url, { signal }),                 // 8
    fetch(gvForekomstUrl, { signal }),                 // 9
    fetch(hypeOmradeUrl, { signal }),                  // 10
  ]);
  const [gvTillgangRes, jordartCql2Res, jordartBboxRes, forekomstRes, delomradeRes,
         jorddjupRes, , ytlagerRes, overstaRes, gvForekomstRes, hypeOmradeRes] = coreResults;

  if (signal.aborted) throw new DOMException('aborted', 'AbortError');

  // Merge Supabase station cache
  const { data: sbStationer } = await sbStationerPromise;
  const useSbStationer = (sbStationer?.length ?? 0) > 0;
  if (useSbStationer) {
    for (const s of sbStationer!) {
      stNamn.set(s.platsbeteckning, s.stationsnamn ?? s.platsbeteckning);
      stJordart.set(s.platsbeteckning, s.jordart_tx ?? '');
      stCoords.set(s.platsbeteckning, [s.lon, s.lat]);
      const akv = String(s.akvifer ?? '').toUpperCase();
      if (akv.startsWith('B')) stAkvifer.set(s.platsbeteckning, 'rock');
      else if (akv.startsWith('J')) {
        stAkvifer.set(s.platsbeteckning, 'jord');
        stAkvifSize.set(s.platsbeteckning, classifyAquifer(s.jordart_tx ?? '').useStoraMagasin ? 'large' : 'small');
      }
    }
  }

  // Nivaer: cache (CF Worker / Supabase) + SGU API merged.
  // The cache only covers 628 out of 1 524 stations, so we ALWAYS also await
  // nivaerPromise (already in-flight from obsStationerChain) and merge both
  // result sets. The stBest deduplication below keeps the reading closest to
  // selectedDate per station, so duplicates are harmless.
  const stationIds = useSbStationer ? sbStationer!.map(s => s.platsbeteckning) : [];
  const cfWorkerUrl = import.meta.env.VITE_CF_WORKER_URL;
  const nivaerFetch: Promise<any> = (async () => {
    let cachedFeatures: any[] = [];

    if (useSbStationer && stationIds.length > 0) {
      if (cfWorkerUrl) {
        try {
          const res = await fetchWithTimeout(`${cfWorkerUrl}/obs-nivaer?ids=${stationIds.join(',')}&from=${nivaerLoDate}&to=${nivaerHiDate}`, 8_000, signal);
          if (res.ok) {
            const d = await res.json();
            if (d?.nivaer?.length > 0) {
              cachedFeatures = d.nivaer.map((r: any) => ({ properties: { platsbeteckning: r.platsbeteckning, obsdatum: r.obsdatum, grundvattenniva_m_u_markyta: r.nivaer_m } }));
            }
          }
        } catch { /* fall through */ }
      }
      if (cachedFeatures.length === 0) {
        const { data } = await supabase
          .from('obs_nivaer')
          .select('platsbeteckning, obsdatum, nivaer_m')
          .in('platsbeteckning', stationIds)
          .gte('obsdatum', nivaerLoDate)
          .lte('obsdatum', nivaerHiDate)
          .limit(500);
        if (data && data.length > 0) {
          cachedFeatures = data.map(r => ({ properties: { platsbeteckning: r.platsbeteckning, obsdatum: r.obsdatum, grundvattenniva_m_u_markyta: r.nivaer_m } }));
        }
      }
    }

    // Always merge with the SGU API result (already in-flight, no extra latency).
    // This fills in stations the cache doesn't cover.
    const sguData = nivaerPromise ? await nivaerPromise : null;
    const sguFeatures: any[] = sguData?.features ?? [];

    const merged = [...cachedFeatures, ...sguFeatures];
    return merged.length > 0 ? { features: merged } : null;
  })();

  const [nivaerData, brunnarData] = await Promise.all([nivaerFetch, brunnarChain]);

  if (signal.aborted) throw new DOMException('aborted', 'AbortError');

  const result: ReportData = { lon, lat, sweref };

  // GV Tillgång
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

  // Jordart: oversta-ytlager → ytlager → grundlager (CQL2), then grundlager bbox
  const extractJordart = (features: any[]): { name: string; kod: string } | null => {
    if (!features?.length) return null;
    const f = features[0];
    const jg2 = f.properties?.jg2 ?? f.properties?.JG2;
    if (jg2 == null) return null;
    return { name: getSoilTypeColor(Number(jg2)).name, kod: String(jg2) };
  };
  try {
    let jordart: { name: string; kod: string } | null = null;
    let kalla: ReportData['jordartKalla'] = undefined;

    const tryRes = async (res: PromiseSettledResult<Response>, k: ReportData['jordartKalla']) => {
      if (jordart) return;
      if (res.status === 'fulfilled' && res.value.ok) {
        const d = await res.value.json().catch(() => null);
        const j = extractJordart(d?.features);
        if (j) { jordart = j; kalla = k; }
      }
    };

    await tryRes(overstaRes,     'oversta-ytlager');
    await tryRes(ytlagerRes,     'ytlager');
    await tryRes(jordartCql2Res, 'grundlager');
    if (!jordart && jordartBboxRes.status === 'fulfilled' && jordartBboxRes.value.ok) {
      const d = await jordartBboxRes.value.json().catch(() => null);
      const nonWater = (d?.features ?? []).filter((f: any) => {
        const jg2 = f.properties?.jg2 ?? f.properties?.JG2;
        return jg2 != null && Number(jg2) !== 91;
      });
      const j = extractJordart(nonWater);
      if (j) { jordart = j; kalla = 'grundlager'; }
    }
    if (jordart) { result.jordartNamn = jordart.name; result.jordartKod = jordart.kod; result.jordartKalla = kalla; }
  } catch { /* ignore */ }

  // Grundvattenmagasin
  if (forekomstRes.status === 'fulfilled' && forekomstRes.value.ok) {
    try {
      const d = await forekomstRes.value.json();
      if (d.features?.length > 0) {
        const p = d.features[0].properties ?? {};
        result.magasin = {
          namn: p.magasinsnamn || p.namn || 'Grundvattenmagasin',
          akvifertyp:            p.akvifertyp || undefined,
          genes:                 p.genes || undefined,
          positionKod:           typeof p.magasinsposition === 'string'
                                   ? (p.magasinsposition.match(/^[JB]\d/)?.[0] ?? undefined)
                                   : undefined,
          geomAreaKm2:           typeof p.geom_area === 'number' && p.geom_area > 0
                                   ? Math.round(p.geom_area / 1e5) / 10 : undefined,
          grvbildningstyp:       p.grvbildningstyp_kod > 0 ? p.grvbildningstyp : undefined,
          tillrinningLs:         typeof p.tillrinning_fran_tillrinningsomraden_l_per_s === 'number'
                                   ? p.tillrinning_fran_tillrinningsomraden_l_per_s : undefined,
          medelmaktighetMattad:  p.medelmaktighet_mattad_zon_kod > 0 ? p.medelmaktighet_mattad_zon : undefined,
          medelmaktighetOmattad: p.medelmaktighet_omattad_zon_kod > 0 ? p.medelmaktighet_omattad_zon : undefined,
          lankBeskrivning:       p.lank_magasinsbeskrivning || undefined,
          magasinsposition:      p.magasinsposition_kod > 0 ? p.magasinsposition : undefined,
        };
      }
    } catch { /* ignore */ }
  }

  // Magasinsdelområde
  if (delomradeRes.status === 'fulfilled' && delomradeRes.value.ok) {
    try {
      const d = await delomradeRes.value.json();
      if (d.features?.length > 0) {
        const p = d.features[0].properties ?? {};
        result.delomrade = {
          namn:               p.delomradesnamn || undefined,
          magasinsnamn:       p.magasinsnamn || undefined,
          uttagsmojligheter:  p.uttagsmojligheter || undefined,
          kornstorlek:        p.kornstorlek_kod > 0 ? p.kornstorlek : undefined,
          artesiskt:          p.artesiskt_kod > 0 ? p.artesiskt : undefined,
          nivaforhallande:    p.nivaforhallande_kod > 0 ? p.nivaforhallande : undefined,
          vattenkemi:         p.vattenkemi_kod > 0 ? p.vattenkemi : undefined,
          delomradeskvalitet: p.delomradeskvalitet_kod > 0 ? p.delomradeskvalitet : undefined,
        };
      }
    } catch { /* ignore */ }
  }

  // Brunnar
  if (brunnarData?.features?.length > 0) {
    result.brunnar = brunnarData.features
      .map((f: any) => {
        const p = f.properties ?? {};
        const totaldjup = p.totaldjup ?? p.borrhalsdjup ?? null;
        const jorddjup  = p.jorddjup ?? 0;
        const coords = f.geometry?.type === 'Point' ? f.geometry.coordinates : null;
        const distKm = coords
          ? Math.round(haversineKm(lat, lon, coords[1], coords[0]) * 10) / 10
          : undefined;
        return {
          id: p.brunnsid || p.id || f.id || '?',
          lon: coords ? coords[0] : undefined,
          lat: coords ? coords[1] : undefined,
          kapacitet: p.kapacitet,
          djup: totaldjup,
          jorddjup,
          isBergborrad: totaldjup != null && (totaldjup - jorddjup) > 15,
          distKm,
          adress: p.adress || p.plats || p.fastighetsadress || undefined,
          typKod: p.typ_kod || p.brunnsstyp || undefined,
        };
      })
      .sort((a: any, b: any) => (a.distKm ?? 999) - (b.distKm ?? 999))
      .slice(0, 20);
  }

  // Jorddjup (WMS 10×10 m raster)
  if (jorddjupRes.status === 'fulfilled' && jorddjupRes.value.ok) {
    try {
      const d = await jorddjupRes.value.json();
      const p = d.features?.[0]?.properties ?? {};
      // Try all known property name variants for this layer
      const raw = p.jorddjup_10x10m ?? p.jorddjup_intervall ?? p.jorddjup
        ?? p.GRAY_INDEX ?? p.gray_index ?? p.value ?? p.VALUE ?? null;
      // Parse both plain numbers and interval strings like "3-5" or ">50"
      const djup = (() => {
        if (raw == null) return NaN;
        if (typeof raw === 'number') return raw;
        const s = String(raw).replace(/\s*(m|meter)\s*/gi, '').trim();
        const n = Number(s);
        if (Number.isFinite(n)) return n;
        const range = s.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
        if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
        const gt = s.match(/^>\s*(\d+(?:\.\d+)?)$/);
        if (gt) return parseFloat(gt[1]);
        return parseFloat(s);
      })();
      if (!isNaN(djup) && djup >= 0 && djup < 500) {
        result.jorddjup = { djup: Math.round(djup * 10) / 10 };
      }
    } catch { /* ignore */ }
  }

  // HYPE avrinningsområde – fast S_INTERSECTS lookup in core group
  if (hypeOmradeRes.status === 'fulfilled' && hypeOmradeRes.value.ok) {
    try {
      const d = await hypeOmradeRes.value.json();
      const id = d.features?.[0]?.properties?.omrade_id;
      if (typeof id === 'number') result.hypeOmradeId = id;
    } catch { /* ignore */ }
  }

  // ── Core data is ready – fire partial callback so the panel can render ──────
  // Elevation, geokemi, gvKemi, and hypeFyllnad are still loading below.
  if (!signal.aborted) onPartial?.({ ...result });

  // Await the slow group (they've been running in parallel since start)
  const [elevationRes, geokemiAesRes, geokemiMsRes, gvKemiProvRes] = await Promise.allSettled([
    elevationP, geokemiAesP, geokemiMsP, gvKemiProvP,
  ]);

  if (signal.aborted) throw new DOMException('aborted', 'AbortError');

  // Elevation (EU-DEM 25m)
  if (elevationRes.status === 'fulfilled' && elevationRes.value.ok) {
    try {
      const ed = await elevationRes.value.json();
      const elev = ed.results?.[0]?.elevation;
      if (typeof elev === 'number') result.elevation = Math.round(elev);
    } catch { /* ignore */ }
  }

  // HYPE fyllnadsgrad – fetch the full 2-year daily series once. The chart reuses
  // it (no second request) and the quick value/AI/export read its latest point.
  // Bounded datum range + omrade_id keeps the query indexed/fast (~725 rows, <1s).
  if (result.hypeOmradeId != null && !signal.aborted) {
    try {
      const hi = new Date();
      const lo = new Date(); lo.setFullYear(lo.getFullYear() - 2);
      const ymd = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const hypeFilter = `datum>='${ymd(lo)}' AND datum<='${ymd(hi)}' AND omrade_id=${result.hypeOmradeId}`;
      const hypeUrl = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/grundvattennivaer-tidigare/items?f=json&filter=${encodeURIComponent(hypeFilter)}&filter-lang=cql2-text&limit=1000`;
      const hr = await fetchWithTimeout(hypeUrl, 8_000, signal);
      if (hr.ok) {
        const hd = await hr.json().catch(() => null);
        const feats: any[] = hd?.features ?? [];
        const clean = (x: any): number | null => {
          const n = Number(x);
          return !Number.isFinite(n) || n === -1 || n === 99 ? null : n;
        };
        const series = feats
          .map((f: any) => {
            const p = f.properties ?? {};
            const datum = String(p.datum ?? '').slice(0, 10);
            return {
              datum,
              ts: new Date(datum).getTime(),
              fyllSma: clean(p.fyllnadsgrad_sma),
              fyllStora: clean(p.fyllnadsgrad_stora),
            };
          })
          .filter(p => Number.isFinite(p.ts))
          .sort((a, b) => a.ts - b.ts);

        if (series.length > 0) {
          result.hypeSeries = series.map(({ ts, fyllSma, fyllStora }) => ({ ts, fyllSma, fyllStora }));
          const latest = series[series.length - 1];
          result.hypeFyllnad = { datum: latest.datum, sma: latest.fyllSma, stora: latest.fyllStora };
        }
      }
    } catch { /* ignore */ }
  }

  // Geokemi (ICP-MS + ICP-AES morän)
  try {
    const [msData, aesData] = await Promise.all([
      geokemiMsRes.status  === 'fulfilled' && geokemiMsRes.value.ok  ? geokemiMsRes.value.json().catch(() => null)  : null,
      geokemiAesRes.status === 'fulfilled' && geokemiAesRes.value.ok ? geokemiAesRes.value.json().catch(() => null) : null,
    ]);

    const ms  = findNearest(msData?.features  ?? [], lat, lon);
    const aes = findNearest(aesData?.features ?? [], lat, lon);

    if (ms || aes) {
      const num = (p: any, k: string) => { const v = p?.[k]; return typeof v === 'number' && v > 0 ? v : null; };
      const oxToEl = (v: number | null, factor: number) => v != null ? Math.round(v * factor * 10) / 10 : null;
      result.geokemi = {
        distKm:    Math.round((ms?.dist ?? aes!.dist) * 10) / 10,
        distKmAes: aes ? Math.round(aes.dist * 10) / 10 : undefined,
        artal:   ms?.artal   ?? aes?.artal,
        provtyp: ms?.provtyp ?? aes?.provtyp,
        elements: {
          as: num(ms?.p, 'as_ppm'),
          cd: num(ms?.p, 'cd_ppm'),
          mo: num(ms?.p, 'mo_ppm'),
          u:  num(ms?.p, 'u_ppm'),
          sb: num(ms?.p, 'sb_ppm'),
          cu: num(ms?.p, 'cu_ppm') ?? num(aes?.p, 'cu_ppm'),
          ni: num(aes?.p, 'ni_ppm'),
          pb: num(aes?.p, 'pb_ppm'),
          cr: num(aes?.p, 'cr_ppm'),
          co: num(aes?.p, 'co_ppm'),
          v:  num(aes?.p, 'v_ppm'),
          zn: num(aes?.p, 'zn_ppm'),
          fe: oxToEl(num(aes?.p, 'fe2o3_proc'), 6994),
          mn: oxToEl(num(aes?.p, 'mno_proc'),   7745),
          ca: oxToEl(num(aes?.p, 'cao_proc'),   7147),
          mg: oxToEl(num(aes?.p, 'mgo_proc'),   6032),
        },
      };
    }
  } catch { /* ignore */ }

  // GV-kemi
  try {
    if (gvKemiProvRes.status === 'fulfilled' && gvKemiProvRes.value.ok) {
      const pd = await gvKemiProvRes.value.json().catch(() => null);
      const bboxFeatures: any[] = pd?.features ?? [];

      let bodyId: string | null = null;
      let bodyBbox: [number, number, number, number] | null = null;
      if (gvForekomstRes.status === 'fulfilled' && gvForekomstRes.value.ok) {
        try {
          const fd = await gvForekomstRes.value.json().catch(() => null);
          const feat = fd?.features?.[0];
          if (feat) {
            const fp = feat.properties ?? {};
            const msCd = fp.ms_cd || fp.eucd_gwb || fp.eu_cd || fp.eucd || null;
            if (msCd) bodyId = String(msCd).trim();
            const geom = feat.geometry;
            if (geom?.type === 'Polygon' || geom?.type === 'MultiPolygon') {
              const rings: number[][][] = geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat(1);
              const pts: number[][] = rings.flat();
              const lons = pts.map((c: number[]) => c[0]);
              const lats = pts.map((c: number[]) => c[1]);
              bodyBbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
            }
          }
        } catch { /* ignore */ }
      }

      let bodyFeatures: any[] = [];
      if (bodyBbox || bodyId) {
        const fetches: Promise<Response | null>[] = [];
        if (bodyBbox) {
          const [bx0, by0, bx1, by1] = bodyBbox;
          fetches.push(
            fetch(`https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/provplatser/items?f=json&bbox=${bx0},${by0},${bx1},${by1}&limit=200`, { signal }).catch(() => null)
          );
        }
        if (bodyId) {
          fetches.push(
            fetch(`https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/provplatser/items?f=json&filter=eucd_gwb='${bodyId}'&filter-lang=cql2-text&limit=100`, { signal }).catch(() => null)
          );
        }
        const bodyResponses = await Promise.allSettled(fetches);
        for (const r of bodyResponses) {
          if (r.status === 'fulfilled' && r.value?.ok) {
            const bd = await r.value.json().catch(() => null);
            bodyFeatures.push(...(bd?.features ?? []));
          }
        }
      }
      if (bodyId && bodyFeatures.length > 0) result.gvForekomstId = bodyId;
      else if (bodyBbox && bodyFeatures.length > 0) result.gvForekomstId = '(förekomst)';

      const seen = new Set<string>();
      const merged: any[] = [];
      for (const f of [...bboxFeatures, ...bodyFeatures]) {
        const id = String(f.properties?.nationellt_provplatsid ?? '');
        if (id && !seen.has(id)) { seen.add(id); merged.push(f); }
      }

      type Cand = { dist: number | null; p: any; lon?: number; lat?: number };
      const bodyIds = new Set(bodyFeatures.map(f => String(f.properties?.nationellt_provplatsid ?? '')));

      let candidates: Cand[];
      if (bodyFeatures.length > 0) {
        candidates = merged
          .map((f): Cand => {
            const coords = f.geometry?.coordinates;
            const id = String(f.properties?.nationellt_provplatsid ?? '');
            const dist = coords ? haversineKm(lat, lon, coords[1], coords[0]) : null;
            return { dist: bodyIds.has(id) || (dist !== null && dist <= 50) ? dist : -1, p: f.properties ?? {}, lon: coords?.[0], lat: coords?.[1] };
          })
          .filter(x => x.dist !== -1)
          .sort((a, b) => {
            if (a.dist === null && b.dist === null) return 0;
            if (a.dist === null) return 1;
            if (b.dist === null) return -1;
            return a.dist - b.dist;
          })
          .slice(0, 20);
      } else {
        const withCoords = merged
          .map(f => {
            const coords = f.geometry?.coordinates;
            if (!coords) return null;
            const dist = haversineKm(lat, lon, coords[1], coords[0]);
            return dist <= 50 ? { dist, p: f.properties ?? {}, lon: coords[0], lat: coords[1] } : null;
          })
          .filter((x): x is { dist: number; p: any; lon: number; lat: number } => x !== null);
        const locAq = result.jordartKod
          ? classifyByJg2(Number(result.jordartKod))
          : classifyAquifer(result.jordartNamn);
        const targetKat = aquiferToBedgrKat(locAq, result.jordartKod);
        const aqFiltered = targetKat !== null ? withCoords.filter(x => x.p.provplatskat_bedgr === targetKat) : [];
        candidates = (aqFiltered.length > 0 ? aqFiltered : withCoords)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 5);
      }

      if (candidates.length > 0) {
        const analysResponses = await Promise.allSettled(
          candidates.map(({ p }) => {
            const pid = p.nationellt_provplatsid;
            const url = `https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/analysresultat/items?f=json&filter=nationellt_provplatsid=${pid}&filter-lang=cql2-text&sortby=-provtagningsdatum&limit=500`;
            return fetch(url, { signal }).catch(() => null);
          })
        );
        const parsedAnalys = await Promise.all(
          analysResponses.map(r =>
            r.status === 'fulfilled' && r.value?.ok ? r.value.json().catch(() => null) : Promise.resolve(null)
          )
        );

        const kemiStations: NonNullable<ReportData['gvKemi']> = [];
        for (let i = 0; i < candidates.length; i++) {
          const cand = candidates[i];
          const ad = parsedAnalys[i];

          const byDate = new Map<string, Map<string, { value: number; unit: string }>>();
          for (const f of ad?.features ?? []) {
            const p = f.properties ?? {};
            const pname: string = p.parameternamn ?? '';
            const datum = (p.provtagningsdatum ?? '').slice(0, 10);
            const rawVal = parseFloat(p.matvardetal ?? '');
            if (!datum || !pname || isNaN(rawVal) || rawVal < 0) continue;
            if (!byDate.has(datum)) byDate.set(datum, new Map());
            if (!byDate.get(datum)!.has(pname))
              byDate.get(datum)!.set(pname, { value: rawVal, unit: p.enhet_tx ?? p.enhet ?? '' });
          }

          const dates = [...byDate.keys()].sort().reverse();
          const classifiableDates = dates.filter(d => {
            const dp = byDate.get(d)!;
            return dp.has('pH') || dp.has('pH, mätt i fält') || [...dp.keys()].some(k => k in GV_BEDGR);
          });
          if (classifiableDates.length === 0) continue;

          const targetSeason = getSeason(parseInt(selectedDate.slice(5, 7), 10));
          let snapshotDate: string;
          let seasonalSelection = false;
          if (classifiableDates.length >= 4) {
            const sameSeason = classifiableDates.filter(
              d => getSeason(parseInt(d.slice(5, 7), 10)) === targetSeason
            );
            if (sameSeason.length > 0) { snapshotDate = sameSeason[0]; seasonalSelection = true; }
            else snapshotDate = classifiableDates[0];
          } else {
            snapshotDate = classifiableDates[0];
          }

          const snapshot = byDate.get(snapshotDate)!;
          const params: Array<{ name: string; label: string; value: number; unit: string; klass: number; datum: string }> = [];
          const phEntry = snapshot.get('pH') ?? snapshot.get('pH, mätt i fält');
          if (phEntry) params.push({ name: 'pH', label: 'pH', ...phEntry, datum: snapshotDate, klass: classifyParam('pH', phEntry.value) });
          for (const [pname, bedgr] of Object.entries(GV_BEDGR)) {
            const entry = snapshot.get(pname);
            if (entry) params.push({ name: pname, label: bedgr.label, ...entry, datum: snapshotDate, klass: classifyParam(pname, entry.value) });
          }
          if (params.length === 0) continue;

          const allDates = [...byDate.keys()].sort();
          const yearSpan = allDates.length >= 2
            ? parseInt(allDates[allDates.length - 1].slice(0, 4), 10) - parseInt(allDates[0].slice(0, 4), 10)
            : 0;
          const isTrendStation =
            cand.p.trendstation === true ||
            String(cand.p.stationstyp ?? '').toLowerCase().includes('trend') ||
            (classifiableDates.length >= 10 && yearSpan >= 5);

          let trend: NonNullable<ReportData['gvKemi']>[number]['trend'];
          if (isTrendStation) {
            const allSeries = new Map<string, Array<{ datum: string; value: number }>>();
            for (const [d, paramMap] of byDate) {
              for (const [pname, { value }] of paramMap) {
                if (!allSeries.has(pname)) allSeries.set(pname, []);
                allSeries.get(pname)!.push({ datum: d, value });
              }
            }
            const trendParams: NonNullable<typeof trend>['params'] = [];
            const addTrend = (name: string, label: string, unit: string, series: Array<{ datum: string; value: number }>) => {
              if (series.length < 4) return;
              const mk = mannKendall(series);
              const { hasSeasonality, relAmplitude } = analyzeSeasonality(series);
              const latest = series.slice().sort((a, b) => b.datum.localeCompare(a.datum))[0].value;
              trendParams.push({
                name, label, unit,
                klass: classifyParam(name === 'pH' ? 'pH' : name, latest),
                latestValue: latest, mk, hasSeasonality,
                seasonalAmplitudePct: Math.round(relAmplitude * 100),
                series: series.slice().sort((a, b) => a.datum.localeCompare(b.datum)),
              });
            };
            const phSeries = allSeries.get('pH') ?? allSeries.get('pH, mätt i fält') ?? [];
            addTrend('pH', 'pH', '', phSeries);
            for (const [pname, bedgr] of Object.entries(GV_BEDGR)) {
              const s = allSeries.get(pname);
              if (s) addTrend(pname, bedgr.label, bedgr.unit, s);
            }
            if (trendParams.length > 0) {
              trendParams.sort((a, b) => {
                if (a.mk.significant !== b.mk.significant) return a.mk.significant ? -1 : 1;
                if (a.mk.trend === 'no trend' && b.mk.trend !== 'no trend') return 1;
                if (b.mk.trend === 'no trend' && a.mk.trend !== 'no trend') return -1;
                return Math.abs(b.mk.slope) - Math.abs(a.mk.slope);
              });
              trend = { yearSpan, nDates: classifiableDates.length, params: trendParams };
            }
          }

          kemiStations.push({
            provplatsid: String(cand.p.nationellt_provplatsid),
            lon: cand.lon, lat: cand.lat,
            provplatsnamn: cand.p.provplatsnamn ?? '',
            distKm: cand.dist != null ? Math.round(cand.dist * 10) / 10 : undefined,
            senasteprov: snapshotDate, seasonalSelection,
            fromBody: bodyIds.has(String(cand.p.nationellt_provplatsid)),
            eucdGwb: cand.p.eucd_gwb || cand.p.eu_cd_gwb || cand.p.eu_cd || undefined,
            provplatskat: cand.p.provplatskat_bedgr_tx ?? undefined,
            region: cand.p.region_bdgr_tx ?? undefined,
            params, trend,
          });
        }
        if (kemiStations.length > 0) result.gvKemi = kemiStations;
      }
    }
  } catch { /* ignore */ }

  // Observed nivaer: pick reading closest to selectedDate per station
  const nivaerTargetMs = new Date(selectedDate).getTime();
  const stBest = new Map<string, { djup: number; distMs: number; obsdatum: string }>();
  const obsArr: Array<{ djup: number; jordart?: string; aquiferGroup?: 'rock' | 'jord'; aquiferSize?: 'large' | 'small' }> = [];
  try {
    for (const f of nivaerData?.features ?? []) {
      const p = f.properties ?? {};
      const sid = String(p.platsbeteckning ?? '');
      if (!sid) continue;
      const djup = p.grundvattenniva_m_u_markyta;
      if (typeof djup !== 'number' || djup <= 0 || djup > 100) continue;
      const obsDateStr = String(p.obsdatum ?? '').split('T')[0];
      const obsMs = obsDateStr ? new Date(obsDateStr).getTime() : NaN;
      const dist = isNaN(obsMs) ? Infinity : Math.abs(obsMs - nivaerTargetMs);
      const prev = stBest.get(sid);
      if (!prev || dist < prev.distMs) stBest.set(sid, { djup, distMs: dist, obsdatum: obsDateStr });
    }
    for (const [sid, { djup, obsdatum }] of stBest) {
      obsArr.push({
        djup,
        jordart:      stJordart.get(sid) || undefined,
        aquiferGroup: stAkvifer.get(sid),
        aquiferSize:  stAkvifSize.get(sid),
      });
      const coords = stCoords.get(sid);
      if (coords) {
        const distKm = Math.round(haversineKm(lat, lon, coords[1], coords[0]) * 10) / 10;
        (result.obsStationer ??= []).push({
          id: sid, lon: coords[0], lat: coords[1],
          namn: stNamn.get(sid) ?? sid,
          djup, obsdatum, distKm,
          aquiferGroup: stAkvifer.get(sid),
          jordart: stJordart.get(sid) || undefined,
        });
      }
    }
    result.obsStationer?.sort((a, b) => a.distKm - b.distKm);
  } catch { /* ignore */ }
  if (obsArr.length) result.obsFeatures = obsArr;

  return result;
}
