import { downloadBlob } from './utils';

// Encodes a WGS84 lon/lat as a GeoPackage geometry blob (8-byte header + WKB Point).
function encodePoint(lon: number, lat: number): Uint8Array {
  const buf = new ArrayBuffer(29); // 8-byte GP header + 21-byte WKB point
  const dv = new DataView(buf);
  dv.setUint8(0, 0x47); dv.setUint8(1, 0x50); // magic "GP"
  dv.setUint8(2, 0x00);  // version
  dv.setUint8(3, 0x01);  // flags: little-endian, no envelope
  dv.setInt32(4, 4326, true); // SRS ID (EPSG:4326), little-endian
  dv.setUint8(8, 0x01);           // WKB byte order: LE
  dv.setUint32(9, 1, true);       // WKB geometry type: Point
  dv.setFloat64(13, lon, true);   // X = longitude
  dv.setFloat64(21, lat, true);   // Y = latitude
  return new Uint8Array(buf);
}

export interface GpkgBrunn {
  id: string; lon?: number; lat?: number;
  djup?: number; jorddjup?: number; kapacitet?: number;
  isBergborrad: boolean; distKm?: number; adress?: string; typKod?: string;
}

export interface GpkgObsStation {
  id: string; lon?: number; lat?: number;
  namn: string; djup: number; obsdatum: string;
  distKm: number; aquiferGroup?: string; jordart?: string;
}

export interface GpkgKemiStation {
  provplatsid: string; lon?: number; lat?: number;
  provplatsnamn: string; distKm?: number; senasteprov?: string;
  fromBody: boolean; hasTrend: boolean;
  eucdGwb?: string; provplatskat?: string; region?: string;
  params: Array<{ name: string; label: string; value: number; unit: string; klass: number; datum: string }>;
}

export interface GpkgExportData {
  lon: number; lat: number;
  sweref: [number, number];
  elevation?: number | null;
  jordartNamn?: string; jordartKod?: string; jordartKalla?: string;
  jorddjup?: number;
  aquiferLabel?: string;
  hypoDate?: string;
  fyllnadsgradSma?: number | null; fyllnadsgradStora?: number | null;
  sitSma?: number | null; sitStora?: number | null;
  gvTillgangLdha?: number | null;
  depthLo?: number; depthHi?: number; depthCalibrated?: boolean;
  magasin?: {
    namn: string; akvifertyp?: string; genes?: string;
    geomAreaKm2?: number; tillrinningLs?: number;
    medelmaktighetMattad?: string; medelmaktighetOmattad?: string; magasinsposition?: string;
  };
  delomrade?: {
    namn?: string; uttagsmojligheter?: string; kornstorlek?: string;
    artesiskt?: string; nivaforhallande?: string; vattenkemi?: string;
  };
  gvForekomstId?: string;
  brunnar?: GpkgBrunn[];
  obsStationer?: GpkgObsStation[];
  gvKemi?: GpkgKemiStation[];
  hypoSeries?: Array<{
    datum: string; fyllnadSma: number | null; fyllnadStora: number | null;
    sitSma: number | null; sitStora: number | null;
  }>;
  analysisDate: string;
}

export async function exportAnalysisGeoPackage(d: GpkgExportData): Promise<void> {
  const initSqlJs = (await import('sql.js')).default;
  const SQL = await initSqlJs({ locateFile: (f: string) => '/' + f });
  const db = new SQL.Database();

  // Set GeoPackage magic values in the SQLite header
  db.run('PRAGMA application_id = 1196444487;'); // 0x47504B47 = "GPKG"
  db.run('PRAGMA user_version = 10200;');         // GeoPackage 1.2

  // ── Required GeoPackage metadata tables ────────────────────────────────────
  db.run(`CREATE TABLE gpkg_spatial_ref_sys (
    srs_name TEXT NOT NULL, srs_id INTEGER NOT NULL PRIMARY KEY,
    organization TEXT NOT NULL, organization_coordsys_id INTEGER NOT NULL,
    definition TEXT NOT NULL, description TEXT)`);
  db.run(`INSERT INTO gpkg_spatial_ref_sys VALUES
    ('Undefined Cartesian',-1,'NONE',-1,'undefined','undefined Cartesian'),
    ('Undefined Geographic',0,'NONE',0,'undefined','undefined geographic'),
    ('WGS 84',4326,'EPSG',4326,
     'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]',
     'Longitude/latitude on WGS 84')`);

  db.run(`CREATE TABLE gpkg_contents (
    table_name TEXT NOT NULL PRIMARY KEY, data_type TEXT NOT NULL,
    identifier TEXT, description TEXT, last_change DATETIME NOT NULL,
    min_x REAL, min_y REAL, max_x REAL, max_y REAL, srs_id INTEGER)`);

  db.run(`CREATE TABLE gpkg_geometry_columns (
    table_name TEXT NOT NULL, column_name TEXT NOT NULL,
    geometry_type_name TEXT NOT NULL, srs_id INTEGER NOT NULL,
    z TINYINT NOT NULL, m TINYINT NOT NULL,
    PRIMARY KEY (table_name, column_name))`);

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  function registerFeatureTable(name: string, title: string, desc: string) {
    db.run(`INSERT INTO gpkg_contents VALUES (?,?,?,?,?,NULL,NULL,NULL,NULL,4326)`,
      [name, 'features', title, desc, now]);
    db.run(`INSERT INTO gpkg_geometry_columns VALUES (?,?,?,?,?,?)`,
      [name, 'geom', 'POINT', 4326, 0, 0]);
  }

  function registerAttributeTable(name: string, title: string, desc: string) {
    db.run(`INSERT INTO gpkg_contents VALUES (?,?,?,?,?,NULL,NULL,NULL,NULL,NULL)`,
      [name, 'attributes', title, desc, now]);
  }

  function updateBbox(tableName: string, items: Array<{ lon?: number; lat?: number }>) {
    const pts = items.filter(x => x.lon != null && x.lat != null) as Array<{ lon: number; lat: number }>;
    if (!pts.length) return;
    db.run(`UPDATE gpkg_contents SET min_x=?,min_y=?,max_x=?,max_y=? WHERE table_name=?`, [
      Math.min(...pts.map(p => p.lon)), Math.min(...pts.map(p => p.lat)),
      Math.max(...pts.map(p => p.lon)), Math.max(...pts.map(p => p.lat)),
      tableName,
    ]);
  }

  // ── Table 1: analysplats (1 row) ────────────────────────────────────────────
  db.run(`CREATE TABLE analysplats (
    id INTEGER PRIMARY KEY, geom BLOB,
    lon REAL, lat REAL, sweref_e INTEGER, sweref_n INTEGER, hojd_m REAL,
    jordart TEXT, jordart_kod TEXT, jordart_kalla TEXT, jorddjup_m REAL,
    akvifer_typ TEXT, hype_datum TEXT,
    fyllnadsgrad_sma REAL, fyllnadsgrad_stora REAL, situation_sma REAL, situation_stora REAL,
    gv_tillgang_ldha REAL, djup_lo REAL, djup_hi REAL, djup_kalibrerat INTEGER,
    magasin_namn TEXT, magasin_akvifertyp TEXT, magasin_genes TEXT, magasin_area_km2 REAL,
    magasin_tillrinning_ls REAL, magasin_medelm_mattad TEXT, magasin_medelm_omattad TEXT,
    magasin_position TEXT, delomrade_namn TEXT, delomrade_uttagsmojligheter TEXT,
    delomrade_kornstorlek TEXT, delomrade_artesiskt TEXT, delomrade_nivaforhallande TEXT,
    delomrade_vattenkemi TEXT, gv_forekomst_id TEXT, analys_datum TEXT)`);
  registerFeatureTable('analysplats', 'Analysplats', 'Analyserad punkt');
  db.run(`UPDATE gpkg_contents SET min_x=?,min_y=?,max_x=?,max_y=? WHERE table_name='analysplats'`,
    [d.lon, d.lat, d.lon, d.lat]);

  // 36 positional params for the 36 non-id columns
  db.run(
    `INSERT INTO analysplats VALUES (1,` + '?,'.repeat(36).slice(0, -1) + `)`,
    [
      encodePoint(d.lon, d.lat),
      d.lon, d.lat, Math.round(d.sweref[0]), Math.round(d.sweref[1]), d.elevation ?? null,
      d.jordartNamn ?? null, d.jordartKod ?? null, d.jordartKalla ?? null, d.jorddjup ?? null,
      d.aquiferLabel ?? null, d.hypoDate ?? null,
      d.fyllnadsgradSma ?? null, d.fyllnadsgradStora ?? null,
      d.sitSma ?? null, d.sitStora ?? null, d.gvTillgangLdha ?? null,
      d.depthLo ?? null, d.depthHi ?? null, d.depthCalibrated ? 1 : 0,
      d.magasin?.namn ?? null, d.magasin?.akvifertyp ?? null, d.magasin?.genes ?? null,
      d.magasin?.geomAreaKm2 ?? null, d.magasin?.tillrinningLs ?? null,
      d.magasin?.medelmaktighetMattad ?? null, d.magasin?.medelmaktighetOmattad ?? null,
      d.magasin?.magasinsposition ?? null,
      d.delomrade?.namn ?? null, d.delomrade?.uttagsmojligheter ?? null,
      d.delomrade?.kornstorlek ?? null, d.delomrade?.artesiskt ?? null,
      d.delomrade?.nivaforhallande ?? null, d.delomrade?.vattenkemi ?? null,
      d.gvForekomstId ?? null, d.analysisDate,
    ],
  );

  // ── Table 2: brunnar_nara ───────────────────────────────────────────────────
  db.run(`CREATE TABLE brunnar_nara (
    id INTEGER PRIMARY KEY AUTOINCREMENT, geom BLOB,
    brunns_id TEXT, djup REAL, jorddjup REAL, kapacitet REAL,
    ar_bergborrad INTEGER, adress TEXT, typ_kod TEXT, avstand_km REAL)`);
  registerFeatureTable('brunnar_nara', 'Brunnar (närliggande)', 'Brunnar inom analysområdet');
  if (d.brunnar?.length) {
    const s = db.prepare(
      `INSERT INTO brunnar_nara (geom,brunns_id,djup,jorddjup,kapacitet,ar_bergborrad,adress,typ_kod,avstand_km)
       VALUES (?,?,?,?,?,?,?,?,?)`);
    for (const b of d.brunnar)
      s.run([b.lon != null && b.lat != null ? encodePoint(b.lon, b.lat) : null,
             b.id, b.djup ?? null, b.jorddjup ?? null, b.kapacitet ?? null,
             b.isBergborrad ? 1 : 0, b.adress ?? null, b.typKod ?? null, b.distKm ?? null]);
    s.free();
    updateBbox('brunnar_nara', d.brunnar);
  }

  // ── Table 3: obs_stationer ──────────────────────────────────────────────────
  db.run(`CREATE TABLE obs_stationer (
    id INTEGER PRIMARY KEY AUTOINCREMENT, geom BLOB,
    stations_id TEXT, namn TEXT, djup REAL, obs_datum TEXT,
    akvifer_grupp TEXT, jordart TEXT, avstand_km REAL)`);
  registerFeatureTable('obs_stationer', 'Observationsstationer', 'Grundvattennivåstationer');
  if (d.obsStationer?.length) {
    const s = db.prepare(
      `INSERT INTO obs_stationer (geom,stations_id,namn,djup,obs_datum,akvifer_grupp,jordart,avstand_km)
       VALUES (?,?,?,?,?,?,?,?)`);
    for (const st of d.obsStationer)
      s.run([st.lon != null && st.lat != null ? encodePoint(st.lon, st.lat) : null,
             st.id, st.namn, st.djup, st.obsdatum, st.aquiferGroup ?? null, st.jordart ?? null, st.distKm]);
    s.free();
    updateBbox('obs_stationer', d.obsStationer);
  }

  // ── Table 4: gv_kemi_stationer ──────────────────────────────────────────────
  db.run(`CREATE TABLE gv_kemi_stationer (
    id INTEGER PRIMARY KEY AUTOINCREMENT, geom BLOB,
    provplats_id TEXT, namn TEXT, avstand_km REAL, senaste_prov TEXT,
    fran_forekomst INTEGER, ar_trendstation INTEGER,
    eucd_gwb TEXT, kategori TEXT, region TEXT)`);
  registerFeatureTable('gv_kemi_stationer', 'Kemistationer', 'Grundvattenkemistationer');

  // ── Table 5: gv_kemi_parametrar (non-spatial) ──────────────────────────────
  db.run(`CREATE TABLE gv_kemi_parametrar (
    id INTEGER PRIMARY KEY AUTOINCREMENT, provplats_id TEXT,
    parameternamn TEXT, label TEXT, varde REAL, enhet TEXT, klass INTEGER, datum TEXT)`);
  registerAttributeTable('gv_kemi_parametrar', 'Kemiparametrar', 'Grundvattenkemi per station');

  if (d.gvKemi?.length) {
    const s4 = db.prepare(
      `INSERT INTO gv_kemi_stationer (geom,provplats_id,namn,avstand_km,senaste_prov,fran_forekomst,ar_trendstation,eucd_gwb,kategori,region)
       VALUES (?,?,?,?,?,?,?,?,?,?)`);
    const s5 = db.prepare(
      `INSERT INTO gv_kemi_parametrar (provplats_id,parameternamn,label,varde,enhet,klass,datum)
       VALUES (?,?,?,?,?,?,?)`);
    for (const st of d.gvKemi) {
      s4.run([st.lon != null && st.lat != null ? encodePoint(st.lon, st.lat) : null,
              st.provplatsid, st.provplatsnamn, st.distKm ?? null, st.senasteprov ?? null,
              st.fromBody ? 1 : 0, st.hasTrend ? 1 : 0,
              st.eucdGwb ?? null, st.provplatskat ?? null, st.region ?? null]);
      for (const p of st.params)
        s5.run([st.provplatsid, p.name, p.label, p.value, p.unit, p.klass, p.datum]);
    }
    s4.free(); s5.free();
    updateBbox('gv_kemi_stationer', d.gvKemi);
  }

  // ── Table 6: hype_tidsserie (non-spatial) ──────────────────────────────────
  if (d.hypoSeries?.length) {
    db.run(`CREATE TABLE hype_tidsserie (
      id INTEGER PRIMARY KEY AUTOINCREMENT, datum TEXT,
      fyllnad_sma REAL, fyllnad_stora REAL, situation_sma REAL, situation_stora REAL)`);
    registerAttributeTable('hype_tidsserie', 'HYPE-tidsserie', 'HYPE-modellens grundvattennivåer');
    const s6 = db.prepare(
      `INSERT INTO hype_tidsserie (datum,fyllnad_sma,fyllnad_stora,situation_sma,situation_stora)
       VALUES (?,?,?,?,?)`);
    for (const row of d.hypoSeries)
      s6.run([row.datum, row.fyllnadSma, row.fyllnadStora, row.sitSma, row.sitStora]);
    s6.free();
  }

  const bytes = db.export();
  db.close();
  downloadBlob(
    new Blob([bytes], { type: 'application/geopackage+sqlite3' }),
    `grundvattenanalys_${d.lat.toFixed(4)}N_${d.lon.toFixed(4)}E_${d.analysisDate}.gpkg`,
  );
}
