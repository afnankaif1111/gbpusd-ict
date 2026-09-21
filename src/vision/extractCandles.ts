import { median, mode } from '../core/math';
import { findComponents, MASK_DOWN, MASK_NONE, MASK_UP, type Component } from './components';
import type { CandleClass, PixelClassifier } from './colors';
import { clampRect, type RasterImage, type Rect } from './raster';

/**
 * A candle located in the screenshot. All y values are pixel *edges*
 * (row indices), so a 1px-tall body at row 10 spans y 10..11.
 */
export interface PixelCandle {
  cls: CandleClass;
  /** Horizontal centre of the candle in pixels. */
  xCenter: number;
  xLeft: number;
  xRight: number;
  yHigh: number;
  yLow: number;
  yBodyTop: number;
  yBodyBottom: number;
}

export interface PixelExtraction {
  candles: PixelCandle[];
  /** Horizontal distance between neighbouring candles, in pixels. */
  pitch: number;
  /** Width of a candle body in pixels. */
  bodyWidth: number;
  region: Rect;
  warnings: string[];
}

export interface ExtractOptions {
  classifier: PixelClassifier;
  region: Rect;
}

/** Bodies narrower than this cannot be told apart from wicks. */
const MIN_BODY_WIDTH = 3;

const EMPTY = (region: Rect, warning: string): PixelExtraction => ({
  candles: [],
  pitch: 0,
  bodyWidth: 0,
  region,
  warnings: [warning],
});

/**
 * Finds every candle of a TradingView screenshot.
 *
 *  1. Colour every pixel as up / down / other.
 *  2. Group touching pixels into blobs (a candle = body + wick = one blob).
 *  3. Keep only blobs that look like candles: same body width as the majority
 *     and evenly spaced. This drops legend text, price tags and stray shapes.
 *  4. Read high/low from the blob's vertical extent and open/close from its
 *     widest rows (the body).
 */
export function extractPixelCandles(img: RasterImage, options: ExtractOptions): PixelExtraction {
  const region = clampRect(options.region, img);
  const mask = buildMask(img, options.classifier, region);
  const components = findComponents(mask, img.width, region);
  if (components.length === 0) {
    return EMPTY(region, 'No candle-coloured pixels found. Check the candle colours and the search region.');
  }

  const shapes = components.map((component) => ({ component, bodyWidth: Math.max(...component.rowWidths) }));
  const bodyWidth = mode(shapes.map((s) => s.bodyWidth));
  if (bodyWidth < MIN_BODY_WIDTH) {
    return EMPTY(
      region,
      `Candles are only ${bodyWidth}px wide. Zoom the chart in or use a higher-resolution screenshot (bodies need at least ${MIN_BODY_WIDTH}px).`,
    );
  }

  const candidates = shapes
    .filter((s) => Math.abs(s.bodyWidth - bodyWidth) <= 1)
    .map((s) => ({ ...s, x: (s.component.x0 + s.component.x1 + 1) / 2 }))
    .sort((a, b) => a.x - b.x);

  const pitch = estimatePitch(candidates.map((c) => c.x));
  if (pitch === null) return EMPTY(region, 'Could not measure the spacing between candles.');

  const chain = longestChain(candidates, pitch);
  const warnings: string[] = [];
  const ignored = components.length - chain.length;
  if (ignored > 0) {
    warnings.push(`${ignored} coloured shape(s) were ignored (legend text, price tag or irregular shapes).`);
  }
  const skippedCandidates = candidates.length - chain.length;
  if (skippedCandidates > 0) {
    warnings.push(
      `${skippedCandidates} candle-like shape(s) did not fit the regular spacing. If candles are missing, turn off the last-price line and crop out overlays.`,
    );
  }
  if (chain.length < 20) warnings.push(`Only ${chain.length} candles detected. Results will be unreliable.`);

  return {
    candles: chain.map((item) => toPixelCandle(item.component, bodyWidth)),
    pitch,
    bodyWidth,
    region,
    warnings,
  };
}

function buildMask(img: RasterImage, classify: PixelClassifier, region: Rect): Uint8Array {
  const mask = new Uint8Array(img.width * img.height);
  const { data, width } = img;
  for (let y = region.top; y < region.bottom; y++) {
    for (let x = region.left; x < region.right; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 200) continue;
      const cls = classify(data[i], data[i + 1], data[i + 2]);
      if (cls === 'up') mask[y * width + x] = MASK_UP;
      else if (cls === 'down') mask[y * width + x] = MASK_DOWN;
      else mask[y * width + x] = MASK_NONE;
    }
  }
  return mask;
}

/** Typical centre-to-centre distance of neighbouring candles, or null if it cannot be measured. */
function estimatePitch(sortedCenters: readonly number[]): number | null {
  const gaps: number[] = [];
  for (let i = 1; i < sortedCenters.length; i++) {
    const gap = sortedCenters[i] - sortedCenters[i - 1];
    if (gap >= 2 && gap <= 80) gaps.push(gap);
  }
  if (gaps.length === 0) return null;
  const coarse = mode(gaps.map(Math.round));
  const close = gaps.filter((g) => Math.abs(g - coarse) <= 1.5);
  return close.length > 0 ? median(close) : coarse;
}

interface Candidate {
  component: Component;
  x: number;
}

/** The longest run of blobs whose consecutive x distance equals the pitch: the real candles. */
function longestChain(sorted: readonly Candidate[], pitch: number): Candidate[] {
  const tolerance = Math.max(1.5, pitch * 0.25);
  const length = new Array<number>(sorted.length).fill(1);
  const previous = new Array<number>(sorted.length).fill(-1);

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i - 1; j >= 0; j--) {
      const gap = sorted[i].x - sorted[j].x;
      if (gap > pitch + tolerance) break;
      if (gap < pitch - tolerance) continue;
      if (length[j] + 1 > length[i]) {
        length[i] = length[j] + 1;
        previous[i] = j;
      }
    }
  }

  let end = 0;
  for (let i = 1; i < sorted.length; i++) if (length[i] > length[end]) end = i;

  const chain: Candidate[] = [];
  for (let i = end; i >= 0; i = previous[i]) chain.push(sorted[i]);
  return chain.reverse();
}

function toPixelCandle(component: Component, bodyWidth: number): PixelCandle {
  // Body rows are (nearly) as wide as the body; wick rows are 1-2px wide.
  const threshold = Math.max(2, bodyWidth - 1);
  let first = -1;
  let last = -1;
  component.rowWidths.forEach((width, row) => {
    if (width < threshold) return;
    if (first < 0) first = row;
    last = row;
  });
  if (first < 0) {
    first = 0;
    last = component.rowWidths.length - 1;
  }

  return {
    cls: component.cls,
    xCenter: (component.x0 + component.x1 + 1) / 2,
    xLeft: component.x0,
    xRight: component.x1 + 1,
    yHigh: component.y0,
    yLow: component.y1 + 1,
    yBodyTop: component.y0 + first,
    yBodyBottom: component.y0 + last + 1,
  };
}
