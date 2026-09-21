import type { Candle } from '../types';

export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Most frequent value; on a tie the larger value wins. */
export function mode(values: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = NaN;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value > best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export interface Line {
  slope: number;
  intercept: number;
}

/** Ordinary least squares fit of y = slope * x + intercept. */
export function leastSquares(points: readonly { x: number; y: number }[]): Line | null {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const { x, y } of points) {
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }
  const denominator = n * sxx - sx * sx;
  if (Math.abs(denominator) < 1e-12) return null;
  const slope = (n * sxy - sx * sy) / denominator;
  return { slope, intercept: (sy - slope * sx) / n };
}

/** Wilder-smoothed Average True Range, defined for every candle (warm-up uses a running mean). */
export function atrSeries(candles: readonly Candle[], period: number): number[] {
  const out = new Array<number>(candles.length).fill(0);
  let atr = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = i > 0 ? candles[i - 1].close : c.close;
    const trueRange = Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
    atr = i < period ? (atr * i + trueRange) / (i + 1) : (atr * (period - 1) + trueRange) / period;
    out[i] = atr;
  }
  return out;
}
