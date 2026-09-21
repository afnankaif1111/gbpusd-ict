import { createCanvas } from '@napi-rs/canvas';
import type { OhlcBar } from '../../src/types';
import { makeAxis, type PriceAxis } from '../../src/vision/priceAxis';
import type { RasterImage } from '../../src/vision/raster';

export interface ChartSpec {
  bars: readonly OhlcBar[];
  width?: number;
  height?: number;
  bodyWidth?: number;
  wickWidth?: number;
  pitch?: number;
  firstX?: number;
  theme?: 'dark' | 'light';
  upColor?: string;
  downColor?: string;
  /** Draw text-like coloured shapes in the top-left corner, like TradingView's OHLC legend. */
  legend?: boolean;
  /** Draw the coloured last-price tag on the right axis. */
  priceTag?: boolean;
}

export interface RenderedChart {
  image: RasterImage;
  /** The exact axis used to draw, i.e. the ground truth for calibration. */
  axis: PriceAxis;
  plotTop: number;
  plotBottom: number;
}

/** Renders a TradingView-style candlestick chart from known OHLC data, with crisp 1px-aligned geometry. */
export function renderChart(spec: ChartSpec): RenderedChart {
  const width = spec.width ?? 1400;
  const height = spec.height ?? 1400;
  const bodyWidth = spec.bodyWidth ?? 5;
  const wickWidth = spec.wickWidth ?? 1;
  const pitch = spec.pitch ?? 7.4;
  const firstX = spec.firstX ?? 30;
  const dark = (spec.theme ?? 'dark') === 'dark';
  const upColor = spec.upColor ?? '#089981';
  const downColor = spec.downColor ?? '#F23645';

  const plotTop = Math.round(height * 0.12);
  const plotBottom = Math.round(height * 0.88);
  const priceMax = Math.max(...spec.bars.map((b) => b.high));
  const priceMin = Math.min(...spec.bars.map((b) => b.low));
  const slope = -(priceMax - priceMin) / (plotBottom - plotTop);
  const axis = makeAxis(slope, priceMax - slope * plotTop);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = dark ? '#131722' : '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = dark ? '#2a2e39' : '#e0e3eb';
  for (let y = plotTop; y < plotBottom; y += Math.round(height / 12)) ctx.fillRect(0, y, width - 70, 1);

  spec.bars.forEach((bar, k) => {
    const xc = Math.round(firstX + k * pitch);
    const rows = (price: number): number => Math.round(axis.yAt(price));
    const yHigh = rows(bar.high);
    const yLow = Math.max(rows(bar.low), yHigh + 1);
    const yTop = rows(Math.max(bar.open, bar.close));
    const yBottom = Math.max(rows(Math.min(bar.open, bar.close)), yTop + 1);

    ctx.fillStyle = bar.close >= bar.open ? upColor : downColor;
    ctx.fillRect(xc - Math.floor(wickWidth / 2), yHigh, wickWidth, yLow - yHigh);
    ctx.fillRect(xc - (bodyWidth - 1) / 2, yTop, bodyWidth, yBottom - yTop);
  });

  if (spec.legend) drawLegend(ctx, upColor, downColor);
  if (spec.priceTag) {
    ctx.fillStyle = upColor;
    ctx.fillRect(width - 66, Math.round(height / 2), 62, 18);
  }

  const { data } = ctx.getImageData(0, 0, width, height);
  return { image: { width, height, data }, axis, plotTop, plotBottom };
}

/** Small glyph-like shapes (stems and bars, at most 5px wide) in a row, spaced like text. */
function drawLegend(ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>, up: string, down: string): void {
  for (let i = 0; i < 28; i++) {
    const x = 10 + i * 9;
    ctx.fillStyle = i % 3 === 0 ? down : up;
    ctx.fillRect(x, 20, 1, 9);
    ctx.fillRect(x, 28, 5, 1);
    if (i % 2 === 0) ctx.fillRect(x + 4, 20, 1, 5);
  }
}
