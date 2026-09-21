import { TIMEFRAMES, type Candle, type Timeframe } from '../types';
import { fetchBinanceKlines } from './binance';
import { generateIctSampleCandles } from './sampleData';
import type { DataFetchRequest } from './types';
import { fetchYahooChart } from './yahoo';

export async function fetchMarketData(request: DataFetchRequest): Promise<Candle[]> {
  const { source, symbol, timeframe, limit } = request;

  switch (source) {
    case 'binance':
      return await fetchBinanceKlines(symbol, timeframe, limit);
    case 'yahoo':
      return await fetchYahooChart(symbol, timeframe);
    case 'sample':
      return generateIctSampleCandles(timeframe, limit ?? 120);
    case 'csv':
      throw new Error('CSV data must be imported through the file uploader.');
    default:
      throw new Error(`Unknown data source: ${String(source)}`);
  }
}

export interface MultiTimeframeDataResult {
  results: Partial<Record<Timeframe, Candle[]>>;
  errors: Partial<Record<Timeframe, string>>;
}

export async function fetchAllTimeframes(
  source: DataFetchRequest['source'],
  symbol: string,
): Promise<MultiTimeframeDataResult> {
  const results: Partial<Record<Timeframe, Candle[]>> = {};
  const errors: Partial<Record<Timeframe, string>> = {};

  const promises = TIMEFRAMES.map(async (tf) => {
    try {
      const candles = await fetchMarketData({ source, symbol, timeframe: tf });
      results[tf] = candles;
    } catch (err) {
      errors[tf] = err instanceof Error ? err.message : String(err);
    }
  });

  await Promise.all(promises);
  return { results, errors };
}
