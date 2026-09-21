import { PIP } from '../core/market';
import type { Candle } from '../types';
import type { LiquidityPool, LiquiditySweep, SwingPoint } from './annotations';
import type { IctParams } from './params';

interface PoolGroup {
  price: number;
  indices: number[];
}

/**
 * Equal highs / equal lows: two or more swing points within a few pips of
 * each other with no candle pushing meaningfully beyond them in between.
 * Buy-side liquidity rests above equal highs, sell-side below equal lows.
 * A pool is swept by the first candle whose wick passes the level.
 */
export function detectLiquidityPools(
  candles: readonly Candle[],
  swings: readonly SwingPoint[],
  params: IctParams,
): LiquidityPool[] {
  const tolerance = params.equalLevelTolerancePips * PIP;
  return [
    ...poolsForSide(candles, swings, 'buy', tolerance),
    ...poolsForSide(candles, swings, 'sell', tolerance),
  ].sort((a, b) => a.indices[0] - b.indices[0]);
}

function poolsForSide(
  candles: readonly Candle[],
  swings: readonly SwingPoint[],
  side: 'buy' | 'sell',
  tolerance: number,
): LiquidityPool[] {
  const buy = side === 'buy';
  const groups: PoolGroup[] = [];

  for (const swing of swings.filter((s) => s.type === (buy ? 'high' : 'low'))) {
    const group = groups.find(
      (g) =>
        Math.abs(swing.price - g.price) <= tolerance &&
        !pushedBeyond(candles, g.indices[g.indices.length - 1] + 1, swing.index - 1, g.price, tolerance, buy),
    );
    if (group) {
      group.indices.push(swing.index);
      group.price = buy ? Math.max(group.price, swing.price) : Math.min(group.price, swing.price);
    } else {
      groups.push({ price: swing.price, indices: [swing.index] });
    }
  }

  return groups
    .filter((g) => g.indices.length >= 2)
    .map((g) => {
      const pool: LiquidityPool = { side, price: g.price, indices: g.indices, sweptAt: null, sweepKind: null };
      for (let j = g.indices[g.indices.length - 1] + 1; j < candles.length; j++) {
        const c = candles[j];
        if (buy ? c.high > g.price : c.low < g.price) {
          pool.sweptAt = j;
          pool.sweepKind = (buy ? c.close < g.price : c.close > g.price) ? 'sweep' : 'run';
          break;
        }
      }
      return pool;
    });
}

function pushedBeyond(
  candles: readonly Candle[],
  from: number,
  to: number,
  price: number,
  tolerance: number,
  buy: boolean,
): boolean {
  for (let i = from; i <= to; i++) {
    if (buy ? candles[i].high > price + tolerance : candles[i].low < price - tolerance) return true;
  }
  return false;
}

/**
 * Liquidity sweeps of single swing points: the first candle after a swing
 * whose wick takes the swing's level but whose close is back inside.
 */
export function detectSweeps(candles: readonly Candle[], swings: readonly SwingPoint[]): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = [];
  for (const swing of swings) {
    const buy = swing.type === 'high';
    for (let j = swing.confirmedAt + 1; j < candles.length; j++) {
      const c = candles[j];
      if (!(buy ? c.high > swing.price : c.low < swing.price)) continue;
      if (buy ? c.close < swing.price : c.close > swing.price) {
        sweeps.push({ side: buy ? 'buy' : 'sell', level: swing.price, levelIndex: swing.index, index: j });
      }
      break; // first candle beyond the level decides; later ones are a different event
    }
  }
  return sweeps.sort((a, b) => a.index - b.index);
}
