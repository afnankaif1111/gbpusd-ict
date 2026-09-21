import type { Candle } from '../types';
import type { SwingPoint } from './annotations';

/**
 * Fractal swing points. A swing high is strictly higher than the `lookback`
 * candles before it and at least as high as the `lookback` candles after it
 * (so of two equal highs the first one is the swing). It is only "confirmed"
 * once those following candles exist.
 */
export function findSwings(candles: readonly Candle[], lookback: number): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let k = 1; k <= lookback; k++) {
      if (candles[i - k].high >= candles[i].high || candles[i + k].high > candles[i].high) isHigh = false;
      if (candles[i - k].low <= candles[i].low || candles[i + k].low < candles[i].low) isLow = false;
    }
    if (isHigh) swings.push({ type: 'high', index: i, confirmedAt: i + lookback, price: candles[i].high });
    if (isLow) swings.push({ type: 'low', index: i, confirmedAt: i + lookback, price: candles[i].low });
  }
  return swings;
}
