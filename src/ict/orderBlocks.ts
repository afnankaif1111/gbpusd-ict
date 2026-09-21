import type { Candle, Direction } from '../types';
import type { OrderBlock, StructureBreak } from './annotations';
import { hasDisplacement } from './displacement';
import type { IctParams } from './params';

/**
 * Order blocks from structure breaks.
 *
 * For a bullish break the rally began at the lowest low between the broken
 * swing high and the break candle. The order block is the last bearish
 * candle at or before that low, and it only counts if a bullish displacement
 * candle follows it before the break. Bearish is the mirror image.
 *
 * State after the break:
 *   unmitigated: price has not come back to the block
 *   mitigated:   price traded back into the block
 *   breaker:     a candle closed through the far side (the block failed)
 */
export function detectOrderBlocks(
  candles: readonly Candle[],
  breaks: readonly StructureBreak[],
  atr: readonly number[],
  params: IctParams,
): OrderBlock[] {
  const blocks: OrderBlock[] = [];
  const seen = new Set<string>();

  for (const brk of breaks) {
    const bullish = brk.direction === 'bullish';
    const origin = extremeIndex(candles, brk.swingIndex, brk.index, bullish ? 'low' : 'high');
    const blockIndex = findOpposingCandle(candles, origin, brk.direction, params.orderBlockLookback);
    if (blockIndex < 0) continue;
    if (!hasDisplacement(candles, atr, blockIndex + 1, brk.index, brk.direction, params)) continue;

    const key = `${brk.direction}:${blockIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const c = candles[blockIndex];
    const block: OrderBlock = {
      direction: brk.direction,
      top: params.orderBlockUsesBody ? Math.max(c.open, c.close) : c.high,
      bottom: params.orderBlockUsesBody ? Math.min(c.open, c.close) : c.low,
      index: blockIndex,
      breakIndex: brk.index,
      endIndex: null,
      state: 'unmitigated',
    };
    trackState(candles, block);
    blocks.push(block);
  }
  return blocks.sort((a, b) => a.index - b.index);
}

/** Index of the lowest low / highest high in [from, to]; the latest one on ties. */
function extremeIndex(candles: readonly Candle[], from: number, to: number, side: 'low' | 'high'): number {
  let best = from;
  for (let i = from; i <= to; i++) {
    const better = side === 'low' ? candles[i].low <= candles[best].low : candles[i].high >= candles[best].high;
    if (better) best = i;
  }
  return best;
}

/** Walks back from `origin` to the nearest candle that closed against the move. */
function findOpposingCandle(candles: readonly Candle[], origin: number, direction: Direction, lookback: number): number {
  for (let i = origin; i >= Math.max(0, origin - lookback); i--) {
    const c = candles[i];
    if (direction === 'bullish' ? c.close < c.open : c.close > c.open) return i;
  }
  return -1;
}

function trackState(candles: readonly Candle[], block: OrderBlock): void {
  for (let j = block.breakIndex + 1; j < candles.length; j++) {
    const c = candles[j];
    const failed = block.direction === 'bullish' ? c.close < block.bottom : c.close > block.top;
    if (failed) {
      block.state = 'breaker';
      block.endIndex = j;
      return;
    }
    const touched = block.direction === 'bullish' ? c.low <= block.top : c.high >= block.bottom;
    if (touched && block.state === 'unmitigated') {
      block.state = 'mitigated';
      block.endIndex = j;
    }
  }
}
