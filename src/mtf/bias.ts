import type { Direction } from '../types';
import type { AnalysisSet, HtfBias, PriceLocation } from './types';

/** Fraction of the range around the 50% line that still counts as "equilibrium". */
const EQUILIBRIUM_BAND = 0.05;

/**
 * Higher-timeframe bias from the market structure of the 1D and 1H charts:
 *   both agree     -> strong
 *   only one chart -> partial
 *   they disagree  -> conflict (direction is neutral)
 */
export function computeBias(set: AnalysisSet): HtfBias {
  const daily = set['1d']?.trend ?? null;
  const hourly = set['1h']?.trend ?? null;

  let direction: HtfBias['direction'] = 'neutral';
  let strength: HtfBias['strength'] = 'none';
  if (daily && hourly) {
    if (daily === hourly) {
      direction = daily;
      strength = 'strong';
    } else {
      strength = 'conflict';
    }
  } else if (daily || hourly) {
    direction = (daily ?? hourly) as Direction;
    strength = 'partial';
  }

  return { direction, strength, daily, hourly, location: locate(set) };
}

function locate(set: AnalysisSet): PriceLocation | null {
  const analysis = set['1h'] ?? set['1d'];
  const range = analysis?.range;
  if (!analysis || !range || analysis.candles.length === 0) return null;

  const close = analysis.candles[analysis.candles.length - 1].close;
  const band = (range.high - range.low) * EQUILIBRIUM_BAND;
  if (Math.abs(close - range.equilibrium) <= band) return 'equilibrium';
  return close > range.equilibrium ? 'premium' : 'discount';
}
