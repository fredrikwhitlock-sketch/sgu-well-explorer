// Transfer model for groundwater chemistry: regress a chemistry parameter at
// a provplats against the SGU-HYPE fyllnadsgrad of its area, using the same
// Pastas-style machinery as the level calibration (exponential kernel with a
// free memory T, chronological 80/20 validation, annual harmonics).
//
// Chemistry differs from levels in three ways the model accounts for:
//  - Parameters fall into hydrogeochemical classes with different dynamics:
//    dilution-driven solutes react quickly to recharge, weathering products
//    track residence time slowly, and redox-sensitive species respond in a
//    thresholded, often non-linear way. Each class gets its own memory grid,
//    and redox fits are expected to fail the validation gate where the local
//    relation is regime- rather than level-controlled — that is the correct
//    outcome, and no model line is shown.
//  - Concentrations vary multiplicatively (Fe/Mn over orders of magnitude),
//    so everything except pH is fitted in log space.
//  - Long-term anthropogenic trends (e.g. road-salt chloride) must not leak
//    into the level coefficient, so a linear trend term is included when the
//    record is long enough to support it.
//
// The model interpolates within the observed range; it cannot predict regime
// shifts (e.g. a redox flip at an unprecedented drawdown).

import { emaSmooth, nearestPoint, olsMulti, scoreFit } from './hypeCalibration';

export type ParamClass = 'dilution' | 'weathering' | 'redox' | 'other';

export const PARAM_CLASS_LABEL: Record<ParamClass, string> = {
  dilution: 'utspädningsstyrd',
  weathering: 'vittring/uppehållstid',
  redox: 'redoxkänslig',
  other: 'övrig',
};

export interface ChemFit {
  paramClass: ParamClass;
  /** True when the parameter was fitted in log space (everything except pH). */
  logTransform: boolean;
  /** Exponential-kernel time scale in days that maximised validation R². */
  memoryDays: number;
  /** R² on all pairs (final refit), in fit space (log space for log fits). */
  r2: number;
  /** Out-of-sample R² on the chronological 20% holdout; null when too few samples. */
  valR2: number | null;
  /** RMSE in fit space: parameter units for linear fits, natural-log units for log fits. */
  rmse: number;
  /** Number of sample↔HYPE pairs used. */
  n: number;
  /** Which HYPE series fitted best. */
  source: 'sma' | 'stora';
  confidence: 'high' | 'medium' | 'low';
  /** Modeled concentration (back-transformed) from 2 years before the first sample onward. */
  series: Array<{ ts: number; value: number }>;
}

const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;
const OMEGA = (2 * Math.PI) / YEAR_MS;

/** Memory grids per class: fast response for dilution/redox, slow for weathering. */
const MEMORY_BY_CLASS: Record<ParamClass, number[]> = {
  dilution: [15, 30, 60, 90, 180, 365],
  weathering: [60, 90, 180, 365, 730],
  redox: [7, 15, 30, 60, 90, 180],
  other: [7, 15, 30, 60, 90, 180, 365],
};

const REDOX_KEYS = ['järn', 'mangan', 'ammonium', 'nitrat', 'nitrit', 'fosfat', 'fosfor', 'syre'];
const DILUTION_KEYS = ['klorid', 'natrium', 'konduktivitet', 'sulfat'];
const WEATHERING_KEYS = ['alkalinitet', 'kalcium', 'magnesium', 'kisel', 'kalium', 'fluorid', 'strontium', 'hårdhet'];

export function classifyParameter(name: string): { cls: ParamClass; log: boolean } {
  const n = name.trim().toLowerCase();
  if (n === 'ph') return { cls: 'weathering', log: false };
  if (REDOX_KEYS.some(k => n.includes(k))) return { cls: 'redox', log: true };
  if (DILUTION_KEYS.some(k => n.includes(k))) return { cls: 'dilution', log: true };
  if (WEATHERING_KEYS.some(k => n.includes(k))) return { cls: 'weathering', log: true };
  return { cls: 'other', log: true };
}

function fitOne(
  obs: Array<{ ts: number; v: number }>,
  hype: Array<{ ts: number; v: number }>,
  source: 'sma' | 'stora',
  cls: ParamClass,
  log: boolean,
): ChemFit | null {
  if (obs.length < 10 || hype.length < 30) return null;
  const pts = obs
    .filter(o => Number.isFinite(o.v) && (!log || o.v > 0))
    .map(o => ({ ts: o.ts, y: log ? Math.log(o.v) : o.v }))
    .sort((a, b) => a.ts - b.ts);
  if (pts.length < 10) return null;

  const t0 = pts[0].ts;
  const spanYears = (pts[pts.length - 1].ts - t0) / YEAR_MS;
  const useTrend = pts.length >= 12 && spanYears >= 5;
  const useSeasonal = pts.length >= 16;
  const row = (ts: number, s: number): number[] => {
    const r = [1, s];
    if (useTrend) r.push((ts - t0) / YEAR_MS);
    if (useSeasonal) r.push(Math.sin(OMEGA * ts), Math.cos(OMEGA * ts));
    return r;
  };

  let sel: { T: number; score: number; valR2: number | null } | null = null;
  for (const T of MEMORY_BY_CLASS[cls]) {
    const smoothed = emaSmooth(hype, T);
    const rows: Array<{ ts: number; s: number; y: number }> = [];
    for (const o of pts) {
      const h = nearestPoint(smoothed, o.ts);
      if (h) rows.push({ ts: o.ts, s: h.v, y: o.y });
    }
    if (rows.length < 10) continue;

    const split = rows.length >= 12 ? Math.floor(rows.length * 0.8) : rows.length;
    const cal = rows.slice(0, split);
    const val = rows.slice(split);

    const calFit = olsMulti(cal.map(r => row(r.ts, r.s)), cal.map(r => r.y));
    if (!calFit) continue;

    let valR2: number | null = null;
    if (val.length >= 4) {
      valR2 = scoreFit(calFit.beta, val.map(r => row(r.ts, r.s)), val.map(r => r.y))?.r2 ?? null;
    }
    const score = valR2 ?? calFit.r2;
    if (!sel || score > sel.score) sel = { T, score, valR2 };
  }
  if (!sel) return null;

  const smoothed = emaSmooth(hype, sel.T);
  const rows: Array<{ ts: number; s: number; y: number }> = [];
  for (const o of pts) {
    const h = nearestPoint(smoothed, o.ts);
    if (h) rows.push({ ts: o.ts, s: h.v, y: o.y });
  }
  const finalFit = olsMulti(rows.map(r => row(r.ts, r.s)), rows.map(r => r.y));
  if (!finalFit) return null;

  const eff = sel.valR2 ?? finalFit.r2;
  const confidence: ChemFit['confidence'] = eff >= 0.6 ? 'high' : eff >= 0.4 ? 'medium' : 'low';

  // Prediction only from shortly before the record starts: with a trend term,
  // extrapolating decades back would be pure speculation.
  const from = t0 - 2 * YEAR_MS;
  const series: ChemFit['series'] = [];
  for (const h of smoothed) {
    if (h.ts < from) continue;
    const x = row(h.ts, h.v);
    let p = 0;
    for (let i = 0; i < finalFit.beta.length; i++) p += finalFit.beta[i] * x[i];
    series.push({ ts: h.ts, value: log ? Math.exp(p) : p });
  }

  return {
    paramClass: cls,
    logTransform: log,
    memoryDays: sel.T,
    r2: finalFit.r2,
    valR2: sel.valR2,
    rmse: finalFit.rmse,
    n: rows.length,
    source,
    confidence,
    series,
  };
}

/**
 * Fit a chemistry parameter against both HYPE series (små + stora magasin);
 * return the best fit, or null when the data is too sparse, the calibration
 * too weak (R² < minR2), or the fit collapses out of sample.
 */
export function fitChemToHype(
  obs: Array<{ ts: number; v: number }>,
  hype: Array<{ ts: number; fyllSma: number | null; fyllStora: number | null }>,
  paramName: string,
  minR2 = 0.3,
): ChemFit | null {
  const { cls, log } = classifyParameter(paramName);
  const sma: Array<{ ts: number; v: number }> = [];
  const stora: Array<{ ts: number; v: number }> = [];
  for (const h of hype) {
    if (h.fyllSma != null) sma.push({ ts: h.ts, v: h.fyllSma });
    if (h.fyllStora != null) stora.push({ ts: h.ts, v: h.fyllStora });
  }

  const fits = [fitOne(obs, sma, 'sma', cls, log), fitOne(obs, stora, 'stora', cls, log)]
    .filter((f): f is ChemFit =>
      f != null && f.r2 >= minR2 && (f.valR2 == null || f.n < 12 || f.valR2 >= 0.1));
  if (fits.length === 0) return null;
  return fits.reduce((p, c) => ((c.valR2 ?? c.r2) > (p.valR2 ?? p.r2) ? c : p));
}
