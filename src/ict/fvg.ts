import { PIP } from '../core/market';
import type { Candle } from '../types';
import type { FairValueGap } from './annotations';
import { isDisplacement } from './displacement';
import type { IctParams } from './params';

/**
 * Fair value gaps: three consecutive candles where the wicks of candle 1 and
 * candle 3 do not overlap.
 *   bullish: candle3.low  > candle1.high  -> zone [candle1.high, candle3.low]
 *   bearish: candle3.high < candle1.low   -> zone [candle3.high, candle1.low]
 * A gap is `partial` once price trades into it and `filled` once price trades
 * through the far edge.
 */
export function detectFairValueGaps(candles: readonly Candle[], atr: readonly number[], params: IctParams): FairValueGap[] {
  const minGap = params.minFvgPips * PIP - 1e-12;
  const gaps: FairValueGap[] = [];

  for (let i = 2; i < candles.length; i++) {
    const first = candles[i - 2];
    const middle = candles[i - 1];
    const third = candles[i];

    if (third.low > first.high && third.low - first.high >= minGap) {
      const gap: FairValueGap = {
        direction: 'bullish',
        top: third.low,
        bottom: first.high,
        startIndex: i - 2,
        endIndex: null,
        status: 'open',
        impulsive: isDisplacement(middle, atr[i - 1], 'bullish', params),
      };
      trackFill(candles, gap, i + 1);
      gaps.push(gap);
    } else if (third.high < first.low && first.low - third.high >= minGap) {
      const gap: FairValueGap = {
        direction: 'bearish',
        top: first.low,
        bottom: third.high,
        startIndex: i - 2,
        endIndex: null,
        status: 'open',
        impulsive: isDisplacement(middle, atr[i - 1], 'bearish', params),
      };
      trackFill(candles, gap, i + 1);
      gaps.push(gap);
    }
  }
  return gaps;
}

function trackFill(candles: readonly Candle[], gap: FairValueGap, from: number): void {
  for (let j = from; j < candles.length; j++) {
    const c = candles[j];
    if (gap.direction === 'bullish') {
      if (c.low <= gap.bottom) return fill(gap, j);
      if (c.low < gap.top) gap.status = 'partial';
    } else {
      if (c.high >= gap.top) return fill(gap, j);
      if (c.high > gap.bottom) gap.status = 'partial';
    }
  }
}

function fill(gap: FairValueGap, index: number): void {
  gap.status = 'filled';
  gap.endIndex = index;
}
