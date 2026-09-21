import { atrSeries } from '../core/math';
import type { Candle, Timeframe } from '../types';
import type { IctAnalysis } from './annotations';
import { detectFairValueGaps } from './fvg';
import { detectKeyLevels } from './levels';
import { detectLiquidityPools, detectSweeps } from './liquidity';
import { detectOrderBlocks } from './orderBlocks';
import { defaultParams, type IctParams } from './params';
import { computeDealingRange } from './range';
import { detectJudasSwings, detectSessions } from './sessions';
import { findStructure } from './structure';
import { findSwings } from './swings';

/** Minimum candles for the engine to say anything meaningful. */
export const MIN_CANDLES = 15;

/** Runs every ICT detector on one chart. Pure and deterministic: same candles in, same result out. */
export function runIct(
  candles: readonly Candle[],
  timeframe: Timeframe,
  params: IctParams = defaultParams(timeframe),
): IctAnalysis {
  const atr = atrSeries(candles, params.atrPeriod);
  const swings = candles.length >= MIN_CANDLES ? findSwings(candles, params.swingLookback) : [];
  const { breaks, trend } = findStructure(candles, swings);

  const sessions = detectSessions(candles, timeframe);
  const max = params.maxZonesPerKind;

  const fvgs = detectFairValueGaps(candles, atr, params);
  const orderBlocks = detectOrderBlocks(candles, breaks, atr, params);
  const pools = detectLiquidityPools(candles, swings, params);

  return {
    timeframe,
    candles,
    swings,
    structure: breaks,
    trend,
    fvgs: keepRecent(fvgs, (g) => g.status !== 'filled', (g) => g.startIndex, max),
    orderBlocks: keepRecent(orderBlocks, (b) => b.state === 'unmitigated', (b) => b.index, max),
    pools: keepRecent(pools, (p) => p.sweptAt === null, (p) => p.indices[0], max),
    sweeps: detectSweeps(candles, swings).slice(-Math.floor(max / 2)),
    range: computeDealingRange(swings, trend, params),
    sessions,
    judas: detectJudasSwings(candles, sessions),
    levels: detectKeyLevels(candles, timeframe),
  };
}

/**
 * Keeps the `max` most recent "active" items plus up to half as many
 * resolved ones. Old resolved zones are noise; old *active* zones still matter.
 */
function keepRecent<T>(items: readonly T[], isActive: (item: T) => boolean, indexOf: (item: T) => number, max: number): T[] {
  const byRecency = (a: T, b: T): number => indexOf(a) - indexOf(b);
  const active = items.filter(isActive).sort(byRecency).slice(-max);
  const resolved = items.filter((i) => !isActive(i)).sort(byRecency).slice(-Math.floor(max / 2));
  return [...resolved, ...active].sort(byRecency);
}
