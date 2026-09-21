import type { IctAnalysis } from '../ict/annotations';
import type { Direction, Timeframe } from '../types';

/** Whichever charts the user has analysed so far. */
export type AnalysisSet = Partial<Record<Timeframe, IctAnalysis>>;

/** A price band (or single line when top === bottom) taken from a higher timeframe. */
export interface ProjectedZone {
  source: Timeframe;
  label: string;
  kind: 'fvg' | 'orderBlock' | 'pool' | 'level' | 'equilibrium' | 'ote';
  direction: Direction | null;
  top: number;
  bottom: number;
}

export type BiasStrength = 'strong' | 'partial' | 'conflict' | 'none';
export type PriceLocation = 'premium' | 'discount' | 'equilibrium';

export interface HtfBias {
  direction: Direction | 'neutral';
  strength: BiasStrength;
  daily: Direction | null;
  hourly: Direction | null;
  /** Where the latest close sits inside the higher-timeframe dealing range. */
  location: PriceLocation | null;
}

export interface ConfluenceZone {
  timeframe: Timeframe;
  kind: 'FVG' | 'Order block';
  direction: Direction;
  top: number;
  bottom: number;
  score: number;
  reasons: string[];
  /** The last close is inside the zone. */
  containsPrice: boolean;
}
