import type { Candle, OhlcBar, Timeframe } from '../types';

/** One pip on GBPUSD. */
export const PIP = 0.0001;

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '1d': 86400,
};

export const priceToPips = (priceDistance: number): number => priceDistance / PIP;

// ---------------------------------------------------------------------------
// New York clock. ICT sessions and the forex trading day are defined in New
// York time, so we use Intl (DST-aware) instead of hard-coded UTC offsets.
// ---------------------------------------------------------------------------

export interface NyParts {
  /** New York calendar date, `YYYY-MM-DD`. */
  date: string;
  hour: number;
  minute: number;
  weekday: 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';
}

const nyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hourCycle: 'h23',
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const nyCache = new Map<number, NyParts>();

export function nyParts(unixSeconds: number): NyParts {
  const cached = nyCache.get(unixSeconds);
  if (cached) return cached;
  const parts = nyFormatter.formatToParts(new Date(unixSeconds * 1000));
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  const result: NyParts = {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: get('weekday') as NyParts['weekday'],
  };
  nyCache.set(unixSeconds, result);
  return result;
}

/** Adds whole days to a `YYYY-MM-DD` string. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The forex "trading day" rolls over at 17:00 New York. Returns its date label. */
export function tradingDayKey(unixSeconds: number): string {
  const p = nyParts(unixSeconds);
  return p.hour >= 17 ? addDays(p.date, 1) : p.date;
}

/** Forex is closed from Friday 17:00 to Sunday 17:00 New York time. */
export function isMarketOpen(unixSeconds: number): boolean {
  const p = nyParts(unixSeconds);
  if (p.weekday === 'Sat') return false;
  if (p.weekday === 'Fri' && p.hour >= 17) return false;
  if (p.weekday === 'Sun' && p.hour < 17) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Timestamps for candles reconstructed from a screenshot.
// ---------------------------------------------------------------------------

const isWeekendUtc = (unixSeconds: number): boolean => {
  const day = new Date(unixSeconds * 1000).getUTCDay();
  return day === 0 || day === 6;
};

/** Moves a user-supplied time onto the candle grid of the timeframe (and off closed hours). */
export function snapToCandleGrid(unixSeconds: number, timeframe: Timeframe): number {
  const step = TIMEFRAME_SECONDS[timeframe];
  let t = unixSeconds - (unixSeconds % step);
  if (timeframe === '1d') {
    while (isWeekendUtc(t)) t -= step;
  } else {
    while (!isMarketOpen(t)) t -= step;
  }
  return t;
}

/** Open time of the candle before the one opening at `unixSeconds`, skipping the weekend gap. */
export function previousCandleTime(unixSeconds: number, timeframe: Timeframe): number {
  const step = TIMEFRAME_SECONDS[timeframe];
  let t = unixSeconds - step;
  if (timeframe === '1d') {
    while (isWeekendUtc(t)) t -= step;
  } else {
    while (!isMarketOpen(t)) t -= step;
  }
  return t;
}

/**
 * Attaches index + timestamp to OHLC bars. Only the last candle's time is
 * known (entered by the user); earlier candles are counted backwards.
 */
export function assignTimes(bars: readonly OhlcBar[], timeframe: Timeframe, lastCandleTime: number): Candle[] {
  const times = new Array<number>(bars.length);
  let t = snapToCandleGrid(lastCandleTime, timeframe);
  for (let i = bars.length - 1; i >= 0; i--) {
    times[i] = t;
    t = previousCandleTime(t, timeframe);
  }
  return bars.map((bar, index) => ({ ...bar, index, time: times[index] }));
}
