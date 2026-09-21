import type { Candle, Direction } from '../types';
import type { StructureBreak, SwingPoint } from './annotations';

export interface StructureResult {
  breaks: StructureBreak[];
  /** Direction of the most recent break, or null if price never broke a swing. */
  trend: Direction | null;
}

/**
 * Market structure from candle *closes* (wicks alone do not break structure).
 *
 * The most recently confirmed, not-yet-broken swing high and swing low are
 * tracked. A close above the swing high is bullish, a close below the swing
 * low is bearish. A break in the direction of the current trend is a BOS; the
 * first break against it is a CHoCH.
 */
export function findStructure(candles: readonly Candle[], swings: readonly SwingPoint[]): StructureResult {
  const byConfirmation = new Map<number, SwingPoint[]>();
  for (const swing of swings) {
    const list = byConfirmation.get(swing.confirmedAt) ?? [];
    list.push(swing);
    byConfirmation.set(swing.confirmedAt, list);
  }

  const breaks: StructureBreak[] = [];
  let trend: Direction | null = null;
  let activeHigh: SwingPoint | null = null;
  let activeLow: SwingPoint | null = null;

  for (const candle of candles) {
    for (const swing of byConfirmation.get(candle.index) ?? []) {
      if (swing.type === 'high') activeHigh = swing;
      else activeLow = swing;
    }

    if (activeHigh && candle.close > activeHigh.price) {
      breaks.push({
        type: trend === 'bearish' ? 'CHoCH' : 'BOS',
        direction: 'bullish',
        level: activeHigh.price,
        swingIndex: activeHigh.index,
        index: candle.index,
      });
      trend = 'bullish';
      activeHigh = null;
    } else if (activeLow && candle.close < activeLow.price) {
      breaks.push({
        type: trend === 'bullish' ? 'CHoCH' : 'BOS',
        direction: 'bearish',
        level: activeLow.price,
        swingIndex: activeLow.index,
        index: candle.index,
      });
      trend = 'bearish';
      activeLow = null;
    }
  }
  return { breaks, trend };
}
