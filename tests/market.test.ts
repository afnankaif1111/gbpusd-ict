import { describe, expect, it } from 'vitest';
import { assignTimes, isMarketOpen, nyParts, tradingDayKey } from '../src/core/market';

const utc = (iso: string): number => Date.parse(iso) / 1000;

describe('New York clock', () => {
  it('follows daylight saving time', () => {
    expect(nyParts(utc('2026-07-01T12:00:00Z')).hour).toBe(8); // EDT, UTC-4
    expect(nyParts(utc('2026-01-15T12:00:00Z')).hour).toBe(7); // EST, UTC-5
  });

  it('rolls the trading day over at 17:00 New York', () => {
    expect(tradingDayKey(utc('2026-09-15T20:59:00Z'))).toBe('2026-09-15'); // 16:59 NY
    expect(tradingDayKey(utc('2026-09-15T21:00:00Z'))).toBe('2026-09-16'); // 17:00 NY
  });
});

describe('forex weekly schedule', () => {
  it('is closed from Friday 17:00 to Sunday 17:00 New York time', () => {
    expect(isMarketOpen(utc('2026-09-18T20:00:00Z'))).toBe(true); // Fri 16:00 NY
    expect(isMarketOpen(utc('2026-09-18T21:00:00Z'))).toBe(false); // Fri 17:00 NY
    expect(isMarketOpen(utc('2026-09-19T12:00:00Z'))).toBe(false); // Saturday
    expect(isMarketOpen(utc('2026-09-20T20:00:00Z'))).toBe(false); // Sun 16:00 NY
    expect(isMarketOpen(utc('2026-09-20T21:00:00Z'))).toBe(true); // Sun 17:00 NY
  });
});

describe('assignTimes', () => {
  const bar = { open: 1, high: 1, low: 1, close: 1 };

  it('counts backwards and skips the weekend gap', () => {
    const candles = assignTimes([bar, bar, bar], '1h', utc('2026-09-20T21:00:00Z'));
    expect(candles.map((c) => new Date(c.time * 1000).toISOString())).toEqual([
      '2026-09-18T19:00:00.000Z',
      '2026-09-18T20:00:00.000Z',
      '2026-09-20T21:00:00.000Z',
    ]);
    expect(candles.map((c) => c.index)).toEqual([0, 1, 2]);
  });

  it('snaps an off-grid last-candle time onto the timeframe grid', () => {
    const [candle] = assignTimes([bar], '15m', utc('2026-09-16T10:07:00Z'));
    expect(new Date(candle.time * 1000).toISOString()).toBe('2026-09-16T10:00:00.000Z');
  });

  it('labels daily candles by date and skips Saturday and Sunday', () => {
    const candles = assignTimes([bar, bar, bar], '1d', utc('2026-09-21T00:00:00Z')); // Monday
    expect(candles.map((c) => new Date(c.time * 1000).toISOString().slice(0, 10))).toEqual(['2026-09-17', '2026-09-18', '2026-09-21']);
  });
});
