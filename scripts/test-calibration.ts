// Empirical test: run the calibration against real SGU stations to see
// acceptance rates and where fits get rejected.
import { fitHypeToObservations } from '../src/lib/hypeCalibration';

const DAY_MS = 86_400_000;

async function getJson(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  return r.json();
}

function parseCSVRow(line: string): string[] {
  const cols: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { cols.push(cur); cur = ''; }
    else cur += ch;
  }
  cols.push(cur);
  return cols;
}

async function fetchObs(plats: string) {
  const enc = encodeURIComponent(plats).replace(/'/g, '%27');
  const url = `https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/nivaer/items?filter=platsbeteckning%20%3D%20%27${enc}%27&f=text/csv`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const text = await r.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]);
  const dCol = headers.indexOf('obsdatum');
  let vCol = headers.indexOf('grundvattenniva_m_u_markyta');
  if (vCol < 0) vCol = headers.indexOf('grundvattenniva_m_urok');
  if (dCol < 0 || vCol < 0) return [];
  const out: Array<{ ts: number; djup: number }> = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = parseCSVRow(line);
    const date = (cols[dCol] ?? '').split('T')[0];
    const v = parseFloat((cols[vCol] ?? '').replace(',', '.'));
    if (!date || isNaN(v) || v === 0) continue;
    out.push({ ts: new Date(date).getTime(), djup: v });
  }
  return out;
}

async function fetchHype(lon: number, lat: number) {
  const omradeUrl = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/omraden/items?f=json&filter=${encodeURIComponent(`S_INTERSECTS(geom,POINT(${lon} ${lat}))`)}&filter-lang=cql2-text&limit=1`;
  const od = await getJson(omradeUrl);
  const omradeId = od.features?.[0]?.properties?.omrade_id;
  if (typeof omradeId !== 'number') return null;
  const today = new Date().toISOString().substring(0, 10);
  const ranges: Array<[string, string]> = [
    ['1960-01-01', '1979-12-31'], ['1980-01-01', '1999-12-31'],
    ['2000-01-01', '2014-12-31'], ['2015-01-01', today],
  ];
  const chunks = await Promise.all(ranges.map(async ([from, to]) => {
    const filter = `datum>='${from}' AND datum<='${to}' AND omrade_id=${omradeId}`;
    const url = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/grundvattennivaer-tidigare/items?f=json&filter=${encodeURIComponent(filter)}&filter-lang=cql2-text&limit=10000`;
    try { return (await getJson(url)).features ?? []; } catch { return []; }
  }));
  const clean = (x: any) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? n : null; };
  return chunks.flat()
    .map((f: any) => {
      const p = f.properties ?? {};
      const datum = typeof p.datum === 'string' ? p.datum.substring(0, 10) : null;
      if (!datum) return null;
      const ts = new Date(datum).getTime();
      return Number.isFinite(ts) ? { ts, fyllSma: clean(p.fyllnadsgrad_sma), fyllStora: clean(p.fyllnadsgrad_stora) } : null;
    })
    .filter((x: any) => x !== null)
    .sort((a: any, b: any) => a.ts - b.ts);
}

async function main() {
  // Grab some stations with long records from different parts of Sweden
  const stUrl = `https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/stationer/items?f=json&limit=15`;
  const sd = await getJson(stUrl);
  const stations = (sd.features ?? [])
    .filter((f: any) => f.properties?.platsbeteckning && f.geometry?.coordinates)
    .slice(0, 8);

  let accepted = 0, rejected = 0;
  for (const st of stations) {
    const plats = st.properties.platsbeteckning;
    const [lon, lat] = st.geometry.coordinates;
    try {
      const obs = await fetchObs(plats);
      if (obs.length < 8) { console.log(`${plats}: bara ${obs.length} obs — hoppar`); continue; }
      const hype = await fetchHype(lon, lat);
      if (!hype || hype.length < 30) { console.log(`${plats}: ingen HYPE`); continue; }
      const fit = fitHypeToObservations(obs, hype as any);
      if (fit) {
        accepted++;
        console.log(`${plats}: ACCEPTERAD  n=${fit.n} r2=${fit.r2.toFixed(2)} valR2=${fit.valR2?.toFixed(2) ?? '–'} T=${fit.memoryDays}d ${fit.source} conf=${fit.confidence}`);
      } else {
        rejected++;
        // diagnose: try with lenient settings
        const lenient = fitHypeToObservations(obs, hype as any, 0.0);
        if (lenient) {
          console.log(`${plats}: AVVISAD    n=${lenient.n} r2=${lenient.r2.toFixed(2)} valR2=${lenient.valR2?.toFixed(2) ?? '–'} T=${lenient.memoryDays}d ${lenient.source}  <-- skulle visas med minR2=0`);
        } else {
          console.log(`${plats}: AVVISAD    (även med minR2=0 → valR2-gate eller för få par)`);
        }
      }
    } catch (e: any) {
      console.log(`${plats}: FEL ${e?.message}`);
    }
  }
  console.log(`\nResultat: ${accepted} accepterade, ${rejected} avvisade`);
}

main().catch(e => { console.error(e); process.exit(1); });
