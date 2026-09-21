import type { Candle, OhlcBar } from '../../src/types';

/** Monday 2026-09-15 00:00 UTC is New York 20:00 (EDT), i.e. the start of an Asia session. */
export const ASIA_START = Date.UTC(2026, 8, 15, 0, 0) / 1000;

export type Row = [open: number, high: number, low: number, close: number];

/** Builds candles from [open, high, low, close] rows, one candle per `stepSeconds`. */
export function candlesFrom(rows: readonly Row[], stepSeconds = 3600, start = ASIA_START): Candle[] {
  return rows.map(([open, high, low, close], index) => ({ index, time: start + index * stepSeconds, open, high, low, close }));
}

/** Candles that follow a list of closes; each opens at the previous close and has small wicks. */
export function candlesFromCloses(closes: readonly number[], wick = 0.0002, stepSeconds = 3600, start = ASIA_START): Candle[] {
  const rows = closes.map((close, i): Row => {
    const open = i === 0 ? close : closes[i - 1];
    return [open, Math.max(open, close) + wick, Math.min(open, close) - wick, close];
  });
  return candlesFrom(rows, stepSeconds, start);
}

/** Deterministic pseudo-random numbers in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** GBPUSD-like random walk: ~6 pip candle bodies with 0-4 pip wicks. */
export function randomWalkBars(count: number, seed = 1, start = 1.335): OhlcBar[] {
  const random = seededRandom(seed);
  const bars: OhlcBar[] = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    const open = price;
    const close = open + (random() - 0.5) * 0.0012;
    bars.push({
      open,
      close,
      high: Math.max(open, close) + random() * 0.0004,
      low: Math.min(open, close) - random() * 0.0004,
    });
    price = close;
  }
  return bars;
}
