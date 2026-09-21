import type { PixelExtraction } from '../vision/extractCandles';
import type { PriceAxis } from '../vision/priceAxis';
import type { RasterImage } from '../vision/raster';

export interface CandleBox {
  xLeft: number;
  xRight: number;
  yHigh: number;
  yLow: number;
}

/** Maps candle indices and prices back to screenshot pixels so annotations can be drawn on the image. */
export interface ChartGeometry {
  xOf(index: number): number;
  yOf(price: number): number;
  /** Distance between neighbouring candles in pixels. */
  pitch: number;
  plotLeft: number;
  plotTop: number;
  plotBottom: number;
  /** Right edge that zones and lines extend to: a few candles past the last one. */
  drawRight: number;
  /** Suggested label size, scaled to the screenshot resolution. */
  fontPx: number;
  /** Where each candle was found (used by the "extracted candles" debug layer). */
  candleBoxes: CandleBox[];
}

/** How many candle widths zones extend past the last candle. */
const EXTENSION_BARS = 8;

export function buildGeometry(extraction: PixelExtraction, axis: PriceAxis, image: RasterImage): ChartGeometry {
  const xs = extraction.candles.map((c) => c.xCenter);
  const { pitch, region } = extraction;
  const first = xs[0];
  const last = xs[xs.length - 1];

  return {
    xOf: (index) => {
      if (index < 0) return first + index * pitch;
      if (index >= xs.length) return last + (index - xs.length + 1) * pitch;
      return xs[index];
    },
    yOf: (price) => axis.yAt(price),
    pitch,
    plotLeft: region.left,
    plotTop: region.top,
    plotBottom: region.bottom,
    drawRight: Math.min(region.right, last + EXTENSION_BARS * pitch),
    fontPx: Math.max(10, Math.round(image.width / 120)),
    candleBoxes: extraction.candles.map((c) => ({ xLeft: c.xLeft, xRight: c.xRight, yHigh: c.yHigh, yLow: c.yLow })),
  };
}
