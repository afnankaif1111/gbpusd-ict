import { useState, type ChangeEvent } from 'react';
import { parseCandlesFromCsv } from '../data/csvParser';
import { PRESET_SYMBOLS, type DataSourceType } from '../data/types';
import type { Candle, Timeframe } from '../types';

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

  return (
    <div className="data-import-bar">
      {/* Preset Quick Buttons */}
      <div className="preset-group">
        <span className="group-label">Presets:</span>
        {PRESET_SYMBOLS.map((preset) => {
          const isSelected = activeSymbol === preset.symbol && activeSource === preset.source;
          return (
            <button
              key={preset.id}
              type="button"
              className={`preset-btn ${isSelected ? 'active' : ''}`}
              onClick={() => handlePresetClick(preset.symbol, preset.source)}
            >
              {preset.name}
            </button>
          );
        })}
      </div>

      {/* Source, Symbol & Action Controls */}
      <div className="controls-group">
        <label className="field-label">
          Source:
          <select
            value={activeSource}
            onChange={(e) => onSourceChange(e.target.value as DataSourceType)}
            disabled={isLoading}
          >
            <option value="sample">ICT Sample Generator</option>
            <option value="yahoo">Yahoo Finance (Forex & Stocks)</option>
            <option value="binance">Binance Public API (Crypto)</option>
            <option value="csv">Custom CSV Import</option>
          </select>
        </label>

        {activeSource !== 'csv' ? (
          <label className="field-label">
            Symbol:
            <input
              type="text"
              value={customSymbol}
              onChange={(e) => {
                setCustomSymbol(e.target.value);
                onSymbolChange(e.target.value);
              }}
              placeholder="e.g. GBPUSD=X or BTCUSDT"
              disabled={isLoading}
              style={{ width: '110px' }}
            />
          </label>
        ) : (
          <label className="file-upload-label">
            Upload CSV:
            <input type="file" accept=".csv,.txt" onChange={handleCsvFile} />
          </label>
        )}

        {activeSource !== 'csv' && (
          <>
            <button
              type="button"
              className="action-btn primary"
              onClick={onFetchCurrent}
              disabled={isLoading}
            >
              {isLoading ? 'Fetching…' : `Fetch ${activeTimeframe.toUpperCase()}`}
            </button>

            <button
              type="button"
              className="action-btn"
              onClick={onFetchAllTimeframes}
              disabled={isLoading}
              title="Fetches 1D, 1H, 15M, and 5M in parallel for complete multi-timeframe bias and confluence analysis"
            >
              Fetch All 4 TFs (1D, 1H, 15M, 5M)
            </button>
          </>
        )}

        {lastUpdated && (
          <span className="updated-badge" title={new Date(lastUpdated).toLocaleTimeString()}>
            Updated {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {error && <div className="import-error">⚠️ {error}</div>}
    </div>
  );
}
