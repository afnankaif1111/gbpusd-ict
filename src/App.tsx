import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAllTimeframes, fetchMarketData } from './data/dataProvider';
import type { DataSourceType } from './data/types';
import type { IctAnalysis } from './ict/annotations';
import { runIct } from './ict/engine';
import { computeBias } from './mtf/bias';
import { findConfluence } from './mtf/confluence';
import type { AnalysisSet } from './mtf/types';
import { projectHigherTimeframeZones } from './mtf/zones';
import type { ScreenshotAnalysis } from './pipeline/analyzeScreenshot';
import { DEFAULT_LAYERS, type LayerKey, type LayerVisibility } from './render/layers';
import { TIMEFRAMES, type Candle, type Timeframe } from './types';
import { ChartPanel } from './ui/ChartPanel';
import { DataImportBar } from './ui/DataImportBar';
import { InteractiveChart } from './ui/InteractiveChart';
import { SummaryPanel } from './ui/SummaryPanel';

export function App() {
  const [appMode, setAppMode] = useState<'api' | 'screenshot'>('api');
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('15m');
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [showResolved, setShowResolved] = useState(false);

  // API Mode State
  const [activeSymbol, setActiveSymbol] = useState<string>('GBPUSD');
  const [activeSource, setActiveSource] = useState<DataSourceType>('sample');
  const [apiCandles, setApiCandles] = useState<Partial<Record<Timeframe, Candle[]>>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Screenshot Mode State
  const [screenshotResults, setScreenshotResults] = useState<Partial<Record<Timeframe, ScreenshotAnalysis>>>({});

  // Initial load: populate sample data for all timeframes so user sees a rich chart immediately
  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const { results } = await fetchAllTimeframes('sample', 'GBPUSD');
        if (!ignore) {
          setApiCandles(results);
          setLastUpdated(Date.now());
        }
      } catch {
        // Fallback gracefully if any error
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  // Compute ICT analyses for all timeframes loaded via API
  const apiAnalyses = useMemo(() => {
    const map: Partial<Record<Timeframe, IctAnalysis>> = {};
    for (const tf of TIMEFRAMES) {
      const candles = apiCandles[tf];
      if (candles && candles.length >= 15) {
        map[tf] = runIct(candles, tf);
      }
    }
    return map;
  }, [apiCandles]);

  // Unified Multi-Timeframe Bias, Projections, and Confluence
  const { bias, projected, confluence } = useMemo(() => {
    const set: AnalysisSet = {};
    for (const tf of TIMEFRAMES) {
      if (appMode === 'api') {
        const analysis = apiAnalyses[tf];
        if (analysis) set[tf] = analysis;
      } else {
        const result = screenshotResults[tf];
        if (result) set[tf] = result.analysis;
      }
    }
    const bias = computeBias(set);
    const projected = projectHigherTimeframeZones(set);
    return { bias, projected, confluence: findConfluence(set, bias, projected) };
  }, [appMode, apiAnalyses, screenshotResults]);

  // Handlers for API Data Fetching
  const handleFetchCurrent = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const candles = await fetchMarketData({
        source: activeSource,
        symbol: activeSymbol,
        timeframe: activeTimeframe,
      });
      setApiCandles((prev) => ({ ...prev, [activeTimeframe]: candles }));
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchAllTimeframes = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const { results, errors } = await fetchAllTimeframes(activeSource, activeSymbol);
      setApiCandles((prev) => ({ ...prev, ...results }));
      setLastUpdated(Date.now());

      const errKeys = Object.keys(errors) as Timeframe[];
      if (errKeys.length > 0) {
        setError(`Failed for some timeframes: ${errKeys.map((k) => `${k}: ${errors[k]}`).join(', ')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = async (symbol: string, source: DataSourceType): Promise<void> => {
    setActiveSymbol(symbol);
    setActiveSource(source);
    setIsLoading(true);
    setError(null);
    try {
      const { results, errors } = await fetchAllTimeframes(source, symbol);
      setApiCandles(results);
      setLastUpdated(Date.now());

      const errKeys = Object.keys(errors) as Timeframe[];
      if (errKeys.length > 0) {
        setError(`Failed for some timeframes: ${errKeys.map((k) => `${k}: ${errors[k]}`).join(', ')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCsvLoaded = (candles: Candle[]): void => {
    setApiCandles((prev) => ({ ...prev, [activeTimeframe]: candles }));
    setLastUpdated(Date.now());
    setError(null);
  };

  const onScreenshotResult = useCallback((timeframe: Timeframe, result: ScreenshotAnalysis | null) => {
    setScreenshotResults((current) => {
      const next = { ...current };
      if (result) next[timeframe] = result;
      else delete next[timeframe];
      return next;
    });
  }, []);

  const currentCandles = apiCandles[activeTimeframe] ?? [];
  const currentAnalysis = apiAnalyses[activeTimeframe] ?? null;

  return (
    <>
      <header className="app-header">
        <div className="title-row">
          <h1>ICT Chart Annotator & Trading Engine</h1>
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-btn ${appMode === 'api' ? 'active' : ''}`}
              onClick={() => setAppMode('api')}
            >
              📊 Live / API Chart
            </button>
            <button
              type="button"
              className={`mode-btn ${appMode === 'screenshot' ? 'active' : ''}`}
              onClick={() => setAppMode('screenshot')}
            >
              📷 Screenshot OCR
            </button>
          </div>
        </div>
        <p className="hint">
          {appMode === 'api'
            ? 'Import candlestick data via API or sample generator. Automatically detects FVGs, Order Blocks, Liquidity Sweeps, BOS, Sessions, and MTF Confluence directly on the chart.'
            : 'Upload TradingView screenshots (1D, 1H, 15M, 5M). Everything runs in your browser; nothing is uploaded anywhere.'}
        </p>
      </header>

      <div className="layout">
        <main>
          {/* Top API Data Import Toolbar (Only in API mode) */}
          {appMode === 'api' && (
            <DataImportBar
              activeTimeframe={activeTimeframe}
              activeSymbol={activeSymbol}
              activeSource={activeSource}
              isLoading={isLoading}
              error={error}
              lastUpdated={lastUpdated}
              onSelectPreset={handleSelectPreset}
              onFetchCurrent={handleFetchCurrent}
              onFetchAllTimeframes={handleFetchAllTimeframes}
              onCsvLoaded={handleCsvLoaded}
              onSymbolChange={setActiveSymbol}
              onSourceChange={setActiveSource}
            />
          )}

          {/* Timeframe Navigation Tabs */}
          <div className="tabs" role="tablist">
            {TIMEFRAMES.map((timeframe) => {
              const count =
                appMode === 'api'
                  ? apiCandles[timeframe]?.length ?? 0
                  : screenshotResults[timeframe]
                    ? screenshotResults[timeframe]?.candles.length
                    : 0;
              const hasData = count > 0;

              return (
                <button
                  key={timeframe}
                  role="tab"
                  aria-selected={activeTimeframe === timeframe}
                  className={hasData ? 'done' : undefined}
                  onClick={() => setActiveTimeframe(timeframe)}
                >
                  {timeframe.toUpperCase()}
                  {hasData && <span className="candle-count"> ({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Interactive Chart Mode */}
          {appMode === 'api' && (
            <div className="chart-view">
              {currentCandles.length > 0 ? (
                <>
                  <InteractiveChart
                    candles={currentCandles}
                    analysis={currentAnalysis}
                    timeframe={activeTimeframe}
                    symbol={activeSymbol}
                    layers={layers}
                    projected={projected}
                    showResolved={showResolved}
                  />

                  {/* Summary Bar of Detected ICT Indicators */}
                  {currentAnalysis && (
                    <div className="ict-metrics-bar">
                      <span className="metric-pill">
                        <b>{currentAnalysis.fvgs.length}</b> FVGs
                      </span>
                      <span className="metric-pill">
                        <b>{currentAnalysis.orderBlocks.length}</b> Order Blocks
                      </span>
                      <span className="metric-pill">
                        <b>{currentAnalysis.pools.length}</b> Liquidity Pools
                      </span>
                      <span className="metric-pill">
                        <b>{currentAnalysis.sweeps.length}</b> Sweeps
                      </span>
                      <span className="metric-pill">
                        <b>{currentAnalysis.structure.length}</b> Structure Breaks
                      </span>
                      <span className="metric-pill">
                        <b>{currentAnalysis.sessions.length}</b> Sessions
                      </span>
                      {currentAnalysis.range?.bias && (
                        <span className="metric-pill highlight">
                          Dealing Range: <b>{currentAnalysis.range.bias.toUpperCase()}</b>
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-chart-notice">
                  <p>No candle data loaded for <b>{activeTimeframe.toUpperCase()}</b>.</p>
                  <button type="button" className="action-btn primary" onClick={handleFetchCurrent} disabled={isLoading}>
                    Load {activeTimeframe.toUpperCase()} Candles
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Screenshot OCR Mode */}
          {appMode === 'screenshot' && (
            <div>
              {TIMEFRAMES.map((timeframe) => (
                <div key={timeframe} hidden={activeTimeframe !== timeframe}>
                  <ChartPanel
                    timeframe={timeframe}
                    layers={layers}
                    showResolved={showResolved}
                    projected={projected}
                    onResult={onScreenshotResult}
                  />
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Sidebar: Layers, Bias & Confluence */}
        <SummaryPanel
          bias={bias}
          confluence={confluence}
          layers={layers}
          showResolved={showResolved}
          onLayerChange={(key: LayerKey, visible) => setLayers((current) => ({ ...current, [key]: visible }))}
          onShowResolvedChange={setShowResolved}
        />
      </div>
    </>
  );
}
