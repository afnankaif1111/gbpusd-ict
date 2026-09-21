import { describe, expect, it } from 'vitest';
import { hueClassifier, paletteClassifier, parseHexColor } from '../../src/vision/colors';
import { extractPixelCandles } from '../../src/vision/extractCandles';
import { pixelCandlesToBars } from '../../src/vision/priceAxis';
import { defaultPlotRegion, fullRect } from '../../src/vision/raster';
import { randomWalkBars } from '../helpers/candles';
import { renderChart, type ChartSpec } from '../helpers/syntheticChart';

/** Extracts a synthetic chart and returns per-candle errors in *pixels* (the natural unit for image accuracy). */
function measure(spec: ChartSpec, options: { classifier?: ReturnType<typeof hueClassifier>; fullImage?: boolean } = {}) {
  const chart = renderChart(spec);
  const extraction = extractPixelCandles(chart.image, {
    classifier: options.classifier ?? hueClassifier(),
    region: options.fullImage ? fullRect(chart.image) : defaultPlotRegion(chart.image),
  });
  const bars = pixelCandlesToBars(extraction.candles, chart.axis);
  const pxPerPrice = 1 / Math.abs(chart.axis.slope);
  const worst = { wick: 0, body: 0 };
  let colourMismatches = 0;

  bars.forEach((bar, i) => {
    const truth = spec.bars[i];
    if (!truth) return;
    worst.wick = Math.max(worst.wick, Math.abs(bar.high - truth.high) * pxPerPrice, Math.abs(bar.low - truth.low) * pxPerPrice);
    worst.body = Math.max(worst.body, Math.abs(bar.open - truth.open) * pxPerPrice, Math.abs(bar.close - truth.close) * pxPerPrice);
    if ((extraction.candles[i].cls === 'up') !== truth.close >= truth.open) colourMismatches++;
  });
  return { extraction, worst, colourMismatches, count: bars.length };
}

describe('candle extraction from synthetic TradingView-style charts', () => {
  const bars = randomWalkBars(150, 7);

  it('recovers every candle with sub-pixel-rounding accuracy (dark theme)', () => {
    const { count, worst, colourMismatches } = measure({ bars });
    expect(count).toBe(150);
    expect(colourMismatches).toBe(0);
    expect(worst.wick).toBeLessThanOrEqual(0.51); // high/low: only rounding error
    expect(worst.body).toBeLessThanOrEqual(1.51); // open/close: rounding + 1px minimum body
  });

  it('works on the light theme', () => {
    const { count, worst } = measure({ bars, theme: 'light' });
    expect(count).toBe(150);
    expect(worst.wick).toBeLessThanOrEqual(0.51);
  });

  it('works on the older TradingView palette', () => {
    const { count } = measure({ bars, upColor: '#26a69a', downColor: '#ef5350' });
    expect(count).toBe(150);
  });

  it('works on a 2x (retina) screenshot with thick wicks', () => {
    const { count, worst } = measure({ bars, width: 2800, height: 1800, bodyWidth: 11, wickWidth: 2, pitch: 14.8, firstX: 60 });
    expect(count).toBe(150);
    expect(worst.wick).toBeLessThanOrEqual(0.51);
  });

  it('supports custom candle colours through the palette classifier', () => {
    const up = '#2962ff';
    const down = '#ffffff';
    const classifier = paletteClassifier(parseHexColor(up), parseHexColor(down), 30);
    const { count, colourMismatches } = measure({ bars, upColor: up, downColor: down, theme: 'dark' }, { classifier });
    expect(count).toBe(150);
    expect(colourMismatches).toBe(0);
  });

  it('ignores the coloured price tag on the axis', () => {
    const { count } = measure({ bars, priceTag: true });
    expect(count).toBe(150);
  });

  it('ignores legend-like text even when it is inside the search region', () => {
    const { count } = measure({ bars, legend: true }, { fullImage: true });
    expect(count).toBe(150);
  });

  it('warns instead of guessing when candles are too thin', () => {
    const chart = renderChart({ bars, bodyWidth: 1, pitch: 3 });
    const extraction = extractPixelCandles(chart.image, { classifier: hueClassifier(), region: defaultPlotRegion(chart.image) });
    expect(extraction.candles).toHaveLength(0);
    expect(extraction.warnings[0]).toMatch(/wide/);
  });

  it('reports an empty chart clearly', () => {
    const chart = renderChart({ bars: randomWalkBars(20, 3) });
    const blank = { ...chart.image, data: new Uint8ClampedArray(chart.image.data.length).fill(20) };
    const extraction = extractPixelCandles(blank, { classifier: hueClassifier(), region: fullRect(blank) });
    expect(extraction.candles).toHaveLength(0);
    expect(extraction.warnings[0]).toMatch(/No candle-coloured pixels/);
  });
});
