import type { Candle, Timeframe } from '../types';

const TIMEFRAME_MAP: Record<Timeframe, string> = {
  '1d': '1d',
  '1h': '1h',
  '15m': '15m',
  '5m': '5m',
};

export async function fetchBinanceKlines(
  symbol = 'BTCUSDT',
  timeframe: Timeframe = '15m',
  limit = 150,
): Promise<Candle[]> {
  const cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const interval = TIMEFRAME_MAP[timeframe];
  const query = `symbol=${encodeURIComponent(cleanSymbol)}&interval=${interval}&limit=${Math.min(limit, 1000)}`;

  // Try dev server proxy first, then fallback to direct endpoint (Binance has CORS enabled)
  const urls = [
    `/api/binance/api/v3/klines?${query}`,
    `https://api.binance.com/api/v3/klines?${query}`,
  ];

  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Binance HTTP ${res.status}: ${text || res.statusText}`);
      }
      const rawData = (await res.json()) as Array<[number, string, string, string, string, ...unknown[]]>;
      if (!Array.isArray(rawData) || rawData.length === 0) {
        throw new Error(`No candle data returned from Binance for ${cleanSymbol}`);
      }

      return rawData.map((kline, index) => ({
        index,
        time: Math.floor(kline[0] / 1000),
        open: Number.parseFloat(kline[1]),
        high: Number.parseFloat(kline[2]),
        low: Number.parseFloat(kline[3]),
        close: Number.parseFloat(kline[4]),
      }));
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error(`Failed to fetch Binance klines for ${cleanSymbol}`);
}
