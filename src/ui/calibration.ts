import { axisFromTwoPoints, fitPriceAxis, type AxisLabel, type PriceAxis } from '../vision/priceAxis';

/** A point the user clicked on the screenshot, with the price they typed for it. */
export interface ManualPoint {
  y: number;
  price: string;
}

export interface AxisResolution {
  axis: PriceAxis | null;
  /** Human-readable description of where the axis came from, or why there is none. */
  note: string;
}

/**
 * Manual calibration wins when both clicked points have a valid price;
 * otherwise the OCR labels are fitted with RANSAC.
 */
export function resolveAxis(ocrLabels: readonly AxisLabel[], manual: readonly ManualPoint[]): AxisResolution {
  const points = manual.map((p) => ({ y: p.y, price: Number(p.price) })).filter((p) => Number.isFinite(p.price) && p.price > 0);
  try {
    if (points.length >= 2) {
      return { axis: axisFromTwoPoints(points[0], points[1]), note: 'Manual calibration from 2 clicked points.' };
    }
    if (ocrLabels.length >= 2) {
      const fit = fitPriceAxis(ocrLabels);
      return {
        axis: fit.axis,
        note: `OCR calibration: ${fit.inliers.length} of ${ocrLabels.length} labels agree (RMS error ${fit.rmsPixels.toFixed(2)}px).`,
      };
    }
  } catch (error) {
    return { axis: null, note: error instanceof Error ? error.message : String(error) };
  }
  return { axis: null, note: 'Not calibrated yet. Read the price axis (OCR) or click two points on the chart.' };
}
