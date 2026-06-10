// Pastas-inspired transfer model: calibrate the HYPE fyllnadsgrad series
// (percentile 0-100) against observed groundwater levels (m below ground)
// so the modeled series can fill gaps in, and extend, the sparse observed
// record. Like Pastas we treat an explanatory series + response lag + linear
// transfer, but skip full impulse-response convolution — HYPE fyllnadsgrad is
// already a groundwater *state* (not a stress like precipitation), so a lagged
// linear map captures most of the signal.

export interface HypeFit {
  /** Regression slope (m per percentile unit) — expected negative. */
  a: number;
  /** Regression intercept (m). */
  b: number;
  /** Coefficient of determination on the paired points. */
  r2: number;
  /** Root-mean-square error of the fit (m). */
  rmse: number;
  /** Number of obs↔HYPE pairs used. */
  n: number;
  /** Response lag in days that maximised R². */
  lagDays: number;
  /** Which HYPE series fitted best. */
  source: 'sma' | 'stora';
  /** Modeled level for every HYPE timestamp: m below ground. */
  series: Array<{ ts: number; niva: number }>;
}

const DAY_MS = 86_400_000;
/** Candidate response lags (days). HYPE state usually leads obs by ~0-2 weeks. */
const LAGS = [0, 3, 7, 14, 21, 30];
/** Match an observation to a HYPE value at most this far away in time. */
const MATCH_TOL_MS = 3 * DAY_MS;

function olsFit(pairs: Array<[number, number]>): { a: number; b: number; r2: number; rmse: number } | null {
  const n = pairs.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of pairs) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const a = (n * sxy - sx * sy) / denom;
  const b = (sy - a * sx) / n;
  const meanY = sy / n;
  let ssRes = 0, ssTot = 0;
  for (const [x, y] of pairs) {
    const e = y - (a * x + b);
    ssRes += e * e;
    ssTot += (y - meanY) * (y - meanY);
  }
  if (ssTot < 1e-9) return null;
  return { a, b, r2: 1 - ssRes / ssTot, rmse: Math.sqrt(ssRes / n) };
}

/** Binary search the (sorted) HYPE series for the closest point to `ts`. */
function nearestHype(
  hype: Array<{ ts: number; v: number }>,
  ts: number,
): { ts: number; v: number } | null {
  let lo = 0, hi = hype.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (hype[mid].ts < ts) lo = mid + 1; else hi = mid;
  }
  let best = hype[lo];
  if (lo > 0 && Math.abs(hype[lo - 1].ts - ts) < Math.abs(best.ts - ts)) best = hype[lo - 1];
  return Math.abs(best.ts - ts) <= MATCH_TOL_MS ? best : null;
}

function fitOne(
  obs: Array<{ ts: number; djup: number }>,
  hype: Array<{ ts: number; v: number }>,
  source: 'sma' | 'stora',
): HypeFit | null {
  if (obs.length < 8 || hype.length < 30) return null;

  let best: HypeFit | null = null;
  for (const lag of LAGS) {
    const lagMs = lag * DAY_MS;
    const pairs: Array<[number, number]> = [];
    for (const o of obs) {
      const h = nearestHype(hype, o.ts - lagMs);
      if (h) pairs.push([h.v, o.djup]);
    }
    if (pairs.length < 8) continue;
    const fit = olsFit(pairs);
    if (!fit) continue;
    if (!best || fit.r2 > best.r2) {
      best = { ...fit, n: pairs.length, lagDays: lag, source, series: [] };
    }
  }
  if (!best) return null;

  const { a, b, lagDays } = best;
  best.series = hype.map(h => ({ ts: h.ts + lagDays * DAY_MS, niva: a * h.v + b }));
  return best;
}

/**
 * Fit observed levels against both HYPE series (små + stora magasin) across a
 * set of candidate response lags; return the best fit, or null when the data
 * is too sparse or the correlation too weak to be meaningful.
 */
export function fitHypeToObservations(
  obs: Array<{ ts: number; djup: number }>,
  hype: Array<{ ts: number; fyllSma: number | null; fyllStora: number | null }>,
  minR2 = 0.25,
): HypeFit | null {
  const sma: Array<{ ts: number; v: number }> = [];
  const stora: Array<{ ts: number; v: number }> = [];
  for (const h of hype) {
    if (h.fyllSma != null) sma.push({ ts: h.ts, v: h.fyllSma });
    if (h.fyllStora != null) stora.push({ ts: h.ts, v: h.fyllStora });
  }

  const fits = [fitOne(obs, sma, 'sma'), fitOne(obs, stora, 'stora')]
    .filter((f): f is HypeFit => f != null && f.r2 >= minR2);
  if (fits.length === 0) return null;
  return fits.reduce((p, c) => (c.r2 > p.r2 ? c : p));
}
