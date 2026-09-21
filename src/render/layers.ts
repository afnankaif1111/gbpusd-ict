/** Every drawable layer. The UI shows one checkbox per entry. */
export const LAYERS = [
  { key: 'structure', label: 'Structure (BOS / CHoCH)' },
  { key: 'swings', label: 'Swing points' },
  { key: 'fvg', label: 'Fair value gaps' },
  { key: 'orderBlocks', label: 'Order blocks / breakers' },
  { key: 'liquidity', label: 'Equal highs / lows' },
  { key: 'sweeps', label: 'Liquidity sweeps' },
  { key: 'range', label: 'Premium / discount / OTE' },
  { key: 'sessions', label: 'Sessions / kill zones' },
  { key: 'judas', label: 'Judas swing' },
  { key: 'levels', label: 'PDH / PDL / midnight open' },
  { key: 'htf', label: 'Higher-timeframe zones' },
  { key: 'debug', label: 'Extracted candles (debug)' },
] as const;

export type LayerKey = (typeof LAYERS)[number]['key'];
export type LayerVisibility = Record<LayerKey, boolean>;

export const DEFAULT_LAYERS: LayerVisibility = {
  structure: true,
  swings: false,
  fvg: true,
  orderBlocks: true,
  liquidity: true,
  sweeps: true,
  range: true,
  sessions: true,
  judas: true,
  levels: true,
  htf: true,
  debug: false,
};
