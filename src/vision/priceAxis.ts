import { leastSquares } from '../core/math';
import type { OhlcBar } from '../types';
import type { PixelCandle } from './extractCandles';

/** A price label read from the axis: the pixel row of its centre and its value. */
export interface AxisLabel {
  y: number;
  price: number;
}

/** Linear mapping between screenshot pixel rows and prices. */
export interface PriceAxis {
  priceAt(y: number): number;
  yAt(price: number): number;
  /** Prices are considered linear; `slope` is price change per pixel row (negative: up is higher). */
  slope: number;
  intercept: number;
}

export interface AxisFit {
  axis: PriceAxis;
  inliers: AxisLabel[];
  /** Root-mean-square residual of the inliers, in pixels. */
  rmsPixels: number;
}

export class CalibrationError extends Error {}

export function makeAxis(slope: number, intercept: number): PriceAxis {
  return {
    slope,
    intercept,
    priceAt: (y) => slope * y + intercept,
    yAt: (price) => (price - intercept) / slope,
  };
}

/** Manual calibration from two clicked points with known prices. */
export function axisFromTwoPoints(a: AxisLabel, b: AxisLabel): PriceAxis {
  if (a.y === b.y) throw new CalibrationError('The two calibration points are on the same pixel row.');
  const slope = (b.price - a.price) / (b.y - a.y);
  if (slope >= 0) {
    throw new CalibrationError('The upper point must have the higher price. Check the two prices you typed.');
  }
  return makeAxis(slope, a.price - slope * a.y);
}

/** Accepts `1.34250`-style labels only. OCR noise is rejected here. */
export function parsePriceLabel(text: string): number | null {
  const cleaned = text.trim().replace(/,/g, '.');
  return /^\d{1,2}\.\d{3,5}$/.test(cleaned) ? Number(cleaned) : null;
}

/**
 * Fits price = slope * y + intercept to noisy OCR labels.
 * RANSAC over every pair of labels: the line supported by the most labels wins,
 * then it is refined with least squares on those labels. Misread labels
 * (outliers) never influence the result.
 */
export function fitPriceAxis(labels: readonly AxisLabel[], tolerancePixels = 2): AxisFit {
  if (labels.length < 2) {
    throw new CalibrationError('Need at least two readable price labels. Use manual calibration instead.');
  }

  let best: { inliers: AxisLabel[]; slope: number; intercept: number } | null = null;
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i];
      const b = labels[j];
      if (a.y === b.y) continue;
      const slope = (b.price - a.price) / (b.y - a.y);
      if (slope >= 0) continue;
      const intercept = a.price - slope * a.y;
      const inliers = labels.filter((l) => Math.abs((l.price - intercept) / slope - l.y) <= tolerancePixels);
      if (!best || inliers.length > best.inliers.length) best = { inliers, slope, intercept };
    }
  }

  const required = labels.length === 2 ? 2 : 3;
  if (!best || best.inliers.length < required) {
    throw new CalibrationError('The price labels do not line up. Use manual calibration instead.');
  }

  // Refine on the inliers (regress y on price so pixel error is minimised).
  const refit = leastSquares(best.inliers.map((l) => ({ x: l.price, y: l.y })));
  const slope = refit ? 1 / refit.slope : best.slope;
  const intercept = refit ? -refit.intercept / refit.slope : best.intercept;
  const axis = makeAxis(slope, intercept);
  const squared = best.inliers.reduce((sum, l) => sum + (axis.yAt(l.price) - l.y) ** 2, 0);
  return { axis, inliers: best.inliers, rmsPixels: Math.sqrt(squared / best.inliers.length) };
}

/** Converts pixel geometry into prices using the calibrated axis. */
export function pixelCandlesToBars(candles: readonly PixelCandle[], axis: PriceAxis): OhlcBar[] {
  return candles.map((c) => {
    const top = axis.priceAt(c.yBodyTop);
    const bottom = axis.priceAt(c.yBodyBottom);
    const open = c.cls === 'up' ? bottom : top;
    const close = c.cls === 'up' ? top : bottom;
    return {
      open,
      close,
      high: Math.max(axis.priceAt(c.yHigh), open, close),
      low: Math.min(axis.priceAt(c.yLow), open, close),
    };
  });
}
