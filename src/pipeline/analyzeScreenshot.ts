import { assignTimes } from '../core/market';
import { MIN_CANDLES, runIct } from '../ict/engine';
import type { IctAnalysis } from '../ict/annotations';
import type { Candle, Timeframe } from '../types';
import type { PixelClassifier } from '../vision/colors';
import { extractPixelCandles } from '../vision/extractCandles';
import { pixelCandlesToBars, type PriceAxis } from '../vision/priceAxis';
import { defaultPlotRegion, type RasterImage, type Rect } from '../vision/raster';
import { buildGeometry, type ChartGeometry } from './geometry';

export interface ScreenshotRequest {
  image: RasterImage;
  timeframe: Timeframe;
  /** Unix seconds (UTC) of the last (right-most) candle's open. */
  lastCandleTime: number;
  classifier: PixelClassifier;
  axis: PriceAxis;
  /** Area searched for candles. Defaults to the image minus the legend and time-axis strips. */
  region?: Rect;
}

export interface ScreenshotAnalysis {
  timeframe: Timeframe;
  candles: Candle[];
  analysis: IctAnalysis;
  geometry: ChartGeometry;
  warnings: string[];
}

/** GBPUSD has never traded outside this band; anything else means the axis was calibrated wrongly. */
const PLAUSIBLE_PRICE = { min: 0.8, max: 2.6 };

export class AnalysisError extends Error {}

/**
 * The whole vision + ICT pipeline for one screenshot:
 * pixels -> candles -> prices -> timestamps -> ICT annotations.
 */
export function analyzeScreenshot(request: ScreenshotRequest): ScreenshotAnalysis {
  const region = request.region ?? defaultPlotRegion(request.image);
  const extraction = extractPixelCandles(request.image, { classifier: request.classifier, region });
  const warnings = [...extraction.warnings];

  if (extraction.candles.length < MIN_CANDLES) {
    throw new AnalysisError(
      `Found ${extraction.candles.length} candles, need at least ${MIN_CANDLES}. ${warnings.join(' ')}`.trim(),
    );
  }

  const bars = pixelCandlesToBars(extraction.candles, request.axis);
  const outOfRange = bars.some((b) => b.high > PLAUSIBLE_PRICE.max || b.low < PLAUSIBLE_PRICE.min);
  if (outOfRange) {
    warnings.push('Some prices are outside the GBPUSD range. The price axis is probably calibrated wrongly.');
  }

  const candles = assignTimes(bars, request.timeframe, request.lastCandleTime);
  return {
    timeframe: request.timeframe,
    candles,
    analysis: runIct(candles, request.timeframe),
    geometry: buildGeometry(extraction, request.axis, request.image),
    warnings,
  };
}
