/** Chart timeframes supported by the app, ordered from highest to lowest. */
export const TIMEFRAMES = ['1d', '1h', '15m', '5m'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

/**
 * Higher rank = higher timeframe. A chart may only use charts with a
 * strictly higher rank as "context" (see src/mtf).
 */
export const TIMEFRAME_RANK: Record<Timeframe, number> = { '1d': 3, '1h': 2, '15m': 1, '5m': 0 };

export type Direction = 'bullish' | 'bearish';

/** Open/high/low/close without any position or time information. */
export interface OhlcBar {
  open: number;
  high: number;
  low: number;
  close: number;
}

/** One candle of a chart. `index` is its position in the chart, 0 = oldest. */
export interface Candle extends OhlcBar {
  index: number;
  /** Unix seconds (UTC) of the candle open. For 1D candles: 00:00 UTC of the trading date. */
  time: number;
}
