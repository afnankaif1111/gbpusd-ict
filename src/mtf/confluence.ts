import type { FairValueGap, IctAnalysis, OrderBlock } from '../ict/annotations';
import { TIMEFRAME_RANK, TIMEFRAMES, type Direction } from '../types';
import type { AnalysisSet, ConfluenceZone, HtfBias, ProjectedZone } from './types';

/** A liquidity sweep this many candles before the zone formed counts as its trigger. */
const SWEEP_WINDOW = 15;
const MAX_RESULTS = 10;

interface Candidate {
  kind: ConfluenceZone['kind'];
  direction: Direction;
  top: number;
  bottom: number;
  /** Candle index the zone formed at. */
  index: number;
  strong: boolean;
}

/**
 * Scores every still-open FVG and unmitigated order block on the 1H, 15M and
 * 5M charts by how many higher-timeframe conditions agree with it:
 *
 *   +2  zone direction matches the 1D/1H bias
 *   +2  zone overlaps a same-direction FVG or order block of a higher timeframe
 *   +1  zone is in discount (bullish) / premium (bearish) of the higher-timeframe range
 *   +1  zone overlaps the higher-timeframe OTE band
 *   +1  opposite-side liquidity was swept shortly before the zone formed
 *   +1  zone is impulsive (FVG made by a displacement candle) or an order block
 *
 * This ranks areas of interest. It is not a trade signal.
 */
export function findConfluence(set: AnalysisSet, bias: HtfBias, projected: readonly ProjectedZone[]): ConfluenceZone[] {
  const results: ConfluenceZone[] = [];

  for (const timeframe of TIMEFRAMES.filter((tf) => tf !== '1d')) {
    const analysis = set[timeframe];
    if (!analysis) continue;
    const references = projected.filter((z) => TIMEFRAME_RANK[z.source] > TIMEFRAME_RANK[timeframe]);
    const lastClose = analysis.candles[analysis.candles.length - 1]?.close ?? NaN;

    for (const candidate of candidatesOf(analysis)) {
      let score = 0;
      const reasons: string[] = [];
      const add = (points: number, reason: string): void => {
        score += points;
        reasons.push(reason);
      };

      if (bias.direction === candidate.direction) add(2, `matches ${bias.strength} higher-timeframe bias`);

      const match = references.find(
        (z) => (z.kind === 'fvg' || z.kind === 'orderBlock') && z.direction === candidate.direction && overlaps(z, candidate),
      );
      if (match) add(2, `overlaps ${match.source.toUpperCase()} ${match.kind === 'fvg' ? 'FVG' : 'order block'}`);

      const equilibrium = references.find((z) => z.kind === 'equilibrium')?.top;
      if (equilibrium !== undefined) {
        const mid = (candidate.top + candidate.bottom) / 2;
        if (candidate.direction === 'bullish' && mid < equilibrium) add(1, 'in discount');
        if (candidate.direction === 'bearish' && mid > equilibrium) add(1, 'in premium');
      }

      const ote = references.find((z) => z.kind === 'ote' && z.direction === candidate.direction && overlaps(z, candidate));
      if (ote) add(1, `inside ${ote.source.toUpperCase()} OTE band`);

      if (sweptBefore(analysis, candidate)) add(1, 'follows a liquidity sweep');
      if (candidate.strong) add(1, candidate.kind === 'FVG' ? 'impulsive FVG' : 'caused a structure break');

      results.push({
        timeframe,
        kind: candidate.kind,
        direction: candidate.direction,
        top: candidate.top,
        bottom: candidate.bottom,
        score,
        reasons,
        containsPrice: lastClose <= candidate.top && lastClose >= candidate.bottom,
      });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}

function candidatesOf(analysis: IctAnalysis): Candidate[] {
  const fromFvg = (g: FairValueGap): Candidate => ({
    kind: 'FVG',
    direction: g.direction,
    top: g.top,
    bottom: g.bottom,
    index: g.startIndex + 2,
    strong: g.impulsive,
  });
  const fromBlock = (b: OrderBlock): Candidate => ({
    kind: 'Order block',
    direction: b.direction,
    top: b.top,
    bottom: b.bottom,
    index: b.index,
    strong: true,
  });
  return [
    ...analysis.fvgs.filter((g) => g.status !== 'filled').map(fromFvg),
    ...analysis.orderBlocks.filter((b) => b.state === 'unmitigated').map(fromBlock),
  ];
}

function sweptBefore(analysis: IctAnalysis, zone: Candidate): boolean {
  const wantedSide = zone.direction === 'bullish' ? 'sell' : 'buy';
  return analysis.sweeps.some((s) => s.side === wantedSide && s.index >= zone.index - SWEEP_WINDOW && s.index <= zone.index + 1);
}

function overlaps(a: { top: number; bottom: number }, b: { top: number; bottom: number }): boolean {
  return a.bottom <= b.top && b.bottom <= a.top;
}
