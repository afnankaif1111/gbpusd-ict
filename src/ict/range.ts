import type { Direction } from '../types';
import type { DealingRange, SwingPoint } from './annotations';
import type { IctParams } from './params';

/**
 * Current dealing range = latest confirmed swing high to latest confirmed
 * swing low. Above the 50% equilibrium is premium, below is discount. The OTE
 * band (62%-79% retracement) is measured from the extreme in the direction of
 * the current trend: in a bullish trend it sits in discount, in a bearish
 * trend in premium.
 */
export function computeDealingRange(
  swings: readonly SwingPoint[],
  trend: Direction | null,
  params: IctParams,
): DealingRange | null {
  const high = [...swings].reverse().find((s) => s.type === 'high');
  const low = [...swings].reverse().find((s) => s.type === 'low');
  if (!high || !low || high.price <= low.price) return null;

  const size = high.price - low.price;
  let oteTop: number | null = null;
  let oteBottom: number | null = null;
  if (trend === 'bullish') {
    oteTop = high.price - params.oteFrom * size;
    oteBottom = high.price - params.oteTo * size;
  } else if (trend === 'bearish') {
    oteBottom = low.price + params.oteFrom * size;
    oteTop = low.price + params.oteTo * size;
  }

  return {
    high: high.price,
    low: low.price,
    equilibrium: (high.price + low.price) / 2,
    fromIndex: Math.min(high.index, low.index),
    bias: trend,
    oteTop,
    oteBottom,
  };
}
