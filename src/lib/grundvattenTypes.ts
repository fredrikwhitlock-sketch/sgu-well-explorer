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
