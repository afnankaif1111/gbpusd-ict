import type { Candle } from '../types';

export function parseCandlesFromCsv(csvText: string): Candle[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV must contain a header and at least one candle row.');
  }

  const header = lines[0].toLowerCase().split(/[,\t]/).map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const timeIdx = header.findIndex((h) => ['time', 'date', 'timestamp', 'datetime'].includes(h));
  const openIdx = header.findIndex((h) => ['open', 'o'].includes(h));
  const highIdx = header.findIndex((h) => ['high', 'h'].includes(h));
  const lowIdx = header.findIndex((h) => ['low', 'l'].includes(h));
  const closeIdx = header.findIndex((h) => ['close', 'c'].includes(h));

  if (openIdx === -1 || highIdx === -1 || lowIdx === -1 || closeIdx === -1) {
    throw new Error('CSV header must contain open, high, low, and close columns.');
  }

  const parsed: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,\t]/).map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length <= Math.max(openIdx, highIdx, lowIdx, closeIdx)) continue;

    const open = Number.parseFloat(cols[openIdx]);
    const high = Number.parseFloat(cols[highIdx]);
    const low = Number.parseFloat(cols[lowIdx]);
    const close = Number.parseFloat(cols[closeIdx]);

    if (Number.isNaN(open) || Number.isNaN(high) || Number.isNaN(low) || Number.isNaN(close)) {
      continue;
    }

    let time = 0;
    if (timeIdx !== -1 && cols[timeIdx]) {
      const rawTime = cols[timeIdx];
      const numericTime = Number(rawTime);
      if (!Number.isNaN(numericTime)) {
        time = numericTime > 1e11 ? Math.floor(numericTime / 1000) : Math.floor(numericTime);
      } else {
        const parsedMs = Date.parse(rawTime);
        time = !Number.isNaN(parsedMs) ? Math.floor(parsedMs / 1000) : i * 3600;
      }
    } else {
      time = i * 3600;
    }

    parsed.push({ time, open, high, low, close });
  }

  if (parsed.length === 0) {
    throw new Error('No valid candle rows found in CSV.');
  }

  // Sort chronologically
  parsed.sort((a, b) => a.time - b.time);

  return parsed.map((item, index) => ({
    ...item,
    index,
  }));
}
