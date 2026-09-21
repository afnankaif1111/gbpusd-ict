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
    <section>
      <div className="row">
        <input type="file" accept="image/*" onChange={onFile} />
      </div>

      {image && region && (
        <>
          <fieldset>
            <legend>1. Last candle</legend>
            <div className="row">
              <label>
                {isDaily ? 'Date' : 'Date and time'} of the right-most candle
                <input
                  type={isDaily ? 'date' : 'datetime-local'}
                  value={isDaily ? settings.lastCandleLocal.slice(0, 10) : settings.lastCandleLocal}
                  onChange={(e) => set('lastCandleLocal', isDaily ? `${e.target.value}T00:00` : e.target.value)}
                />
              </label>
              {!isDaily && (
                <label>
                  Chart UTC offset (hours)
                  <input type="number" step="0.5" value={settings.utcOffsetHours} onChange={(e) => set('utcOffsetHours', Number(e.target.value))} />
                </label>
              )}
            </div>
          </fieldset>

          <fieldset>
            <legend>2. Price axis</legend>
            <div className="row">
              <button onClick={readAxis} disabled={busy}>{busy ? 'Reading…' : 'Read price axis (OCR)'}</button>
              <button onClick={() => setPicking((p) => !p)}>{picking ? 'Stop clicking' : 'Or click 2 points on the chart'}</button>
            </div>
            {manualPoints.map((point, i) => (
              <div className="row" key={point.y}>
                <label>
                  Price at line {i + 1} (row {point.y})
                  <input
                    value={point.price}
                    placeholder="1.34250"
                    onChange={(e) => setManualPoints((pts) => pts.map((p, j) => (j === i ? { ...p, price: e.target.value } : p)))}
                  />
                </label>
              </div>
            ))}
            <div className="status">{calibration.note}</div>
          </fieldset>

          <fieldset>
            <legend>3. Candle detection</legend>
            <div className="row">
              <label>
                Colours
                <select value={settings.colorMode} onChange={(e) => set('colorMode', e.target.value as Settings['colorMode'])}>
                  <option value="auto">Automatic (green / red)</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              {settings.colorMode === 'custom' && (
                <>
                  <label>Up <input type="color" value={settings.upColor} onChange={(e) => set('upColor', e.target.value)} /></label>
                  <label>Down <input type="color" value={settings.downColor} onChange={(e) => set('downColor', e.target.value)} /></label>
                </>
              )}
            </div>
            <div className="row">
              Search region (px):
              {(['left', 'top', 'right', 'bottom'] as const).map((edge) => (
                <label key={edge}>
                  {edge}
                  <input type="number" value={region[edge]} onChange={(e) => setEdge(edge, Number(e.target.value))} />
                </label>
              ))}
            </div>
          </fieldset>

          <div className="row">
            <button onClick={analyze}>Analyze chart</button>
            {result && <button onClick={exportPng}>Download annotated PNG</button>}
            {result && <button onClick={exportCsv}>Download candles CSV</button>}
          </div>
        </>
      )}

      {error && <div className="status error">{error}</div>}
      {result?.warnings.map((w) => <div className="status warn" key={w}>{w}</div>)}
      {result && <div className="status">{result.candles.length} candles reconstructed and analysed.</div>}

      <canvas ref={canvasRef} className={picking ? 'picking' : undefined} onClick={pickPoint} />
    </section>
  );
}
