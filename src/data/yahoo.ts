import type { Candle, Timeframe } from '../types';

interface YahooParams {
  interval: string;
  range: string;
}

const YAHOO_TIMEFRAME_MAP: Record<Timeframe, YahooParams> = {
  '1d': { interval: '1d', range: '6mo' },
  '1h': { interval: '60m', range: '1mo' },
  '15m': { interval: '15m', range: '5d' },
  '5m': { interval: '5m', range: '2d' },
};

interface YahooResponse {
  chart?: {
    result?: Array<{
      meta?: { symbol?: string; regularMarketPrice?: number };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
        }>;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
}

export async function fetchYahooChart(
  symbol = 'GBPUSD=X',
  timeframe: Timeframe = '15m',
): Promise<Candle[]> {
  const { interval, range } = YAHOO_TIMEFRAME_MAP[timeframe];
  const query = `interval=${interval}&range=${range}&includePrePost=false`;

  // Dev proxy first, direct fallback second
  const urls = [
    `/api/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`,
  ];

  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Yahoo Finance HTTP ${res.status}: ${res.statusText}`);
      }

      const json = (await res.json()) as YahooResponse;
      if (json.chart?.error) {
        throw new Error(`Yahoo error: ${json.chart.error.description ?? json.chart.error.code}`);
      }

      const result = json.chart?.result?.[0];
      const timestamps = result?.timestamp;
      const quote = result?.indicators?.quote?.[0];

      if (!timestamps || !quote || !quote.open || !quote.high || !quote.low || !quote.close) {
        throw new Error(`Incomplete chart payload returned from Yahoo Finance for ${symbol}`);
      }

      const candles: Candle[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const time = timestamps[i];
        const open = quote.open[i];
        const high = quote.high[i];
        const low = quote.low[i];
        const close = quote.close[i];

        // Discard candles with missing or null prices
        if (
          typeof time === 'number' &&
          typeof open === 'number' &&
          typeof high === 'number' &&
          typeof low === 'number' &&
          typeof close === 'number' &&
          !Number.isNaN(open) &&
          !Number.isNaN(high) &&
          !Number.isNaN(low) &&
          !Number.isNaN(close)
        ) {
          candles.push({
            index: candles.length,
            time,
            open,
            high,
            low,
            close,
          });
        }
      }

      if (candles.length === 0) {
        throw new Error(`No valid candle points extracted for ${symbol}`);
      }

      return candles;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error(`Failed to fetch Yahoo Finance data for ${symbol}`);
}
