import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { candlesToCsv, downloadBlob } from '../export/candles';
import type { ProjectedZone } from '../mtf/types';
import { analyzeScreenshot, type ScreenshotAnalysis } from '../pipeline/analyzeScreenshot';
import type { LayerVisibility } from '../render/layers';
import { renderOverlay } from '../render/overlay';
import type { Timeframe } from '../types';
import { hueClassifier, paletteClassifier, parseHexColor } from '../vision/colors';
import { loadRasterImage } from '../vision/loadImage';
import { readAxisLabels } from '../vision/ocr';
import type { AxisLabel } from '../vision/priceAxis';
import { defaultAxisStrip, defaultPlotRegion, type RasterImage, type Rect } from '../vision/raster';
import { resolveAxis, type ManualPoint } from './calibration';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  UploadCloud,
  Calendar,
  ScanText,
  MousePointerClick,
  Sparkles,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';

interface Props {
  timeframe: Timeframe;
  layers: LayerVisibility;
  showResolved: boolean;
  projected: readonly ProjectedZone[];
  onResult: (timeframe: Timeframe, result: ScreenshotAnalysis | null) => void;
}

interface Settings {
  lastCandleLocal: string;
  utcOffsetHours: number;
  colorMode: 'auto' | 'custom';
  upColor: string;
  downColor: string;
}

const DEFAULT_SETTINGS: Settings = {
  lastCandleLocal: '',
  utcOffsetHours: -new Date().getTimezoneOffset() / 60,
  colorMode: 'auto',
  upColor: '#089981',
  downColor: '#f23645',
};

export function ChartPanel({ timeframe, layers, showResolved, projected, onResult }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<RasterImage | null>(null);
  const [region, setRegion] = useState<Rect | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ocrLabels, setOcrLabels] = useState<AxisLabel[]>([]);
  const [manualPoints, setManualPoints] = useState<ManualPoint[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScreenshotAnalysis | null>(null);

  const calibration = useMemo(() => resolveAxis(ocrLabels, manualPoints), [ocrLabels, manualPoints]);
  const isDaily = timeframe === '1d';

  const reset = (next: ScreenshotAnalysis | null): void => {
    setResult(next);
    onResult(timeframe, next);
  };

  // Redraw the screenshot and all overlays whenever anything visible changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);

    if (result) {
      renderOverlay({ ctx, geometry: result.geometry, analysis: result.analysis, layers, projected, showResolved });
    }
    ctx.fillStyle = '#ff00ff';
    for (const point of manualPoints) ctx.fillRect(0, point.y - 1, image.width, 2);
  }, [image, result, layers, projected, showResolved, manualPoints]);

  const onFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const raster = await loadRasterImage(file);
      setImage(raster);
      setRegion(defaultPlotRegion(raster));
      setOcrLabels([]);
      setManualPoints([]);
      reset(null);
    } catch {
      setError('Could not read that image. Use a PNG or JPEG screenshot.');
    }
  };

  const readAxis = async (): Promise<void> => {
    if (!image) return;
    setBusy(true);
    setError('');
    try {
      const labels = await readAxisLabels(image, defaultAxisStrip(image));
      setOcrLabels(labels);
      if (labels.length < 2) setError('OCR found fewer than 2 price labels. Click two points on the chart instead.');
    } catch (e) {
      setError(`OCR failed (it needs an internet connection the first time): ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const pickPoint = (event: MouseEvent<HTMLCanvasElement>): void => {
    if (!picking || !image) return;
    const box = event.currentTarget.getBoundingClientRect();
    const y = Math.round(((event.clientY - box.top) * image.height) / box.height);
    setManualPoints((points) => (points.length >= 2 ? [{ y, price: '' }] : [...points, { y, price: '' }]));
    reset(null);
  };

  const analyze = (): void => {
    setError('');
    if (!image || !region) return;
    if (!calibration.axis) return setError(calibration.note);
    if (!settings.lastCandleLocal) return setError('Enter the date and time of the last (right-most) candle.');

    try {
      const lastCandleTime = Date.parse(`${settings.lastCandleLocal}:00Z`) / 1000 - settings.utcOffsetHours * 3600;
      const classifier =
        settings.colorMode === 'auto'
          ? hueClassifier()
          : paletteClassifier(parseHexColor(settings.upColor), parseHexColor(settings.downColor));
      reset(analyzeScreenshot({ image, timeframe, lastCandleTime, classifier, axis: calibration.axis, region }));
    } catch (e) {
      reset(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const set = <K extends keyof Settings>(key: K, value: Settings[K]): void => setSettings((s) => ({ ...s, [key]: value }));
  const setEdge = (edge: keyof Rect, value: number): void => setRegion((r) => (r ? { ...r, [edge]: value } : r));

  const exportPng = (): void => canvasRef.current?.toBlob((blob) => blob && downloadBlob(`gbpusd-${timeframe}-annotated.png`, blob));
  const exportCsv = (): void => {
    if (result) downloadBlob(`gbpusd-${timeframe}-candles.csv`, new Blob([candlesToCsv(result.candles)], { type: 'text/csv' }));
  };

  return (
    <div className="space-y-3">
      {/* Upload Drop Area Card */}
      <Card className="border-border/80 bg-card/70 backdrop-blur-sm">
        <CardContent className="p-4">
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/80 hover:border-primary/60 rounded-lg p-6 cursor-pointer bg-muted/20 hover:bg-muted/40 transition-all text-center group">
            <UploadCloud className="size-8 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
            <span className="text-xs font-semibold text-foreground">
              {image ? 'Replace screenshot image' : `Upload ${timeframe.toUpperCase()} TradingView screenshot`}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5">
              PNG or JPEG with clear candlesticks and price axis
            </span>
            <input type="file" accept="image/*" onChange={onFile} className="hidden" />
          </label>
        </CardContent>
      </Card>

      {image && region && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Step 1: Last Candle Time */}
          <Card className="border-border/80 bg-card/70">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="size-3.5 text-primary" />
                <span>1. Last Candle Time</span>
              </CardTitle>
              <CardDescription className="text-[11px]">
                Required for accurate session time alignment
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">
                  {isDaily ? 'Date' : 'Date & Time'} of right-most bar:
                </label>
                <Input
                  type={isDaily ? 'date' : 'datetime-local'}
                  value={isDaily ? settings.lastCandleLocal.slice(0, 10) : settings.lastCandleLocal}
                  onChange={(e) => set('lastCandleLocal', isDaily ? `${e.target.value}T00:00` : e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {!isDaily && (
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">
                    Chart UTC offset (hours):
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    value={settings.utcOffsetHours}
                    onChange={(e) => set('utcOffsetHours', Number(e.target.value))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Price Axis Calibration */}
          <Card className="border-border/80 bg-card/70">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <ScanText className="size-3.5 text-primary" />
                <span>2. Price Axis Calibration</span>
              </CardTitle>
              <CardDescription className="text-[11px]">
                Automatic OCR or manual 2-point mapping
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2 text-xs">
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={readAxis}
                  disabled={busy}
                  className="gap-1 text-[11px] h-7 flex-1"
                >
                  <ScanText className="size-3" />
                  <span>{busy ? 'Reading…' : 'Read Axis (OCR)'}</span>
                </Button>
                <Button
                  variant={picking ? 'active' : 'outline'}
                  size="sm"
                  onClick={() => setPicking((p) => !p)}
                  className="gap-1 text-[11px] h-7 flex-1"
                >
                  <MousePointerClick className="size-3" />
                  <span>{picking ? 'Stop Clicking' : 'Pick 2 Points'}</span>
                </Button>
              </div>

              {manualPoints.map((point, i) => (
                <div key={point.y} className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground font-mono">P{i + 1} (y={point.y}):</span>
                  <Input
                    value={point.price}
                    placeholder="e.g. 1.34250"
                    onChange={(e) =>
                      setManualPoints((pts) =>
                        pts.map((p, j) => (j === i ? { ...p, price: e.target.value } : p)),
                      )
                    }
                    className="h-7 text-xs font-mono flex-1"
                  />
                </div>
              ))}

              <p className="text-[11px] text-muted-foreground leading-snug">
                {calibration.note}
              </p>
            </CardContent>
          </Card>

          {/* Step 3: Detection Parameters & Actions */}
          <Card className="border-border/80 bg-card/70">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <SlidersHorizontal className="size-3.5 text-primary" />
                <span>3. Detection & Run</span>
              </CardTitle>
              <CardDescription className="text-[11px]">
                Candle color classification & execution
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Colors:</span>
                <Select
                  value={settings.colorMode}
                  onChange={(e) => set('colorMode', e.target.value as Settings['colorMode'])}
                  className="h-7 text-xs flex-1"
                >
                  <option value="auto">Automatic (Green/Red)</option>
                  <option value="custom">Custom Palette</option>
                </Select>
              </div>

              {settings.colorMode === 'custom' && (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    Up: <input type="color" value={settings.upColor} onChange={(e) => set('upColor', e.target.value)} className="h-6 w-6 rounded border cursor-pointer" />
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    Down: <input type="color" value={settings.downColor} onChange={(e) => set('downColor', e.target.value)} className="h-6 w-6 rounded border cursor-pointer" />
                  </label>
                </div>
              )}

              <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground pt-1">
                {(['left', 'top', 'right', 'bottom'] as const).map((edge) => (
                  <div key={edge}>
                    <span className="capitalize">{edge}:</span>
                    <Input
                      type="number"
                      value={region[edge]}
                      onChange={(e) => setEdge(edge, Number(e.target.value))}
                      className="h-6 px-1 text-[10px] font-mono"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-1 flex flex-wrap gap-1.5">
                <Button
                  variant="default"
                  size="sm"
                  onClick={analyze}
                  className="w-full gap-1.5 h-8 font-semibold"
                >
                  <Sparkles className="size-3.5" />
                  <span>Analyze Screenshot</span>
                </Button>

                {result && (
                  <div className="flex gap-1.5 w-full mt-1">
                    <Button variant="outline" size="sm" onClick={exportPng} className="flex-1 h-7 text-[11px]">
                      <Download className="size-3 mr-1" />
                      <span>PNG</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportCsv} className="flex-1 h-7 text-[11px]">
                      <FileSpreadsheet className="size-3 mr-1" />
                      <span>CSV</span>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status / Alert Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {result?.warnings.map((w) => (
        <Alert variant="warning" key={w}>
          <AlertCircle className="size-4" />
          <AlertDescription className="text-xs">{w}</AlertDescription>
        </Alert>
      ))}

      {result && (
        <Alert variant="success">
          <CheckCircle2 className="size-4" />
          <AlertDescription className="text-xs font-medium">
            Successfully reconstructed and analyzed {result.candles.length} candles.
          </AlertDescription>
        </Alert>
      )}

      {/* Screenshot & Overlays Canvas */}
      <Card className="border-border/80 overflow-hidden bg-card/60">
        <canvas
          ref={canvasRef}
          className={`w-full block select-none ${picking ? 'cursor-crosshair' : 'cursor-default'}`}
          onClick={pickPoint}
        />
      </Card>
    </div>
  );
}
