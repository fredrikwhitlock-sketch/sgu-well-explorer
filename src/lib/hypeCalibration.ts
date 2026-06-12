// Pastas-style transfer model: calibrate the HYPE fyllnadsgrad series
// (percentile 0-100) against observed groundwater levels (m below ground)
// so the modeled series can fill gaps in, and extend, the sparse observed
// record.
//
// Like Pastas we convolve the explanatory series with an exponential
// impulse-response kernel before the linear transfer. The convolution is
// computed as a recursive exponential moving average with a free time scale
// T (the aquifer "memory"), selected from a candidate grid by out-of-sample
// R² on a chronological 80/20 split. When enough observations exist, annual
// sin/cos harmonics absorb local seasonality that HYPE does not reproduce.
// The final parameters are refit on all pairs with the selected structure.

export interface HypeFit {
  /** Regression slope on the smoothed fyllnadsgrad (m per percentile unit) — expected negative. */
  a: number;
  /** Regression intercept (m). */
  b: number;
  /** Annual harmonic coefficients (m); 0 when seasonality was not fitted. */
  c1: number;
  c2: number;
  /** Exponential-kernel time scale in days that maximised validation R². */
  memoryDays: number;
  /** Coefficient of determination on all paired points (final refit). */
  r2: number;
  /** Out-of-sample R² on the chronological 20% holdout; null when too few obs to validate. */
  valR2: number | null;
  /** Root-mean-square error of the fit (m). */
  rmse: number;
  /** Number of obs↔HYPE pairs used. */
  n: number;
  /** Which HYPE series fitted best. */
  source: 'sma' | 'stora';
  /** Graded reliability based on validation (or calibration) R². */
  confidence: 'high' | 'medium' | 'low';
  /** Modeled level for every HYPE timestamp: m below ground. */
  series: Array<{ ts: number; niva: number }>;
}

const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;
const OMEGA = (2 * Math.PI) / YEAR_MS;
/** Candidate exponential-kernel time scales (days). Spans flashy till-aquifers to slow eskers. */
const MEMORY_CANDIDATES = [1, 7, 15, 30, 60, 90, 180, 365];
/** Match an observation to a HYPE value at most this far away in time. */
const MATCH_TOL_MS = 3 * DAY_MS;
/** Use annual harmonics only when calibration data can support 4 parameters. */
const MIN_N_SEASONAL = 16;

/**
 * Exponential-kernel convolution computed as a recursive EMA that handles
 * irregular sampling. Seeded with the mean of the first T days to suppress
 * warm-up bias at the start of the record.
 */
export function emaSmooth(
  pts: Array<{ ts: number; v: number }>,
  T: number,
): Array<{ ts: number; v: number }> {
  if (pts.length === 0 || T <= 0.5) return pts;
  const seedEnd = pts[0].ts + T * DAY_MS;
  let seedSum = 0, seedN = 0;
  for (const p of pts) {
    if (p.ts > seedEnd) break;
    seedSum += p.v; seedN++;
  }
  let s = seedN > 0 ? seedSum / seedN : pts[0].v;
  const out = new Array<{ ts: number; v: number }>(pts.length);
  out[0] = { ts: pts[0].ts, v: s };
  for (let i = 1; i < pts.length; i++) {
    const dtDays = (pts[i].ts - pts[i - 1].ts) / DAY_MS;
    const alpha = 1 - Math.exp(-dtDays / T);
    s = s + alpha * (pts[i].v - s);
    out[i] = { ts: pts[i].ts, v: s };
  }
  return out;
}

/** Binary search the (sorted) series for the closest point to `ts`. */
export function nearestPoint(
  pts: Array<{ ts: number; v: number }>,
  ts: number,
): { ts: number; v: number } | null {
  let lo = 0, hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].ts < ts) lo = mid + 1; else hi = mid;
  }
  let best = pts[lo];
  if (lo > 0 && Math.abs(pts[lo - 1].ts - ts) < Math.abs(best.ts - ts)) best = pts[lo - 1];
  return Math.abs(best.ts - ts) <= MATCH_TOL_MS ? best : null;
}

/** Design-matrix row: [1, smoothed fyllnadsgrad, (sin, cos annual)]. */
function designRow(ts: number, s: number, seasonal: boolean): number[] {
  return seasonal ? [1, s, Math.sin(OMEGA * ts), Math.cos(OMEGA * ts)] : [1, s];
}

/** Multiple OLS via normal equations + Gauss-Jordan with partial pivoting. */
export function olsMulti(X: number[][], y: number[]): { beta: number[]; r2: number; rmse: number } | null {
  const n = X.length;
  if (n === 0) return null;
  const k = X[0].length;
  if (n <= k + 1) return null;
  const A: number[][] = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let r = 0; r < n; r++) {
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) A[i][j] += X[r][i] * X[r][j];
      A[i][k] += X[r][i] * y[r];
    }
  }
  for (let col = 0; col < k; col++) {
    let piv = col;
    for (let r = col + 1; r < k; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-9) return null;
    [A[col], A[piv]] = [A[piv], A[col]];
    for (let r = 0; r < k; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let c = col; c <= k; c++) A[r][c] -= f * A[col][c];
    }
  }
  const beta = A.map((row, i) => row[k] / row[i]);
  const stats = scoreFit(beta, X, y);
  if (!stats) return null;
  return { beta, ...stats };
}

/** R²/RMSE of predictions `X·beta` against `y`; null when y has no variance. */
export function scoreFit(beta: number[], X: number[][], y: number[]): { r2: number; rmse: number } | null {
  const n = X.length;
  if (n === 0) return null;
  const meanY = y.reduce((acc, v) => acc + v, 0) / n;
  let ssRes = 0, ssTot = 0;
  for (let r = 0; r < n; r++) {
    let pred = 0;
    for (let i = 0; i < beta.length; i++) pred += beta[i] * X[r][i];
    ssRes += (y[r] - pred) ** 2;
    ssTot += (y[r] - meanY) ** 2;
  }
  if (ssTot < 1e-9) return null;
  return { r2: 1 - ssRes / ssTot, rmse: Math.sqrt(ssRes / n) };
}

function fitOne(
  obs: Array<{ ts: number; djup: number }>,
  hype: Array<{ ts: number; v: number }>,
  source: 'sma' | 'stora',
): HypeFit | null {
  if (obs.length < 8 || hype.length < 30) return null;
  const obsSorted = [...obs].sort((x, y) => x.ts - y.ts);

  // Model selection: pick the memory T (and seasonality) that maximises
  // out-of-sample R² on the chronologically last 20% of observations.
  let sel: { T: number; score: number; valR2: number | null; seasonal: boolean } | null = null;
  for (const T of MEMORY_CANDIDATES) {
    const smoothed = emaSmooth(hype, T);
    const rows: Array<{ ts: number; s: number; y: number }> = [];
    for (const o of obsSorted) {
      const h = nearestPoint(smoothed, o.ts);
      if (h) rows.push({ ts: o.ts, s: h.v, y: o.djup });
    }
    if (rows.length < 8) continue;
    const seasonal = rows.length >= MIN_N_SEASONAL;

    const split = rows.length >= 12 ? Math.floor(rows.length * 0.8) : rows.length;
    const cal = rows.slice(0, split);
    const val = rows.slice(split);

    const calFit = olsMulti(cal.map(r => designRow(r.ts, r.s, seasonal)), cal.map(r => r.y));
    if (!calFit) continue;

    let valR2: number | null = null;
    if (val.length >= 4) {
      valR2 = scoreFit(calFit.beta, val.map(r => designRow(r.ts, r.s, seasonal)), val.map(r => r.y))?.r2 ?? null;
    }
    const score = valR2 ?? calFit.r2;
    if (!sel || score > sel.score) sel = { T, score, valR2, seasonal };
  }
  if (!sel) return null;

  // Final refit on all pairs with the selected structure.
  const smoothed = emaSmooth(hype, sel.T);
  const rows: Array<{ ts: number; s: number; y: number }> = [];
  for (const o of obsSorted) {
    const h = nearestPoint(smoothed, o.ts);
    if (h) rows.push({ ts: o.ts, s: h.v, y: o.djup });
  }
  const finalFit = olsMulti(rows.map(r => designRow(r.ts, r.s, sel.seasonal)), rows.map(r => r.y));
  if (!finalFit) return null;

  const [b, a, c1 = 0, c2 = 0] = finalFit.beta;
  const eff = sel.valR2 ?? finalFit.r2;
  const confidence: HypeFit['confidence'] = eff >= 0.6 ? 'high' : eff >= 0.4 ? 'medium' : 'low';

  return {
    a, b, c1, c2,
    memoryDays: sel.T,
    r2: finalFit.r2,
    valR2: sel.valR2,
    rmse: finalFit.rmse,
    n: rows.length,
    source,
    confidence,
    series: smoothed.map(h => ({
      ts: h.ts,
      niva: b + a * h.v + c1 * Math.sin(OMEGA * h.ts) + c2 * Math.cos(OMEGA * h.ts),
    })),
  };
}

/**
 * Fit observed levels against both HYPE series (små + stora magasin); return
 * the best fit, or null when the data is too sparse, the calibration too weak
 * (R² < minR2), or the fit collapses out of sample (validation R² < 0.1).
 */
export function fitHypeToObservations(
  obs: Array<{ ts: number; djup: number }>,
  hype: Array<{ ts: number; fyllSma: number | null; fyllStora: number | null }>,
  minR2 = 0.3,
): HypeFit | null {
  const sma: Array<{ ts: number; v: number }> = [];
  const stora: Array<{ ts: number; v: number }> = [];
  for (const h of hype) {
    if (h.fyllSma != null) sma.push({ ts: h.ts, v: h.fyllSma });
    if (h.fyllStora != null) stora.push({ ts: h.ts, v: h.fyllStora });
  }

  const fits = [fitOne(obs, sma, 'sma'), fitOne(obs, stora, 'stora')]
    .filter((f): f is HypeFit =>
      f != null && f.r2 >= minR2 && (f.valR2 == null || f.n < 12 || f.valR2 >= 0.1));
  if (fits.length === 0) return null;
  return fits.reduce((p, c) => ((c.valR2 ?? c.r2) > (p.valR2 ?? p.r2) ? c : p));
}
