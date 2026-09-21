import type { Candle, Direction, Timeframe } from '../types';

/** A confirmed pivot high/low. `confirmedAt` is when it became knowable (no look-ahead). */
export interface SwingPoint {
  type: 'high' | 'low';
  index: number;
  confirmedAt: number;
  price: number;
}

/** Break of structure (trend continuation) or change of character (first break against the trend). */
export interface StructureBreak {
  type: 'BOS' | 'CHoCH';
  direction: Direction;
  /** Price of the broken swing. */
  level: number;
  swingIndex: number;
  /** Candle whose close broke the swing. */
  index: number;
}

export type FvgStatus = 'open' | 'partial' | 'filled';

export interface FairValueGap {
  direction: Direction;
  top: number;
  bottom: number;
  /** First candle of the 3-candle pattern; the zone is drawn from here. */
  startIndex: number;
  /** Candle that fully filled the gap, or null while it is still (partly) open. */
  endIndex: number | null;
  status: FvgStatus;
  /** True if the middle candle was a displacement candle. */
  impulsive: boolean;
}

export type OrderBlockState = 'unmitigated' | 'mitigated' | 'breaker';

export interface OrderBlock {
  direction: Direction;
  top: number;
  bottom: number;
  /** The order block candle itself. */
  index: number;
  /** The structure break it produced. */
  breakIndex: number;
  /** Candle where it was mitigated or turned into a breaker, or null while unmitigated. */
  endIndex: number | null;
  state: OrderBlockState;
}

/** Resting liquidity: `buy` = buy-side (above equal highs), `sell` = sell-side (below equal lows). */
export interface LiquidityPool {
  side: 'buy' | 'sell';
  price: number;
  /** Swing indices that form the pool (at least two). */
  indices: number[];
  sweptAt: number | null;
  /** `sweep`: wick took the level and closed back. `run`: candle closed beyond the level. */
  sweepKind: 'sweep' | 'run' | null;
}

/** A single swing level that was taken by a wick and rejected (closed back inside). */
export interface LiquiditySweep {
  side: 'buy' | 'sell';
  level: number;
  levelIndex: number;
  index: number;
}

/** Current dealing range from the latest swing high and swing low. */
export interface DealingRange {
  high: number;
  low: number;
  equilibrium: number;
  fromIndex: number;
  bias: Direction | null;
  /** Optimal trade entry band (62%-79% retracement) in the direction of `bias`. */
  oteTop: number | null;
  oteBottom: number | null;
}

export type SessionName = 'Asia' | 'London' | 'New York';

export interface Session {
  name: SessionName;
  /** New York date the session belongs to. */
  dayKey: string;
  startIndex: number;
  endIndex: number;
  high: number;
  low: number;
}

/** London-open sweep of the Asia range that closes back inside it. */
export interface JudasSwing {
  /** `bearish` = Asia high swept then rejected (expect lower). */
  direction: Direction;
  asiaHigh: number;
  asiaLow: number;
  index: number;
  endIndex: number;
}

export interface KeyLevel {
  label: string;
  price: number;
  fromIndex: number;
}

/** Everything the engine finds on one chart. */
export interface IctAnalysis {
  timeframe: Timeframe;
  candles: readonly Candle[];
  swings: SwingPoint[];
  structure: StructureBreak[];
  trend: Direction | null;
  fvgs: FairValueGap[];
  orderBlocks: OrderBlock[];
  pools: LiquidityPool[];
  sweeps: LiquiditySweep[];
  range: DealingRange | null;
  sessions: Session[];
  judas: JudasSwing[];
  levels: KeyLevel[];
}
