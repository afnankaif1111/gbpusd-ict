import { nyParts, TIMEFRAME_SECONDS, tradingDayKey } from '../core/market';
import type { Candle, Timeframe } from '../types';
import type { KeyLevel } from './annotations';

/**
 * Reference levels:
 *  - PDH / PDL: previous trading day's high and low (trading day = 17:00 NY to 17:00 NY).
 *    On the daily chart these are simply the previous candle.
 *  - Midnight Open: open of the 00:00 New York candle of the latest day (intraday charts only).
 * Levels that cannot be computed reliably from the visible candles are left out.
 */
export function detectKeyLevels(candles: readonly Candle[], timeframe: Timeframe): KeyLevel[] {
  if (candles.length < 2) return [];
  const last = candles[candles.length - 1];

  if (timeframe === '1d') {
    const previous = candles[candles.length - 2];
    return [
      { label: 'PDH', price: previous.high, fromIndex: last.index },
      { label: 'PDL', price: previous.low, fromIndex: last.index },
    ];
  }

  const levels: KeyLevel[] = [];
  const days = groupByTradingDay(candles);
  const keys = [...days.keys()];
  const previousDay = days.get(keys[keys.length - 2] ?? '');
  const currentDay = days.get(keys[keys.length - 1]);

  // A previous day is only trusted if (almost) all of its candles are visible.
  const expectedPerDay = 86400 / TIMEFRAME_SECONDS[timeframe];
  if (previousDay && currentDay && previousDay.length >= expectedPerDay * 0.9) {
    levels.push({ label: 'PDH', price: Math.max(...previousDay.map((c) => c.high)), fromIndex: currentDay[0].index });
    levels.push({ label: 'PDL', price: Math.min(...previousDay.map((c) => c.low)), fromIndex: currentDay[0].index });
  }

  const lastDate = nyParts(last.time).date;
  const midnight = candles.find((c) => {
    const ny = nyParts(c.time);
    return ny.date === lastDate && ny.hour === 0 && ny.minute < TIMEFRAME_SECONDS[timeframe] / 60;
  });
  if (midnight) levels.push({ label: 'Midnight Open', price: midnight.open, fromIndex: midnight.index });

  return levels;
}

function groupByTradingDay(candles: readonly Candle[]): Map<string, Candle[]> {
  const days = new Map<string, Candle[]>();
  for (const candle of candles) {
    const key = tradingDayKey(candle.time);
    const list = days.get(key) ?? [];
    list.push(candle);
    days.set(key, list);
  }
  return days;
}
