import type { ConfluenceZone, HtfBias } from '../mtf/types';
import { LAYERS, type LayerKey, type LayerVisibility } from '../render/layers';

interface Props {
  bias: HtfBias;
  confluence: readonly ConfluenceZone[];
  layers: LayerVisibility;
  showResolved: boolean;
  onLayerChange: (key: LayerKey, visible: boolean) => void;
  onShowResolvedChange: (value: boolean) => void;
}

const price = (value: number): string => value.toFixed(5);

const BIAS_TEXT: Record<HtfBias['strength'], string> = {
  strong: 'Daily and hourly structure agree',
  partial: 'Only one higher-timeframe chart analysed',
  conflict: 'Daily and hourly structure disagree',
  none: 'Analyse the 1D and 1H charts to get a bias',
};

export function SummaryPanel({ bias, confluence, layers, showResolved, onLayerChange, onShowResolvedChange }: Props) {
  return (
    <aside>
      <h2>Layers</h2>
      {LAYERS.map(({ key, label }) => (
        <div key={key}>
          <label>
            <input type="checkbox" checked={layers[key]} onChange={(e) => onLayerChange(key, e.target.checked)} /> {label}
          </label>
        </div>
      ))}
      <div>
        <label>
          <input type="checkbox" checked={showResolved} onChange={(e) => onShowResolvedChange(e.target.checked)} /> Show filled / mitigated zones
        </label>
      </div>

      <h2>Higher-timeframe bias</h2>
      <div>
        <strong>{bias.direction}</strong> — {BIAS_TEXT[bias.strength]}
      </div>
      <ul>
        <li>Daily trend: {bias.daily ?? 'unknown'}</li>
        <li>Hourly trend: {bias.hourly ?? 'unknown'}</li>
        <li>Price location: {bias.location ?? 'unknown'}</li>
      </ul>

      <h2>Confluence zones</h2>
      <p className="hint">Areas of interest ranked by how many conditions agree. Not trade signals.</p>
      {confluence.length === 0 ? (
        <div>None yet. Analyse the 1H and a lower-timeframe chart.</div>
      ) : (
        <table>
          <thead>
            <tr><th>TF</th><th>Zone</th><th>Score</th></tr>
          </thead>
          <tbody>
            {confluence.map((zone) => (
              <tr key={`${zone.timeframe}-${zone.kind}-${zone.top}-${zone.bottom}`}>
                <td>{zone.timeframe}</td>
                <td>
                  {zone.direction} {zone.kind}
                  <br />
                  {price(zone.bottom)} – {price(zone.top)}
                  {zone.containsPrice && <strong> (price inside)</strong>}
                  <br />
                  <small>{zone.reasons.join('; ') || 'no confirming conditions'}</small>
                </td>
                <td>{zone.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </aside>
  );
}
