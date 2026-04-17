import { useEffect, useState, useRef, useCallback } from "react";
import { X, Droplets, Loader2, MapPin, AlertCircle, RefreshCw, Info, ChevronDown, Bot } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import proj4 from "proj4";
import { getSoilTypeColor } from "../../lib/soilTypeColors";

interface Props {
  coordinate: [number, number]; // Web Mercator EPSG:3857
  wmsProxyUrl: string;
  onClose: () => void;
  onAnalysisData?: (summary: string | null) => void;
  onOpenAI?: () => void;
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
  hypoDateIsFallback?: boolean;
  fyllnadsgradSma?: number | null;
  fyllnadsgradStora?: number | null;
  sitSma?: number | null;
  sitStora?: number | null;
  gvTillgangLdha?: number | null;
  jordartNamn?: string;
  jordartKod?: string;
  // Jorddjup från jorddjupsmodell – interpolerat WMS GetFeatureInfo (10×10 m raster)
  jorddjup?: { djup: number };
  // Terrängmodell – EU-DEM 25m via OpenTopoData
  elevation?: number | null;
  // Grundvattenmagasin (SGU karteringsdata – mer detaljerat än EU-förekomster)
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
  hypoSeries?: Array<{ datum: string; fyllnadSma: number | null; fyllnadStora: number | null }>;
  // Nearby observed groundwater levels for calibration pool
  obsFeatures?: Array<{ djup: number; jordart?: string; aquiferGroup?: 'rock' | 'jord'; aquiferSize?: 'large' | 'small' }>;
  // Nearby observed stations sorted by distance — shown in level analysis section
  obsStationer?: Array<{ id: string; namn: string; djup: number; obsdatum: string; distKm: number; aquiferGroup?: 'rock' | 'jord'; jordart?: string }>;
}

// ── Aquifer classification ────────────────────────────────────────────────────

type AquiferType = 'porous-fine' | 'porous-coarse' | 'till' | 'rock' | 'confining' | 'unknown';

interface AquiferClass {
  type: AquiferType;
  label: string;
  depthMin: number; // typical depth to water table, m below surface
  depthMax: number;
  capacityLabel: string; // qualitative capacity description
  useStoraMagasin: boolean; // use large vs small aquifer pool for obs calibration
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

// ── jg2-code-based classifier ─────────────────────────────────────────────────
// Maps every code from SGU jordarter 1:25 000–100 000 (grundlager) to an
// AquiferClass. Prefer this over classifyAquifer() at the click point where
// we have the exact jg2 code; keep classifyAquifer() for observation-station
// text fields (jordart_tx) that come from the stationer API.
function classifyByJg2(jg2: number): AquiferClass {
  // ── Berg ────────────────────────────────────────────────────────────────────
  if (jg2 === 888 || jg2 === 890)
    return { type: 'rock', label: 'Berg – sprickzonsmagasin',
      depthMin: 5, depthMax: 20, capacityLabel: 'Se grundvattentillgång (bergborrad brunn)', useStoraMagasin: false };
  if (jg2 === 823)
    return { type: 'rock', label: 'Fanerozoisk diabas – sprickzonsmagasin',
      depthMin: 5, depthMax: 20, capacityLabel: 'Se grundvattentillgång (bergborrad brunn)', useStoraMagasin: false };
  if (jg2 === 849 || jg2 === 850)
    return { type: 'rock', label: 'Sedimentärt berg – sprickzons-/karstmagasin',
      depthMin: 5, depthMax: 30, capacityLabel: 'Varierande – beroende på sprickor och kast', useStoraMagasin: false };
  if (jg2 === 9950 || jg2 === 9960)
    return { type: 'rock', label: 'Skålla av berg – tunt jordtäcke',
      depthMin: 3, depthMax: 15, capacityLabel: 'Bergborrad brunn trolig', useStoraMagasin: false };
  if (jg2 === 81)
    return { type: 'rock', label: 'Talus (rasmassor) – grovkornigt, nära berg',
      depthMin: 1, depthMax: 10, capacityLabel: 'Varierande; bergborrad brunn möjlig', useStoraMagasin: false };
  if (jg2 === 82 || jg2 === 8919 || jg2 === 8950)
    return { type: 'rock', label: 'Vittringsjord – tunt ytligt lager',
      depthMin: 1, depthMax: 8, capacityLabel: 'Bergborrad brunn trolig', useStoraMagasin: false };

  // ── Isälvssediment ──────────────────────────────────────────────────────────
  if (jg2 === 50 || jg2 === 51 || jg2 === 55 || jg2 === 57 || (jg2 > 50 && jg2 < 60))
    return { type: 'porous-coarse', label: 'Isälvssediment – poröst grovkornigt magasin',
      depthMin: 0.5, depthMax: 4, capacityLabel: '500–10 000 l/h (grävd/borrad infiltrationsbrunn)', useStoraMagasin: true };

  // ── Morän ────────────────────────────────────────────────────────────────────
  if (jg2 === 98 || jg2 === 99 || jg2 === 101 || jg2 === 9792 || jg2 === 9794)
    return { type: 'confining', label: 'Moränlera – täckande lager',
      depthMin: 5, depthMax: 30, capacityLabel: 'Ej lämpligt för ytlig brunn; kan täcka djupare magasin', useStoraMagasin: false };
  if (jg2 === 93 || jg2 === 95 || jg2 === 97 || jg2 === 100 || jg2 === 9147 || jg2 === 9299 || jg2 === 9336)
    return { type: 'till', label: 'Morän – varierande magasin',
      depthMin: 2, depthMax: 12, capacityLabel: '50–600 l/h (bergborrad brunn vanligast)', useStoraMagasin: false };

  // ── Lera och silt – täckande ─────────────────────────────────────────────────
  if ([17, 19, 22, 40, 43, 44, 85, 86, 8186].includes(jg2))
    return { type: 'confining', label: 'Lera – täckande lager',
      depthMin: 5, depthMax: 30, capacityLabel: 'Ej lämpligt för ytlig brunn; täckande lager kan dölja djupare magasin', useStoraMagasin: false };
  if ([24, 39, 48, 9060].includes(jg2))
    return { type: 'confining', label: 'Silt – halvtäckande lager',
      depthMin: 3, depthMax: 20, capacityLabel: 'Dålig kapacitet; kan täcka djupare akvifer', useStoraMagasin: false };
  if (jg2 === 16)
    return { type: 'confining', label: 'Gyttjelera – organiskt täckande lager',
      depthMin: 3, depthMax: 15, capacityLabel: 'Ej lämpligt', useStoraMagasin: false };

  // ── Sand och grus ─────────────────────────────────────────────────────────
  if ([21, 31, 84, 87, 33, 89].includes(jg2))
    return { type: 'porous-coarse', label: 'Sand/grus – poröst magasin',
      depthMin: 1, depthMax: 5, capacityLabel: '200–5 000 l/h (grävd/borrad brunn)', useStoraMagasin: true };
  if (jg2 === 34)
    return { type: 'porous-coarse', label: 'Klapper – grovkornigt magasin',
      depthMin: 0.5, depthMax: 3, capacityLabel: 'Hög kapacitet lokalt', useStoraMagasin: true };
  if ([26, 28, 79].includes(jg2))
    return { type: 'porous-fine', label: 'Finsand/grovsilt – svagt poröst magasin',
      depthMin: 1, depthMax: 8, capacityLabel: '50–500 l/h', useStoraMagasin: false };
  if (jg2 === 13)
    return { type: 'porous-fine', label: 'Flygsand – homogen men lågkapacitetsakvifer',
      depthMin: 1, depthMax: 6, capacityLabel: '50–300 l/h', useStoraMagasin: false };
  if (jg2 === 66 || jg2 === 92)
    return { type: 'porous-coarse', label: 'Blockmark/sten-block – hög permeabilitet, begränsad kapacitet',
      depthMin: 1, depthMax: 5, capacityLabel: '< 200 l/h (begränsad lagringskapacitet)', useStoraMagasin: false };

  // ── Svämsediment ─────────────────────────────────────────────────────────
  if (jg2 === 62)
    return { type: 'porous-coarse', label: 'Svämsediment, grus – poröst magasin',
      depthMin: 0.5, depthMax: 4, capacityLabel: '200–3 000 l/h', useStoraMagasin: true };
  if (jg2 === 10)
    return { type: 'porous-coarse', label: 'Svämsediment, sand – poröst magasin',
      depthMin: 0.5, depthMax: 5, capacityLabel: '200–3 000 l/h', useStoraMagasin: true };
  if (jg2 === 9 || jg2 === 8937)
    return { type: 'porous-fine', label: 'Svämsediment, ler-silt – svagt poröst',
      depthMin: 1, depthMax: 8, capacityLabel: '50–300 l/h', useStoraMagasin: false };
  if (jg2 === 9010)
    return { type: 'porous-fine', label: 'Svämsediment, grovsilt-finsand – svagt poröst',
      depthMin: 1, depthMax: 6, capacityLabel: '50–300 l/h', useStoraMagasin: false };

  // ── Älvsediment ───────────────────────────────────────────────────────────
  if (jg2 === 8803 || jg2 === 8814)
    return { type: 'porous-coarse', label: 'Älvsediment, grus/sten-block – poröst fluvialt magasin',
      depthMin: 0.5, depthMax: 4, capacityLabel: '200–3 000 l/h', useStoraMagasin: true };
  if (jg2 === 8809)
    return { type: 'porous-coarse', label: 'Älvsediment, sand – poröst fluvialt magasin',
      depthMin: 1, depthMax: 5, capacityLabel: '200–2 000 l/h', useStoraMagasin: true };
  if (jg2 === 8802)
    return { type: 'porous-fine', label: 'Älvsediment, grovsilt-finsand – svagt poröst',
      depthMin: 1, depthMax: 6, capacityLabel: '50–300 l/h', useStoraMagasin: false };
  if (jg2 === 8806)
    return { type: 'porous-fine', label: 'Älvsediment, ler-silt – svagt poröst',
      depthMin: 2, depthMax: 8, capacityLabel: '50–200 l/h', useStoraMagasin: false };
  if (jg2 === 8804)
    return { type: 'porous-fine', label: 'Älvsediment – fluvialt sediment',
      depthMin: 1, depthMax: 6, capacityLabel: '50–500 l/h', useStoraMagasin: false };

  // ── Torv och organiska ────────────────────────────────────────────────────
  if (jg2 === 1 || jg2 === 75 || jg2 === 8175)
    return { type: 'porous-fine', label: 'Torv/mossa – ytligt grundvatten',
      depthMin: 0.2, depthMax: 2, capacityLabel: 'Ej lämpligt för dricksvattenbrunn', useStoraMagasin: false };
  if (jg2 === 5)
    return { type: 'porous-fine', label: 'Kärrtorv – ytligt grundvatten',
      depthMin: 0.2, depthMax: 2, capacityLabel: 'Ej lämpligt för dricksvattenbrunn', useStoraMagasin: false };
  if (jg2 === 6 || jg2 === 2306)
    return { type: 'porous-fine', label: 'Gyttja/kalkgyttja – organiskt sediment',
      depthMin: 0.5, depthMax: 3, capacityLabel: 'Ej lämpligt', useStoraMagasin: false };
  if (jg2 === 2368 || jg2 === 2372)
    return { type: 'porous-fine', label: 'Slamströmssediment/flytjord – instabilt',
      depthMin: 1, depthMax: 5, capacityLabel: 'Ej lämpligt', useStoraMagasin: false };
  if (jg2 === 36)
    return { type: 'porous-fine', label: 'Skaljord – kalkhaltigt sediment',
      depthMin: 1, depthMax: 4, capacityLabel: '100–500 l/h', useStoraMagasin: false };
  if (jg2 === 1950)
    return { type: 'porous-fine', label: 'Kalktuff – karstig porös kalksten',
      depthMin: 0.5, depthMax: 5, capacityLabel: '100–1 000 l/h', useStoraMagasin: false };

  // ── Fyllning ─────────────────────────────────────────────────────────────
  if (jg2 >= 200 && jg2 < 400)
    return { type: 'unknown', label: 'Fyllning – varierande egenskaper',
      depthMin: 1, depthMax: 10, capacityLabel: 'Okänd (fyllnadsmassor)', useStoraMagasin: false };

  // ── Övrigt ───────────────────────────────────────────────────────────────
  if (jg2 === 9191)
    return { type: 'unknown', label: 'Glaciär – ej tillämpligt',
      depthMin: 0, depthMax: 0, capacityLabel: 'Ej tillämpligt', useStoraMagasin: false };
  if (jg2 === 91)
    return { type: 'unknown', label: 'Vatten',
      depthMin: 0, depthMax: 0, capacityLabel: 'Ej tillämpligt', useStoraMagasin: false };
  if (jg2 === 90 || jg2 === 8114)
    return { type: 'unknown', label: 'Oklassat område',
      depthMin: 2, depthMax: 15, capacityLabel: 'Okänd', useStoraMagasin: false };

  return { type: 'unknown', label: `Okänd jordart (kod ${jg2})`,
    depthMin: 2, depthMax: 15, capacityLabel: 'Okänd', useStoraMagasin: false };
}

function depthAdjustment(fyllnad: number | null | undefined): { factor: number; label: string; color: string } {
  if (fyllnad == null || fyllnad === -1) return { factor: 1.0, label: 'okänd nivå', color: 'text-muted-foreground' };
  if (fyllnad < 10) return { factor: 1.7, label: 'mycket låg (+50–80% djupare än normalt)', color: 'text-red-700 dark:text-red-400' };
  if (fyllnad < 25) return { factor: 1.3, label: 'låg (+20–35% djupare än normalt)', color: 'text-orange-600 dark:text-orange-400' };
  if (fyllnad < 75) return { factor: 1.0, label: 'normal nivå', color: 'text-yellow-700 dark:text-yellow-400' };
  if (fyllnad < 90) return { factor: 0.75, label: 'hög (20–30% grundare än normalt)', color: 'text-green-600 dark:text-green-400' };
  return { factor: 0.55, label: 'mycket hög (40–50% grundare än normalt)', color: 'text-green-800 dark:text-green-300' };
}

function estimatedDepth(aq: AquiferClass, fyllnad: number | null | undefined) {
  const adj = depthAdjustment(fyllnad);
  return { lo: Math.round(aq.depthMin * adj.factor * 10) / 10, hi: Math.round(aq.depthMax * adj.factor * 10) / 10, adj };
}

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

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

export const GrundvattenRapport = ({ coordinate, wmsProxyUrl, onClose, onAnalysisData, onOpenAI }: Props) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  // Build a plain-text AI summary whenever analysis data changes
  useEffect(() => {
    if (!onAnalysisData) return;
    if (!data) { onAnalysisData(null); return; }

    const aq = data.jordartKod ? classifyByJg2(Number(data.jordartKod)) : classifyAquifer(data.jordartNamn);
    const hasStoraMag = !!data.magasin;

    // Reconstruct calibrated depth label (mirrors obsKalibr logic above, no HYPE factor)
    let obsKalibrStr = 'Saknas (för få observationsstationer)';
    if (data.obsFeatures && aq.type !== 'unknown' && !(aq.type === 'confining' && !hasStoraMag)) {
      const useRockPool = aq.type === 'rock' || aq.type === 'till' ||
        (aq.type === 'confining' && hasStoraMag &&
          (data.magasin!.genes ?? data.magasin!.akvifertyp ?? '').toUpperCase().match(/BERG|SPRICK|SEDIMENTÄR/) != null);
      const groupMatch = data.obsFeatures.filter(o =>
        o.aquiferGroup ? o.aquiferGroup === (useRockPool ? 'rock' : 'jord') : true
      );
      let sizeMatch = groupMatch;
      if (!useRockPool) {
        const targetSize: 'large' | 'small' = aq.useStoraMagasin ? 'large' : 'small';
        const sized = groupMatch.filter(o => !o.aquiferSize || o.aquiferSize === targetSize);
        const hasSizeData = groupMatch.some(o => !!o.aquiferSize);
        if (hasSizeData && sized.length > 0) sizeMatch = sized;
      }
      const subMatch = sizeMatch.filter(o => o.jordart ? classifyAquifer(o.jordart).type === aq.type : false);
      const pool = subMatch.length >= 3 ? subMatch : sizeMatch.length >= 3 ? sizeMatch : null;
      if (pool) {
        const sorted = pool.map(o => o.djup).sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const p25   = sorted[Math.floor(sorted.length * 0.25)];
        const p75   = sorted[Math.floor(sorted.length * 0.75)];
        const f = d?.adj.factor ?? 1;
      obsKalibrStr = `median ${(median * f).toFixed(1)} m (kv: ${(p25 * f).toFixed(1)}–${(p75 * f).toFixed(1)} m), ${pool.length} stationer`;
      }
    }

    const bergBr = (data.brunnar ?? []).filter(b => b.isBergborrad);
    const jordBr = (data.brunnar ?? []).filter(b => !b.isBergborrad);
    const medOf = (arr: BrunnInfo[]) => {
      const vals = arr.map(b => b.kapacitet!).filter(v => v > 0).sort((a, b) => a - b);
      return vals.length ? vals[Math.floor(vals.length / 2)] : null;
    };

    const eff = (() => {
      if (!aq || aq.type !== 'confining' || !data.magasin?.genes) return aq;
      const g = classifyAquifer(data.magasin.genes);
      return g.type !== 'unknown' && g.type !== 'confining' ? g : aq;
    })();
    const relevantF = eff?.useStoraMagasin || hasStoraMag ? data.fyllnadsgradStora : data.fyllnadsgradSma;
    const d = eff ? estimatedDepth(eff, relevantF) : null;
    const sitLabel = (v: number | null | undefined) =>
      v == null || v === -1 ? 'Ingen data' : `${Math.round(v)}:e percentilen`;

    const lines: string[] = [
      `## Grundvattenanalys – ${data.lat.toFixed(5)}°N, ${data.lon.toFixed(5)}°E`,
      `**Datum (HYPE):** ${data.hypoDate ?? 'okänt'}${data.hypoDateIsFallback ? ' (senaste tillgängliga)' : ''}`,
      `**SWEREF99 TM:** E ${Math.round(data.sweref[0])}, N ${Math.round(data.sweref[1])}`,
      ...(data.elevation != null ? [`**Höjd:** ${data.elevation} m ö.h. (EU-DEM 25m)`] : []),
      '',
      '### Jordart & Akvifer',
      `- **Jordart:** ${data.jordartNamn ?? 'Okänd'}`,
      `- **Klassificering:** ${aq.label}`,
      `- **Kapacitetsuppskattning:** ${aq.capacityLabel}`,
    ];

    if (data.magasin) {
      const m = data.magasin;
      lines.push('', '### Grundvattenmagasin (SGU)');
      lines.push(`- **Namn:** ${m.namn}`);
      if (m.positionKod) lines.push(`- **Magasinsposition:** ${m.positionKod}${m.magasinsposition ? ` – ${m.magasinsposition.split(',').slice(1).join(',').trim()}` : ''}`);
      if (m.akvifertyp) lines.push(`- **Akvifertyp:** ${m.akvifertyp}`);
      if (m.genes) lines.push(`- **Genesis:** ${m.genes}`);
      if (m.geomAreaKm2 != null) lines.push(`- **Magasinsyta:** ~${m.geomAreaKm2} km²`);
      if (m.grvbildningstyp) lines.push(`- **Grundvattenbildning:** ${m.grvbildningstyp}`);
      if (m.medelmaktighetMattad) lines.push(`- **Mättad zon:** ${m.medelmaktighetMattad}`);
      if (m.medelmaktighetOmattad) lines.push(`- **Omättad zon:** ${m.medelmaktighetOmattad}`);
      if (m.tillrinningLs != null) lines.push(`- **Tillrinning från tillrinningsområden:** ${m.tillrinningLs} l/s`);
    }

    lines.push('', '### Grundvattennivå');
    lines.push(`- **Situation litet magasin:** ${sitLabel(data.sitSma)}`);
    lines.push(`- **Fyllnadsgrad litet magasin:** ${fyllnadLabel(data.fyllnadsgradSma)} (${data.fyllnadsgradSma != null && data.fyllnadsgradSma !== -1 ? Math.round(data.fyllnadsgradSma) + ':e perc.' : 'ingen data'})`);
    lines.push(`- **Situation stort magasin:** ${sitLabel(data.sitStora)}`);
    lines.push(`- **Fyllnadsgrad stort magasin:** ${fyllnadLabel(data.fyllnadsgradStora)} (${data.fyllnadsgradStora != null && data.fyllnadsgradStora !== -1 ? Math.round(data.fyllnadsgradStora) + ':e perc.' : 'ingen data'})`);
    if (d) {
      lines.push(`- **Nivåjustering:** ${d.adj.label}`);
      lines.push(`- **Estimerat djup till grundvatten:** ${d.lo}–${d.hi} m u. markytan`);
    }
    lines.push(`- **Kalibrerat djup (observerade stationer):** ${obsKalibrStr}`);
    if (data.obsStationer && data.obsStationer.length > 0) {
      lines.push(`- **Observerade stationer ±7 dagar:** ${data.obsStationer.length} st`);
      data.obsStationer.slice(0, 5).forEach(st => {
        lines.push(`  - ${st.namn} (${st.distKm.toFixed(1)} km) – ${st.djup.toFixed(1)} m u. markyta, ${st.obsdatum.slice(0, 10)}`);
      });
    }

    if (data.jorddjup) {
      lines.push('', '### Jorddjup (djup till berg)');
      lines.push(`- **Interpolerat djup (WMS 10×10 m raster):** ${data.jorddjup.djup} m`);
    }

    if (bergBr.length > 0 || jordBr.length > 0) {
      lines.push('', '### Brunnskapacitet i närheten (l/h)');
      if (bergBr.length > 0) {
        const med = medOf(bergBr);
        lines.push(`- **Bergborrade brunnar:** ${bergBr.length} st${med != null ? `, mediankapacitet ${med} l/h` : ''}`);
      }
      if (jordBr.length > 0) {
        const med = medOf(jordBr);
        lines.push(`- **Jordbrunnar:** ${jordBr.length} st${med != null ? `, mediankapacitet ${med} l/h` : ''}`);
      }
    }

    if (data.gvTillgangLdha != null) {
      lines.push('', '### Grundvattentillgång');
      lines.push(`- **Litet magasin:** ${data.gvTillgangLdha.toLocaleString('sv')} l/dygn/ha`);
    }

    lines.push('', '*Tolkningar baseras på regionala modeller och observationer och ersätter inte platsspecifik hydrogeologisk undersökning.*');

    onAnalysisData(lines.join('\n'));
  }, [data, onAnalysisData, selectedDate]);

  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startLeft: 80, startTop: 80 });
  const [position, setPosition] = useState({ left: 80, top: 80 });
  const abortRef = useRef<AbortController | null>(null);

  // Detect mobile so we can render as a bottom sheet instead of a floating panel
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return; // no drag on mobile
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
      // Grundvattenmagasin: exact point-in-polygon via CQL2 – only show when click
      // is actually inside a mapped aquifer polygon.
      const gvmCql2Url = `https://api.sgu.se/oppnadata/grundvattenmagasin/ogc/features/v1/collections/grundvattenmagasin/items?f=json&filter=${encodeURIComponent(`S_INTERSECTS(geometry,POINT(${lon} ${lat}))`)}&filter-lang=cql2-text&limit=1`;
      // ~15 km radius for brunnar
      const brunnarDelta = 0.13;
      const brunnarBbox = `${lon - brunnarDelta},${lat - brunnarDelta},${lon + brunnarDelta},${lat + brunnarDelta}`;
      // Jorddjupsmodell – WMS GetFeatureInfo via proxy (10×10 m interpolated raster).
      // Use EPSG:3857 bbox (same CRS as map) to avoid WMS 1.3.0 axis-order issues.
      // 50 m half-width → 100×100 m box; 3×3 image, center pixel I=1,J=1.
      const [cx, cy] = coordinate; // already in EPSG:3857
      const djupWmsBbox = `${cx - 50},${cy - 50},${cx + 50},${cy + 50}`;
      const jorddjupWmsUrl =
        `${wmsProxyUrl}?url=${encodeURIComponent('https://maps3.sgu.se/geoserver/misc/ows')}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=SE.GOV.SGU.MISC.JORDDJUPSMODELL.RASTER_INTERVALL&QUERY_LAYERS=SE.GOV.SGU.MISC.JORDDJUPSMODELL.RASTER_INTERVALL&INFO_FORMAT=application%2Fjson&BBOX=${djupWmsBbox}&CRS=EPSG:3857&WIDTH=3&HEIGHT=3&I=1&J=1`;

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

      // HYPE: chain levels fetch onto omraden response
      let levelsPromise: Promise<[any, any]> | null = null;
      let seriesPromise: Promise<any> | null = null;
      let omradeIdCapture: number | undefined;
      const levelBase = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/grundvattennivaer-tidigare/items?f=json`;
      const omradenChain = fetch(
        `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/omraden/items?f=json&bbox=${bbox}&limit=1`,
        { signal }
      ).then(r => r.ok ? r.json() : null)
       .then(d => {
         const id = d?.features?.[0]?.properties?.omrade_id;
         if (id !== undefined) {
           omradeIdCapture = id;
           const safeJson = (r: Response) => r.ok ? r.json().catch(() => null) : null;
           levelsPromise = Promise.all([
             fetch(`${levelBase}&filter=${encodeURIComponent(`omrade_id=${id} AND datum='${selectedDate}'`)}&limit=1`, { signal }).then(safeJson).catch(() => null),
             fetch(`${levelBase}&filter=${encodeURIComponent(`omrade_id=${id}`)}&sortby=-datum&limit=1`, { signal }).then(safeJson).catch(() => null),
           ]);
           const monthUrls: string[] = [];
           for (let i = 12; i >= 0; i--) {
             const md = new Date(selectedDate);
             md.setMonth(md.getMonth() - i);
             md.setDate(1);
             monthUrls.push(`${levelBase}&filter=${encodeURIComponent(`omrade_id=${id} AND datum='${md.toISOString().split('T')[0]}'`)}&limit=1`);
           }
           seriesPromise = Promise.all(monthUrls.map(url => fetch(url, { signal }).then(safeJson).catch(() => null)));
         }
         return d;
       }).catch(() => null);

      // 50 km bbox for observed groundwater level stations
      const latD50 = 0.45; // ≈ 50 km
      const lonD50 = latD50 / Math.cos((lat * Math.PI) / 180);
      const obs50Bbox = `${lon - lonD50},${lat - latD50},${lon + lonD50},${lat + latD50}`;
      const obsBase = 'https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections';

      // Chain: nivaer has no geometry so bbox filtering fails with 400.
      // Fetch stationer spatially first → extract platsbeteckning IDs → query
      // nivaer via CQL2 IN filter.
      const stJordart    = new Map<string, string>();
      const stAkvifer    = new Map<string, 'rock' | 'jord'>();
      const stAkvifSize  = new Map<string, 'large' | 'small'>();
      const stNamn       = new Map<string, string>();
      const stCoords     = new Map<string, [number, number]>(); // WGS84 [lon, lat]
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
           const jordartTx = p.jordart_tx ?? p.jordart ?? '';
           stJordart.set(String(id), jordartTx);
           stNamn.set(String(id), String(p.stationsnamn ?? p.namn ?? id));
           const geom = f.geometry;
           if (geom?.type === 'Point' && Array.isArray(geom.coordinates)) {
             stCoords.set(String(id), [geom.coordinates[0], geom.coordinates[1]]);
           }
           // akvifer code: B* = berg (rock), J* = jord (soil), XX = unknown
           const akv = String(p.akvifer ?? '').toUpperCase();
           if (akv.startsWith('B')) stAkvifer.set(String(id), 'rock');
           else if (akv.startsWith('J')) {
             stAkvifer.set(String(id), 'jord');
             const stAq = classifyAquifer(jordartTx);
             stAkvifSize.set(String(id), stAq.useStoraMagasin ? 'large' : 'small');
           }
           ids.push(String(id));
         }
         if (ids.length > 0) {
           // Limit IN list to avoid very long URLs
           const idList = ids.slice(0, 200).map(id => `'${id.replace(/'/g, "''")}'`).join(',');
           // Use a tight ±7-day window around selectedDate for temporal coherence:
           // ensures all stations contribute readings from the same week.
           const targetMs = new Date(selectedDate).getTime();
           const wMs = 7 * 24 * 60 * 60 * 1000;
           const loDate = new Date(targetMs - wMs).toISOString().split('T')[0];
           const hiDate = new Date(targetMs + wMs).toISOString().split('T')[0];
           const filter = `platsbeteckning IN (${idList}) AND obsdatum >= '${loDate}' AND obsdatum <= '${hiDate}'`;
           nivaerPromise = fetch(
             `${obsBase}/nivaer/items?f=json&filter=${encodeURIComponent(filter)}&filter-lang=cql2-text&sortby=obsdatum&limit=3000`,
             { signal }
           ).then(r => r.ok ? r.json().catch(() => null) : null).catch(() => null);
         }
         return d;
       }).catch(() => null);

      // All fetches at t=0
      const allResults = await Promise.allSettled([
        omradenChain,
        fetch(gvTillgangUrl, { signal }),
        fetch(jordartCql2Url, { signal }),
        fetch(jordartBboxUrl, { signal }),
        fetch(gvmCql2Url, { signal }),
        fetch(`https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items?f=json&bbox=${brunnarBbox}&limit=25`, { signal }),
        fetch(jorddjupWmsUrl, { signal }),
        obsStationerChain,
        fetch(`https://api.opentopodata.org/v1/eudem25m?locations=${lat},${lon}`, { signal }),
      ]);
      const [omradenRes, gvTillgangRes, jordartCql2Res, jordartBboxRes, forekomstRes, brunnarRes, jorddjupRes, , elevationRes] = allResults;

      if (signal.aborted) return;

      const [[dateResult, latestResult], seriesData, nivaerData] = await Promise.all([
        levelsPromise ?? Promise.resolve([null, null]),
        seriesPromise ?? Promise.resolve(null),
        nivaerPromise ?? Promise.resolve(null),
      ]);

      if (signal.aborted) return;

      const result: ReportData = { lon, lat, sweref };

      if (omradenRes.status === 'fulfilled' && omradeIdCapture !== undefined) {
        result.omradeId = omradeIdCapture;
      }
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
      if (Array.isArray(seriesData)) {
        const parsed = (seriesData as any[])
          .filter(d => d?.features?.length > 0)
          .map((d: any) => {
            const p = d.features[0].properties ?? {};
            return { datum: String(p.datum ?? '').slice(0, 10), fyllnadSma: typeof p.fyllnadsgrad_sma === 'number' ? p.fyllnadsgrad_sma : null, fyllnadStora: typeof p.fyllnadsgrad_stora === 'number' ? p.fyllnadsgrad_stora : null };
          })
          .filter((s: any) => s.datum)
          .sort((a: any, b: any) => a.datum.localeCompare(b.datum));
        if (parsed.length >= 2) result.hypoSeries = parsed;
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
                akvifertyp:              p.akvifertyp || undefined,
                genes:                   p.genes || undefined,
                positionKod:             typeof p.magasinsposition === 'string'
                                           ? (p.magasinsposition.match(/^[JB]\d/)?.[0] ?? undefined)
                                           : undefined,
                geomAreaKm2:             typeof p.geom_area === 'number' && p.geom_area > 0
                                           ? Math.round(p.geom_area / 1e5) / 10
                                           : undefined,
                grvbildningstyp:         p.grvbildningstyp_kod > 0 ? p.grvbildningstyp : undefined,
                tillrinningLs:           typeof p.tillrinning_fran_tillrinningsomraden_l_per_s === 'number'
                                           ? p.tillrinning_fran_tillrinningsomraden_l_per_s : undefined,
                medelmaktighetMattad:    p.medelmaktighet_mattad_zon_kod > 0
                                           ? p.medelmaktighet_mattad_zon : undefined,
                medelmaktighetOmattad:   p.medelmaktighet_omattad_zon_kod > 0
                                           ? p.medelmaktighet_omattad_zon : undefined,
                lankBeskrivning:         p.lank_magasinsbeskrivning || undefined,
                magasinsposition:        p.magasinsposition_kod > 0 ? p.magasinsposition : undefined,
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

      // Jorddjup from jorddjupsmodell – single interpolated WMS raster value (10×10 m).
      // Field name verified from GetFeatureInfo response: jorddjup_10x10m
      if (jorddjupRes.status === 'fulfilled' && jorddjupRes.value.ok) {
        try {
          const d = await jorddjupRes.value.json();
          const p = d.features?.[0]?.properties ?? {};
          const raw = p.jorddjup_10x10m ?? p.GRAY_INDEX ?? p.gray_index ?? null;
          const djup = typeof raw === 'number' ? raw : parseFloat(String(raw));
          if (!isNaN(djup) && djup > 0 && djup < 500) {
            result.jorddjup = { djup: Math.round(djup * 10) / 10 };
          }
        } catch { /* ignore */ }
      }

      // Elevation from OpenTopoData EU-DEM 25m (free, ~25 m resolution)
      if (elevationRes.status === 'fulfilled' && elevationRes.value.ok) {
        try {
          const ed = await elevationRes.value.json();
          const elev = ed.results?.[0]?.elevation;
          if (typeof elev === 'number') result.elevation = Math.round(elev);
        } catch { /* ignore */ }
      }

      // Parse observed nivaer: for each station pick the reading closest to selectedDate.
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
          // Build obsStationer entry (needs coordinate for distance)
          const coords = stCoords.get(sid);
          if (coords) {
            const distKm = Math.round(haversineKm(lat, lon, coords[1], coords[0]) * 10) / 10;
            (result.obsStationer ??= []).push({
              id:           sid,
              namn:         stNamn.get(sid) ?? sid,
              djup,
              obsdatum,
              distKm,
              aquiferGroup: stAkvifer.get(sid),
              jordart:      stJordart.get(sid) || undefined,
            });
          }
        }
        result.obsStationer?.sort((a, b) => a.distKm - b.distKm);
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
  // Use jg2 code when available (precise); fall back to name-based match.
  const aquifer = data
    ? (data.jordartKod ? classifyByJg2(Number(data.jordartKod)) : classifyAquifer(data.jordartNamn))
    : null;

  // When the surface deposit is a confining layer (lera/silt/moränlera), the
  // actual aquifer lies BELOW it. If the grundvattenmagasin API returned a named
  // aquifer whose genesis (genes) indicates a coarser material, use that as the
  // effective aquifer for depth estimation and calibration.
  const effectiveAquifer = (() => {
    if (!aquifer || aquifer.type !== 'confining' || !data?.magasin?.genes) return aquifer;
    const genesAq = classifyAquifer(data.magasin.genes);
    if (genesAq.type !== 'unknown' && genesAq.type !== 'confining') return genesAq;
    return aquifer;
  })();

  const relevantFyllnad = effectiveAquifer?.useStoraMagasin
    ? data?.fyllnadsgradStora
    : data?.fyllnadsgradSma;
  const depth = effectiveAquifer && data ? estimatedDepth(effectiveAquifer, relevantFyllnad) : null;

  // Observation calibration – three-level filter:
  //   1. Primary:   bergborrade (B*) vs jordbrunnar (J*) split
  //      Morän ('till') uses rock pool: drilling through to bedrock is standard.
  //   2. Secondary: for jord pools, separate large (isälv/sand/grus) from small
  //      (morän/finkornigt) – never mix the two sizes.
  //   3. Tertiary:  within the size-matched pool, prefer matching jordart sub-type.
  const obsKalibr = (() => {
    if (!data?.obsFeatures?.length || !aquifer || aquifer.type === 'unknown') return null;
    // Confining layers: skip unless we have an effective underlying aquifer
    if (aquifer.type === 'confining' && effectiveAquifer?.type === 'confining') return null;

    // Use the effective aquifer (underlying material) for pool selection and size filtering.
    const eff = effectiveAquifer ?? aquifer;

    // Determine which observation pool to use:
    //  - rock / till / berg-magasin → B* stations (bergborrade)
    //  - porous sediment aquifers   → J* stations (jordbrunnar)
    let useRockPool: boolean;
    if (aquifer.type === 'confining' && data?.magasin) {
      const g = (data.magasin.genes ?? data.magasin.akvifertyp ?? '').toUpperCase();
      useRockPool = g.includes('BERG') || g.includes('SPRICK') || g.includes('SEDIMENTÄR');
    } else {
      useRockPool = eff.type === 'rock' || eff.type === 'till';
    }

    // Level 1: berg / jord split
    const groupMatch = data.obsFeatures.filter(o =>
      o.aquiferGroup ? o.aquiferGroup === (useRockPool ? 'rock' : 'jord') : true
    );

    // Level 2 (jord only): large vs small aquifer — never allow cross-size fallback.
    // Use effectiveAquifer's useStoraMagasin so that isälvssediment beneath clay
    // calibrates against large-aquifer stations rather than small ones.
    let sizeMatch = groupMatch;
    let sizeLabel = useRockPool ? 'bergbrunnar' : 'jordbrunnar';
    if (!useRockPool) {
      const targetSize: 'large' | 'small' = eff.useStoraMagasin ? 'large' : 'small';
      // Keep stations whose size is known and matches, OR whose size is unknown
      const sized = groupMatch.filter(o => !o.aquiferSize || o.aquiferSize === targetSize);
      // Only restrict to size-filtered if it actually removes something (i.e. size data exists)
      const hasSizeData = groupMatch.some(o => !!o.aquiferSize);
      if (hasSizeData && sized.length > 0) {
        sizeMatch = sized;
        sizeLabel = targetSize === 'large' ? 'stora jordmagasin' : 'små jordmagasin';
      }
    }

    // Level 3: within size-match, prefer matching jordart sub-type
    const subMatch = sizeMatch.filter(o =>
      o.jordart ? classifyAquifer(o.jordart).type === eff.type : false
    );

    // Pick most specific pool with ≥3 — do NOT fall back past sizeMatch to all obs
    const pool = subMatch.length >= 3 ? subMatch :
                 sizeMatch.length >= 3 ? sizeMatch :
                 null;
    if (!pool) return null;

    const sorted = pool.map(o => o.djup).sort((a, b) => a - b);
    const p25      = sorted[Math.floor(sorted.length * 0.25)];
    const p75      = sorted[Math.floor(sorted.length * 0.75)];
    const median   = sorted[Math.floor(sorted.length / 2)];
    // Flag high spread: P75/P25 ratio > 3 or absolute spread > 5 m indicates
    // that nearby stations represent genuinely different aquifer conditions.
    const highVariance = p75 - p25 > 5 || (p25 > 0 && p75 / p25 > 3);

    return {
      antal:        pool.length,
      medianDjup:   median,
      p25,
      p75,
      highVariance,
      matchLabel:   subMatch.length >= 3  ? 'matchande jordart' :
                    sizeMatch.length >= 3 ? sizeLabel :
                                            'blandad (få stationer)',
      aquiferMatch: subMatch.length >= 3 || sizeMatch.length >= 3,
    };
  })();

  // Calibrated depth: observed P25/P75 scaled by HYPE situation factor
  const calibratedDepth = (() => {
    if (!obsKalibr || !depth) return null;
    const f = depth.adj.factor;
    return {
      median: Math.round(obsKalibr.medianDjup * f * 10) / 10,
      lo:     Math.round(obsKalibr.p25 * f * 10) / 10,
      hi:     Math.round(obsKalibr.p75 * f * 10) / 10,
    };
  })();

  // Jorddjup cap: if estimated GW depth exceeds soil thickness, groundwater is likely in bedrock.
  const jorddjupCapInfo = (() => {
    if (!data?.jorddjup || !effectiveAquifer || effectiveAquifer.type === 'rock' || effectiveAquifer.type === 'unknown') return null;
    const jd = data.jorddjup.djup;
    if (!jd || jd <= 0.5) return null;
    const refDepth = calibratedDepth?.median ?? (depth ? (depth.lo + depth.hi) / 2 : 0);
    const hiDepth  = calibratedDepth?.hi ?? depth?.hi ?? 0;
    const likelyBedrock   = refDepth > jd;
    const possiblyBedrock = !likelyBedrock && hiDepth > jd * 0.85;
    if (!likelyBedrock && !possiblyBedrock) return null;
    return { soilDepth: jd, likelyBedrock, possiblyBedrock };
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
      className={`absolute z-30 bg-card shadow-xl border border-border overflow-hidden flex flex-col ${
        isMobile
          ? 'bottom-0 left-0 right-0 rounded-t-2xl rounded-b-none border-b-0'
          : 'rounded-xl'
      }`}
      style={
        isMobile
          ? { maxHeight: '85vh' }
          : { left: position.left, top: position.top, width: 400, maxHeight: '85vh' }
      }
    >
      {/* Mobile drag handle */}
      {isMobile && (
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
      )}

      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 bg-sgu-maroon text-white select-none shrink-0 ${isMobile ? '' : 'cursor-move'}`}
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
                {data.elevation != null && (
                  <div className="text-muted-foreground">
                    Höjd: <span className="font-medium text-foreground">{data.elevation} m ö.h.</span>
                    <span className="text-[10px] ml-1">(EU-DEM 25m)</span>
                  </div>
                )}
              </div>
            </div>

            <hr className="border-border" />

            {/* ── TOLKNING ── */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tolkning</h3>

              {/* Aquifer type – only shown when we have actual jordart data */}
              {aquifer && aquifer.type !== 'unknown' ? (
                <div className="bg-secondary/40 rounded-lg p-3 mb-2">
                  {effectiveAquifer && effectiveAquifer !== aquifer ? (
                    // Surface is a confining layer; the effective aquifer comes from
                    // the underlying named groundwater aquifer (grundvattenmagasin).
                    <>
                      <div className="text-xs text-muted-foreground mb-0.5">Akvifer (utifrån magasin)</div>
                      <div className="font-semibold">{effectiveAquifer.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Täcklager (ytgeologi): {aquifer.label}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-muted-foreground mb-0.5">Akvifer (utifrån jordart)</div>
                      <div className="font-semibold">{aquifer.label}</div>
                    </>
                  )}
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

              {/* Depth estimate – shown for non-unknown, non-pure-confining aquifers with HYPE data */}
              {depth && effectiveAquifer?.type !== 'unknown' && !(aquifer?.type === 'confining' && effectiveAquifer === aquifer) && (
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
                      <div className={`text-xs mt-1 ${depth.adj.color}`}>{depth.adj.label}</div>
                      <div className="text-xs mt-1.5 text-muted-foreground">
                        Observerat P25–P75: {obsKalibr!.p25.toFixed(1)}–{obsKalibr!.p75.toFixed(1)} m
                        · median {obsKalibr!.medianDjup.toFixed(1)} m
                        · {obsKalibr!.antal} stationer
                        <span className={`ml-1 ${obsKalibr!.aquiferMatch ? 'text-green-700 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                          · {obsKalibr!.matchLabel}
                        </span>
                        {obsKalibr!.highVariance && (
                          <span className="block text-[10px] mt-0.5 text-orange-600 dark:text-orange-400">
                            Stor spridning mellan stationer – heterogena akviferer i området. Kalibreringen är osäker.
                          </span>
                        )}
                        <span className="block text-[10px] mt-0.5 opacity-70">
                          Närmaste observation ±7 dagar från valt datum per station
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-muted-foreground mb-1">
                        Uppskattad grundvattennivå under markyta
                        {data?.hypoDate && (
                          <span className="ml-1">
                            · {data.hypoDate.replace(/Z$/, '')}
                            {data?.hypoDateIsFallback && <span className="italic"> (senaste tillgängliga)</span>}
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
                  {jorddjupCapInfo && (
                    <div className={`flex items-start gap-1.5 mt-2 rounded-md px-2.5 py-2 text-xs ${
                      jorddjupCapInfo.likelyBedrock
                        ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300'
                        : 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-300'
                    }`}>
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        {jorddjupCapInfo.likelyBedrock ? (
                          <>
                            <span className="font-semibold">Troligen bergmagasin.</span>
                            {' '}Estimerat djup ({calibratedDepth?.median ?? Math.round((depth!.lo + depth!.hi) / 2)} m) överstiger jorddjupet i närheten (~{jorddjupCapInfo.soilDepth.toFixed(1)} m).
                            Grundvattnet finns troligen i sprickor i berggrunden.
                            Osäkerheten ökar – bergmagasinets djup beror på täcklager, sprickor och topografiskt läge.
                          </>
                        ) : (
                          <>
                            <span className="font-semibold">Möjligt bergmagasin.</span>
                            {' '}Övre delen av djupintervallet kan överstiga jorddjupet (~{jorddjupCapInfo.soilDepth.toFixed(1)} m),
                            vilket antyder att grundvattnet delvis kan finnas i berggrunden.
                          </>
                        )}
                      </span>
                    </div>
                  )}
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
                {/* Jorddjup – thickness of soil above bedrock from WMS raster */}
                {aquifer?.type === 'rock' ? (
                  <div className="text-xs mb-1.5">
                    <span className="font-medium">Jordlager:</span>
                    <span className="ml-1 text-muted-foreground italic">≈ 0 m – berg i dagen, inget jordmagasin</span>
                  </div>
                ) : data.jorddjup ? (
                  <div className="text-xs mb-1.5">
                    <span className="font-medium">Jordlager (jorddjupsmodell):</span>
                    <span className="ml-1 text-blue-700 dark:text-blue-400 font-semibold">
                      {data.jorddjup.djup.toFixed(1)} m
                    </span>
                    <span className="text-muted-foreground ml-1">(interpolerat 10×10 m raster)</span>
                  </div>
                ) : null}
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

              {/* Observed groundwater level stations ±7 days */}
              {data.obsStationer && data.obsStationer.length > 0 ? (
                <>
                  <div className="text-xs text-muted-foreground mb-2">
                    {data.obsStationer.length} stationer med observationer ±7 dagar från {selectedDate}
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {data.obsStationer.slice(0, 10).map(st => (
                      <div key={st.id} className="flex items-center justify-between bg-secondary/30 rounded px-2.5 py-1.5 text-xs">
                        <div className="min-w-0 flex-1">
                          <span className="font-medium">{st.namn || st.id}</span>
                          <span className="text-muted-foreground ml-1.5">{st.distKm.toFixed(1)} km</span>
                          {st.jordart && (
                            <span className="text-muted-foreground ml-1.5 truncate">{st.jordart}</span>
                          )}
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="font-semibold text-blue-700 dark:text-blue-400">{st.djup.toFixed(1)} m</span>
                          <div className="text-[10px] text-muted-foreground">{st.obsdatum.slice(0, 10)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {data.obsStationer.length > 10 && (
                    <div className="text-[10px] text-muted-foreground mb-3 text-right">
                      +{data.obsStationer.length - 10} stationer till
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-muted-foreground mb-3">
                  Inga observerade grundvattennivåer ±7 dagar från valt datum hittades inom 50 km
                </div>
              )}

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
                  {data.hypoSeries && data.hypoSeries.length >= 2 && (
                    <div className="mt-3 mb-3">
                      <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Trend – senaste året</div>
                      <ResponsiveContainer width="100%" height={90}>
                        <AreaChart data={data.hypoSeries} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                          <defs>
                            <linearGradient id="gfSma" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gfStora" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="datum" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => new Date(v).toLocaleDateString('sv', { month: 'short' }).replace('.', '')} interval="preserveStartEnd" />
                          <YAxis domain={[0, 100]} hide />
                          <Tooltip content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, padding: '4px 8px', fontSize: 11 }}>
                                <div style={{ fontWeight: 600, marginBottom: 2 }}>{String(label).slice(0, 7)}</div>
                                {payload.map(p => (
                                  <div key={String(p.name)} style={{ color: p.color as string }}>
                                    {p.name}: {p.value != null ? `${Math.round(Number(p.value))}:e perc.` : '–'}
                                  </div>
                                ))}
                              </div>
                            );
                          }} />
                          {data.hypoDate && <ReferenceLine x={data.hypoDate.slice(0, 10)} stroke="hsl(var(--foreground))" strokeDasharray="3 3" strokeWidth={1} />}
                          <Area type="monotone" dataKey="fyllnadStora" name="Stort magasin" stroke="#22c55e" fill="url(#gfStora)" strokeWidth={1.5} dot={false} connectNulls />
                          <Area type="monotone" dataKey="fyllnadSma" name="Litet magasin" stroke="#3b82f6" fill="url(#gfSma)" strokeWidth={1.5} dot={false} connectNulls />
                        </AreaChart>
                      </ResponsiveContainer>
                      <div className="flex gap-3 justify-center mt-1">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="inline-block w-3 h-0.5 rounded bg-blue-500" />Litet magasin</span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="inline-block w-3 h-0.5 rounded bg-green-500" />Stort magasin</span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="inline-block w-3 h-0.5 rounded" style={{ borderTop: '1px dashed currentColor', background: 'none' }} />Valt datum</span>
                      </div>
                    </div>
                  )}
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
              {aquifer?.type === 'rock' ? (
                <div className="flex justify-between items-baseline text-xs mb-1.5">
                  <span className="text-muted-foreground">Jorddjup</span>
                  <span className="font-medium ml-2 text-right text-muted-foreground italic">≈ 0 m (berg i dagen)</span>
                </div>
              ) : data.jorddjup ? (
                <div className="flex justify-between items-baseline text-xs mb-1.5">
                  <span className="text-muted-foreground">Jorddjup (10×10 m raster, interpolerat)</span>
                  <span className="font-medium ml-2 text-right">
                    {data.jorddjup.djup.toFixed(1)} m
                  </span>
                </div>
              ) : null}

              {/* Grundvattenmagasin – card */}
              {data.magasin && (() => {
                const m = data.magasin!;
                return (
                  <div className="mt-1 bg-secondary/30 border border-border rounded-lg p-3 space-y-2.5">
                    {/* Header: label */}
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Grundvattenmagasin (SGU)
                    </div>

                    {/* Name */}
                    <div className="text-xs font-semibold leading-snug">{m.namn}</div>

                    {/* Badges: position code + type + genesis */}
                    <div className="flex flex-wrap gap-1">
                      {m.positionKod && (
                        <span className="text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded">
                          {m.positionKod}
                        </span>
                      )}
                      {m.akvifertyp && (
                        <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded capitalize border border-border">
                          {m.akvifertyp}
                        </span>
                      )}
                      {m.genes && (
                        <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded capitalize border border-border">
                          {m.genes}
                        </span>
                      )}
                    </div>

                    {/* Data rows */}
                    <div className="space-y-1 text-xs">
                      {m.geomAreaKm2 != null && (
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-muted-foreground shrink-0">Yta</span>
                          <span className="font-medium">~{m.geomAreaKm2} km²</span>
                        </div>
                      )}
                      {m.medelmaktighetMattad && (
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-muted-foreground shrink-0">Mättad zon</span>
                          <span className="font-medium text-right">{m.medelmaktighetMattad}</span>
                        </div>
                      )}
                      {m.medelmaktighetOmattad && (
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-muted-foreground shrink-0">Omättad zon</span>
                          <span className="font-medium text-right">{m.medelmaktighetOmattad}</span>
                        </div>
                      )}
                      {m.tillrinningLs != null && (
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-muted-foreground shrink-0">Tillrinning</span>
                          <span className="font-medium">{m.tillrinningLs.toLocaleString('sv')} l/s</span>
                        </div>
                      )}
                      {m.grvbildningstyp && (
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="text-muted-foreground shrink-0">GV-bildning</span>
                          <span className="capitalize">{m.grvbildningstyp}</span>
                        </div>
                      )}
                    </div>

                    {m.lankBeskrivning && (
                      <a
                        href={m.lankBeskrivning}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-blue-700 dark:text-blue-400 hover:underline"
                      >
                        Magasinsbeskrivning (SGU) →
                      </a>
                    )}
                  </div>
                );
              })()}
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
                    note="OGC API Features – bbox mot klickad punkt. Fält: magasinsnamn, akvifertyp, genes, magasinsposition (J1/B1 etc.), geom_area (yta), grvbildningstyp, tillrinning_fran_tillrinningsomraden_l_per_s, medelmaktighet_mattad/omattad_zon."
                    url="https://api.sgu.se/oppnadata/grundvattenmagasin/ogc/features/v1"
                  />
                  <SourceRow
                    label="Grundvattennivå – observerade stationer"
                    source="SGU Grundvattennivåer observerade"
                    note="OGC API Features – stationer inom 50 km (bbox), nivaer via CQL2 IN-filter ±7 dagar. Fält: grundvattenniva_m_u_markyta, akvifer (B*=berg, J*=jord), jordart_tx, stationsnamn. Medianen skalas med HYPE-situationsfaktor."
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
                    source="SGU Jorddjupsmodell – WMS GetFeatureInfo"
                    note="WMS 1.3.0 GetFeatureInfo – interpolerat 10×10 m raster (RASTER_INTERVALL), lager SE.GOV.SGU.MISC.JORDDJUPSMODELL.RASTER_INTERVALL. Ger ett enskilt interpolerat djupvärde för den klickade punkten i EPSG:3857. Via proxy (CORS)."
                    url="https://resource.sgu.se/service/wms/130/jorddjupsmodell"
                  />
                  <SourceRow
                    label="Grundvattentillgång små magasin (l/dygn/ha)"
                    source="SGU GV-tillgång små magasin (WMS)"
                    note="WMS GetFeatureInfo – rastervärde via proxy. Lager: grundvattentillgang-sma-magasin. Fält: Grundvattentillgang_i_sma_magasin_l_dygn_ha."
                    url="https://api.sgu.se/oppnadata/grundvattentillgang-sma-magasin/wms"
                  />

                  <SourceRow
                    label="Terrängmodell / höjd (m ö.h.)"
                    source="OpenTopoData – EU-DEM 25m"
                    note="REST API – punkthöjd via EU Digital Elevation Model (25 m upplösning). Används för höjdinformation i koordinatpanelen."
                    url="https://www.opentopodata.org/datasets/eudem/"
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

            {/* Ask AI button */}
            {onOpenAI && (
              <div className="pt-1">
                <button
                  onClick={onOpenAI}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-sgu-maroon/10 hover:bg-sgu-maroon/20 text-sgu-maroon text-xs font-medium transition-colors border border-sgu-maroon/20"
                >
                  <Bot className="w-3.5 h-3.5 shrink-0" />
                  Fråga GeoAnalys AI om denna punkt
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
