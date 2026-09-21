import type { Candle, Direction } from '../types';
import type { IctParams } from './params';

/** A displacement candle: large body (relative to ATR) that closes near its extreme. */
export function isDisplacement(candle: Candle, atr: number, direction: Direction, params: IctParams): boolean {
  const range = candle.high - candle.low;
  if (range <= 0 || atr <= 0) return false;
  const body = candle.close - candle.open;
  if (direction === 'bullish') {
    return body >= params.displacementAtrMultiple * atr && (candle.close - candle.low) / range >= params.displacementCloseRatio;
  }
  return -body >= params.displacementAtrMultiple * atr && (candle.high - candle.close) / range >= params.displacementCloseRatio;
}

/** True if any candle in [from, to] is a displacement candle in `direction`. */
export function hasDisplacement(
  candles: readonly Candle[],
  atr: readonly number[],
  from: number,
  to: number,
  direction: Direction,
  params: IctParams,
): boolean {
  for (let i = Math.max(0, from); i <= Math.min(to, candles.length - 1); i++) {
    if (isDisplacement(candles[i], atr[i], direction, params)) return true;
  }
  return false;
}
