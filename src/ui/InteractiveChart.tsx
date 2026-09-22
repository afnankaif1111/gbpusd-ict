import { useEffect, useMemo, useRef, useState, type MouseEvent, type WheelEvent } from 'react';
import { candlesToCsv, downloadBlob } from '../export/candles';
import type { IctAnalysis } from '../ict/annotations';
import type { ProjectedZone } from '../mtf/types';
import type { CandleBox, ChartGeometry } from '../pipeline/geometry';
import type { LayerVisibility } from '../render/layers';
import { renderOverlay } from '../render/overlay';
import type { Candle, Timeframe } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sun,
  Moon,
  Download,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface Props {
  candles: readonly Candle[];
  analysis: IctAnalysis | null;
  timeframe: Timeframe;
  symbol: string;
  layers: LayerVisibility;
  projected: readonly ProjectedZone[];
  showResolved: boolean;
}

export function InteractiveChart({
  candles,
  analysis,
  timeframe,
  symbol,
  layers,
  projected,
  showResolved,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Viewport / pan & zoom state
  const [pitch, setPitch] = useState<number>(10);
  const [panOffset, setPanOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; offset: number } | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isDark, setIsDark] = useState<boolean>(true);

  // Reset pan whenever candles or timeframe changes
  useEffect(() => {
    setPanOffset(0);
    setHoverIndex(null);
  }, [timeframe, symbol, candles.length]);

  // Dimensions & layout margins
  const margins = useMemo(
    () => ({
      left: 12,
      top: 24,
      right: 74,
      bottom: 28,
    }),
    [],
  );

  // Geometry calculation for the current viewport
  const geometryData = useMemo(() => {
    if (candles.length === 0) return null;

    const canvas = canvasRef.current;
    const width = canvas ? canvas.width / (window.devicePixelRatio || 1) : 900;
    const height = canvas ? canvas.height / (window.devicePixelRatio || 1) : 520;

    const plotLeft = margins.left;
    const plotRight = Math.max(plotLeft + 100, width - margins.right);
    const plotTop = margins.top;
    const plotBottom = Math.max(plotTop + 100, height - margins.bottom);
    const plotHeight = plotBottom - plotTop;

    const totalCandles = candles.length;
    const lastAnchorX = plotRight - 40 + panOffset;

    const xOf = (index: number): number => {
      return lastAnchorX - (totalCandles - 1 - index) * pitch;
    };

    // Find visible index range
    let minIdx = totalCandles - 1;
    let maxIdx = 0;
    for (let i = 0; i < totalCandles; i++) {
      const x = xOf(i);
      if (x >= plotLeft - pitch && x <= plotRight + pitch) {
        if (i < minIdx) minIdx = i;
        if (i > maxIdx) maxIdx = i;
      }
    }

    // Determine min/max price for the visible window
    const visibleCandles = minIdx <= maxIdx ? candles.slice(minIdx, maxIdx + 1) : candles.slice(-20);
    let minPrice = Math.min(...visibleCandles.map((c) => c.low));
    let maxPrice = Math.max(...visibleCandles.map((c) => c.high));

    if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || minPrice === maxPrice) {
      minPrice = (candles[0]?.low ?? 1.3) * 0.99;
      maxPrice = (candles[0]?.high ?? 1.3) * 1.01;
    }

    const priceSpan = maxPrice - minPrice;
    const paddedMin = minPrice - priceSpan * 0.08;
    const paddedMax = maxPrice + priceSpan * 0.08;
    const paddedSpan = paddedMax - paddedMin;

    const yOf = (price: number): number => {
      const fraction = (price - paddedMin) / paddedSpan;
      return plotBottom - fraction * plotHeight;
    };

    const priceAtY = (y: number): number => {
      const fraction = (plotBottom - y) / plotHeight;
      return paddedMin + fraction * paddedSpan;
    };

    const candleBoxes: CandleBox[] = candles.map((c, i) => {
      const xc = xOf(i);
      const halfW = Math.max(1, Math.floor(pitch * 0.35));
      return {
        xLeft: xc - halfW,
        xRight: xc + halfW,
        yHigh: yOf(c.high),
        yLow: yOf(c.low),
      };
    });

    const geometry: ChartGeometry = {
      xOf,
      yOf,
      pitch,
      plotLeft,
      plotTop,
      plotBottom,
      drawRight: Math.min(plotRight, xOf(totalCandles - 1) + 8 * pitch),
      fontPx: 11,
      candleBoxes,
    };

    return {
      geometry,
      width,
      height,
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      minPrice: paddedMin,
      maxPrice: paddedMax,
      yOf,
      xOf,
      priceAtY,
      visibleCandles,
    };
  }, [candles, pitch, panOffset, margins]);

  // Resize canvas according to parent container and device pixel ratio
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = (): void => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(400, Math.floor(rect.width));
      const h = 540;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Main rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !geometryData || candles.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    const { width, height, plotLeft, plotRight, plotTop, plotBottom, minPrice, maxPrice, geometry, yOf, xOf } =
      geometryData;

    // Background & Palette
    const bg = isDark ? '#0f172a' : '#ffffff';
    const axisBg = isDark ? '#1e293b' : '#f8fafc';
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const borderColor = isDark ? '#334155' : '#e2e8f0';
    const bullColor = '#089981';
    const bearColor = '#f23645';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // 1. Draw Grid & Horizontal Price Levels
    const numPriceTicks = 7;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.fillStyle = textColor;
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';

    const priceStep = (maxPrice - minPrice) / numPriceTicks;
    for (let i = 0; i <= numPriceTicks; i++) {
      const price = minPrice + i * priceStep;
      const y = Math.round(yOf(price));
      if (y >= plotTop && y <= plotBottom) {
        ctx.beginPath();
        ctx.moveTo(plotLeft, y + 0.5);
        ctx.lineTo(plotRight, y + 0.5);
        ctx.stroke();

        // Right axis price label
        const formattedPrice = price >= 100 ? price.toFixed(2) : price.toFixed(5);
        ctx.fillText(formattedPrice, plotRight + 6, y + 3);
      }
    }

    // 2. Draw Vertical Time Grid Lines
    const stepBars = Math.max(8, Math.floor(80 / pitch));
    ctx.textAlign = 'center';
    for (let i = 0; i < candles.length; i += stepBars) {
      const x = Math.round(xOf(i));
      if (x >= plotLeft && x <= plotRight) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, plotTop);
        ctx.lineTo(x + 0.5, plotBottom);
        ctx.stroke();

        const timeStr = formatCandleTime(candles[i].time, timeframe);
        ctx.fillText(timeStr, x, height - 10);
      }
    }

    // 3. Draw Candlesticks
    const halfBody = Math.max(1, Math.floor(pitch * 0.35));
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const xc = Math.round(xOf(i));
      if (xc < plotLeft - pitch || xc > plotRight + pitch) continue;

      const yO = Math.round(yOf(c.open));
      const yC = Math.round(yOf(c.close));
      const yH = Math.round(yOf(c.high));
      const yL = Math.round(yOf(c.low));

      const isBull = c.close >= c.open;
      const candleColor = isBull ? bullColor : bearColor;

      // Wick
      ctx.strokeStyle = candleColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xc + 0.5, yH);
      ctx.lineTo(xc + 0.5, yL);
      ctx.stroke();

      // Body
      ctx.fillStyle = candleColor;
      const top = Math.min(yO, yC);
      const h = Math.max(1, Math.abs(yC - yO));
      ctx.fillRect(xc - halfBody, top, halfBody * 2 + 1, h);
    }

    // 4. Render ICT Overlays
    if (analysis) {
      renderOverlay({
        ctx,
        geometry,
        analysis,
        layers,
        projected,
        showResolved,
      });
    }

    // 5. Draw Axes Borders
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    // Right Price Axis Boundary
    ctx.fillStyle = axisBg;
    ctx.fillRect(plotRight, 0, width - plotRight, height);
    ctx.strokeRect(plotRight + 0.5, 0, 0, height);

    // Re-draw price ticks over axis background
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    for (let i = 0; i <= numPriceTicks; i++) {
      const price = minPrice + i * priceStep;
      const y = Math.round(yOf(price));
      if (y >= plotTop && y <= plotBottom) {
        const formattedPrice = price >= 100 ? price.toFixed(2) : price.toFixed(5);
        ctx.fillText(formattedPrice, plotRight + 6, y + 3);
      }
    }

    // Bottom Time Axis Boundary
    ctx.fillRect(0, plotBottom, plotRight, height - plotBottom);
    ctx.strokeRect(0, plotBottom + 0.5, plotRight, 0);

    // Re-draw time labels over time axis background
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    for (let i = 0; i < candles.length; i += stepBars) {
      const x = Math.round(xOf(i));
      if (x >= plotLeft && x <= plotRight) {
        const timeStr = formatCandleTime(candles[i].time, timeframe);
        ctx.fillText(timeStr, x, height - 10);
      }
    }

    // Current Price Line
    const lastCandle = candles[candles.length - 1];
    if (lastCandle) {
      const lastY = Math.round(yOf(lastCandle.close));
      if (lastY >= plotTop && lastY <= plotBottom) {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = lastCandle.close >= lastCandle.open ? bullColor : bearColor;
        ctx.beginPath();
        ctx.moveTo(plotLeft, lastY + 0.5);
        ctx.lineTo(plotRight, lastY + 0.5);
        ctx.stroke();

        // Price badge
        ctx.fillStyle = ctx.strokeStyle;
        const tagText = lastCandle.close >= 100 ? lastCandle.close.toFixed(2) : lastCandle.close.toFixed(5);
        ctx.fillRect(plotRight, lastY - 8, width - plotRight, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(tagText, plotRight + 6, lastY + 3);
        ctx.restore();
      }
    }

    // 6. Crosshair & Hover Tooltip
    if (mousePos && mousePos.x >= plotLeft && mousePos.x <= plotRight && mousePos.y >= plotTop && mousePos.y <= plotBottom) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.lineWidth = 1;

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(mousePos.x + 0.5, plotTop);
      ctx.lineTo(mousePos.x + 0.5, plotBottom);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(plotLeft, mousePos.y + 0.5);
      ctx.lineTo(plotRight, mousePos.y + 0.5);
      ctx.stroke();

      // Price indicator on right axis
      const hoveredPrice = geometryData.priceAtY(mousePos.y);
      const priceText = hoveredPrice >= 100 ? hoveredPrice.toFixed(2) : hoveredPrice.toFixed(5);
      ctx.fillStyle = isDark ? '#334155' : '#475569';
      ctx.fillRect(plotRight, mousePos.y - 9, width - plotRight, 18);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.font = '10px monospace, system-ui, sans-serif';
      ctx.fillText(priceText, plotRight + 6, mousePos.y + 3);

      // Time indicator on bottom axis
      if (hoverIndex !== null && candles[hoverIndex]) {
        const timeText = formatFullTime(candles[hoverIndex].time);
        ctx.fillStyle = isDark ? '#334155' : '#475569';
        const textW = ctx.measureText(timeText).width + 12;
        ctx.fillRect(mousePos.x - textW / 2, plotBottom, textW, height - plotBottom);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(timeText, mousePos.x, height - 10);
      }
      ctx.restore();
    }

    ctx.restore();
  }, [geometryData, candles, analysis, layers, projected, showResolved, mousePos, hoverIndex, isDark, timeframe]);

  // Mouse interaction handlers
  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>): void => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    setDragStart({ x: e.clientX, offset: panOffset });
  };

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    if (!canvas || !geometryData) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });

    if (isDragging && dragStart) {
      const deltaX = e.clientX - dragStart.x;
      setPanOffset(dragStart.offset + deltaX);
    } else {
      // Find hovered candle
      let closestIdx: number | null = null;
      let minDistance = Infinity;
      for (let i = 0; i < candles.length; i++) {
        const cx = geometryData.xOf(i);
        const dist = Math.abs(cx - x);
        if (dist < minDistance && dist <= Math.max(6, pitch / 2)) {
          minDistance = dist;
          closestIdx = i;
        }
      }
      setHoverIndex(closestIdx);
    }
  };

  const handleMouseUp = (): void => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleMouseLeave = (): void => {
    setIsDragging(false);
    setDragStart(null);
    setMousePos(null);
    setHoverIndex(null);
  };

  const handleWheel = (e: WheelEvent<HTMLCanvasElement>): void => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setPitch((prev) => {
      const next = Math.max(3, Math.min(60, prev * zoomFactor));
      return Number(next.toFixed(2));
    });
  };

  const handleExportPng = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(`${symbol.toLowerCase()}-${timeframe}-ict-chart.png`, blob);
    });
  };

  const handleExportCsv = (): void => {
    if (candles.length > 0) {
      downloadBlob(`${symbol.toLowerCase()}-${timeframe}-candles.csv`, new Blob([candlesToCsv(candles)], { type: 'text/csv' }));
    }
  };

  // Active candle for HUD (hovered candle or latest candle)
  const activeCandle = hoverIndex !== null && candles[hoverIndex] ? candles[hoverIndex] : candles[candles.length - 1];
  const priceChange = activeCandle ? activeCandle.close - activeCandle.open : 0;
  const percentChange = activeCandle && activeCandle.open > 0 ? (priceChange / activeCandle.open) * 100 : 0;
  const isUp = priceChange >= 0;

  return (
    <Card className="overflow-hidden border-border/80 shadow-md bg-card/60 backdrop-blur-sm" ref={containerRef}>
      {/* Chart Top Header & HUD */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-muted/30">
        {/* HUD: Symbol, Timeframe & Candlestick Metrics */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm tracking-tight text-foreground">{symbol}</span>
            <Badge variant="accent" className="font-mono text-[10px] px-1.5 py-0 h-4 uppercase">
              {timeframe}
            </Badge>
          </div>

          {activeCandle && (
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted-foreground">
              <span>
                O: <b className="text-foreground">{formatPrice(activeCandle.open)}</b>
              </span>
              <span>
                H: <b className="text-foreground">{formatPrice(activeCandle.high)}</b>
              </span>
              <span>
                L: <b className="text-foreground">{formatPrice(activeCandle.low)}</b>
              </span>
              <span>
                C: <b className="text-foreground">{formatPrice(activeCandle.close)}</b>
              </span>
              <Badge
                variant={isUp ? 'bullish' : 'bearish'}
                className="gap-1 font-mono text-[10px] h-4.5 px-1.5"
              >
                {isUp ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
                <span>
                  {isUp ? '+' : ''}
                  {formatPrice(priceChange)} ({isUp ? '+' : ''}
                  {percentChange.toFixed(2)}%)
                </span>
              </Badge>
            </div>
          )}
        </div>

        {/* Chart View Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 border-border/60"
            title="Zoom in"
            onClick={() => setPitch((p) => Math.min(60, p * 1.25))}
          >
            <ZoomIn className="size-3.5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 border-border/60"
            title="Zoom out"
            onClick={() => setPitch((p) => Math.max(3, p * 0.8))}
          >
            <ZoomOut className="size-3.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px] border-border/60"
            title="Reset chart view"
            onClick={() => {
              setPanOffset(0);
              setPitch(10);
            }}
          >
            <RotateCcw className="size-3 mr-1" />
            <span>Reset</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 border-border/60"
            title="Toggle Theme"
            onClick={() => setIsDark((d) => !d)}
          >
            {isDark ? <Sun className="size-3.5 text-amber-400" /> : <Moon className="size-3.5 text-sky-400" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px] border-border/60"
            title="Export chart as PNG"
            onClick={handleExportPng}
          >
            <Download className="size-3 mr-1" />
            <span>PNG</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px] border-border/60"
            title="Export candlestick data as CSV"
            onClick={handleExportCsv}
          >
            <FileSpreadsheet className="size-3 mr-1" />
            <span>CSV</span>
          </Button>
        </div>
      </div>

      {/* Chart Canvas */}
      <canvas
        ref={canvasRef}
        className={`w-full block select-none ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      />
    </Card>
  );
}

function formatCandleTime(unixSeconds: number, timeframe: Timeframe): string {
  const d = new Date(unixSeconds * 1000);
  if (timeframe === '1d') {
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  }
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

function formatFullTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  return `${m} ${day} ${hours}:${mins} UTC`;
}

function formatPrice(val: number): string {
  if (Math.abs(val) >= 100) return val.toFixed(2);
  return val.toFixed(5);
}
