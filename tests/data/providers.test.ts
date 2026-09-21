import { describe, expect, it } from 'vitest';
import { parseCandlesFromCsv } from '../../src/data/csvParser';
import { generateIctSampleCandles } from '../../src/data/sampleData';
import { runIct } from '../../src/ict/engine';
import { TIMEFRAMES } from '../../src/types';

describe('Market Data Providers & Parsers', () => {
  describe('Sample Data Generator', () => {
    it('generates valid candles for all 4 timeframes that feed into runIct', () => {
      for (const tf of TIMEFRAMES) {
        const candles = generateIctSampleCandles(tf, 100);
        expect(candles.length).toBe(100);

        // Verify candle fields and ordering
        for (let i = 0; i < candles.length; i++) {
          const c = candles[i];
          expect(c.index).toBe(i);
          expect(c.high).toBeGreaterThanOrEqual(c.low);
          expect(c.high).toBeGreaterThanOrEqual(c.open);
          expect(c.high).toBeGreaterThanOrEqual(c.close);
          expect(c.low).toBeLessThanOrEqual(c.open);
          expect(c.low).toBeLessThanOrEqual(c.close);
          if (i > 0) {
            expect(c.time).toBeGreaterThan(candles[i - 1].time);
          }
        }

        // Run ICT engine on generated sample
        const analysis = runIct(candles, tf);
        expect(analysis).toBeDefined();
        expect(analysis.candles.length).toBe(100);
        // Should detect ICT features (FVGs, pools, structure breaks)
        expect(analysis.fvgs.length).toBeGreaterThan(0);
        expect(analysis.structure.length).toBeGreaterThan(0);
      }
    });
  });

  describe('CSV Parser', () => {
    it('parses standard ISO date CSV correctly', () => {
      const csv = `time,open,high,low,close
2026-09-15T10:00:00Z,1.33200,1.33450,1.33150,1.33400
2026-09-15T10:15:00Z,1.33400,1.33550,1.33300,1.33320
2026-09-15T10:30:00Z,1.33320,1.33600,1.33300,1.33580`;

      const candles = parseCandlesFromCsv(csv);
      expect(candles.length).toBe(3);
      expect(candles[0].open).toBe(1.332);
      expect(candles[0].high).toBe(1.3345);
      expect(candles[0].low).toBe(1.3315);
      expect(candles[0].close).toBe(1.334);
      expect(candles[0].index).toBe(0);
      expect(candles[1].index).toBe(1);
      expect(candles[2].index).toBe(2);
    });

    it('parses TradingView style Unix timestamp CSV and sorts chronologically', () => {
      const csv = `timestamp,Open,High,Low,Close
1789467000,1.3350,1.3380,1.3340,1.3370
1789463400,1.3320,1.3350,1.3310,1.3350`;

      const candles = parseCandlesFromCsv(csv);
      expect(candles.length).toBe(2);
      // Older first
      expect(candles[0].time).toBe(1789463400);
      expect(candles[0].index).toBe(0);
      expect(candles[1].time).toBe(1789467000);
      expect(candles[1].index).toBe(1);
    });

    it('throws descriptive error on invalid CSV missing OHLC headers', () => {
      const csv = `date,volume,price
2026-09-15,100,1.334`;

      expect(() => parseCandlesFromCsv(csv)).toThrow(/open, high, low, and close columns/);
    });
  });
});
