import type { Timeframe } from '../types';

/** All tunable numbers of the ICT engine. ICT is discretionary, so nothing here is "the" truth. */
export interface IctParams {
  /** Bars on each side that must be lower/higher for a swing point. */
  swingLookback: number;
  atrPeriod: number;
  /** A displacement candle has a body of at least this many ATRs... */
  displacementAtrMultiple: number;
  /** ...and closes within this fraction of its range from the extreme (0.7 = top/bottom 30%). */
  displacementCloseRatio: number;
  /** Swing highs/lows within this many pips count as "equal". */
  equalLevelTolerancePips: number;
  /** Smaller fair value gaps are ignored. */
  minFvgPips: number;
  /** Order block zone = candle body (true) or full candle range (false). */
  orderBlockUsesBody: boolean;
  /** How many candles before the swing low/high to search for the order block candle. */
  orderBlockLookback: number;
  /** OTE band as retracement fractions of the dealing range. */
  oteFrom: number;
  oteTo: number;
  /** Cap on drawn zones per kind so the chart stays readable. */
  maxZonesPerKind: number;
}

export function defaultParams(timeframe: Timeframe): IctParams {
  const higher = timeframe === '1h' || timeframe === '1d';
  return {
    swingLookback: timeframe === '1d' ? 2 : 3,
    atrPeriod: 14,
    displacementAtrMultiple: 1.2,
    displacementCloseRatio: 0.7,
    equalLevelTolerancePips: higher ? 5 : 2,
    minFvgPips: higher ? 2 : 0.5,
    orderBlockUsesBody: true,
    orderBlockLookback: 10,
    oteFrom: 0.62,
    oteTo: 0.79,
    maxZonesPerKind: 12,
  };
}
