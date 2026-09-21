import { parsePriceLabel, type AxisLabel } from './priceAxis';
import type { RasterImage, Rect } from './raster';

/** Upscale factor applied before OCR; small axis text reads far better at 3x. */
const OCR_SCALE = 3;
const MIN_CONFIDENCE = 40;

/**
 * Reads the price labels of the right-hand axis (browser only).
 * Tesseract.js is loaded lazily so the rest of the app never pays for it.
 * Returns the pixel row of each label's centre together with its value.
 */
export async function readAxisLabels(img: RasterImage, strip: Rect): Promise<AxisLabel[]> {
  const { createWorker } = await import('tesseract.js');
  const canvas = prepareStrip(img, strip);
  const worker = await createWorker('eng');
  try {
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.',
      tessedit_pageseg_mode: '11' as never, // sparse text: find text anywhere, no layout assumptions
    });
    const { data } = await worker.recognize(canvas, {}, { blocks: true });

    const labels: AxisLabel[] = [];
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          for (const word of line.words) {
            const price = parsePriceLabel(word.text);
            if (price === null || word.confidence < MIN_CONFIDENCE) continue;
            const centreInStrip = (word.bbox.y0 + word.bbox.y1) / 2 / OCR_SCALE;
            labels.push({ y: strip.top + centreInStrip, price });
          }
        }
      }
    }
    return labels;
  } finally {
    await worker.terminate();
  }
}

/** Crops, upscales and converts to dark-text-on-light-background greyscale. */
function prepareStrip(img: RasterImage, strip: Rect): HTMLCanvasElement {
  const width = strip.right - strip.left;
  const height = strip.bottom - strip.top;

  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const sourceCtx = source.getContext('2d') as CanvasRenderingContext2D;
  const pixels = sourceCtx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    const from = ((strip.top + y) * img.width + strip.left) * 4;
    pixels.data.set(img.data.subarray(from, from + width * 4), y * width * 4);
  }

  // Greyscale; invert if the background is dark so the text is always dark.
  let sum = 0;
  for (let i = 0; i < pixels.data.length; i += 4) {
    const grey = 0.299 * pixels.data[i] + 0.587 * pixels.data[i + 1] + 0.114 * pixels.data[i + 2];
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = grey;
    sum += grey;
  }
  const invert = sum / (pixels.data.length / 4) < 128;
  if (invert) {
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255 - pixels.data[i];
    }
  }
  sourceCtx.putImageData(pixels, 0, 0);

  const scaled = document.createElement('canvas');
  scaled.width = width * OCR_SCALE;
  scaled.height = height * OCR_SCALE;
  const scaledCtx = scaled.getContext('2d') as CanvasRenderingContext2D;
  scaledCtx.imageSmoothingEnabled = true;
  scaledCtx.drawImage(source, 0, 0, scaled.width, scaled.height);
  return scaled;
}
