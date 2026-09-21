export type CandleClass = 'up' | 'down';

/** Decides whether an RGB pixel belongs to an up candle, a down candle, or neither. */
export type PixelClassifier = (r: number, g: number, b: number) => CandleClass | null;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHexColor(hex: string): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`Invalid colour "${hex}". Use a 6-digit hex value such as #089981.`);
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** Returns [hue 0-360, saturation 0-1, value 0-1]. */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === r) hue = 60 * (((g - b) / delta + 6) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  return [hue, max === 0 ? 0 : delta / max, max / 255];
}

/**
 * Default classifier: any saturated teal/green is an up candle and any
 * saturated red is a down candle. Covers both TradingView palettes
 * (#089981/#F23645 and the older #26a69a/#ef5350) in dark and light themes.
 */
export function hueClassifier(): PixelClassifier {
  return (r, g, b) => {
    const [hue, saturation, value] = rgbToHsv(r, g, b);
    if (saturation < 0.4 || value < 0.35) return null;
    if (hue >= 140 && hue <= 185) return 'up';
    if (hue >= 350 || hue <= 15) return 'down';
    return null;
  };
}

/** Classifier for custom candle colours: nearest-colour match within a Euclidean RGB tolerance. */
export function paletteClassifier(up: Rgb, down: Rgb, tolerance = 40): PixelClassifier {
  const limit = tolerance * tolerance;
  const distance = (r: number, g: number, b: number, c: Rgb): number =>
    (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
  return (r, g, b) => {
    const dUp = distance(r, g, b, up);
    const dDown = distance(r, g, b, down);
    if (dUp <= limit && dUp <= dDown) return 'up';
    if (dDown <= limit) return 'down';
    return null;
  };
}
