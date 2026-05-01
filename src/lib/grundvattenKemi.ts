// ── Grundvattenkemi bedömningsgrunder ────────────────────────────────────────
// Klassgränser från SGU tillståndsklasser 2024 (xlsx-tabell):
//   https://www.sgu.se/globalassets/handledningar/bedomningsgrunder-for-grundvatten/tillstandsklasser_sammanstallning_2024.xlsx
// Klass 1 = Mycket låg halt, klass 5 = Mycket hög halt.
// Parametrar med jonbaserade enhet i SGU-tabellen omräknade till API-enhet (som N):
//   NO₃ mg/l × (14/62) × 1000 → µg/l N;  NH₄ mg/l × (14/18) × 1000 → µg/l N.
// Järn, Mangan, Aluminium, Koppar, Zink: SGU-tabell i mg/l → här i µg/l (×1000).

export const GV_BEDGR: Record<string, { thresholds: [number, number, number, number]; unit: string; label: string }> = {
  // Konduktivitet: 1a <10, 1b 10–25, 2 25–50, 3 50–75, 4 75–150, 5 ≥150 mS/m
  'Konduktivitet':              { thresholds: [25, 50, 75, 150],         unit: 'mS/m',  label: 'Konduktivitet' },
  // Klorid: 1a <5, 1b 5–20, 2 20–50, 3 50–100, 4 100–300, 5 ≥300 mg/l
  'Klorid (jon: Cl-)':          { thresholds: [20, 50, 100, 300],        unit: 'mg/l',  label: 'Klorid' },
  // Sulfat: 1a <5, 1b 5–10, 2 10–25, 3 25–50, 4 50–100, 5 ≥100 mg/l
  'Sulfat (jon: SO42-)':        { thresholds: [10, 25, 50, 100],         unit: 'mg/l',  label: 'Sulfat' },
  // Nitrat: SGU <2/5/20/50 mg/l NO₃ → µg/l N (×14/62×1000)
  'Nitrat + Nitrit, som N':     { thresholds: [452, 1129, 4516, 11290],  unit: 'µg/l',  label: 'NO₃+NO₂-N' },
  // Nitrit: SGU <0.01/0.05/0.1/0.5 mg/l NO₂
  'Nitrit':                     { thresholds: [0.01, 0.05, 0.1, 0.5],   unit: 'mg/l',  label: 'Nitrit' },
  // Ammonium: SGU <0.05/0.1/0.5/1.5 mg/l NH₄ → µg/l N (×14/18×1000)
  'Ammonium, som N (NH4-N)':    { thresholds: [39, 78, 389, 1167],       unit: 'µg/l',  label: 'NH₄-N' },
  // Järn: SGU <0.1/0.2/0.5/1 mg/l → µg/l
  'Järn':                       { thresholds: [100, 200, 500, 1000],     unit: 'µg/l',  label: 'Järn' },
  // Mangan: SGU <0.05/0.1/0.3/0.4 mg/l → µg/l
  'Mangan':                     { thresholds: [50, 100, 300, 400],       unit: 'µg/l',  label: 'Mangan' },
  // Arsenik: SGU <1/2/5/10 µg/l
  'Arsenik':                    { thresholds: [1, 2, 5, 10],             unit: 'µg/l',  label: 'Arsenik' },
  // Bly: SGU <0.5/2/5/10 µg/l
  'Bly':                        { thresholds: [0.5, 2, 5, 10],           unit: 'µg/l',  label: 'Bly' },
  // Kadmium: SGU <0.05/0.1/0.5/1 µg/l
  'Kadmium':                    { thresholds: [0.05, 0.1, 0.5, 1],       unit: 'µg/l',  label: 'Kadmium' },
  // Kvicksilver: SGU <0.001/0.01/0.05/0.5 µg/l (ny i 2024)
  'Kvicksilver':                { thresholds: [0.001, 0.01, 0.05, 0.5],  unit: 'µg/l',  label: 'Kvicksilver' },
  // Uran: SGU <5/10/15/30 µg/l (ny i 2024)
  'Uran':                       { thresholds: [5, 10, 15, 30],           unit: 'µg/l',  label: 'Uran' },
  // Fluorid: SGU <0.4/0.8/1.5/4 mg/l
  'Fluorid (jon: F-)':          { thresholds: [0.4, 0.8, 1.5, 4],        unit: 'mg/l',  label: 'Fluorid' },
  // Koppar: SGU <0.005/0.01/0.1/0.5 mg/l → µg/l
  'Koppar':                     { thresholds: [5, 10, 100, 500],          unit: 'µg/l',  label: 'Koppar' },
  // Nickel: SGU <0.5/2/10/20 µg/l
  'Nickel':                     { thresholds: [0.5, 2, 10, 20],           unit: 'µg/l',  label: 'Nickel' },
  // Krom: SGU <0.5/5/10/25 µg/l
  'Krom':                       { thresholds: [0.5, 5, 10, 25],           unit: 'µg/l',  label: 'Krom' },
  // Zink: SGU <0.005/0.01/0.1/0.5 mg/l → µg/l (ny i 2024)
  'Zink':                       { thresholds: [5, 10, 100, 500],          unit: 'µg/l',  label: 'Zink' },
  // Antimon: SGU <0.1/0.5/5/10 µg/l (ny i 2024)
  'Antimon':                    { thresholds: [0.1, 0.5, 5, 10],          unit: 'µg/l',  label: 'Antimon' },
  // Aluminium: SGU <0.01/0.05/0.1/0.5 mg/l → µg/l
  'Aluminium':                  { thresholds: [10, 50, 100, 500],          unit: 'µg/l',  label: 'Aluminium' },
  // TOC/DOC: SGU <0.5/2.5/5/10 mg/l
  'Kol, totalt organiskt (TOC)':{ thresholds: [0.5, 2.5, 5, 10],          unit: 'mg/l',  label: 'TOC' },
};

export function classifyParam(paramName: string, value: number): number {
  if (paramName === 'pH') {
    // SGU 2024: försurningsskala – klass 1 = >8.5 (alkalint), klass 5 = ≤5.5 (starkt surt)
    if (value > 8.5) return 1;
    if (value > 7.5) return 2;
    if (value > 6.5) return 3;
    if (value > 5.5) return 4;
    return 5;
  }
  const bedgr = GV_BEDGR[paramName];
  if (!bedgr) return 0;
  const [t1, t2, t3, t4] = bedgr.thresholds;
  if (value <= t1) return 1;
  if (value <= t2) return 2;
  if (value <= t3) return 3;
  if (value <= t4) return 4;
  return 5;
}

// Meteorological seasons: winter=Dec–Feb, spring=Mar–May, summer=Jun–Aug, autumn=Sep–Nov
export function getSeason(month: number): 'winter' | 'spring' | 'summer' | 'autumn' {
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'autumn';
}

// Abramowitz & Stegun approximation for standard normal CDF
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  return z > 0 ? 1 - p : p;
}

// Mann-Kendall non-parametric trend test with Sen's slope estimator
export function mannKendall(series: Array<{ datum: string; value: number }>): {
  trend: 'increasing' | 'decreasing' | 'no trend';
  significant: boolean;
  slope: number; // Sen's slope in units per year
  n: number;
} {
  const pts = [...series].sort((a, b) => a.datum.localeCompare(b.datum));
  const n = pts.length;
  if (n < 4) return { trend: 'no trend', significant: false, slope: 0, n };

  // Pre-compute timestamps once (avoids n²/2 Date allocations in the pair loop)
  const times = pts.map(p => new Date(p.datum).getTime());
  const MS_PER_YEAR = 365.25 * 86400e3;

  // Single pass over all pairs: accumulate S and Sen's slope list simultaneously
  let S = 0;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = pts[j].value - pts[i].value;
      if (d > 0) S++; else if (d < 0) S--;
      const dt = (times[j] - times[i]) / MS_PER_YEAR;
      if (dt > 0) slopes.push(d / dt);
    }
  }

  // Variance with tie correction
  const counts = new Map<number, number>();
  for (const pt of pts) counts.set(pt.value, (counts.get(pt.value) ?? 0) + 1);
  let tieAdj = 0;
  for (const t of counts.values()) if (t > 1) tieAdj += t * (t - 1) * (2 * t + 5);
  const varS = (n * (n - 1) * (2 * n + 5) - tieAdj) / 18;

  const z = S === 0 ? 0 : (S > 0 ? S - 1 : S + 1) / Math.sqrt(varS);
  const p = 2 * (1 - normalCdf(Math.abs(z)));

  slopes.sort((a, b) => a - b);
  const slope = slopes.length > 0 ? slopes[Math.floor(slopes.length / 2)] : 0;

  return {
    trend: S > 0 ? 'increasing' : S < 0 ? 'decreasing' : 'no trend',
    significant: p < 0.05,
    slope,
    n,
  };
}

// Relative amplitude of seasonal means — detects intra-annual variation
export function analyzeSeasonality(series: Array<{ datum: string; value: number }>): {
  hasSeasonality: boolean;
  relAmplitude: number;
} {
  const bySeason: Record<string, number[]> = { winter: [], spring: [], summer: [], autumn: [] };
  for (const pt of series) bySeason[getSeason(parseInt(pt.datum.slice(5, 7), 10))].push(pt.value);
  const means = Object.values(bySeason)
    .map(v => (v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null))
    .filter((v): v is number => v !== null);
  if (means.length < 2) return { hasSeasonality: false, relAmplitude: 0 };
  const amplitude = Math.max(...means) - Math.min(...means);
  const overall = means.reduce((a, b) => a + b, 0) / means.length;
  const relAmplitude = overall > 0 ? amplitude / overall : 0;
  return { hasSeasonality: relAmplitude > 0.2 && means.length >= 3, relAmplitude };
}

export const GV_KLASS_COLORS: Record<number, string> = {
  1: '#16a34a',
  2: '#65a30d',
  3: '#ca8a04',
  4: '#ea580c',
  5: '#dc2626',
};
