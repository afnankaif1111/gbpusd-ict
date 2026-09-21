import type { Candle } from '../types';

/** CSV with an ISO-8601 UTC timestamp, one candle per line, oldest first. */
export function candlesToCsv(candles: readonly Candle[]): string {
  const rows = candles.map((c) =>
    [new Date(c.time * 1000).toISOString(), c.open, c.high, c.low, c.close].map((v) => (typeof v === 'number' ? v.toFixed(5) : v)).join(','),
  );
  return ['time,open,high,low,close', ...rows].join('\n');
}

export function candlesToJson(candles: readonly Candle[]): string {
  return JSON.stringify(
    candles.map((c) => ({ time: new Date(c.time * 1000).toISOString(), open: c.open, high: c.high, low: c.low, close: c.close })),
    null,
    2,
  );
}

/** Triggers a browser download. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
