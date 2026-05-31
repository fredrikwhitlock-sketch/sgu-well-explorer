import { useEffect, useState, useRef, useCallback } from "react";
import { Droplets, Loader2, MapPin, AlertCircle, RefreshCw, Info, ChevronDown, Bot, Download, Maximize2, Minimize2, X } from "lucide-react";
import { ObsHypoTimeSeriesChart } from "./ObsHypoTimeSeriesChart";
import {
  classifyAquifer,
  classifyByJg2,
} from "../../lib/aquifer";
import {
  GV_BEDGR,
  classifyParam,
  getSeason,
  mannKendall,
  analyzeSeasonality,
  GV_KLASS_COLORS,
} from "../../lib/grundvattenKemi";
import { FloatingChartPopup, ChartPopupState } from "./FloatingChartPopup";
import { escapeHtml } from "../../lib/utils";
import { exportAnalysisGeoPackage } from "../../lib/exportGeoPackage";
import { toast } from "sonner";
import { fetchGrundvattenData, BrunnInfo, ReportData } from "../../lib/grundvattenFetch";

interface Props {
  coordinate: [number, number]; // Web Mercator EPSG:3857
  wmsProxyUrl: string;
  onClose: () => void;
  onAnalysisData?: (summary: string | null) => void;
  onOpenAI?: () => void;
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

// HYPE fyllnadsgrad → Swedish situation label + color (percentile 0–100, 25–75 = normalt)
function hypePercentileInfo(p: number): { label: string; color: string } {
  if (p < 10)  return { label: 'Mycket under det normala', color: '#b91c1c' };
  if (p < 25)  return { label: 'Under det normala',        color: '#ea580c' };
  if (p <= 75) return { label: 'Normalt läge',             color: '#16a34a' };
  if (p <= 90) return { label: 'Över det normala',         color: '#0284c7' };
  return { label: 'Mycket över det normala', color: '#1d4ed8' };
}

// ── Component ─────────────────────────────────────────────────────────────────

export const GrundvattenRapport = ({ coordinate, wmsProxyUrl, onClose, onAnalysisData, onOpenAI }: Props) => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay()); // most recent Sunday
    // Use local-time parts to avoid UTC rollover near midnight
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [expandedObsStation, setExpandedObsStation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slowLoading, setSlowLoading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [expandedGvKemi, setExpandedGvKemi] = useState<Set<number>>(new Set([0]));
  const [chartPopup, setChartPopup] = useState<ChartPopupState>(null);

  useEffect(() => { setExpandedGvKemi(new Set([0])); }, [coordinate]);


  // Build a plain-text AI summary whenever analysis data changes
  useEffect(() => {
    if (!onAnalysisData) return;
    if (!data) { onAnalysisData(null); return; }

    const aq = data.jordartKod ? classifyByJg2(Number(data.jordartKod)) : classifyAquifer(data.jordartNamn);
    const hasStoraMag = !!data.magasin;

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
        obsKalibrStr = `median ${median.toFixed(1)} m (kv: ${p25.toFixed(1)}–${p75.toFixed(1)} m), ${pool.length} stationer`;
      }
    }

    const bergBr = (data.brunnar ?? []).filter(b => b.isBergborrad);
    const jordBr = (data.brunnar ?? []).filter(b => !b.isBergborrad);
    const medOf = (arr: BrunnInfo[]) => {
      const vals = arr.map(b => b.kapacitet).filter((v): v is number => v != null && v > 0).sort((a, b) => a - b);
      return vals.length ? vals[Math.floor(vals.length / 2)] : null;
    };

    const lines: string[] = [
      `## Grundvattenanalys – ${data.lat.toFixed(5)}°N, ${data.lon.toFixed(5)}°E`,
      `**SWEREF99 TM:** E ${Math.round(data.sweref[0])}, N ${Math.round(data.sweref[1])}`,
      ...(data.elevation != null ? [`**Höjd:** ${data.elevation} m ö.h. (EU-DEM 25m)`] : []),
      '',
      '### Jordart & Akvifer',
      `- **Jordart:** ${data.jordartNamn ?? 'Okänd'}${data.jordartKalla ? ` (källa: ${data.jordartKalla})` : ''}`,
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
      if (data.delomrade?.uttagsmojligheter) lines.push(`- **Uttagsmöjlighet (delområde):** ${data.delomrade.uttagsmojligheter}`);
      if (data.delomrade?.kornstorlek) lines.push(`- **Kornstorlek (delområde):** ${data.delomrade.kornstorlek}`);
      if (data.delomrade?.artesiskt) lines.push(`- **Artesiskt:** ${data.delomrade.artesiskt}`);
      if (data.delomrade?.nivaforhallande) lines.push(`- **Nivåförhållande:** ${data.delomrade.nivaforhallande}`);
      if (data.delomrade?.vattenkemi) lines.push(`- **Vattenkemi:** ${data.delomrade.vattenkemi}`);
    }

    lines.push('', '### Grundvattennivå');
    lines.push(`- **Kalibrerat djup (observerade stationer):** ${obsKalibrStr}`);
    if (data.obsStationer && data.obsStationer.length > 0) {
      lines.push(`- **Observerade stationer ±7 dagar:** ${data.obsStationer.length} st`);
      data.obsStationer.slice(0, 5).forEach(st => {
        lines.push(`  - ${st.namn} (${st.distKm.toFixed(1)} km) – ${st.djup.toFixed(1)} m u. markyta, ${st.obsdatum.slice(0, 10)}`);
      });
    }

    if (data.hypeFyllnad && (data.hypeFyllnad.sma != null || data.hypeFyllnad.stora != null)) {
      const h = data.hypeFyllnad;
      const parts: string[] = [];
      if (h.sma != null) parts.push(`små magasin ${h.sma}:e percentilen`);
      if (h.stora != null) parts.push(`stora magasin ${h.stora}:e percentilen`);
      lines.push(`- **SGU-HYPE fyllnadsgrad (modellerat, ${h.datum}):** ${parts.join(', ')} (percentil 0–100 jämfört med 1961–idag; 25–75 = normalt)`);
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
  const [expanded, setExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Detect mobile so we can render as a bottom sheet instead of a floating panel
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const handler = () => { clearTimeout(t); t = setTimeout(() => setIsMobile(window.innerWidth < 640), 100); };
    window.addEventListener('resize', handler);
    return () => { window.removeEventListener('resize', handler); clearTimeout(t); };
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
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    setLoading(true);
    setSlowLoading(false);
    setError(null);
    try {
      const result = await fetchGrundvattenData(
        coordinate, wmsProxyUrl, selectedDate, signal,
        (partial) => {
          if (signal.aborted) return;
          setData(partial);
          setLoading(false);
          setSlowLoading(true);
        },
      );
      if (!signal.aborted) {
        setData(result);
        setSlowLoading(false);
      }
    } catch (e: any) {
      if (signal.aborted) return;
      console.error("GrundvattenRapport error:", e);
      setError("Kunde inte hämta data. Kontrollera din internetanslutning.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [coordinate, wmsProxyUrl, selectedDate]);


  useEffect(() => {
    fetchData();
    return () => { abortRef.current?.abort(); };
  }, [fetchData]);

  // ── Derived interpretation ─────────────────────────────────────────────────
  const isWaterPoint = data?.jordartKod === '91';
  // Use jg2 code when available (precise); fall back to name-based match.
  // Water (jg2=91) is not an aquifer – skip classification entirely.
  const aquifer = data && !isWaterPoint
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

  // Calibrated depth: observed P25/P75 from nearby stations (no HYPE adjustment)
  const calibratedDepth = obsKalibr
    ? { median: obsKalibr.medianDjup, lo: obsKalibr.p25, hi: obsKalibr.p75 }
    : null;

  // Jorddjup cap: if estimated GW depth exceeds soil thickness, groundwater is likely in bedrock.
  const jorddjupCapInfo = (() => {
    if (!data?.jorddjup || !effectiveAquifer || effectiveAquifer.type === 'rock' || effectiveAquifer.type === 'unknown') return null;
    const jd = data.jorddjup.djup;
    if (!jd || jd <= 0.5) return null;
    const refDepth = calibratedDepth?.median ?? (effectiveAquifer ? (effectiveAquifer.depthMin + effectiveAquifer.depthMax) / 2 : 0);
    const hiDepth  = calibratedDepth?.hi ?? effectiveAquifer?.depthMax ?? 0;
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

  // ── Export ────────────────────────────────────────────────────────────────
  const exportReport = useCallback(() => {
    if (!data) return;
    const e = escapeHtml;
    const today = new Date().toISOString().split('T')[0];
    const kCol = (k: number) => GV_KLASS_COLORS[k] ?? '#6b7280';
    let html = `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8">
<title>Grundvattenanalys – ${data.lat.toFixed(5)}°N ${data.lon.toFixed(5)}°E</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#1a1a1a;background:#fff;padding:32px;max-width:900px;margin:0 auto}
h1{font-size:20px;color:#6b0f1a;margin-bottom:4px}
.sub{color:#6b7280;font-size:12px;margin-bottom:24px}
h2{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin:20px 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
.row{display:flex;justify-content:space-between;align-items:baseline;padding:2px 0;gap:16px}
.lbl{color:#6b7280;white-space:nowrap}
.val{font-weight:500;text-align:right}
table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12px}
th{background:#f3f4f6;padding:5px 8px;text-align:left;font-weight:600;border:1px solid #e5e7eb}
td{padding:4px 8px;border:1px solid #e5e7eb}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:middle}
.sh{background:#f9fafb;padding:8px 12px;margin-top:14px;border-radius:6px 6px 0 0;border:1px solid #e5e7eb;border-bottom:none;font-weight:600}
.sb{border:1px solid #e5e7eb;border-radius:0 0 6px 6px;overflow:hidden;margin-bottom:4px}
.badge{font-size:10px;padding:1px 6px;border-radius:4px;font-weight:500;margin-left:4px}
.bb{background:#dbeafe;color:#1d4ed8}
.ba{background:#fef3c7;color:#92400e}
.note{color:#9ca3af;font-size:11px;margin-top:4px;font-style:italic}
.pbtn{position:fixed;bottom:24px;right:24px;background:#6b0f1a;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,.2)}
@media print{.pbtn{display:none}body{padding:16px}}
</style>
</head>
<body>
<button class="pbtn" onclick="window.print()">Skriv ut / Spara PDF</button>
<h1>Grundvattenanalys</h1>
<div class="sub">Genererad ${today} · Analyserat datum: ${e(selectedDate)}</div>`;

    // Coordinates
    html += `<h2>Koordinater</h2>
<div class="row"><span class="lbl">WGS84</span><span class="val">${data.lat.toFixed(5)}°N, ${data.lon.toFixed(5)}°E</span></div>
<div class="row"><span class="lbl">SWEREF99 TM</span><span class="val">${Math.round(data.sweref[0])} E, ${Math.round(data.sweref[1])} N</span></div>
${data.elevation != null ? `<div class="row"><span class="lbl">Höjd ö.h. (EU-DEM 25m)</span><span class="val">${data.elevation} m</span></div>` : ''}`;

    // Jordart & akvifer
    if (data.jordartNamn || (aquifer && aquifer.type !== 'unknown')) {
      html += `<h2>Jordart & Akvifer</h2>`;
      if (data.jordartNamn) html += `<div class="row"><span class="lbl">Jordart${data.jordartKalla && data.jordartKalla !== 'grundlager' ? ` (${e(data.jordartKalla)})` : ''}</span><span class="val">${e(data.jordartNamn)}</span></div>`;
      if (data.jorddjup) html += `<div class="row"><span class="lbl">Jorddjup (10×10 m raster)</span><span class="val">${data.jorddjup.djup.toFixed(1)} m</span></div>`;
      if (aquifer && aquifer.type !== 'unknown') html += `<div class="row"><span class="lbl">Akvifertyp (yta)</span><span class="val">${e(aquifer.label)}</span></div>`;
      if (effectiveAquifer && effectiveAquifer !== aquifer) html += `<div class="row"><span class="lbl">Effektiv akvifer (under täcklager)</span><span class="val">${e(effectiveAquifer.label)}</span></div>`;
    }

    // Magasin
    if (data.magasin) {
      const m = data.magasin;
      html += `<h2>Grundvattenmagasin</h2>`;
      html += `<div class="row"><span class="lbl">Namn</span><span class="val">${e(m.namn)}</span></div>`;
      if (m.akvifertyp) html += `<div class="row"><span class="lbl">Akvifertyp</span><span class="val">${e(m.akvifertyp)}</span></div>`;
      if (m.genes) html += `<div class="row"><span class="lbl">Genesis</span><span class="val">${e(m.genes)}</span></div>`;
      if (m.geomAreaKm2) html += `<div class="row"><span class="lbl">Area</span><span class="val">${m.geomAreaKm2.toFixed(1)} km²</span></div>`;
      if (m.tillrinningLs != null) html += `<div class="row"><span class="lbl">Tillrinning</span><span class="val">${m.tillrinningLs} l/s</span></div>`;
      if (m.medelmaktighetMattad) html += `<div class="row"><span class="lbl">Medelm. mättad zon</span><span class="val">${e(m.medelmaktighetMattad)}</span></div>`;
      if (m.medelmaktighetOmattad) html += `<div class="row"><span class="lbl">Medelm. omättad zon</span><span class="val">${e(m.medelmaktighetOmattad)}</span></div>`;
      if (m.magasinsposition) html += `<div class="row"><span class="lbl">Position</span><span class="val">${e(m.magasinsposition)}</span></div>`;
    }

    // Delomrade
    if (data.delomrade) {
      const d2 = data.delomrade;
      html += `<h2>Magasinsdelområde</h2>`;
      if (d2.namn) html += `<div class="row"><span class="lbl">Delområde</span><span class="val">${e(d2.namn)}</span></div>`;
      if (d2.magasinsnamn) html += `<div class="row"><span class="lbl">Magasin</span><span class="val">${e(d2.magasinsnamn)}</span></div>`;
      if (d2.uttagsmojligheter) html += `<div class="row"><span class="lbl">Uttagsmöjligheter</span><span class="val">${e(d2.uttagsmojligheter)}</span></div>`;
      if (d2.kornstorlek) html += `<div class="row"><span class="lbl">Kornstorlek</span><span class="val">${e(d2.kornstorlek)}</span></div>`;
      if (d2.artesiskt) html += `<div class="row"><span class="lbl">Artesiskt</span><span class="val">${e(d2.artesiskt)}</span></div>`;
      if (d2.nivaforhallande) html += `<div class="row"><span class="lbl">Nivåförhållande</span><span class="val">${e(d2.nivaforhallande)}</span></div>`;
      if (d2.vattenkemi) html += `<div class="row"><span class="lbl">Vattenkemi</span><span class="val">${e(d2.vattenkemi)}</span></div>`;
    }

    // Depth from observed stations
    if (effectiveAquifer?.type !== 'unknown' && !(aquifer?.type === 'confining' && effectiveAquifer === aquifer)) {
      html += `<h2>Grundvattennivå – uppskattad</h2>`;
      if (calibratedDepth) {
        html += `<div class="row"><span class="lbl">Kalibrerad uppskattning</span><span class="val" style="font-size:16px;font-weight:700">${calibratedDepth.lo.toFixed(1)}–${calibratedDepth.hi.toFixed(1)} m u. markytan</span></div>`;
        html += `<div class="row"><span class="lbl">Observerat median</span><span class="val">${obsKalibr!.medianDjup.toFixed(1)} m</span></div>`;
        html += `<div class="row"><span class="lbl">Kvartilar P25–P75</span><span class="val">${obsKalibr!.p25.toFixed(1)}–${obsKalibr!.p75.toFixed(1)} m</span></div>`;
        html += `<div class="row"><span class="lbl">Stationer</span><span class="val">${obsKalibr!.antal} st · ${obsKalibr!.matchLabel}</span></div>`;
      } else if (effectiveAquifer) {
        html += `<div class="row"><span class="lbl">Uppskattning (akvifertyp)</span><span class="val" style="font-size:16px;font-weight:700">${effectiveAquifer.depthMin}–${effectiveAquifer.depthMax} m u. markytan</span></div>`;
        html += `<p class="note">Baserat på akvifertyp – inga observerade stationer för kalibrering</p>`;
      }
      if (jorddjupCapInfo) html += `<p class="note" style="color:#c2410c">${jorddjupCapInfo.likelyBedrock ? `Jorddjup (${jorddjupCapInfo.soilDepth.toFixed(1)} m) grundare än uppskattning – grundvatten troligen i berg` : `Övre gräns når nära jorddjup (${jorddjupCapInfo.soilDepth.toFixed(1)} m)`}</p>`;
    }

    // SGU-HYPE fyllnadsgrad (modellerat)
    if (data.hypeFyllnad && (data.hypeFyllnad.sma != null || data.hypeFyllnad.stora != null)) {
      const h = data.hypeFyllnad;
      html += `<h2>SGU-HYPE fyllnadsgrad (modellerat)</h2>`;
      if (h.sma != null) html += `<div class="row"><span class="lbl">Små magasin</span><span class="val">${h.sma}:e percentilen</span></div>`;
      if (h.stora != null) html += `<div class="row"><span class="lbl">Stora magasin</span><span class="val">${h.stora}:e percentilen</span></div>`;
      html += `<p class="note">Percentil 0–100 mot referensperiod 1961–idag (25–75 = normalt läge). Modellerat datum: ${e(h.datum)}</p>`;
    }

    // Capacity
    if (medianBergKapacitet != null || medianJordKapacitet != null || data.gvTillgangLdha != null) {
      html += `<h2>Kapacitet</h2>`;
      if (aquifer && aquifer.type !== 'unknown') html += `<div class="row"><span class="lbl">Typisk (${e(aquifer.label.split('–')[0].trim())})</span><span class="val">${e(aquifer.capacityLabel)}</span></div>`;
      if (medianBergKapacitet != null) html += `<div class="row"><span class="lbl">Bergborrade brunnar nära (median, ${bergBrunnar.length} st)</span><span class="val">${medianBergKapacitet} l/h</span></div>`;
      if (medianJordKapacitet != null) html += `<div class="row"><span class="lbl">Grävda/rörbrunnars kapacitet nära (median, ${jordBrunnar.length} st)</span><span class="val">${medianJordKapacitet} l/h</span></div>`;
      if (data.gvTillgangLdha != null) html += `<div class="row"><span class="lbl">Grundvattentillgång, små magasin</span><span class="val">${Math.round(data.gvTillgangLdha)} l/dygn/ha</span></div>`;
    }

    // Geokemi
    if (data.geokemi) {
      html += `<h2>Markgeokemi (morän)</h2>`;
      html += `<div class="row"><span class="lbl">Avstånd</span><span class="val">MS ${data.geokemi.distKm} km${data.geokemi.distKmAes != null ? ` · AES ${data.geokemi.distKmAes} km` : ''}${data.geokemi.artal ? ` · ${e(data.geokemi.artal)}` : ''}</span></div>`;
      const GEO_KEYS = ['as','u','ni','pb','cr','cd','mn','fe','f','cu','zn','co','mo','v','ca','mg'];
      const GEO_LBL: Record<string,string> = {as:'As',u:'U',ni:'Ni',pb:'Pb',cr:'Cr',cd:'Cd',mn:'Mn',fe:'Fe',f:'F',cu:'Cu',zn:'Zn',co:'Co',mo:'Mo',v:'V',ca:'Ca',mg:'Mg'};
      const geoPresent = GEO_KEYS.filter(k => data.geokemi!.elements[k] != null);
      if (geoPresent.length > 0) {
        html += `<table><tr>${geoPresent.map(k => `<th>${GEO_LBL[k]}</th>`).join('')}</tr>`;
        html += `<tr>${geoPresent.map(k => { const v = data.geokemi!.elements[k]!; return `<td>${v < 1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : v < 1000 ? Math.round(v) : (v/1000).toFixed(1)+'k'}</td>`; }).join('')}</tr></table>`;
      }
    }

    // Förekomst
    if (data.gvForekomstId) {
      html += `<h2>Grundvattenförekomst (WFD)</h2>`;
      html += `<div class="row"><span class="lbl">Nationell kod</span><span class="val">${e(data.gvForekomstId)}</span></div>`;
    }

    // GV Kemi
    if (data.gvKemi && data.gvKemi.length > 0) {
      html += `<h2>Grundvattenkemi</h2>`;
      for (const st of data.gvKemi) {
        const badges = [
          st.fromBody ? '<span class="badge bb">Förekomst</span>' : '',
          st.trend ? '<span class="badge ba">Trendstation</span>' : '',
        ].join('');
        const meta = [
          st.distKm != null ? `${st.distKm} km` : '',
          st.senasteprov ? `${e(st.senasteprov)}${st.seasonalSelection ? ' (årstidsval)' : ''}` : '',
        ].filter(Boolean).join(' · ');
        html += `<div class="sh">${e(st.provplatsnamn)} <span style="font-weight:400;font-size:11px;color:#6b7280">(ID: ${e(st.provplatsid)})</span>${badges}${meta ? `<span style="font-weight:400;font-size:11px;color:#9ca3af;margin-left:8px">${meta}</span>` : ''}</div>`;
        html += `<div class="sb">`;
        if (st.params.length > 0) {
          html += `<table><tr><th>Parameter</th><th>Värde</th><th>Enhet</th><th>Klass</th><th>Datum</th></tr>`;
          for (const p of st.params) {
            html += `<tr><td>${e(p.label || p.name)}</td><td>${e(p.value)}</td><td>${e(p.unit)}</td><td><span class="dot" style="background:${kCol(p.klass)}"></span>${p.klass}</td><td>${e(p.datum)}</td></tr>`;
          }
          html += `</table>`;
        }
        if (st.trend) {
          const t = st.trend;
          html += `<div style="padding:8px 12px;border-top:1px solid #e5e7eb"><div style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:6px">TRENDANALYS (Mann-Kendall) · ${t.yearSpan} år · ${t.nDates} mättillfällen</div>`;
          html += `<table><tr><th>Parameter</th><th>Senaste</th><th>Trend</th><th>Sign.</th><th>Förändring/år</th><th>Säsongsvar.</th></tr>`;
          for (const tp of t.params) {
            const tLbl = tp.mk.trend === 'increasing' ? '↑ Ökande' : tp.mk.trend === 'decreasing' ? '↓ Minskande' : '→ Ingen';
            const tCol = tp.mk.trend === 'increasing' ? '#dc2626' : tp.mk.trend === 'decreasing' ? '#2563eb' : '#6b7280';
            html += `<tr><td>${e(tp.label || tp.name)}</td><td>${e(tp.latestValue)} ${e(tp.unit)}</td><td style="color:${tCol};font-weight:600">${tLbl}</td><td>${tp.mk.significant ? 'Ja (p<0.05)' : 'Nej'}</td><td>${tp.mk.slope >= 0 ? '+' : ''}${tp.mk.slope.toFixed(4)} ${e(tp.unit)}/år</td><td>${tp.hasSeasonality ? `Ja (${Math.round(tp.seasonalAmplitudePct)}%)` : 'Nej'}</td></tr>`;
          }
          html += `</table></div>`;
        }
        const stMeta = [st.eucdGwb ? `Förekomst: ${e(st.eucdGwb)}` : '', st.provplatskat ? `Kategori: ${e(st.provplatskat)}` : '', st.region ? `Region: ${e(st.region)}` : ''].filter(Boolean);
        if (stMeta.length > 0) html += `<div style="padding:4px 12px 8px;font-size:11px;color:#9ca3af">${stMeta.join(' · ')}</div>`;
        html += `</div>`;
      }
    }

    // Footer
    html += `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af">
<p>Tolkningar är uppskattningar baserade på modeller och regionala observationer. De ersätter inte platsspecifik hydrogeologisk undersökning.</p>
<p style="margin-top:4px">Datakällor: SGU OGC API, EU-DEM 25m (OpenTopoData)</p>
</div>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }, [data, aquifer, effectiveAquifer, calibratedDepth, obsKalibr, bergBrunnar, jordBrunnar,
      medianBergKapacitet, medianJordKapacitet, jorddjupCapInfo, selectedDate]);

  const exportGeoPackage = useCallback(async () => {
    if (!data) return;
    const tid = toast.loading('Skapar GeoPackage…');
    try {
      await exportAnalysisGeoPackage({
        lon: data.lon, lat: data.lat, sweref: data.sweref,
        elevation: data.elevation,
        jordartNamn: data.jordartNamn, jordartKod: data.jordartKod, jordartKalla: data.jordartKalla,
        jorddjup: data.jorddjup?.djup,
        aquiferLabel: aquifer && aquifer.type !== 'unknown' ? aquifer.label : undefined,
        hypoDate: data.hypeFyllnad?.datum,
        fyllnadsgradSma: data.hypeFyllnad?.sma ?? null,
        fyllnadsgradStora: data.hypeFyllnad?.stora ?? null,
        gvTillgangLdha: data.gvTillgangLdha,
        depthLo: calibratedDepth?.lo,
        depthHi: calibratedDepth?.hi,
        depthCalibrated: !!calibratedDepth,
        magasin: data.magasin,
        delomrade: data.delomrade,
        gvForekomstId: data.gvForekomstId,
        brunnar: data.brunnar,
        obsStationer: data.obsStationer,
        gvKemi: data.gvKemi?.map(st => ({ ...st, hasTrend: !!st.trend })),
        analysisDate: selectedDate,
      });
      toast.success('GeoPackage nedladdat', { id: tid });
    } catch (err: any) {
      toast.error(err?.message ?? 'Kunde inte skapa GeoPackage', { id: tid });
    }
  }, [data, aquifer, calibratedDepth, selectedDate]);

  // ── Render ────────────────────────────────────────────────────────────────
  const desktopExpanded = expanded && !isMobile;
  return (
    <>
    {/* Floating chart popup */}
    {chartPopup && (
      <FloatingChartPopup
        title={
          chartPopup.kind === 'obs'
            ? `Nivådiagram – ${chartPopup.namn}`
            : chartPopup.label
        }
        onClose={() => setChartPopup(null)}
      >
        {chartPopup.kind === 'obs' && (
          <ObsHypoTimeSeriesChart
            stations={[{ id: chartPopup.stationId, namn: chartPopup.namn, distKm: chartPopup.distKm }]}
            omradeId={data?.hypeOmradeId}
            useStora={!!(effectiveAquifer?.useStoraMagasin)}
            years={5}
            maxStations={1}
          />
        )}
      </FloatingChartPopup>
    )}
    <div
      className={`absolute z-30 bg-card shadow-xl border border-border overflow-hidden flex flex-col ${
        isMobile
          ? 'bottom-0 left-0 right-0 rounded-t-2xl rounded-b-none border-b-0'
          : 'rounded-xl'
      }`}
      style={
        isMobile
          ? { maxHeight: '85vh' }
          : expanded
          ? { left: position.left, top: position.top, width: 1200, height: '85vh' }
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
        <div className="flex items-center gap-1">
          {!isMobile && (
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded hover:bg-white/20 transition-colors"
              title={expanded ? 'Komprimera vy' : 'Utöka till trekolumnslayout'}
            >
              {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Date picker (for observed stations ±7-day window) */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/30 shrink-0">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Datum:</span>
        <input
          type="date"
          value={selectedDate}
          min="1961-01-01"
          max={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
          onChange={e => { if (e.target.value) setSelectedDate(e.target.value); }}
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
        <button
          onClick={exportReport}
          disabled={!data || loading}
          className="shrink-0 p-1.5 rounded hover:bg-secondary transition-colors disabled:opacity-50"
          title="Exportera rapport (HTML)"
        >
          <Download className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button
          onClick={exportGeoPackage}
          disabled={!data || loading}
          className="shrink-0 px-2 py-1 rounded hover:bg-secondary transition-colors disabled:opacity-50 text-[10px] font-mono font-semibold text-muted-foreground"
          title="Exportera GeoPackage (.gpkg) – öppnas i QGIS"
        >
          .gpkg
        </button>
      </div>

      <div className={`flex-1 min-h-0 ${desktopExpanded ? 'overflow-hidden' : 'overflow-y-auto'}`}>
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
          <div className={desktopExpanded ? 'flex h-full divide-x divide-border' : 'p-4 space-y-4 text-sm'}>
            <div className={desktopExpanded ? 'flex-1 min-w-0 p-4 space-y-4 text-sm overflow-y-auto' : 'contents'}>

            {/* Coordinates */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Koordinater</span>
              </div>
              <div className="text-xs space-y-0.5">
                <div>WGS84: {data.lat.toFixed(5)}°N, {data.lon.toFixed(5)}°E</div>
                <div className="text-muted-foreground">SWEREF99 TM: {Math.round(data.sweref[0])} E, {Math.round(data.sweref[1])} N</div>
                {data.elevation != null ? (
                  <div className="text-muted-foreground">
                    Höjd: <span className="font-medium text-foreground">{data.elevation} m ö.h.</span>
                    <span className="text-[10px] ml-1">(EU-DEM 25m)</span>
                  </div>
                ) : slowLoading && (
                  <div className="text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-[10px]">Hämtar höjddata…</span>
                  </div>
                )}
              </div>
            </div>

            <hr className="border-border" />

            {/* ── TOLKNING ── */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tolkning</h3>

              {/* Water point – no aquifer analysis */}
              {isWaterPoint ? (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-2">
                  <div className="text-xs text-muted-foreground mb-0.5">Jordart (ytgeologi)</div>
                  <div className="font-semibold text-blue-700 dark:text-blue-400">Vatten</div>
                  <div className="text-xs text-muted-foreground mt-1">Punkten ligger i ett vattendrag, sjö eller hav – ingen akviferanalys</div>
                </div>
              ) : null}

              {/* Aquifer type – only shown when we have actual jordart data */}
              {!isWaterPoint && aquifer && aquifer.type !== 'unknown' ? (
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
              ) : !isWaterPoint && !data.jordartNamn ? (
                <div className="text-xs text-muted-foreground mb-2">
                  Ingen jordartsinformation tillgänglig för denna punkt
                </div>
              ) : null}

              {/* Capacity interpretation – not relevant for water points */}
              {!isWaterPoint && (
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
                    {bergBrunnar.length <= 5 && (
                      <ul className="mt-1 ml-2 space-y-0.5">
                        {bergBrunnar.map(b => (
                          <li key={b.id} className="text-muted-foreground">
                            {b.id}{b.adress ? ` – ${b.adress}` : ''}{b.kapacitet ? `: ${b.kapacitet} l/h` : ''}{b.distKm != null ? `, ${b.distKm} km` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
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
                {data.jorddjup ? (
                  <div className="text-xs mb-1.5">
                    <span className="font-medium">Jordlager (jorddjupsmodell):</span>
                    <span className="ml-1 text-blue-700 dark:text-blue-400 font-semibold">
                      {data.jorddjup.djup.toFixed(1)} m
                    </span>
                    <span className="text-muted-foreground ml-1">(interpolerat 10×10 m raster)</span>
                  </div>
                ) : aquifer?.type === 'rock' ? (
                  <div className="text-xs mb-1.5">
                    <span className="font-medium">Jordlager:</span>
                    <span className="ml-1 text-muted-foreground italic">≈ 0 m – berg i dagen, inget jordmagasin</span>
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
                  <div className={`text-xs mb-1.5`}>
                    <span className={`font-medium ${aquifer?.type === 'till' ? 'text-muted-foreground' : ''}`}>
                      {aquifer?.type === 'till' ? 'Grävda/rörbrunnars kapacitet nära (referens):' : 'Grävda/rörbrunnars kapacitet nära:'}
                    </span>
                    <span className={`ml-1 font-semibold ${aquifer?.type === 'till' ? 'text-muted-foreground' : 'text-blue-700 dark:text-blue-400'}`}>
                      {medianJordKapacitet} l/h
                    </span>
                    <span className="text-muted-foreground ml-1">(median, {jordBrunnar.length} brunnar)</span>
                    {jordBrunnar.length <= 5 && (
                      <ul className="mt-1 ml-2 space-y-0.5">
                        {jordBrunnar.map(b => (
                          <li key={b.id} className="text-muted-foreground">
                            {b.id}{b.adress ? ` – ${b.adress}` : ''}{b.kapacitet ? `: ${b.kapacitet} l/h` : ''}{b.distKm != null ? `, ${b.distKm} km` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
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
              )}
            </div>

            </div>{/* end left col */}
            <div className={desktopExpanded ? 'flex-1 min-w-0 p-4 space-y-4 text-sm overflow-y-auto' : 'contents'}>
            {!(desktopExpanded) && <hr className="border-border" />}

            {/* ── GRUNDVATTENTILLGÅNG ── */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Grundvattentillgång</h3>

              {/* SGU-HYPE percentile series – always visible when area id is known */}
              {data.hypeOmradeId != null && (
                <div className="mb-3 bg-secondary/30 border border-border rounded-lg p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    SGU-HYPE fyllnadsgrad (beräknat)
                  </div>

                  {/* Quick value – latest modelled fyllnadsgrad for small/large magazines */}
                  {!data.hypeFyllnad && slowLoading && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
                      <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                      Hämtar senaste fyllnadsgrad…
                    </div>
                  )}
                  {data.hypeFyllnad && (data.hypeFyllnad.sma != null || data.hypeFyllnad.stora != null) && (() => {
                    const relevantStora = !!(effectiveAquifer?.useStoraMagasin);
                    const cards: Array<{ key: 'sma' | 'stora'; label: string; value: number | null }> = [
                      { key: 'sma',   label: 'Små magasin',  value: data.hypeFyllnad!.sma },
                      { key: 'stora', label: 'Stora magasin', value: data.hypeFyllnad!.stora },
                    ];
                    return (
                      <div className="mb-3">
                        <div className="grid grid-cols-2 gap-2">
                          {cards.map(c => {
                            const isRelevant = (c.key === 'stora') === relevantStora;
                            const info = c.value != null ? hypePercentileInfo(c.value) : null;
                            return (
                              <div
                                key={c.key}
                                className={`rounded-lg border p-2 ${isRelevant ? 'border-sgu-maroon/60 ring-1 ring-sgu-maroon/30 bg-background' : 'border-border bg-background/40'}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-medium text-muted-foreground">{c.label}</span>
                                  {isRelevant && <span className="text-[9px] font-semibold text-sgu-maroon uppercase">Akvifer här</span>}
                                </div>
                                {c.value != null ? (
                                  <>
                                    <div className="text-lg font-bold leading-tight" style={{ color: info!.color }}>
                                      {c.value}<span className="text-xs font-medium text-muted-foreground"> perc.</span>
                                    </div>
                                    <div className="text-[10px] leading-tight" style={{ color: info!.color }}>{info!.label}</div>
                                  </>
                                ) : (
                                  <div className="text-sm text-muted-foreground mt-1">Saknas här</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Modellerat {data.hypeFyllnad!.datum} · percentil 0–100 mot 1961–idag (25–75 = normalt)
                        </div>
                      </div>
                    );
                  })()}

                  <ObsHypoTimeSeriesChart
                    stations={[]}
                    omradeId={data.hypeOmradeId}
                    useStora={!!(effectiveAquifer?.useStoraMagasin)}
                    years={2}
                  />
                </div>
              )}

              {/* Observed groundwater level stations ±7 days */}
              {data.obsStationer && data.obsStationer.length > 0 ? (
                <>
                  <div className="text-xs text-muted-foreground mb-2">
                    {data.obsStationer.length} stationer med nivåobservationer ±7 dagar från {selectedDate}. Klicka på en station för att visa nivådiagram för senaste 2 åren.
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {data.obsStationer.slice(0, 10).map(st => {
                      const isOpen = expandedObsStation === st.id;
                      return (
                        <div key={st.id} className="rounded bg-secondary/30 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedObsStation(isOpen ? null : st.id)}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left hover:bg-secondary/50 transition-colors"
                            aria-expanded={isOpen}
                          >
                            <div className="min-w-0 flex-1 flex items-center">
                              <ChevronDown
                                className={`w-3.5 h-3.5 mr-1.5 shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                              />
                              <span className="font-medium">{st.namn || st.id}</span>
                              <span className="text-muted-foreground ml-1.5">{st.distKm.toFixed(1)} km fr. punkten</span>
                              {st.jordart && (
                                <span className="text-muted-foreground ml-1.5 truncate">{st.jordart}</span>
                              )}
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <span className="font-semibold text-blue-700 dark:text-blue-400">{parseFloat(st.djup.toPrecision(3))} m</span>
                              <div className="text-[10px] text-muted-foreground">{st.obsdatum.slice(0, 10)}</div>
                            </div>
                          </button>
                          {isOpen && (
                            <div className="border-t border-border bg-background/40 p-2">
                              <div className="flex items-center justify-end mb-1">
                                <button
                                  type="button"
                                  onClick={() => setChartPopup({ kind: 'obs', stationId: st.id, namn: st.namn || st.id, distKm: st.distKm })}
                                  className="hidden sm:block p-0.5 rounded hover:bg-secondary/70 transition-colors"
                                  title="Visa i större fönster"
                                >
                                  <Maximize2 className="w-3 h-3 text-muted-foreground" />
                                </button>
                              </div>
                              <ObsHypoTimeSeriesChart
                                stations={[{ id: st.id, namn: st.namn, distKm: st.distKm }]}
                                omradeId={data?.hypeOmradeId}
                                useStora={!!(effectiveAquifer?.useStoraMagasin)}
                                years={2}
                                maxStations={1}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
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

              {/* Estimated/calibrated depth from observed stations */}
              {effectiveAquifer?.type !== 'unknown' && !(aquifer?.type === 'confining' && effectiveAquifer === aquifer) && (
                <div className="mt-2 mb-3 bg-secondary/30 border border-border rounded-lg p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Grundvattennivå – uppskattad
                  </div>
                  {calibratedDepth ? (
                    <>
                      <div className="text-xl font-bold mb-3">
                        {calibratedDepth.lo.toFixed(1)}–{calibratedDepth.hi.toFixed(1)} m u. markytan
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Beräkning</div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Observerat median</span>
                          <span className="font-medium">{obsKalibr!.medianDjup.toFixed(1)} m</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Kvartilar P25–P75</span>
                          <span className="font-medium">{obsKalibr!.p25.toFixed(1)}–{obsKalibr!.p75.toFixed(1)} m</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Stationer</span>
                          <span className="font-medium">{obsKalibr!.antal} st · {obsKalibr!.matchLabel}</span>
                        </div>
                      </div>
                    </>
                  ) : effectiveAquifer ? (
                    <>
                      <div className="text-xl font-bold mb-1">
                        {effectiveAquifer.depthMin}–{effectiveAquifer.depthMax} m u. markytan
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Baserat på akvifertyp – inga observerade stationer för kalibrering
                      </div>
                    </>
                  ) : null}
                  {jorddjupCapInfo && (
                    <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                      {jorddjupCapInfo.likelyBedrock
                        ? `Jorddjup (${jorddjupCapInfo.soilDepth.toFixed(1)} m) grundare än uppskattningen – grundvatten troligen i berg`
                        : `Observera: övre gräns når nära jorddjup (${jorddjupCapInfo.soilDepth.toFixed(1)} m)`}
                    </div>
                  )}
                </div>
              )}

            </div>{/* end Grundvattentillgång section */}

            {/* Grundvattenmagasin – card */}
            {(data.magasin || data.delomrade) && (() => {
              const m = data.magasin;
              const d = data.delomrade;
              const Row = ({ label, value, bold, blue, muted }: { label: string; value: React.ReactNode; bold?: boolean; blue?: boolean; muted?: boolean }) => (
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-muted-foreground shrink-0">{label}</span>
                  <span className={`text-right ${bold ? 'font-semibold' : 'font-medium'} ${blue ? 'text-blue-700 dark:text-blue-400' : ''} ${muted ? 'text-muted-foreground' : ''} capitalize`}>{value}</span>
                </div>
              );
              return (
                <div className="bg-secondary/30 border border-border rounded-lg p-3 space-y-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Grundvattenmagasin (SGU)
                  </div>
                  {m && (
                    <>
                      <div className="text-xs font-semibold leading-snug">{m.namn}</div>
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
                      {m.magasinsposition && (
                        <div className="text-[11px] text-muted-foreground leading-snug -mt-1">{m.magasinsposition}</div>
                      )}
                      <div className="space-y-1 text-xs">
                        {m.geomAreaKm2 != null && <Row label="Yta" value={`~${m.geomAreaKm2} km²`} />}
                        {m.medelmaktighetMattad && <Row label="Mättad zon" value={m.medelmaktighetMattad} />}
                        {m.medelmaktighetOmattad && <Row label="Omättad zon" value={m.medelmaktighetOmattad} />}
                        {m.tillrinningLs != null && <Row label="Tillrinning" value={`${m.tillrinningLs.toLocaleString('sv')} l/s`} />}
                        {m.grvbildningstyp && <Row label="GV-bildning" value={m.grvbildningstyp} />}
                      </div>
                      {m.lankBeskrivning && (
                        <a href={m.lankBeskrivning} target="_blank" rel="noopener noreferrer"
                          className="block text-xs text-blue-700 dark:text-blue-400 hover:underline">
                          Magasinsbeskrivning (SGU) →
                        </a>
                      )}
                    </>
                  )}
                  {d && (
                    <>
                      {m && <div className="border-t border-border pt-2 mt-1" />}
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Delområde (J1)
                        {d.namn && <span className="ml-1 normal-case font-normal">– {d.namn}</span>}
                      </div>
                      {!m && d.magasinsnamn && (
                        <div className="text-xs font-semibold leading-snug">{d.magasinsnamn}</div>
                      )}
                      <div className="space-y-1 text-xs">
                        {d.uttagsmojligheter && (
                          <div className="flex justify-between items-baseline gap-2">
                            <span className="text-muted-foreground shrink-0">Uttagsmöjlighet</span>
                            <span className="font-bold text-blue-700 dark:text-blue-400">{d.uttagsmojligheter}</span>
                          </div>
                        )}
                        {d.kornstorlek && <Row label="Kornstorlek" value={d.kornstorlek} />}
                        {d.artesiskt && <Row label="Artesiskt" value={d.artesiskt} />}
                        {d.nivaforhallande && <Row label="Nivåförhållande" value={d.nivaforhallande} />}
                        {d.vattenkemi && <Row label="Vattenkemi" value={d.vattenkemi} />}
                        {d.delomradeskvalitet && <Row label="Karteringskvalitet" value={d.delomradeskvalitet} muted />}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Brunnar i närheten */}
            {data.brunnar && data.brunnar.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Brunnar i närheten
                  {data.brunnar.length > 8 && <span className="ml-1 font-normal">({data.brunnar.length} totalt, visar 8)</span>}
                </h3>
                <div className="space-y-1.5">
                  {data.brunnar.slice(0, 8).map((b, i) => (
                    <div key={i} className="flex items-center justify-between bg-secondary/30 rounded px-2.5 py-1.5 text-xs">
                      <div>
                        <span className="font-medium">{b.id}</span>
                        <span className="text-muted-foreground ml-1.5">{b.isBergborrad ? 'berg' : 'jord'}</span>
                        {b.djup != null && <span className="text-muted-foreground ml-1.5">{b.djup} m</span>}
                        {b.distKm != null && <span className="text-muted-foreground ml-1.5">{b.distKm.toFixed(1)} km fr. punkten</span>}
                      </div>
                      <div className={`font-semibold ml-2 shrink-0 ${b.kapacitet != null ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground'}`}>
                        {b.kapacitet != null ? `${b.kapacitet} l/h` : 'kap. okänd'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            </div>{/* end col 2 */}

            {/* ── COL 3 – GRUNDVATTENKVALITET ── */}
            <div className={desktopExpanded ? 'flex-1 min-w-0 p-4 space-y-4 text-sm overflow-y-auto' : 'contents'}>
            {!(desktopExpanded) && <hr className="border-border" />}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Grundvattenkvalitet</h3>

              {/* Grundvattenkemi */}
              {!data.gvKemi && slowLoading && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  Hämtar grundvattenkemi…
                </div>
              )}
              {data.gvKemi && data.gvKemi.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    {data.gvForekomstId
                      ? `Grundvattenkemi · förekomst ${data.gvForekomstId} · ${data.gvKemi.length} stationer`
                      : `Grundvattenkemi · ${data.gvKemi.length} station${data.gvKemi.length > 1 ? 'er' : ''} inom 50 km`}
                  </div>
                  <div className="space-y-1">
                    {data.gvKemi.map((gv, i) => {
                      const isOpen = expandedGvKemi.has(i);
                      const sorted = [...gv.params].sort((a, b) => b.klass - a.klass || a.label.localeCompare(b.label));
                      const worstKlass = sorted[0]?.klass ?? 0;
                      return (
                        <div key={gv.provplatsid} className="border border-border rounded overflow-hidden">
                          <button
                            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-secondary/50 transition-colors"
                            onClick={() => setExpandedGvKemi(prev => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i); else next.add(i);
                              return next;
                            })}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {worstKlass > 0 && (
                                <span
                                  className="shrink-0 font-bold text-white text-[10px] rounded px-1 py-0.5 leading-none"
                                  style={{ backgroundColor: GV_KLASS_COLORS[worstKlass] ?? '#6b7280' }}
                                >
                                  {worstKlass}
                                </span>
                              )}
                              <span className="text-[11px] font-medium truncate">{gv.provplatsnamn}</span>
                              {gv.fromBody ? (
                                <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 px-1 py-0.5 rounded">
                                  Förekomst
                                </span>
                              ) : gv.eucdGwb ? (
                                <span className="shrink-0 text-[9px] text-muted-foreground font-mono">
                                  {gv.eucdGwb}
                                </span>
                              ) : null}
                              {gv.trend && (
                                <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1 py-0.5 rounded">
                                  Trend
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
                              {gv.distKm != null ? <span>{gv.distKm} km</span> : <span className="italic">pos. saknas</span>}
                              {gv.senasteprov && <span>{gv.senasteprov}</span>}
                              <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </div>
                          </button>
                          {isOpen && (() => {
                            const fmtVal = (v: number) =>
                              v < 0.001 ? v.toExponential(1) : v < 1 ? v.toFixed(3) : v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.round(v));
                            const fmtSlope = (s: number, unit: string) => {
                              const abs = Math.abs(s);
                              const str = abs < 0.001 ? s.toExponential(1) : abs < 1 ? s.toFixed(3) : abs < 10 ? s.toFixed(2) : s.toFixed(1);
                              return `${s > 0 ? '+' : ''}${str} ${unit}/år`;
                            };
                            return (
                              <div className="px-2 pb-2">
                                {(gv.eucdGwb || gv.provplatskat || gv.region) && (
                                  <div className="text-[10px] text-muted-foreground mb-1 pt-1 flex flex-wrap gap-x-2">
                                    {gv.eucdGwb && <span className="font-mono">{gv.eucdGwb}</span>}
                                    {gv.provplatskat && <span>{gv.provplatskat}</span>}
                                    {gv.region && <span>{gv.region}</span>}
                                  </div>
                                )}

                                {/* Snapshot parameter table */}
                                <div className="space-y-0.5 mt-1">
                                  {sorted.map(p => (
                                    <div key={p.name} className="flex items-center gap-1.5 text-[11px]">
                                      <span
                                        className="shrink-0 font-bold text-white text-[10px] rounded px-1 py-0.5 leading-none"
                                        style={{ backgroundColor: GV_KLASS_COLORS[p.klass] ?? '#6b7280' }}
                                      >
                                        {p.klass}
                                      </span>
                                      <span className="font-medium w-20 shrink-0">{p.label}</span>
                                      <span className="text-muted-foreground">{fmtVal(p.value)} {p.unit}</span>
                                    </div>
                                  ))}
                                </div>

                                {/* Trend analysis section */}
                                {gv.trend && (() => {
                                  const tr = gv.trend!;
                                  const mkHasAnyTrend = tr.params.some(p => p.mk.trend !== 'no trend');
                                  const mkHasSig = tr.params.some(p => p.mk.significant);
                                  return (
                                    <div className="mt-2 pt-2 border-t border-border">
                                      <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1.5">
                                        Trendanalys (Mann-Kendall)
                                        <span className="font-normal normal-case text-muted-foreground">
                                          {tr.yearSpan} år · {tr.nDates} provtillfällen
                                        </span>
                                      </div>
                                      {!mkHasAnyTrend && (
                                        <p className="text-[10px] text-muted-foreground">Ingen tydlig trend för något parameter.</p>
                                      )}
                                      {mkHasSig && (
                                        <div className="space-y-0.5 mb-1">
                                          {tr.params.filter(p => p.mk.significant).map(p => {
                                            const up = p.mk.trend === 'increasing';
                                            return (
                                              <div key={p.name} className="flex items-center gap-1.5 text-[11px]">
                                                <span className={`shrink-0 font-bold text-sm leading-none ${up ? 'text-orange-500' : 'text-blue-500'}`}>
                                                  {up ? '↑' : '↓'}
                                                </span>
                                                <span
                                                  className="shrink-0 font-bold text-white text-[10px] rounded px-1 py-0.5 leading-none"
                                                  style={{ backgroundColor: GV_KLASS_COLORS[p.klass] ?? '#6b7280' }}
                                                >
                                                  {p.klass}
                                                </span>
                                                <span className="font-medium w-20 shrink-0">{p.label}</span>
                                                <span className="text-muted-foreground">{fmtSlope(p.mk.slope, p.unit)}</span>
                                                {p.hasSeasonality && (
                                                  <span className="ml-auto text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0" title={`Säsongsvariation ~${p.seasonalAmplitudePct}%`}>
                                                    ~{p.seasonalAmplitudePct}% säsong
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {tr.params.some(p => !p.mk.significant && p.mk.trend !== 'no trend') && (
                                        <div className="space-y-0.5">
                                          <div className="text-[10px] text-muted-foreground mb-0.5">Ej signifikant (p≥0,05):</div>
                                          {tr.params.filter(p => !p.mk.significant && p.mk.trend !== 'no trend').map(p => {
                                            const up = p.mk.trend === 'increasing';
                                            return (
                                              <div key={p.name} className="flex items-center gap-1.5 text-[11px] opacity-70">
                                                <span className="shrink-0 text-muted-foreground font-bold text-sm leading-none">
                                                  {up ? '↗' : '↘'}
                                                </span>
                                                <span
                                                  className="shrink-0 font-bold text-white text-[10px] rounded px-1 py-0.5 leading-none"
                                                  style={{ backgroundColor: GV_KLASS_COLORS[p.klass] ?? '#6b7280' }}
                                                >
                                                  {p.klass}
                                                </span>
                                                <span className="font-medium w-20 shrink-0">{p.label}</span>
                                                <span className="text-muted-foreground">{fmtSlope(p.mk.slope, p.unit)}</span>
                                                {p.hasSeasonality && (
                                                  <span className="ml-auto text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0">
                                                    ~{p.seasonalAmplitudePct}% säsong
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {tr.params.some(p => p.hasSeasonality) && (
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                          Säsong = relativ amplitud mellan årstidsmedeltal (≥20% = tydlig variation).
                                        </p>
                                      )}
                                    </div>
                                  );
                                })()}

                                <p className="text-[10px] text-muted-foreground mt-1.5">
                                  Klass 1–5 · SGU tillståndsklasser 2024 · pH: klass 1 = alkaliskt &gt;8,5, klass 5 = starkt surt ≤5,5.
                                  {' '}{gv.senasteprov}{gv.seasonalSelection ? ' (senaste prov samma årstid)' : ' (senaste prov)'}.
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>{/* end Grundvattenkvalitet section */}

            {/* Geokemi – närmaste morän ICP-MS-prov */}
            {!data.geokemi && slowLoading && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1 mb-2">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                Hämtar markgeokemi…
              </div>
            )}
            {data.geokemi && (() => {
              const ELEMENTS: { key: string; label: string; elevated: number; high: number; note?: string }[] = [
                { key: 'as', label: 'As', elevated: 10,     high: 25     },
                { key: 'u',  label: 'U',  elevated: 5,      high: 12     },
                { key: 'ni', label: 'Ni', elevated: 35,     high: 80     },
                { key: 'pb', label: 'Pb', elevated: 35,     high: 80     },
                { key: 'cr', label: 'Cr', elevated: 80,     high: 200    },
                { key: 'cd', label: 'Cd', elevated: 0.4,    high: 1.0    },
                { key: 'mn', label: 'Mn', elevated: 800,    high: 2000   },
                { key: 'fe', label: 'Fe', elevated: 45000,  high: 80000  },
                { key: 'f',  label: 'F',  elevated: 600,    high: 1200   },
                { key: 'cu', label: 'Cu', elevated: 30,     high: 70     },
                { key: 'zn', label: 'Zn', elevated: 120,    high: 300    },
                { key: 'co', label: 'Co', elevated: 15,     high: 40     },
                { key: 'mo', label: 'Mo', elevated: 2,      high: 6      },
                { key: 'v',  label: 'V',  elevated: 60,     high: 150    },
                { key: 'ca', label: 'Ca', elevated: 25000,  high: 60000, note: 'buffert' },
                { key: 'mg', label: 'Mg', elevated: 15000,  high: 35000, note: 'buffert' },
              ];
              const dot = (v: number | null, elevated: number, high: number, note?: string) => {
                if (v == null) return <span className="text-muted-foreground/40">–</span>;
                const isBuf = note === 'buffert';
                if (v >= high) return <span className={`inline-block w-2 h-2 rounded-full mr-1 ${isBuf ? 'bg-blue-500' : 'bg-red-500'}`} />;
                if (v >= elevated) return <span className={`inline-block w-2 h-2 rounded-full mr-1 ${isBuf ? 'bg-blue-400' : 'bg-orange-400'}`} />;
                return <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />;
              };
              const hasAny = ELEMENTS.some(e => data.geokemi!.elements[e.key] != null);
              return (
                <div className="mb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center justify-between">
                    <span>Markgeokemi morän</span>
                    <span className="normal-case font-normal">
                      MS {data.geokemi.distKm} km
                      {data.geokemi.distKmAes != null ? ` · AES ${data.geokemi.distKmAes} km` : ''}
                      {data.geokemi.artal ? ` · ${data.geokemi.artal}` : ''}
                    </span>
                  </div>
                  {hasAny ? (
                    <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
                      {ELEMENTS.filter(e => data.geokemi!.elements[e.key] != null).map(e => {
                        const v = data.geokemi!.elements[e.key]!;
                        const isBuf = e.note === 'buffert';
                        const isHigh = v >= e.high;
                        const isElevated = v >= e.elevated;
                        const labelColor = isBuf
                          ? (isHigh || isElevated ? 'text-blue-600 dark:text-blue-400' : 'text-foreground')
                          : (isHigh ? 'text-red-600 dark:text-red-400' : isElevated ? 'text-orange-500 dark:text-orange-400' : 'text-foreground');
                        return (
                          <div key={e.key} className="flex items-center text-[11px]">
                            {dot(v, e.elevated, e.high, e.note)}
                            <span className={`font-medium mr-1 ${labelColor}`}>{e.label}</span>
                            <span className="text-muted-foreground truncate">{v < 1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : v < 1000 ? Math.round(v) : (v / 1000).toFixed(1) + 'k'}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Inga elementdata i provet</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1.5">mg/kg i morän · <span className="inline-flex items-center gap-0.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400" /> förhöjd</span> · <span className="inline-flex items-center gap-0.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" /> hög</span> · <span className="inline-flex items-center gap-0.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" /> hög buffert</span></p>
                </div>
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
                    note="Identifierar jordart och akvifertyp (berg, morän, isälvssediment, lera m.fl.) vid den klickade punkten. Används för att bedöma magasinstyp, förväntade brunndjup och klassificera akvifer."
                    url="https://api.sgu.se/oppnadata/jordarter25k-100k/ogc/features/v1"
                  />
                  <SourceRow
                    label="Grundvattenmagasin"
                    source="SGU Grundvattenmagasin"
                    note="Karterade grundvattenmagasin. Visar om punkten ingår i ett namngivet magasin med uppgifter om akvifertyp, genestyp, position (ytlig/djup), yta, medelmäktighet och tillrinning från upptagningsområdet."
                    url="https://api.sgu.se/oppnadata/grundvattenmagasin/ogc/features/v1"
                  />
                  <SourceRow
                    label="Observationer av grundvattennivån"
                    source="SGU Grundvattennivåer observerade"
                    note="Fysiska mätstationer med nivåloggar – observationer av grundvattennivån. Stationer inom 50 km används som kalibreringspunkter för nivå- och djupuppskattning, matchade mot akvifertyp. Observationer inom ±7 dagar från valt datum."
                    url="https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1"
                  />

                  {/* Group: Kapacitet */}
                  <div className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5 mt-1">Kapacitet</div>

                  <SourceRow
                    label="Brunnskapacitet (l/h)"
                    source="SGU Brunnar"
                    note="Nationell brunnsdatabas med uppmätt kapacitet, totaldjup och jorddjup. Brunnar inom ~15 km används för att uppskatta sannolikt kapacitetsintervall utifrån akvifertyp."
                    url="https://api.sgu.se/oppnadata/brunnar/ogc/features/v1"
                  />
                  <SourceRow
                    label="Tillrinning till magasin (l/s)"
                    source="SGU Grundvattenmagasin"
                    note="Beräknad nettotillrinning till det namngivna grundvattenmagasinet från dess upptagningsområde, i liter per sekund."
                    url="https://api.sgu.se/oppnadata/grundvattenmagasin/ogc/features/v1"
                  />
                  <SourceRow
                    label="Jordlager / jorddjup (m)"
                    source="SGU Jorddjupsmodell – WMS GetFeatureInfo"
                    note="Interpolerad rastermodell (10×10 m) som visar tjockleken på lösa jordlager ovanför berget. Används för att uppskatta nödvändigt borrdjup för bergborrad brunn."
                    url="https://resource.sgu.se/service/wms/130/jorddjupsmodell"
                  />
                  <SourceRow
                    label="Grundvattentillgång små magasin (l/dygn/ha)"
                    source="SGU GV-tillgång små magasin (WMS)"
                    note="Rastermodell med beräknad uttagningsmöjlighet ur ytliga, små magasin per hektar. Ger ett mått på kapaciteten för grävda brunnar och ytliga infiltrationsbrunnar."
                    url="https://api.sgu.se/oppnadata/grundvattentillgang-sma-magasin/wms"
                  />

                  <SourceRow
                    label="Terrängmodell / höjd (m ö.h.)"
                    source="OpenTopoData – EU-DEM 25m"
                    note="EU Digital Elevation Model med 25 m upplösning. Ger terrängbaserad höjd över havet för den klickade punkten."
                    url="https://www.opentopodata.org/datasets/eudem/"
                  />

                  {/* Group: Kemi */}
                  <div className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5 mt-1">Kemi</div>

                  <SourceRow
                    label="Markgeokemi morän (mg/kg)"
                    source="SGU Markgeokemi Regional – morän ICP-MS + ICP-AES"
                    note="Regionala geokemiska prover ur morän (< 63 µm-fraktion). Ger bakgrundshalter av spårämnen och tungmetaller i moränens finkorniga del – indikerar naturliga förhöjda halter som kan påverka grundvattenkvaliteten. Aqua regia-uppslutning."
                    url="https://api.sgu.se/oppnadata/markgeokemi-regional/ogc/features/v1"
                  />

                  <SourceRow
                    label="Grundvattenkemi (klass 1–5)"
                    source="SGU Grundvattenkvalitet – analysresultat provplatser"
                    note="Övervakningsstationer för grundvattenkvalitet. Närmaste station med samma akvifertyp väljs. Senaste analysresultat per parameter klassas mot SGU:s bedömningsgrunder (klass 1 = bakgrundsnivå, 5 = kraftigt avvikande)."
                    url="https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1"
                  />

                  <SourceRow
                    label="Bedömningsgrunder klass 1–5"
                    source="SGU tillståndsklasser 2024"
                    note="Klassgränser från SGU:s tillståndsklasstabell 2024. pH följer SGU:s försurningsskala (klass 1 = alkaliskt &gt;8,5 ; klass 3 = neutralt 6,5–7,5 ; klass 5 = starkt surt ≤5,5). Ny 2024: Kvicksilver, Uran, Zink, Antimon, Nitrit. Nitrat och ammonium omräknade från jonbaserade mg/l-gränser till µg/l N."
                    url="https://www.sgu.se/globalassets/handledningar/bedomningsgrunder-for-grundvatten/tillstandsklasser_sammanstallning_2024.xlsx"
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
            </div>{/* end col 3 */}
          </div>
        ) : null}
      </div>
    </div>
    </>
  );
};
