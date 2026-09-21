import { describe, expect, it } from 'vitest';
import { axisFromTwoPoints, CalibrationError, fitPriceAxis, parsePriceLabel, type AxisLabel } from '../../src/vision/priceAxis';

/** Ground truth: price = 1.3600 - 0.00002 * y. */
const truePrice = (y: number): number => 1.36 - 0.00002 * y;

describe('fitPriceAxis', () => {
  const clean: AxisLabel[] = [100, 200, 300, 400, 500, 600].map((y) => ({ y, price: truePrice(y) }));

  it('recovers the axis from clean labels', () => {
    const { axis, rmsPixels } = fitPriceAxis(clean);
    expect(axis.priceAt(350)).toBeCloseTo(truePrice(350), 8);
    expect(rmsPixels).toBeLessThan(1e-6);
  });

  it('is not fooled by misread labels (outliers)', () => {
    const noisy: AxisLabel[] = [
      ...clean.map((l) => ({ y: l.y + 0.4, price: l.price })), // sub-pixel jitter
      { y: 250, price: 1.9999 }, // OCR read a wrong number
      { y: 480, price: 1.0 },
    ];
    const { axis, inliers } = fitPriceAxis(noisy);
    expect(inliers).toHaveLength(6);
    expect(Math.abs(axis.priceAt(350) - truePrice(350))).toBeLessThan(0.00002); // within one pixel
  });

  it('refuses to guess with too few or inconsistent labels', () => {
    expect(() => fitPriceAxis([clean[0]])).toThrow(CalibrationError);
    const random: AxisLabel[] = [
      { y: 100, price: 1.31 },
      { y: 200, price: 1.39 },
      { y: 300, price: 1.32 },
      { y: 400, price: 1.38 },
    ];
    expect(() => fitPriceAxis(random)).toThrow(CalibrationError);
  });
});

describe('axisFromTwoPoints', () => {
  it('builds an axis from two clicked points', () => {
    const axis = axisFromTwoPoints({ y: 100, price: 1.358 }, { y: 500, price: 1.35 });
    expect(axis.priceAt(300)).toBeCloseTo(1.354, 8);
    expect(axis.yAt(1.354)).toBeCloseTo(300, 6);
  });

  it('rejects points that are the wrong way round', () => {
    expect(() => axisFromTwoPoints({ y: 100, price: 1.35 }, { y: 500, price: 1.358 })).toThrow(CalibrationError);
  });
});

describe('parsePriceLabel', () => {
  it('accepts GBPUSD-style prices only', () => {
    expect(parsePriceLabel('1.34250')).toBe(1.3425);
    expect(parsePriceLabel(' 1.3425 ')).toBe(1.3425);
    expect(parsePriceLabel('1,3425')).toBe(1.3425);
    expect(parsePriceLabel('13425')).toBeNull();
    expect(parsePriceLabel('1.3')).toBeNull();
    expect(parsePriceLabel('abc')).toBeNull();
  });
});
