import { describe, expect, it } from 'vitest';
import { assignTimes } from '../src/core/market';
import { runIct } from '../src/ict/engine';
import { analyzeScreenshot, AnalysisError } from '../src/pipeline/analyzeScreenshot';
import { computeBias } from '../src/mtf/bias';
import { findConfluence } from '../src/mtf/confluence';
import { projectHigherTimeframeZones } from '../src/mtf/zones';
import { hueClassifier } from '../src/vision/colors';
import { randomWalkBars } from './helpers/candles';
import { renderChart } from './helpers/syntheticChart';

const LAST_CANDLE = Date.UTC(2026, 8, 18, 14, 0) / 1000; // Friday 14:00 UTC

describe('screenshot -> candles -> ICT annotations', () => {
  const bars = randomWalkBars(150, 11);
  const chart = renderChart({ bars });
  const result = analyzeScreenshot({
    image: chart.image,
    timeframe: '15m',
    lastCandleTime: LAST_CANDLE,
    classifier: hueClassifier(),
    axis: chart.axis,
  });

  it('reconstructs all candles with correct timestamps', () => {
    expect(result.candles).toHaveLength(150);
    expect(result.candles[149].time).toBe(LAST_CANDLE);
    expect(result.candles[148].time).toBe(LAST_CANDLE - 900);
  });

  it('finds essentially the same fair value gaps as the engine finds on the original data', () => {
    const truth = runIct(assignTimes(bars, '15m', LAST_CANDLE), '15m');
    const found = new Set(result.analysis.fvgs.map((g) => g.startIndex));
    const expected = truth.fvgs.map((g) => g.startIndex);
    const shared = expected.filter((i) => found.has(i)).length;
    expect(shared / expected.length).toBeGreaterThanOrEqual(0.8);
  });

  it('finds essentially the same swing structure', () => {
    const truth = runIct(assignTimes(bars, '15m', LAST_CANDLE), '15m');
    const found = new Set(result.analysis.swings.map((s) => `${s.type}${s.index}`));
    const expected = truth.swings.map((s) => `${s.type}${s.index}`);
    const shared = expected.filter((k) => found.has(k)).length;
    expect(shared / expected.length).toBeGreaterThanOrEqual(0.85);
  });

  it('maps annotations back onto the screenshot with the same geometry it read the candles from', () => {
    const { geometry, candles } = result;
    const last = candles[candles.length - 1];
    expect(Math.abs(geometry.yOf(last.close) - chart.axis.yAt(bars[149].close))).toBeLessThan(1.6);
    expect(geometry.xOf(149)).toBeGreaterThan(geometry.xOf(0));
    expect(geometry.drawRight).toBeGreaterThan(geometry.xOf(149));
  });

  it('refuses to analyse an image without candles', () => {
    const blank = { ...chart.image, data: new Uint8ClampedArray(chart.image.data.length).fill(20) };
    expect(() =>
      analyzeScreenshot({ image: blank, timeframe: '15m', lastCandleTime: LAST_CANDLE, classifier: hueClassifier(), axis: chart.axis }),
    ).toThrow(AnalysisError);
  });
});

describe('multi-timeframe layer', () => {
  const analyse = (timeframe: '1d' | '1h' | '15m', seed: number) => {
    const candles = assignTimes(randomWalkBars(150, seed), timeframe, LAST_CANDLE);
    return runIct(candles, timeframe);
  };
  const set = { '1d': analyse('1d', 3), '1h': analyse('1h', 4), '15m': analyse('15m', 5) } as const;

  it('derives a bias, projects higher-timeframe zones and scores lower-timeframe zones', () => {
    const bias = computeBias(set);
    expect(['strong', 'partial', 'conflict']).toContain(bias.strength);

    const projected = projectHigherTimeframeZones(set);
    expect(projected.every((z) => z.source === '1d' || z.source === '1h')).toBe(true);

    const zones = findConfluence(set, bias, projected);
    expect(zones.length).toBeLessThanOrEqual(10);
    expect([...zones].sort((a, b) => b.score - a.score)).toEqual(zones);
    expect(zones.every((z) => z.timeframe !== '1d')).toBe(true);
  });

  it('reports no bias when nothing is analysed', () => {
    expect(computeBias({})).toMatchObject({ direction: 'neutral', strength: 'none', location: null });
  });

  it('marks a conflict when the daily and hourly trends disagree', () => {
    const bullish = { ...set['1d'], trend: 'bullish' as const };
    const bearish = { ...set['1h'], trend: 'bearish' as const };
    expect(computeBias({ '1d': bullish, '1h': bearish })).toMatchObject({ direction: 'neutral', strength: 'conflict' });
    expect(computeBias({ '1d': bullish, '1h': { ...bearish, trend: 'bullish' } })).toMatchObject({ direction: 'bullish', strength: 'strong' });
  });
});
