import { describe, expect, it } from 'vitest';
import { atrSeries } from '../../src/core/math';
import { detectFairValueGaps } from '../../src/ict/fvg';
import { detectKeyLevels } from '../../src/ict/levels';
import { detectLiquidityPools, detectSweeps } from '../../src/ict/liquidity';
import { detectOrderBlocks } from '../../src/ict/orderBlocks';
import { defaultParams, type IctParams } from '../../src/ict/params';
import { computeDealingRange } from '../../src/ict/range';
import { detectJudasSwings, detectSessions } from '../../src/ict/sessions';
import { findStructure } from '../../src/ict/structure';
import { findSwings } from '../../src/ict/swings';
import { ASIA_START, candlesFrom, candlesFromCloses, type Row } from '../helpers/candles';

const params = (overrides: Partial<IctParams> = {}): IctParams => ({ ...defaultParams('15m'), swingLookback: 1, ...overrides });

describe('swings', () => {
  it('finds fractal highs and lows and only confirms them after the lookback', () => {
    const candles = candlesFromCloses([1.30, 1.31, 1.32, 1.31, 1.30, 1.31, 1.32], 0);
    const swings = findSwings(candles, 1);
    const high = swings.find((s) => s.type === 'high' && s.index === 2);
    const low = swings.find((s) => s.type === 'low' && s.index === 4);
    expect(high?.confirmedAt).toBe(3);
    expect(low?.confirmedAt).toBe(5);
  });

  it('treats the first of two equal highs as the swing', () => {
    const rows: Row[] = [
      [1.3, 1.301, 1.299, 1.3],
      [1.3, 1.305, 1.3, 1.304],
      [1.304, 1.305, 1.301, 1.302],
      [1.302, 1.303, 1.3, 1.301],
    ];
    const highs = findSwings(candlesFrom(rows), 1).filter((s) => s.type === 'high');
    expect(highs.map((s) => s.index)).toEqual([1]);
  });
});

describe('market structure', () => {
  it('labels the first break BOS, continuation BOS and a reversal CHoCH, using closes only', () => {
    //                   0     1     2     3     4     5     6     7     8     9     10    11
    const closes = [1.300, 1.310, 1.320, 1.312, 1.306, 1.316, 1.326, 1.318, 1.300, 1.292, 1.296, 1.284];
    const candles = candlesFromCloses(closes, 0.0002, 0);
    const { breaks, trend } = findStructure(candles, findSwings(candles, 1));

    expect(breaks.map((b) => `${b.type} ${b.direction}`)).toEqual(['BOS bullish', 'CHoCH bearish', 'BOS bearish']);
    expect(breaks[0].index).toBe(6);
    expect(trend).toBe('bearish');
  });

  it('does not break structure on a wick alone', () => {
    const rows: Row[] = [
      [1.3, 1.31, 1.299, 1.305],
      [1.305, 1.32, 1.304, 1.31], // swing high 1.32
      [1.31, 1.315, 1.305, 1.308],
      [1.308, 1.325, 1.306, 1.312], // wick above 1.32 but closes below
      [1.312, 1.314, 1.306, 1.31],
    ];
    const candles = candlesFrom(rows, 0);
    expect(findStructure(candles, findSwings(candles, 1)).breaks).toHaveLength(0);
  });
});

describe('fair value gaps', () => {
  const rows: Row[] = [
    [1.3390, 1.3400, 1.3385, 1.3395], // candle 1: high 1.3400
    [1.3395, 1.3440, 1.3393, 1.3435], // candle 2: strong up
    [1.3435, 1.3450, 1.3420, 1.3445], // candle 3: low 1.3420 -> gap 1.3400..1.3420
  ];
  const detect = (extra: Row[]) => {
    const candles = candlesFrom([...rows, ...extra], 0);
    return detectFairValueGaps(candles, atrSeries(candles, 14), params());
  };

  it('finds a bullish gap between candle 1 high and candle 3 low', () => {
    const [gap] = detect([]);
    expect(gap).toMatchObject({ direction: 'bullish', bottom: 1.34, top: 1.342, startIndex: 0, status: 'open' });
  });

  it('marks the gap partial when price re-enters it and filled when price closes it', () => {
    expect(detect([[1.3445, 1.3446, 1.3410, 1.3440]])[0].status).toBe('partial');
    const filled = detect([[1.3445, 1.3446, 1.3410, 1.3440], [1.344, 1.3441, 1.3395, 1.34]])[0];
    expect(filled).toMatchObject({ status: 'filled', endIndex: 4 });
  });

  it('finds bearish gaps and ignores gaps below the minimum size', () => {
    const bearish: Row[] = [
      [1.3450, 1.3455, 1.3440, 1.3445],
      [1.3445, 1.3446, 1.3400, 1.3405],
      [1.3405, 1.3420, 1.3395, 1.3400],
    ];
    const candles = candlesFrom(bearish, 0);
    const gaps = detectFairValueGaps(candles, atrSeries(candles, 14), params());
    expect(gaps[0]).toMatchObject({ direction: 'bearish', top: 1.344, bottom: 1.342 });
    const strict = detectFairValueGaps(candles, atrSeries(candles, 14), params({ minFvgPips: 50 }));
    expect(strict).toHaveLength(0);
  });
});

describe('order blocks', () => {
  // A down leg, then a displacement candle (index 6) that closes above the swing high at index 2.
  const rows: Row[] = [
    [1.3500, 1.3510, 1.3490, 1.3495],
    [1.3495, 1.3520, 1.3494, 1.3515],
    [1.3515, 1.3530, 1.3510, 1.3512], // swing high 1.3530
    [1.3512, 1.3515, 1.3490, 1.3495],
    [1.3495, 1.3498, 1.3470, 1.3475],
    [1.3475, 1.3480, 1.3465, 1.3470], // last bearish candle before the rally: the order block
    [1.3470, 1.3545, 1.3468, 1.3540], // displacement + break of structure
  ];
  const detect = (extra: Row[]) => {
    const candles = candlesFrom([...rows, ...extra], 0);
    const { breaks } = findStructure(candles, findSwings(candles, 1));
    return detectOrderBlocks(candles, breaks, atrSeries(candles, 14), params());
  };

  it('finds the last opposing candle before the displacement that broke structure', () => {
    const [block] = detect([]);
    expect(block).toMatchObject({ direction: 'bullish', index: 5, top: 1.3475, bottom: 1.347, state: 'unmitigated', breakIndex: 6 });
  });

  it('becomes mitigated when price returns and a breaker when it closes through', () => {
    expect(detect([[1.354, 1.3542, 1.3472, 1.3500]])[0]).toMatchObject({ state: 'mitigated', endIndex: 7 });
    const broken = detect([[1.354, 1.3542, 1.3472, 1.3500], [1.35, 1.3501, 1.3455, 1.3460]])[0];
    expect(broken).toMatchObject({ state: 'breaker', endIndex: 8 });
  });

  it('ignores breaks that had no displacement', () => {
    const slow: Row[] = rows.map((r, i) => (i === 6 ? ([1.3470, 1.3535, 1.3468, 1.3532] as Row) : r));
    const candles = candlesFrom(slow, 0);
    const { breaks } = findStructure(candles, findSwings(candles, 1));
    expect(detectOrderBlocks(candles, breaks, atrSeries(candles, 14), params({ displacementAtrMultiple: 5 }))).toHaveLength(0);
  });
});

describe('liquidity', () => {
  // Two swing highs 1 pip apart (equal highs), later taken by a wick that closes back below.
  const rows: Row[] = [
    [1.3500, 1.3505, 1.3495, 1.3500],
    [1.3500, 1.3510, 1.3498, 1.3502], // swing high 1.3510
    [1.3502, 1.3505, 1.3490, 1.3495],
    [1.3495, 1.3511, 1.3493, 1.3500], // swing high 1.3511
    [1.3500, 1.3504, 1.3492, 1.3496],
    [1.3496, 1.3520, 1.3495, 1.3505], // wick takes 1.3511, closes below
  ];
  const candles = candlesFrom(rows, 0);
  const swings = findSwings(candles, 1);

  it('groups equal highs into one buy-side pool and reports the sweep', () => {
    const pools = detectLiquidityPools(candles, swings, params());
    const pool = pools.find((p) => p.side === 'buy');
    expect(pool).toMatchObject({ price: 1.3511, indices: [1, 3], sweptAt: 5, sweepKind: 'sweep' });
  });

  it('distinguishes a sweep (closes back) from a run (closes beyond)', () => {
    const run = candlesFrom([...rows.slice(0, 5), [1.3496, 1.3520, 1.3495, 1.3518]], 0);
    const pool = detectLiquidityPools(run, findSwings(run, 1), params()).find((p) => p.side === 'buy');
    expect(pool?.sweepKind).toBe('run');
  });

  it('does not pool highs that are further apart than the tolerance', () => {
    const wide = candlesFrom(rows.map((r, i) => (i === 3 ? ([1.3495, 1.3535, 1.3493, 1.35] as Row) : r)), 0);
    expect(detectLiquidityPools(wide, findSwings(wide, 1), params()).filter((p) => p.side === 'buy')).toHaveLength(0);
  });

  it('detects single-swing sweeps', () => {
    const sweeps = detectSweeps(candles, swings);
    expect(sweeps.some((s) => s.side === 'buy' && s.level === 1.3511 && s.index === 5)).toBe(true);
  });
});

describe('premium / discount and OTE', () => {
  it('computes equilibrium and a bullish OTE band inside discount', () => {
    const swings = [
      { type: 'low' as const, index: 1, confirmedAt: 2, price: 1.30 },
      { type: 'high' as const, index: 5, confirmedAt: 6, price: 1.40 },
    ];
    const range = computeDealingRange(swings, 'bullish', params());
    expect(range?.equilibrium).toBeCloseTo(1.35, 8);
    expect(range?.oteTop).toBeCloseTo(1.4 - 0.62 * 0.1, 8);
    expect(range?.oteBottom).toBeCloseTo(1.4 - 0.79 * 0.1, 8);
  });

  it('places the bearish OTE band inside premium', () => {
    const swings = [
      { type: 'high' as const, index: 1, confirmedAt: 2, price: 1.40 },
      { type: 'low' as const, index: 5, confirmedAt: 6, price: 1.30 },
    ];
    const range = computeDealingRange(swings, 'bearish', params());
    expect(range?.oteBottom).toBeCloseTo(1.3 + 0.62 * 0.1, 8);
    expect(range?.oteTop).toBeCloseTo(1.3 + 0.79 * 0.1, 8);
  });
});

describe('sessions and Judas swing', () => {
  // Hourly candles from 2026-09-15 00:00 UTC = 20:00 New York (EDT).
  // idx 0-3 Asia, idx 4-5 quiet, idx 6-8 London kill zone, idx 11-13 New York kill zone.
  const flat = (i: number): Row => [1.3480, 1.3490 + i * 0, 1.3470, 1.3480];
  const rows: Row[] = Array.from({ length: 14 }, (_, i) => flat(i));
  rows[6] = [1.3485, 1.3510, 1.3480, 1.3500]; // London: takes the Asia high (1.3490)
  rows[7] = [1.3500, 1.3502, 1.3478, 1.3480];
  rows[8] = [1.3480, 1.3485, 1.3465, 1.3475]; // London closes back below the Asia high

  const candles = candlesFrom(rows);

  it('builds Asia, London and New York ranges in New York time', () => {
    const sessions = detectSessions(candles, '1h');
    const byName = Object.fromEntries(sessions.map((s) => [s.name, s]));
    expect(byName['Asia']).toMatchObject({ startIndex: 0, endIndex: 3, high: 1.349, low: 1.347, dayKey: '2026-09-15' });
    expect(byName['London']).toMatchObject({ startIndex: 6, endIndex: 8 });
    expect(byName['New York']).toMatchObject({ startIndex: 11, endIndex: 13 });
  });

  it('flags a bearish Judas swing when London sweeps the Asia high and closes back below', () => {
    const judas = detectJudasSwings(candles, detectSessions(candles, '1h'));
    expect(judas).toHaveLength(1);
    expect(judas[0]).toMatchObject({ direction: 'bearish', index: 6, asiaHigh: 1.349 });
  });

  it('has no sessions on the daily chart', () => {
    expect(detectSessions(candles, '1d')).toEqual([]);
  });
});

describe('key levels', () => {
  it('uses the previous candle on the daily chart', () => {
    const candles = candlesFrom([[1.30, 1.32, 1.29, 1.31], [1.31, 1.33, 1.30, 1.32], [1.32, 1.325, 1.31, 1.315]], 86400);
    const levels = detectKeyLevels(candles, '1d');
    expect(levels).toEqual([
      { label: 'PDH', price: 1.33, fromIndex: 2 },
      { label: 'PDL', price: 1.3, fromIndex: 2 },
    ]);
  });

  it('computes PDH/PDL over the previous 17:00-17:00 trading day and finds the midnight open', () => {
    // 48 hourly candles from Mon 21:00 UTC (17:00 NY): the first 24 are one full trading day.
    const start = Date.UTC(2026, 8, 14, 21, 0) / 1000;
    const rows: Row[] = Array.from({ length: 48 }, (_, i) => [1.3, 1.3 + i * 0.0001, 1.29 - i * 0.0001, 1.3]);
    const candles = candlesFrom(rows, 3600, start);
    const levels = detectKeyLevels(candles, '1h');
    const byLabel = Object.fromEntries(levels.map((l) => [l.label, l]));

    expect(byLabel['PDH'].price).toBeCloseTo(1.3 + 23 * 0.0001, 8);
    expect(byLabel['PDL'].price).toBeCloseTo(1.29 - 23 * 0.0001, 8);
    expect(byLabel['Midnight Open'].fromIndex).toBe(31); // Wed 04:00 UTC = 00:00 NY
  });

  it('leaves out PDH/PDL when the previous day is incomplete', () => {
    const rows: Row[] = Array.from({ length: 30 }, () => [1.3, 1.31, 1.29, 1.3]);
    const levels = detectKeyLevels(candlesFrom(rows, 3600, ASIA_START), '1h');
    expect(levels.find((l) => l.label === 'PDH')).toBeUndefined();
  });
});
