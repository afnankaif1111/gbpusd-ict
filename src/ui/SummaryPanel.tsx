import type { ConfluenceZone, HtfBias } from '../mtf/types';
import { LAYERS, DEFAULT_LAYERS, type LayerKey, type LayerVisibility } from '../render/layers';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Layers,
  Compass,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  HelpCircle,
  Sliders,
} from 'lucide-react';

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
  strong: 'Daily & hourly structure aligned',
  partial: 'Single timeframe confirmed',
  conflict: 'Daily & hourly structure conflicting',
  none: 'Requires 1D & 1H analysis',
};

export function SummaryPanel({
  bias,
  confluence,
  layers,
  showResolved,
  onLayerChange,
  onShowResolvedChange,
}: Props) {
  const getBiasVariant = (dir: string) => {
    const lower = dir.toLowerCase();
    if (lower.includes('bull')) return 'bullish' as const;
    if (lower.includes('bear')) return 'bearish' as const;
    if (lower.includes('conflict')) return 'destructive' as const;
    return 'secondary' as const;
  };

  const getBiasIcon = (dir: string) => {
    const lower = dir.toLowerCase();
    if (lower.includes('bull')) return <TrendingUp className="size-3.5" />;
    if (lower.includes('bear')) return <TrendingDown className="size-3.5" />;
    if (lower.includes('conflict')) return <AlertCircle className="size-3.5" />;
    return <Minus className="size-3.5" />;
  };

  const handleResetLayers = () => {
    for (const key of Object.keys(DEFAULT_LAYERS) as LayerKey[]) {
      onLayerChange(key, DEFAULT_LAYERS[key]);
    }
  };

  const handleToggleAll = (visible: boolean) => {
    for (const { key } of LAYERS) {
      onLayerChange(key, visible);
    }
  };

  return (
    <div className="space-y-3">
      {/* 1. Higher-Timeframe Bias Card */}
      <Card className="border-border/80 bg-card/70 backdrop-blur-sm">
        <CardHeader className="p-3.5 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Compass className="size-4 text-primary" />
              <span>HTF Directional Bias</span>
            </div>
            <Badge variant={getBiasVariant(bias.direction)} className="gap-1 font-semibold uppercase text-[10px] tracking-wide">
              {getBiasIcon(bias.direction)}
              <span>{bias.direction}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3.5 pt-1 space-y-2.5 text-xs">
          <p className="text-[11px] text-muted-foreground leading-snug">
            {BIAS_TEXT[bias.strength]}
          </p>

          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-border/40 font-mono text-[11px]">
            <div className="flex flex-col rounded bg-muted/40 p-1.5 border border-border/30">
              <span className="text-[10px] font-sans text-muted-foreground">1D Trend</span>
              <span className="font-semibold capitalize text-foreground truncate mt-0.5">
                {bias.daily ?? '—'}
              </span>
            </div>
            <div className="flex flex-col rounded bg-muted/40 p-1.5 border border-border/30">
              <span className="text-[10px] font-sans text-muted-foreground">1H Trend</span>
              <span className="font-semibold capitalize text-foreground truncate mt-0.5">
                {bias.hourly ?? '—'}
              </span>
            </div>
            <div className="flex flex-col rounded bg-muted/40 p-1.5 border border-border/30">
              <span className="text-[10px] font-sans text-muted-foreground">Location</span>
              <span className="font-semibold capitalize text-foreground truncate mt-0.5">
                {bias.location ?? '—'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Layer Visibility Card */}
      <Card className="border-border/80 bg-card/70 backdrop-blur-sm">
        <CardHeader className="p-3.5 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Layers className="size-4 text-primary" />
              <span>Chart Layers</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => handleToggleAll(true)}
              >
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => handleToggleAll(false)}
              >
                None
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={handleResetLayers}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3.5 pt-1 space-y-1.5">
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {LAYERS.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-xs transition-colors group"
              >
                <span className="text-muted-foreground group-hover:text-foreground transition-colors select-none text-[11px]">
                  {label}
                </span>
                <Switch
                  checked={layers[key]}
                  onCheckedChange={(checked) => onLayerChange(key, checked)}
                />
              </label>
            ))}
          </div>

          <div className="pt-2 border-t border-border/50">
            <label className="flex items-center justify-between py-1 px-1.5 rounded-md bg-muted/30 border border-border/40 hover:bg-muted/50 cursor-pointer text-xs transition-colors">
              <div className="flex items-center gap-1.5">
                <Sliders className="size-3 text-primary" />
                <span className="font-medium text-[11px] text-foreground">Show Mitigated Zones</span>
              </div>
              <Switch
                checked={showResolved}
                onCheckedChange={onShowResolvedChange}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* 3. Confluence Zones Card */}
      <Card className="border-border/80 bg-card/70 backdrop-blur-sm">
        <CardHeader className="p-3.5 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Target className="size-4 text-primary" />
              <span>Confluence Zones</span>
            </div>
            {confluence.length > 0 && (
              <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 h-4">
                {confluence.length} detected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3.5 pt-1">
          {confluence.length === 0 ? (
            <div className="py-6 px-2 text-center text-xs text-muted-foreground rounded border border-dashed border-border/50">
              <HelpCircle className="size-6 mx-auto mb-1.5 text-muted-foreground/60" />
              <p className="font-medium">No confluence zones yet</p>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                Fetch 1H and lower timeframe data to detect overlapping zones.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12 px-1 text-[10px]">TF</TableHead>
                    <TableHead className="px-1 text-[10px]">Zone Details</TableHead>
                    <TableHead className="w-10 px-1 text-right text-[10px]">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confluence.map((zone) => {
                    const isBull = zone.direction.toLowerCase().includes('bull');
                    return (
                      <TableRow
                        key={`${zone.timeframe}-${zone.kind}-${zone.top}-${zone.bottom}`}
                        className="border-border/40 hover:bg-muted/30"
                      >
                        <TableCell className="px-1 py-1.5 font-mono text-[10px] uppercase font-bold text-foreground">
                          {zone.timeframe}
                        </TableCell>
                        <TableCell className="px-1 py-1.5">
                          <div className="flex flex-wrap items-center gap-1 mb-0.5">
                            <Badge
                              variant={isBull ? 'bullish' : 'bearish'}
                              className="text-[9px] px-1 py-0 h-3.5 uppercase font-mono"
                            >
                              {zone.direction} {zone.kind}
                            </Badge>
                            {zone.containsPrice && (
                              <Badge variant="accent" className="text-[9px] px-1 py-0 h-3.5 animate-pulse">
                                Inside
                              </Badge>
                            )}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {price(zone.bottom)} – {price(zone.top)}
                          </div>
                          {zone.reasons.length > 0 && (
                            <div className="text-[10px] text-muted-foreground/80 mt-0.5 leading-tight">
                              {zone.reasons.join(' • ')}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-1 py-1.5 text-right font-mono">
                          <Badge
                            variant={zone.score >= 3 ? 'default' : 'secondary'}
                            className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold"
                          >
                            {zone.score}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
