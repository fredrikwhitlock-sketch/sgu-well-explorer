// Empirical test: run the chemistry calibration against real SGU provplatser
// to see acceptance rates per parameter class and sanity-check the fits.
import { fitChemToHype, classifyParameter } from '../src/lib/chemCalibration';

async function getJson(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  return r.json();
}

const PARAMS = ['Klorid', 'Konduktivitet', 'Alkalinitet', 'Kalcium', 'pH', 'Järn', 'Mangan', 'Nitrat'];

async function fetchAnalys(id: number) {
  const url = `https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/analysresultat/items?f=json&limit=10000&filter=nationellt_provplatsid=${id}&filter-lang=cql2-text`;
  const feats = (await getJson(url)).features ?? [];
  const byParam = new Map<string, Array<{ ts: number; v: number }>>();
  for (const f of feats) {
    const p = f.properties ?? {};
    const name = p.parameternamn;
    const d = (p.provtagningsdatum ?? '').slice(0, 10);
    if (!name || !d) continue;
    const raw = String(p.matvardetal ?? '').trim();
    const censored = raw.startsWith('<');
    const v = parseFloat(raw.replace(/^</, '').replace(/\s/g, '').replace(',', '.'));
    if (isNaN(v)) continue;
    if (!byParam.has(name)) byParam.set(name, []);
    byParam.get(name)!.push({ ts: new Date(d).getTime(), v: censored ? v / 2 : v });
  }
  return byParam;
}

async function fetchHype(lon: number, lat: number) {
  const omradeUrl = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/omraden/items?f=json&filter=${encodeURIComponent(`S_INTERSECTS(geom,POINT(${lon} ${lat}))`)}&filter-lang=cql2-text&limit=1`;
  const od = await getJson(omradeUrl);
  const omradeId = od.features?.[0]?.properties?.omrade_id;
  if (typeof omradeId !== 'number') return null;
  const today = new Date().toISOString().substring(0, 10);
  const ranges: Array<[string, string]> = [
    ['1995-01-01', '2009-12-31'], ['2010-01-01', today],
  ];
  const chunks = await Promise.all(ranges.map(async ([from, to]) => {
    const filter = `datum>='${from}' AND datum<='${to}' AND omrade_id=${omradeId}`;
    const url = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/grundvattennivaer-tidigare/items?f=json&filter=${encodeURIComponent(filter)}&filter-lang=cql2-text&limit=10000`;
    try { return (await getJson(url)).features ?? []; } catch { return []; }
  }));
  const clean = (x: unknown) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? n : null; };
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
  // Provplatser with visible coordinates and long records
  const ppUrl = `https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/provplatser/items?f=json&limit=60&filter=${encodeURIComponent("antal_provtillf>=25 AND dold_koordinat='Nej'")}&filter-lang=cql2-text`;
  const pd = await getJson(ppUrl);
  const stations = (pd.features ?? [])
    .filter((f: any) => f.geometry?.coordinates && f.properties?.nationellt_provplatsid)
    .slice(0, 5);
  console.log(`Testar ${stations.length} provplatser\n`);

  const tally = new Map<string, { acc: number; rej: number }>();
  for (const st of stations) {
    const id = st.properties.nationellt_provplatsid;
    const name = st.properties.platsbeteckning ?? id;
    const [lon, lat] = st.geometry.coordinates;
    const [byParam, hype] = await Promise.all([fetchAnalys(id), fetchHype(lon, lat)]);
    if (!hype || hype.length < 30) { console.log(`${name}: ingen HYPE`); continue; }
    console.log(`${name} (${st.properties.kommun ?? ''}):`);
    for (const param of PARAMS) {
      const obs = byParam.get(param);
      if (!obs || obs.length < 10) continue;
      const { cls } = classifyParameter(param);
      const t = tally.get(cls) ?? { acc: 0, rej: 0 };
      const fit = fitChemToHype(obs, hype as any, param);
      if (fit) {
        t.acc++;
        console.log(`  ${param.padEnd(14)} ACC  n=${fit.n} r2=${fit.r2.toFixed(2)} valR2=${fit.valR2?.toFixed(2) ?? '–'} T=${fit.memoryDays}d ${fit.source} ${fit.paramClass} conf=${fit.confidence}`);
      } else {
        t.rej++;
        const lenient = fitChemToHype(obs, hype as any, param, 0.0);
        console.log(`  ${param.padEnd(14)} rej  ${lenient ? `(r2=${lenient.r2.toFixed(2)} valR2=${lenient.valR2?.toFixed(2) ?? '–'})` : '(för få par / valR2-gate)'} ${cls}`);
      }
      tally.set(cls, t);
    }
  }
  console.log('\nPer klass:');
  for (const [cls, t] of tally) console.log(`  ${cls}: ${t.acc} accepterade, ${t.rej} avvisade`);
}

main().catch(e => { console.error(e); process.exit(1); });
