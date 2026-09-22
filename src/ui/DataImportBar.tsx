import { useState, type ChangeEvent } from 'react';
import { parseCandlesFromCsv } from '../data/csvParser';
import { PRESET_SYMBOLS, type DataSourceType } from '../data/types';
import type { Candle, Timeframe } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  RefreshCw,
  Layers,
  Upload,
  AlertCircle,
  Database,
  Coins,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

interface Props {
  activeTimeframe: Timeframe;
  activeSymbol: string;
  activeSource: DataSourceType;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  onSelectPreset: (symbol: string, source: DataSourceType) => void;
  onFetchCurrent: () => void;
  onFetchAllTimeframes: () => void;
  onCsvLoaded: (candles: Candle[]) => void;
  onSymbolChange: (symbol: string) => void;
  onSourceChange: (source: DataSourceType) => void;
}

export function DataImportBar({
  activeTimeframe,
  activeSymbol,
  activeSource,
  isLoading,
  error,
  lastUpdated,
  onSelectPreset,
  onFetchCurrent,
  onFetchAllTimeframes,
  onCsvLoaded,
  onSymbolChange,
  onSourceChange,
}: Props) {
  const [customSymbol, setCustomSymbol] = useState(activeSymbol);

  const handlePresetClick = (symbol: string, source: DataSourceType): void => {
    setCustomSymbol(symbol);
    onSelectPreset(symbol, source);
  };

  const handleCsvFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseCandlesFromCsv(text);
      onCsvLoaded(parsed);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const getPresetIcon = (source: DataSourceType) => {
    switch (source) {
      case 'binance':
        return <Coins className="size-3 text-amber-400" />;
      case 'yahoo':
        return <DollarSign className="size-3 text-emerald-400" />;
      default:
        return <TrendingUp className="size-3 text-sky-400" />;
    }
  };

  return (
    <Card className="mb-3 border-border/80 bg-card/70 backdrop-blur-sm">
      <CardContent className="p-3 space-y-3">
        {/* Preset Quick Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mr-1">
            <Database className="size-3.5" />
            <span>Presets:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_SYMBOLS.map((preset) => {
              const isSelected = activeSymbol === preset.symbol && activeSource === preset.source;
              return (
                <Button
                  key={preset.id}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  className={`h-6 px-2.5 text-[11px] font-medium transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'hover:border-primary/50 text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => handlePresetClick(preset.symbol, preset.source)}
                >
                  {getPresetIcon(preset.source)}
                  <span>{preset.name}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Source, Symbol & Action Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40 text-xs">
          {/* Source Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium">Source:</span>
            <Select
              value={activeSource}
              onChange={(e) => onSourceChange(e.target.value as DataSourceType)}
              disabled={isLoading}
              className="h-8 w-[180px] bg-background/80"
            >
              <option value="sample">ICT Sample Generator</option>
              <option value="yahoo">Yahoo Finance (Forex & Stocks)</option>
              <option value="binance">Binance Public API (Crypto)</option>
              <option value="csv">Custom CSV Import</option>
            </Select>
          </div>

          {/* Symbol or CSV Upload */}
          {activeSource !== 'csv' ? (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground font-medium">Symbol:</span>
              <Input
                type="text"
                value={customSymbol}
                onChange={(e) => {
                  setCustomSymbol(e.target.value);
                  onSymbolChange(e.target.value);
                }}
                placeholder="e.g. GBPUSD or BTCUSDT"
                disabled={isLoading}
                className="h-8 w-32 bg-background/80 font-mono uppercase"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-1.5 h-8 text-xs font-medium rounded-md border border-input bg-background/80 hover:bg-accent cursor-pointer transition-colors">
                <Upload className="size-3.5 text-muted-foreground" />
                <span>Upload CSV file</span>
                <input type="file" accept=".csv,.txt" onChange={handleCsvFile} className="hidden" />
              </label>
            </div>
          )}

          {/* Action Buttons */}
          {activeSource !== 'csv' && (
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="default"
                size="sm"
                onClick={onFetchCurrent}
                disabled={isLoading}
                className="gap-1.5"
              >
                <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Fetching…' : `Fetch ${activeTimeframe.toUpperCase()}`}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={onFetchAllTimeframes}
                disabled={isLoading}
                title="Fetches 1D, 1H, 15M, and 5M in parallel for complete multi-timeframe bias and confluence analysis"
                className="gap-1.5 border-border/80"
              >
                <Layers className="size-3.5 text-primary" />
                <span>Fetch All 4 TFs</span>
              </Button>
            </div>
          )}

          {/* Timestamp Indicator */}
          {lastUpdated && (
            <div className="flex items-center gap-1.5 ml-auto text-[11px] text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>
                Updated {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="py-2 mt-2">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs ml-1 font-medium">{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
