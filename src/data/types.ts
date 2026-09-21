import type { Candle, Timeframe } from '../types';

export type DataSourceType = 'yahoo' | 'binance' | 'sample' | 'csv';

export interface MarketSymbolPreset {
  id: string;
  name: string;
  symbol: string;
  source: DataSourceType;
}

export const PRESET_SYMBOLS: readonly MarketSymbolPreset[] = [
  { id: 'gbpusd-sample', name: 'GBP/USD (Sample ICT)', symbol: 'GBPUSD', source: 'sample' },
  { id: 'gbpusd-live', name: 'GBP/USD (Forex Live)', symbol: 'GBPUSD=X', source: 'yahoo' },
  { id: 'eurusd-live', name: 'EUR/USD (Forex Live)', symbol: 'EURUSD=X', source: 'yahoo' },
  { id: 'btcusdt-live', name: 'BTC/USDT (Crypto Live)', symbol: 'BTCUSDT', source: 'binance' },
  { id: 'ethusdt-live', name: 'ETH/USDT (Crypto Live)', symbol: 'ETHUSDT', source: 'binance' },
];

export interface DataFetchRequest {
  source: DataSourceType;
  symbol: string;
  timeframe: Timeframe;
  limit?: number;
}

export interface DataFetchResult {
  symbol: string;
  timeframe: Timeframe;
  source: DataSourceType;
  candles: Candle[];
  fetchedAt: number;
}
