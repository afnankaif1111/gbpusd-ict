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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  Camera,
  Layers,
  Box,
  Zap,
  Waves,
  Crosshair,
  Compass,
  Clock,
  Check,
  LineChart,
  Sun,
  Moon,
  Info,
} from 'lucide-react';

export function App() {
  const [appMode, setAppMode] = useState<'api' | 'screenshot'>('api');
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('15m');
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [showResolved, setShowResolved] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // API Mode State
  const [activeSymbol, setActiveSymbol] = useState<string>('GBPUSD');
  const [activeSource, setActiveSource] = useState<DataSourceType>('sample');
  const [apiCandles, setApiCandles] = useState<Partial<Record<Timeframe, Candle[]>>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Screenshot Mode State
  const [screenshotResults, setScreenshotResults] = useState<Partial<Record<Timeframe, ScreenshotAnalysis>>>({});

  // Sync dark mode class on document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [isDarkMode]);

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
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-150">
      {/* Institutional Navigation Header */}
      <header className="border-b border-border/70 bg-card/80 backdrop-blur-md sticky top-0 z-40 px-4 py-2.5">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <LineChart className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-foreground">
                  ICT Chart Annotator & Trading Engine
                </h1>
                <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4 border-primary/30 text-primary">
                  PRO
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Institutional inner-circle-trader algorithmic orderflow analysis & multi-timeframe confluence
              </p>
            </div>
          </div>

          {/* Mode Switcher & Theme Control */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border/50">
              <Button
                variant={appMode === 'api' ? 'default' : 'ghost'}
                size="sm"
                className={`h-7 px-3 text-xs gap-1.5 rounded-md transition-all ${
                  appMode === 'api' ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setAppMode('api')}
              >
                <Activity className="size-3.5" />
                <span>Live / API Chart</span>
              </Button>
              <Button
                variant={appMode === 'screenshot' ? 'default' : 'ghost'}
                size="sm"
                className={`h-7 px-3 text-xs gap-1.5 rounded-md transition-all ${
                  appMode === 'screenshot' ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setAppMode('screenshot')}
              >
                <Camera className="size-3.5" />
                <span>Screenshot OCR</span>
              </Button>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-border/70"
              title={isDarkMode ? 'Switch to Light mode' : 'Switch to Dark mode'}
              onClick={() => setIsDarkMode((prev) => !prev)}
            >
              {isDarkMode ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-sky-400" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <div className="max-w-[1600px] mx-auto w-full p-3 sm:p-4 flex-1">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-3.5 items-start">
          {/* Main Chart Column */}
          <main className="space-y-3 min-w-0">
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
            <div className="flex items-center justify-between gap-2">
              <Tabs
                value={activeTimeframe}
                onValueChange={(val) => setActiveTimeframe(val as Timeframe)}
                className="w-auto"
              >
                <TabsList className="bg-muted/50 border border-border/50 h-8 p-0.5">
                  {TIMEFRAMES.map((timeframe) => {
                    const count =
                      appMode === 'api'
                        ? apiCandles[timeframe]?.length ?? 0
                        : screenshotResults[timeframe]
                          ? screenshotResults[timeframe]?.candles.length
                          : 0;
                    const hasData = count > 0;

                    return (
                      <TabsTrigger
                        key={timeframe}
                        value={timeframe}
                        className="h-7 px-3 text-xs font-mono font-bold uppercase gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                      >
                        <span>{timeframe}</span>
                        {hasData && (
                          <span className="flex items-center text-[10px] font-normal opacity-80 gap-0.5">
                            <Check className="size-3 stroke-[2.5]" />
                            <span>({count})</span>
                          </span>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>

              {appMode === 'screenshot' && (
                <span className="text-[11px] text-muted-foreground hidden sm:flex items-center gap-1">
                  <Info className="size-3 text-primary" />
                  <span>Runs 100% locally in browser OCR</span>
                </span>
              )}
            </div>

            {/* Interactive Chart Mode */}
            {appMode === 'api' && (
              <div className="space-y-2.5">
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
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <Badge variant="outline" className="gap-1 py-1 px-2.5 bg-card/60 text-xs border-border/80">
                          <Box className="size-3 text-sky-400" />
                          <span><b>{currentAnalysis.fvgs.length}</b> FVGs</span>
                        </Badge>

                        <Badge variant="outline" className="gap-1 py-1 px-2.5 bg-card/60 text-xs border-border/80">
                          <Layers className="size-3 text-indigo-400" />
                          <span><b>{currentAnalysis.orderBlocks.length}</b> Order Blocks</span>
                        </Badge>

                        <Badge variant="outline" className="gap-1 py-1 px-2.5 bg-card/60 text-xs border-border/80">
                          <Waves className="size-3 text-amber-400" />
                          <span><b>{currentAnalysis.pools.length}</b> Liquidity Pools</span>
                        </Badge>

                        <Badge variant="outline" className="gap-1 py-1 px-2.5 bg-card/60 text-xs border-border/80">
                          <Zap className="size-3 text-fuchsia-400" />
                          <span><b>{currentAnalysis.sweeps.length}</b> Sweeps</span>
                        </Badge>

                        <Badge variant="outline" className="gap-1 py-1 px-2.5 bg-card/60 text-xs border-border/80">
                          <Crosshair className="size-3 text-emerald-400" />
                          <span><b>{currentAnalysis.structure.length}</b> Breaks</span>
                        </Badge>

                        <Badge variant="outline" className="gap-1 py-1 px-2.5 bg-card/60 text-xs border-border/80">
                          <Clock className="size-3 text-purple-400" />
                          <span><b>{currentAnalysis.sessions.length}</b> Sessions</span>
                        </Badge>

                        {currentAnalysis.range?.bias && (
                          <Badge
                            variant={currentAnalysis.range.bias === 'bullish' ? 'bullish' : 'bearish'}
                            className="gap-1 py-1 px-2.5 text-xs uppercase font-mono font-semibold"
                          >
                            <Compass className="size-3" />
                            <span>Range: {currentAnalysis.range.bias}</span>
                          </Badge>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <Card className="border-border/80 bg-card/60 p-12 text-center">
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        No candle data loaded for <b className="text-foreground">{activeTimeframe.toUpperCase()}</b>.
                      </p>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleFetchCurrent}
                        disabled={isLoading}
                      >
                        Load {activeTimeframe.toUpperCase()} Candles
                      </Button>
                    </CardContent>
                  </Card>
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
          <aside className="w-full xl:sticky xl:top-[68px]">
            <SummaryPanel
              bias={bias}
              confluence={confluence}
              layers={layers}
              showResolved={showResolved}
              onLayerChange={(key: LayerKey, visible) => setLayers((current) => ({ ...current, [key]: visible }))}
              onShowResolvedChange={setShowResolved}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
