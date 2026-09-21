import { TIMEFRAME_RANK, TIMEFRAMES } from '../types';
import type { AnalysisSet, ProjectedZone } from './types';

/**
 * Collects the still-relevant zones of the 1D and 1H charts so they can be
 * drawn as horizontal bands on the lower-timeframe screenshots. Screenshots
 * share only the price axis, which is exactly what a horizontal band needs.
 */
export function projectHigherTimeframeZones(set: AnalysisSet): ProjectedZone[] {
  const zones: ProjectedZone[] = [];

  for (const timeframe of TIMEFRAMES.filter((tf) => TIMEFRAME_RANK[tf] >= TIMEFRAME_RANK['1h'])) {
    const analysis = set[timeframe];
    if (!analysis) continue;
    const source = timeframe;

    for (const gap of analysis.fvgs.filter((g) => g.status !== 'filled')) {
      zones.push({
        source,
        label: `FVG ${gap.direction === 'bullish' ? '▲' : '▼'}`,
        kind: 'fvg',
        direction: gap.direction,
        top: gap.top,
        bottom: gap.bottom,
      });
    }
    for (const block of analysis.orderBlocks.filter((b) => b.state === 'unmitigated')) {
      zones.push({
        source,
        label: `OB ${block.direction === 'bullish' ? '▲' : '▼'}`,
        kind: 'orderBlock',
        direction: block.direction,
        top: block.top,
        bottom: block.bottom,
      });
    }
    for (const pool of analysis.pools.filter((p) => p.sweptAt === null)) {
      zones.push({
        source,
        label: pool.side === 'buy' ? 'EQH' : 'EQL',
        kind: 'pool',
        direction: null,
        top: pool.price,
        bottom: pool.price,
      });
    }
    for (const level of analysis.levels.filter((l) => l.label !== 'Midnight Open')) {
      zones.push({ source, label: level.label, kind: 'level', direction: null, top: level.price, bottom: level.price });
    }
    if (analysis.range) {
      zones.push({
        source,
        label: 'EQ',
        kind: 'equilibrium',
        direction: null,
        top: analysis.range.equilibrium,
        bottom: analysis.range.equilibrium,
      });
      if (analysis.range.oteTop !== null && analysis.range.oteBottom !== null) {
        zones.push({
          source,
          label: 'OTE',
          kind: 'ote',
          direction: analysis.range.bias,
          top: analysis.range.oteTop,
          bottom: analysis.range.oteBottom,
        });
      }
    }
  }
  return zones;
}
