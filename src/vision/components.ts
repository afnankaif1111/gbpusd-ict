import type { Rect } from './raster';
import type { CandleClass } from './colors';

/** One connected blob of candle-coloured pixels. Bounds are inclusive. */
export interface Component {
  cls: CandleClass;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Number of blob pixels in each row, from y0 to y1. Wide rows are the candle body, narrow rows the wick. */
  rowWidths: number[];
}

export const MASK_NONE = 0;
export const MASK_UP = 1;
export const MASK_DOWN = 2;

/** 8-connected flood fill over a class mask (1 = up, 2 = down), limited to `region`. */
export function findComponents(mask: Uint8Array, width: number, region: Rect): Component[] {
  const visited = new Uint8Array(mask.length);
  const components: Component[] = [];
  const stack: number[] = [];

  for (let y = region.top; y < region.bottom; y++) {
    for (let x = region.left; x < region.right; x++) {
      const start = y * width + x;
      const value = mask[start];
      if (value === MASK_NONE || visited[start]) continue;

      let x0 = x;
      let x1 = x;
      let y0 = y;
      let y1 = y;
      const rowCounts = new Map<number, number>();
      visited[start] = 1;
      stack.push(start);

      while (stack.length > 0) {
        const p = stack.pop() as number;
        const px = p % width;
        const py = (p - px) / width;
        rowCounts.set(py, (rowCounts.get(py) ?? 0) + 1);
        if (px < x0) x0 = px;
        if (px > x1) x1 = px;
        if (py < y0) y0 = py;
        if (py > y1) y1 = py;

        for (let dy = -1; dy <= 1; dy++) {
          const ny = py + dy;
          if (ny < region.top || ny >= region.bottom) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = px + dx;
            if (nx < region.left || nx >= region.right) continue;
            const q = ny * width + nx;
            if (mask[q] === value && !visited[q]) {
              visited[q] = 1;
              stack.push(q);
            }
          }
        }
      }

      const rowWidths: number[] = [];
      for (let row = y0; row <= y1; row++) rowWidths.push(rowCounts.get(row) ?? 0);
      components.push({ cls: value === MASK_UP ? 'up' : 'down', x0, y0, x1, y1, rowWidths });
    }
  }
  return components;
}
