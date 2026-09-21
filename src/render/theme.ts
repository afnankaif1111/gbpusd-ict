/** Colours for every annotation. Zones use a translucent fill and a solid outline. */
export const THEME = {
  bullish: { fill: 'rgba(38, 190, 130, 0.22)', line: '#26be82' },
  bearish: { fill: 'rgba(240, 80, 90, 0.22)', line: '#f0505a' },
  orderBlockBullish: { fill: 'rgba(60, 130, 255, 0.25)', line: '#3c82ff' },
  orderBlockBearish: { fill: 'rgba(255, 150, 40, 0.25)', line: '#ff9628' },
  breaker: { fill: 'rgba(170, 100, 255, 0.22)', line: '#aa64ff' },
  liquidity: '#f5c542',
  sweep: '#ff5fd2',
  level: '#c8c8c8',
  equilibrium: '#f5c542',
  ote: { fill: 'rgba(245, 197, 66, 0.20)', line: '#f5c542' },
  premium: 'rgba(240, 80, 90, 0.06)',
  discount: 'rgba(38, 190, 130, 0.06)',
  session: {
    Asia: 'rgba(120, 120, 255, 0.10)',
    London: 'rgba(255, 190, 60, 0.10)',
    'New York': 'rgba(60, 200, 255, 0.10)',
  },
  htf: { fill: 'rgba(255, 255, 255, 0.05)', line: '#e0e0e0' },
  debug: '#ffe600',
} as const;
