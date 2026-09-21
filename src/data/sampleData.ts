import { TIMEFRAME_SECONDS } from '../core/market';
import type { Candle, OhlcBar, Timeframe } from '../types';

function createRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates realistic GBPUSD multi-timeframe data with ICT characteristics:
 * - Liquidity pools and sweeps
 * - Impulsive displacement moves forming Fair Value Gaps (FVG)
 * - Order blocks before structure breaks (BOS/CHoCH)
 * - Dealing range with Premium and Discount pricing
 */
export function generateIctSampleCandles(timeframe: Timeframe, count = 120): Candle[] {
  const seedMap: Record<Timeframe, number> = {
    '1d': 101,
    '1h': 202,
    '15m': 303,
    '5m': 404,
  };

  const rand = createRng(seedMap[timeframe]);
  const step = TIMEFRAME_SECONDS[timeframe];
  // Monday 2026-09-14 00:00 UTC
  const startTime = Date.UTC(2026, 8, 14, 0, 0) / 1000 - count * step;

  const basePrice = 1.332;
  let currentPrice = basePrice;
  const bars: OhlcBar[] = [];

  for (let i = 0; i < count; i++) {
    const cycle = (i % 28) / 28;
    const isDisplacement = i === 25 || i === 48 || i === 72 || i === 95;
    const isSweep = i === 35 || i === 65 || i === 85;

    let delta: number;
    if (isDisplacement) {
      // Strong 30-40 pip expansion candle creating FVG
      delta = (i % 2 === 0 ? 1 : -1) * (0.003 + rand() * 0.0015);
    } else if (isSweep) {
      // Sweep candle with long wick
      delta = (rand() - 0.5) * 0.0006;
    } else {
      // Standard oscillation with trend wave
      const wave = Math.sin(cycle * Math.PI * 2) * 0.0004;
      delta = wave + (rand() - 0.5) * 0.0008;
    }

    const open = currentPrice;
    const close = open + delta;
    const wickHigh = isSweep && i % 2 === 0 ? 0.0018 : rand() * 0.0005;
    const wickLow = isSweep && i % 2 !== 0 ? 0.0018 : rand() * 0.0005;

    const high = Math.max(open, close) + wickHigh;
    const low = Math.min(open, close) - wickLow;

    bars.push({
      open: Number(open.toFixed(5)),
      high: Number(high.toFixed(5)),
      low: Number(low.toFixed(5)),
      close: Number(close.toFixed(5)),
    });

    currentPrice = close;
  }

  return bars.map((bar, index) => ({
    ...bar,
    index,
    time: startTime + index * step,
  }));
}
