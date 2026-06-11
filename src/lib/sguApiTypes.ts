/**
 * Types for SGU OGC API – Features responses (api.sgu.se/oppnadata/...).
 *
 * The property interfaces list the fields this app actually reads. SGU's
 * collections carry many more attributes and the naming varies between
 * datasets, so every interface keeps an open index signature — these types
 * document and autocomplete the known fields without rejecting unknown ones.
 */

export interface OgcGeometry {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon' | 'GeometryCollection';
  /** [lon, lat] for Point; nested arrays for lines/polygons. */
  coordinates: any;
}

export interface OgcFeature<P = Record<string, any>> {
  type?: 'Feature';
  id?: string | number;
  geometry?: OgcGeometry | null;
  properties?: P | null;
}

export interface OgcFeatureCollection<P = Record<string, any>> {
  type?: 'FeatureCollection';
  features?: OgcFeature<P>[];
  numberMatched?: number;
  numberReturned?: number;
}

// ── grundvattennivaer-observerade ─────────────────────────────────────────────

/** collections/stationer */
export interface ObsStationProps {
  platsbeteckning?: string;
  stationsnamn?: string;
  namn?: string;
  jordart_tx?: string;
  jordart?: string;
  /** Aquifer code – starts with 'B' (berg) or 'J' (jord). */
  akvifer?: string;
  /** Station closing date – set only for inactive stations. */
  tdat?: string | null;
  [key: string]: any;
}

/** collections/nivaer */
export interface ObsNivaProps {
  platsbeteckning?: string;
  /** ISO date, sometimes with a time part. */
  obsdatum?: string;
  grundvattenniva_m_u_markyta?: number;
  grundvattenniva_m_urok?: number;
  [key: string]: any;
}

// ── brunnar ───────────────────────────────────────────────────────────────────

export interface BrunnProps {
  brunnsid?: string;
  id?: string;
  totaldjup?: number;
  borrhalsdjup?: number;
  jorddjup?: number;
  kapacitet?: number;
  adress?: string;
  plats?: string;
  fastighetsadress?: string;
  typ_kod?: string;
  brunnsstyp?: string;
  [key: string]: any;
}

// ── jordarter25k-100k (grundlager / ytlager / oversta-ytlager) ────────────────

export interface JordartProps {
  /** Soil type code, see soilTypeColors. Casing varies between layers. */
  jg2?: number | string;
  JG2?: number | string;
  [key: string]: any;
}

// ── grundvattenmagasin ────────────────────────────────────────────────────────

/** collections/grundvattenmagasin */
export interface MagasinProps {
  magasinsnamn?: string;
  namn?: string;
  akvifertyp?: string;
  genes?: string;
  /** E.g. "J2 ..." – position code is the leading [JB]\d token. */
  magasinsposition?: string;
  magasinsposition_kod?: number;
  /** m² */
  geom_area?: number;
  grvbildningstyp?: string;
  grvbildningstyp_kod?: number;
  tillrinning_fran_tillrinningsomraden_l_per_s?: number;
  medelmaktighet_mattad_zon?: string;
  medelmaktighet_mattad_zon_kod?: number;
  medelmaktighet_omattad_zon?: string;
  medelmaktighet_omattad_zon_kod?: number;
  lank_magasinsbeskrivning?: string;
  [key: string]: any;
}

/** collections/magasinsdelomraden */
export interface DelomradeProps {
  delomradesnamn?: string;
  magasinsnamn?: string;
  uttagsmojligheter?: string;
  kornstorlek?: string;
  kornstorlek_kod?: number;
  artesiskt?: string;
  artesiskt_kod?: number;
  nivaforhallande?: string;
  nivaforhallande_kod?: number;
  vattenkemi?: string;
  vattenkemi_kod?: number;
  delomradeskvalitet?: string;
  delomradeskvalitet_kod?: number;
  [key: string]: any;
}

// ── grundvattenforekomster ────────────────────────────────────────────────────

export interface GvForekomstProps {
  /** Water-body code, e.g. "WA12345678". Field name varies by vintage. */
  ms_cd?: string;
  eucd_gwb?: string;
  eu_cd?: string;
  eucd?: string;
  [key: string]: any;
}

// ── grundvattennivaer-sgu-hype-omraden ────────────────────────────────────────

/** collections/omraden */
export interface HypeOmradeProps {
  omrade_id?: number;
  [key: string]: any;
}

/** collections/grundvattennivaer-tidigare. -1 and 99 are no-data sentinels. */
export interface HypeNivaProps {
  datum?: string;
  omrade_id?: number;
  fyllnadsgrad_sma?: number;
  fyllnadsgrad_stora?: number;
  [key: string]: any;
}

// ── markgeokemi-regional (moran_0063mm_ar_icpms / _icpaes) ────────────────────

export interface GeokemiProps {
  prov_artal?: number;
  provtyp?: string;
  // ICP-MS
  as_ppm?: number; cd_ppm?: number; mo_ppm?: number; u_ppm?: number; sb_ppm?: number;
  // ICP-AES (cu_ppm appears in both)
  cu_ppm?: number; ni_ppm?: number; pb_ppm?: number; cr_ppm?: number; co_ppm?: number;
  v_ppm?: number; zn_ppm?: number;
  // Oxide weight-% (converted to element ppm in the report)
  fe2o3_proc?: number; mno_proc?: number; cao_proc?: number; mgo_proc?: number;
  [key: string]: any;
}

// ── grundvattenkvalitet-analysresultat-provplatser-v2 ─────────────────────────

/** collections/provplatser */
export interface ProvplatsProps {
  nationellt_provplatsid?: string | number;
  provplatsnamn?: string;
  provplatskat_bedgr?: number;
  provplatskat_bedgr_tx?: string;
  region_bdgr_tx?: string;
  eucd_gwb?: string;
  eu_cd_gwb?: string;
  eu_cd?: string;
  trendstation?: boolean;
  stationstyp?: string;
  [key: string]: any;
}

/** collections/analysresultat */
export interface AnalysresultatProps {
  parameternamn?: string;
  provtagningsdatum?: string;
  /** Numeric string. */
  matvardetal?: string;
  enhet_tx?: string;
  enhet?: string;
  [key: string]: any;
}

// ── WMS GetFeatureInfo (jorddjup raster, gv-tillgång) ─────────────────────────

export interface WmsFeatureInfoProps {
  GRAY_INDEX?: number;
  gray_index?: number;
  value?: number | string;
  VALUE?: number | string;
  jorddjup_10x10m?: number | string;
  jorddjup_intervall?: string;
  jorddjup?: number | string;
  Grundvattentillgang_i_sma_magasin_l_dygn_ha?: number;
  [key: string]: any;
}
