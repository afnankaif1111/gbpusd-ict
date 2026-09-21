/** Environment-neutral pixel buffer (RGBA, row-major). Works in the browser and in Node tests. */
export interface RasterImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/** Pixel rectangle. `right` and `bottom` are exclusive. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const fullRect = (img: RasterImage): Rect => ({ left: 0, top: 0, right: img.width, bottom: img.height });

/**
 * Default area searched for candles: everything except the top strip (where
 * TradingView draws the OHLC legend) and the bottom strip (time axis).
 */
export function defaultPlotRegion(img: RasterImage): Rect {
  return { left: 0, top: Math.round(img.height * 0.07), right: img.width, bottom: Math.round(img.height * 0.93) };
}

/** Default strip read by OCR to find the price-axis labels (right edge of the chart). */
export function defaultAxisStrip(img: RasterImage): Rect {
  return { left: Math.round(img.width * 0.93), top: 0, right: img.width, bottom: Math.round(img.height * 0.93) };
}

export function clampRect(rect: Rect, img: RasterImage): Rect {
  const left = Math.max(0, Math.min(img.width, Math.round(rect.left)));
  const top = Math.max(0, Math.min(img.height, Math.round(rect.top)));
  const right = Math.max(left, Math.min(img.width, Math.round(rect.right)));
  const bottom = Math.max(top, Math.min(img.height, Math.round(rect.bottom)));
  return { left, top, right, bottom };
}
