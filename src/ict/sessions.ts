import { addDays, nyParts } from '../core/market';
import type { Candle, Timeframe } from '../types';
import type { JudasSwing, Session, SessionName } from './annotations';

/** ICT session windows in New York time (start hour inclusive, end hour exclusive). */
const WINDOWS: readonly { name: SessionName; from: number; to: number }[] = [
  { name: 'Asia', from: 20, to: 24 },
  { name: 'London', from: 2, to: 5 },
  { name: 'New York', from: 7, to: 10 },
];

/**
 * Asia range (20:00-00:00 NY) and the London / New York kill zones. The Asia
 * window belongs to the *next* calendar day, so that London can be compared
 * with the Asia range that precedes it. Not defined for daily charts.
 */
export function detectSessions(candles: readonly Candle[], timeframe: Timeframe): Session[] {
  if (timeframe === '1d') return [];
  const sessions = new Map<string, Session>();

  for (const candle of candles) {
    const ny = nyParts(candle.time);
    const window = WINDOWS.find((w) => ny.hour >= w.from && ny.hour < w.to);
    if (!window) continue;

    const dayKey = window.name === 'Asia' ? addDays(ny.date, 1) : ny.date;
    const key = `${window.name}|${dayKey}`;
    const existing = sessions.get(key);
    if (existing) {
      existing.endIndex = candle.index;
      existing.high = Math.max(existing.high, candle.high);
      existing.low = Math.min(existing.low, candle.low);
    } else {
      sessions.set(key, {
        name: window.name,
        dayKey,
        startIndex: candle.index,
        endIndex: candle.index,
        high: candle.high,
        low: candle.low,
      });
    }
  }
  return [...sessions.values()].sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Judas swing: inside the London kill zone price takes the Asia high (or low)
 * and the zone closes back below (above) it. The earlier of the two sweeps
 * counts; a candle that takes both sides is ignored as ambiguous.
 */
export function detectJudasSwings(candles: readonly Candle[], sessions: readonly Session[]): JudasSwing[] {
  const swings: JudasSwing[] = [];

  for (const asia of sessions.filter((s) => s.name === 'Asia')) {
    const london = sessions.find((s) => s.name === 'London' && s.dayKey === asia.dayKey);
    if (!london) continue;

    for (let i = london.startIndex; i <= london.endIndex; i++) {
      const c = candles[i];
      const tookHigh = c.high > asia.high;
      const tookLow = c.low < asia.low;
      if (tookHigh === tookLow) continue;

      const lastClose = candles[london.endIndex].close;
      const rejected = tookHigh ? lastClose < asia.high : lastClose > asia.low;
      if (rejected) {
        swings.push({
          direction: tookHigh ? 'bearish' : 'bullish',
          asiaHigh: asia.high,
          asiaLow: asia.low,
          index: i,
          endIndex: london.endIndex,
        });
      }
      break;
    }
  }
  return swings;
}
