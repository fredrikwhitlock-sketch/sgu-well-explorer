// ── Aquifer classification ────────────────────────────────────────────────────

export type AquiferType = 'porous-fine' | 'porous-coarse' | 'till' | 'rock' | 'confining' | 'unknown';

export interface AquiferClass {
  type: AquiferType;
  label: string;
  depthMin: number; // typical depth to water table, m below surface
  depthMax: number;
  capacityLabel: string; // qualitative capacity description
  useStoraMagasin: boolean; // use large vs small aquifer pool for obs calibration
}

export function classifyAquifer(jordart: string | undefined): AquiferClass {
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
export function classifyByJg2(jg2: number): AquiferClass {
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

export function depthAdjustment(fyllnad: number | null | undefined): { factor: number; label: string; color: string } {
  if (fyllnad == null || fyllnad === -1) return { factor: 1.0, label: 'okänd nivå', color: 'text-muted-foreground' };
  if (fyllnad < 10) return { factor: 1.7, label: 'mycket låg (+50–80% djupare än normalt)', color: 'text-red-700 dark:text-red-400' };
  if (fyllnad < 25) return { factor: 1.3, label: 'låg (+20–35% djupare än normalt)', color: 'text-orange-600 dark:text-orange-400' };
  if (fyllnad < 75) return { factor: 1.0, label: 'normal nivå', color: 'text-yellow-700 dark:text-yellow-400' };
  if (fyllnad < 90) return { factor: 0.75, label: 'hög (20–30% grundare än normalt)', color: 'text-green-600 dark:text-green-400' };
  return { factor: 0.55, label: 'mycket hög (40–50% grundare än normalt)', color: 'text-green-800 dark:text-green-300' };
}

export function estimatedDepth(aq: AquiferClass, fyllnad: number | null | undefined) {
  const adj = depthAdjustment(fyllnad);
  return { lo: Math.round(aq.depthMin * adj.factor * 10) / 10, hi: Math.round(aq.depthMax * adj.factor * 10) / 10, adj };
}

export function fyllnadLabel(v: number | null | undefined): string {
  if (v == null || v === -1) return 'Ingen data';
  if (v < 10) return 'Mycket låg';
  if (v < 25) return 'Låg';
  if (v < 75) return 'Normal';
  if (v < 90) return 'Hög';
  return 'Mycket hög';
}

export function fyllnadColor(v: number | null | undefined): string {
  if (v == null || v === -1) return 'text-muted-foreground';
  if (v < 10) return 'text-red-700 dark:text-red-400';
  if (v < 25) return 'text-orange-600 dark:text-orange-400';
  if (v < 75) return 'text-yellow-700 dark:text-yellow-400';
  if (v < 90) return 'text-green-600 dark:text-green-400';
  return 'text-green-800 dark:text-green-300';
}

export function fyllnadBg(v: number | null | undefined): string {
  if (v == null || v === -1) return 'bg-secondary/40';
  if (v < 10) return 'bg-red-50 dark:bg-red-950/30';
  if (v < 25) return 'bg-orange-50 dark:bg-orange-950/30';
  if (v < 75) return 'bg-yellow-50 dark:bg-yellow-950/30';
  if (v < 90) return 'bg-green-50 dark:bg-green-950/30';
  return 'bg-green-100 dark:bg-green-900/30';
}

// Maps the classified aquifer type at the clicked point to provplatskat_bedgr (1–5).
// Returns null when there is no clear match (no category filter applied).
export function aquiferToBedgrKat(aq: AquiferClass, jordartKod?: string): number | null {
  if (aq.type === 'rock') {
    const jg2 = Number(jordartKod ?? 0);
    return (jg2 === 849 || jg2 === 850 || aq.label.toLowerCase().includes('sedimentärt') || aq.label.toLowerCase().includes('kalk')) ? 2 : 1;
  }
  if (aq.type === 'till') return 3;
  if (aq.type === 'porous-coarse') return 4;
  if (aq.type === 'confining') return 5;
  return null;
}
