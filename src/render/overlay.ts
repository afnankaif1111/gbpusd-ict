import type { IctAnalysis } from '../ict/annotations';
import type { ProjectedZone } from '../mtf/types';
import type { ChartGeometry } from '../pipeline/geometry';
import { TIMEFRAME_RANK } from '../types';
import type { LayerKey, LayerVisibility } from './layers';
import { dot, fillBox, hLine, label } from './primitives';
import { THEME } from './theme';

export interface OverlayRequest {
  ctx: CanvasRenderingContext2D;
  geometry: ChartGeometry;
  analysis: IctAnalysis;
  layers: LayerVisibility;
  /** Zones from the 1D / 1H charts. Only those from a higher timeframe than this chart are drawn. */
  projected: readonly ProjectedZone[];
  /** Also draw filled FVGs and mitigated order blocks (dimmed). */
  showResolved: boolean;
}

type Painter = (req: OverlayRequest) => void;

/** Painters in drawing order: background shading first, text-heavy layers last. */
const PAINTERS: readonly [LayerKey, Painter][] = [
  ['sessions', paintSessions],
  ['range', paintRange],
  ['htf', paintHigherTimeframe],
  ['fvg', paintFairValueGaps],
  ['orderBlocks', paintOrderBlocks],
  ['liquidity', paintPools],
  ['levels', paintLevels],
  ['structure', paintStructure],
  ['sweeps', paintSweeps],
  ['judas', paintJudas],
  ['swings', paintSwings],
  ['debug', paintDebug],
];

export function renderOverlay(request: OverlayRequest): void {
  for (const [key, paint] of PAINTERS) {
    if (request.layers[key]) paint(request);
  }
}

// ---------------------------------------------------------------------------

function paintFairValueGaps({ ctx, geometry: g, analysis, showResolved }: OverlayRequest): void {
  for (const gap of analysis.fvgs) {
    if (gap.status === 'filled' && !showResolved) continue;
    const colors = gap.direction === 'bullish' ? THEME.bullish : THEME.bearish;
    const dim = gap.status === 'filled' ? 0.5 : 1;
    ctx.globalAlpha = dim;
    const x1 = gap.endIndex === null ? g.drawRight : g.xOf(gap.endIndex);
    fillBox(ctx, g.xOf(gap.startIndex), g.yOf(gap.top), x1, g.yOf(gap.bottom), colors.fill, colors.line);
    label(ctx, gap.status === 'partial' ? 'FVG (partial)' : 'FVG', g.xOf(gap.startIndex), g.yOf(gap.top) - 2, colors.line, g.fontPx);
    ctx.globalAlpha = 1;
  }
}

function paintOrderBlocks({ ctx, geometry: g, analysis, showResolved }: OverlayRequest): void {
  for (const block of analysis.orderBlocks) {
    if (block.state === 'mitigated' && !showResolved) continue;
    const colors =
      block.state === 'breaker'
        ? THEME.breaker
        : block.direction === 'bullish'
          ? THEME.orderBlockBullish
          : THEME.orderBlockBearish;
    ctx.globalAlpha = block.state === 'unmitigated' ? 1 : 0.6;
    const x1 = block.endIndex === null ? g.drawRight : g.xOf(block.endIndex);
    fillBox(ctx, g.xOf(block.index), g.yOf(block.top), x1, g.yOf(block.bottom), colors.fill, colors.line);
    const name = block.state === 'breaker' ? 'Breaker' : block.direction === 'bullish' ? 'Bull OB' : 'Bear OB';
    label(ctx, name, g.xOf(block.index), g.yOf(block.top) - 2, colors.line, g.fontPx);
    ctx.globalAlpha = 1;
  }
}

function paintPools({ ctx, geometry: g, analysis }: OverlayRequest): void {
  for (const pool of analysis.pools) {
    const x0 = g.xOf(pool.indices[0]);
    const x1 = pool.sweptAt === null ? g.drawRight : g.xOf(pool.sweptAt);
    const y = g.yOf(pool.price);
    hLine(ctx, x0, x1, y, THEME.liquidity, [6, 4]);
    const text = `${pool.side === 'buy' ? 'EQH' : 'EQL'}${pool.sweepKind ? ` (${pool.sweepKind})` : ''}`;
    label(ctx, text, x0, pool.side === 'buy' ? y - 2 : y + g.fontPx + 4, THEME.liquidity, g.fontPx);
  }
}

function paintSweeps({ ctx, geometry: g, analysis }: OverlayRequest): void {
  for (const sweep of analysis.sweeps) {
    const x = g.xOf(sweep.index);
    const y = g.yOf(sweep.level);
    dot(ctx, x, y, Math.max(3, g.fontPx / 3), THEME.sweep);
    label(ctx, sweep.side === 'buy' ? 'BSL swept' : 'SSL swept', x, sweep.side === 'buy' ? y - 6 : y + g.fontPx + 8, THEME.sweep, g.fontPx, 'center');
  }
}

function paintStructure({ ctx, geometry: g, analysis }: OverlayRequest): void {
  for (const brk of analysis.structure) {
    const color = brk.direction === 'bullish' ? THEME.bullish.line : THEME.bearish.line;
    const x0 = g.xOf(brk.swingIndex);
    const x1 = g.xOf(brk.index);
    const y = g.yOf(brk.level);
    hLine(ctx, x0, x1, y, color, brk.type === 'CHoCH' ? [] : [3, 3]);
    label(ctx, brk.type, (x0 + x1) / 2, brk.direction === 'bullish' ? y - 2 : y + g.fontPx + 4, color, g.fontPx, 'center');
  }
}

function paintSwings({ ctx, geometry: g, analysis }: OverlayRequest): void {
  for (const swing of analysis.swings) {
    dot(ctx, g.xOf(swing.index), g.yOf(swing.price), 2.5, swing.type === 'high' ? THEME.bearish.line : THEME.bullish.line);
  }
}

function paintRange({ ctx, geometry: g, analysis }: OverlayRequest): void {
  const range = analysis.range;
  if (!range) return;
  const x0 = g.xOf(range.fromIndex);
  const x1 = g.drawRight;
  fillBox(ctx, x0, g.yOf(range.high), x1, g.yOf(range.equilibrium), THEME.premium);
  fillBox(ctx, x0, g.yOf(range.equilibrium), x1, g.yOf(range.low), THEME.discount);
  hLine(ctx, x0, x1, g.yOf(range.equilibrium), THEME.equilibrium, [8, 5], 1);
  label(ctx, 'EQ 50%', x1, g.yOf(range.equilibrium) - 2, THEME.equilibrium, g.fontPx, 'right');
  label(ctx, 'Premium', x1, g.yOf(range.high) + g.fontPx + 2, THEME.bearish.line, g.fontPx, 'right');
  label(ctx, 'Discount', x1, g.yOf(range.low) - 2, THEME.bullish.line, g.fontPx, 'right');

  if (range.oteTop !== null && range.oteBottom !== null) {
    fillBox(ctx, x0, g.yOf(range.oteTop), x1, g.yOf(range.oteBottom), THEME.ote.fill, THEME.ote.line, [4, 3]);
    label(ctx, 'OTE', x0, g.yOf(range.oteTop) - 2, THEME.ote.line, g.fontPx);
  }
}

function paintSessions({ ctx, geometry: g, analysis }: OverlayRequest): void {
  for (const session of analysis.sessions) {
    const x0 = g.xOf(session.startIndex) - g.pitch / 2;
    const x1 = g.xOf(session.endIndex) + g.pitch / 2;
    fillBox(ctx, x0, g.plotTop, x1, g.plotBottom, THEME.session[session.name]);
    label(ctx, session.name, x0 + 2, g.plotTop + g.fontPx + 2, '#dddddd', g.fontPx);
  }
}

function paintJudas({ ctx, geometry: g, analysis }: OverlayRequest): void {
  for (const judas of analysis.judas) {
    const x = g.xOf(judas.index);
    const swept = judas.direction === 'bearish' ? judas.asiaHigh : judas.asiaLow;
    const color = judas.direction === 'bearish' ? THEME.bearish.line : THEME.bullish.line;
    hLine(ctx, g.xOf(judas.index) - g.pitch * 6, g.xOf(judas.endIndex), g.yOf(swept), color, [2, 3], 1);
    label(ctx, `Judas swing (${judas.direction})`, x, g.yOf(swept) + (judas.direction === 'bearish' ? -6 : g.fontPx + 8), color, g.fontPx, 'center');
  }
}

function paintLevels({ ctx, geometry: g, analysis }: OverlayRequest): void {
  for (const level of analysis.levels) {
    const y = g.yOf(level.price);
    hLine(ctx, g.xOf(level.fromIndex), g.drawRight, y, THEME.level, [2, 4], 1);
    label(ctx, level.label, g.drawRight, y - 2, THEME.level, g.fontPx, 'right');
  }
}

function paintHigherTimeframe({ ctx, geometry: g, analysis, projected }: OverlayRequest): void {
  const rank = TIMEFRAME_RANK[analysis.timeframe];
  for (const zone of projected) {
    if (TIMEFRAME_RANK[zone.source] <= rank) continue;
    const yTop = g.yOf(zone.top);
    const yBottom = g.yOf(zone.bottom);
    if (Math.max(yTop, yBottom) < g.plotTop || Math.min(yTop, yBottom) > g.plotBottom) continue;

    const text = `${zone.source.toUpperCase()} ${zone.label}`;
    if (zone.top === zone.bottom) {
      hLine(ctx, g.plotLeft, g.drawRight, yTop, THEME.htf.line, [10, 6], 1);
    } else {
      fillBox(ctx, g.plotLeft, yTop, g.drawRight, yBottom, THEME.htf.fill, THEME.htf.line, [10, 6]);
    }
    label(ctx, text, g.plotLeft + 4, Math.min(yTop, yBottom) - 2, THEME.htf.line, g.fontPx);
  }
}

function paintDebug({ ctx, geometry: g }: OverlayRequest): void {
  ctx.save();
  ctx.strokeStyle = THEME.debug;
  ctx.lineWidth = 1;
  for (const box of g.candleBoxes) {
    ctx.strokeRect(box.xLeft - 0.5, box.yHigh - 0.5, box.xRight - box.xLeft + 1, box.yLow - box.yHigh + 1);
  }
  ctx.restore();
}
