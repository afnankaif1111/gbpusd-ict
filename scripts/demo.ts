/**
 * Renders a synthetic GBPUSD chart, runs the full pipeline on the *image*, and
 * writes the annotated result to demo-output/annotated.png.
 * Lets you see the engine working without taking a screenshot: `npm run demo`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { analyzeScreenshot } from '../src/pipeline/analyzeScreenshot';
import { DEFAULT_LAYERS } from '../src/render/layers';
import { renderOverlay } from '../src/render/overlay';
import { hueClassifier } from '../src/vision/colors';
import { randomWalkBars } from '../tests/helpers/candles';
import { renderChart } from '../tests/helpers/syntheticChart';

const chart = renderChart({ bars: randomWalkBars(150, 21), width: 1500, height: 900, pitch: 8.6, bodyWidth: 5 });
const result = analyzeScreenshot({
  image: chart.image,
  timeframe: '15m',
  lastCandleTime: Date.UTC(2026, 8, 18, 14, 0) / 1000,
  classifier: hueClassifier(),
  axis: chart.axis,
});

const canvas = createCanvas(chart.image.width, chart.image.height);
const ctx = canvas.getContext('2d');
ctx.putImageData(ctx.createImageData(chart.image.data, chart.image.width, chart.image.height), 0, 0);
renderOverlay({
  ctx: ctx as unknown as CanvasRenderingContext2D,
  geometry: result.geometry,
  analysis: result.analysis,
  layers: { ...DEFAULT_LAYERS, swings: true },
  projected: [],
  showResolved: false,
});

mkdirSync('demo-output', { recursive: true });
writeFileSync('demo-output/annotated.png', canvas.toBuffer('image/png'));
const a = result.analysis;
console.log(
  `${result.candles.length} candles | ${a.structure.length} structure breaks | ${a.fvgs.length} FVGs | ${a.orderBlocks.length} order blocks | ${a.pools.length} liquidity pools | ${a.sweeps.length} sweeps`,
);
console.log('Wrote demo-output/annotated.png');
