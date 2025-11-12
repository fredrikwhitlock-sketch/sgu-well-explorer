import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Layers } from "lucide-react";

interface LayerPanelProps {
  wmsVisible: boolean;
  wmsOpacity: number;
  sourcesVisible: boolean;
  wellsVisible: boolean;
  aquifersVisible: boolean;
  sourcesLoaded: number;
  wellsLoaded: number;
  aquifersLoaded: number;
  onWmsVisibleChange: (visible: boolean) => void;
  onWmsOpacityChange: (opacity: number) => void;
  onSourcesVisibleChange: (visible: boolean) => void;
  onWellsVisibleChange: (visible: boolean) => void;
  onAquifersVisibleChange: (visible: boolean) => void;
}

export const LayerPanel = ({
  wmsVisible,
  wmsOpacity,
  sourcesVisible,
  wellsVisible,
  aquifersVisible,
  sourcesLoaded,
  wellsLoaded,
  aquifersLoaded,
  onWmsVisibleChange,
  onWmsOpacityChange,
  onSourcesVisibleChange,
  onWellsVisibleChange,
  onAquifersVisibleChange,
}: LayerPanelProps) => {
  return (
    <Card className="absolute top-4 right-4 w-80 p-4 bg-card/95 backdrop-blur-sm shadow-lg border-border">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Kartlager</h3>
      </div>
      
      <div className="space-y-4">
        {/* WMS Layer Control */}
        <div className="space-y-3 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <Label htmlFor="wms-layer" className="text-sm font-medium">
              SGU Brunnar (WMS)
            </Label>
            <Switch
              id="wms-layer"
              checked={wmsVisible}
              onCheckedChange={onWmsVisibleChange}
            />
          </div>
          
          {wmsVisible && (
            <div className="space-y-2">
              <Label htmlFor="wms-opacity" className="text-xs text-muted-foreground">
                Transparens: {Math.round(wmsOpacity * 100)}%
              </Label>
              <Slider
                id="wms-opacity"
                min={0}
                max={1}
                step={0.1}
                value={[wmsOpacity]}
                onValueChange={([value]) => onWmsOpacityChange(value)}
                className="w-full"
              />
            </div>
          )}
        </div>

        {/* Wells Layer Control */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="wells-layer" className="text-sm font-medium">
                Brunnar (OGC API)
              </Label>
              <p className="text-xs text-muted-foreground">
                Klickbara brunnar från SGU {wellsLoaded > 0 && `(${wellsLoaded})`}
              </p>
            </div>
            <Switch
              id="wells-layer"
              checked={wellsVisible}
              onCheckedChange={onWellsVisibleChange}
            />
          </div>
          
          {wellsVisible && (
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[rgb(59,130,246)]" />
                <span className="text-muted-foreground">Brunnar (laddas per vy)</span>
              </div>
            </div>
          )}
        </div>

        {/* Aquifers Layer Control */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="aquifers-layer" className="text-sm font-medium">
                Grundvattenmagasin
              </Label>
              <p className="text-xs text-muted-foreground">
                Avgränsningar från SGU {aquifersLoaded > 0 && `(${aquifersLoaded})`}
              </p>
            </div>
            <Switch
              id="aquifers-layer"
              checked={aquifersVisible}
              onCheckedChange={onAquifersVisibleChange}
            />
          </div>
          
          {aquifersVisible && (
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-[rgb(34,197,94)] bg-[rgba(34,197,94,0.2)]" />
                <span className="text-muted-foreground">Magasin</span>
              </div>
            </div>
          )}
        </div>

        {/* Sources Layer Control */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="sources-layer" className="text-sm font-medium">
                Källor (OGC API)
              </Label>
              <p className="text-xs text-muted-foreground">
                Klickbara källor från SGU {sourcesLoaded > 0 && `(${sourcesLoaded})`}
              </p>
            </div>
            <Switch
              id="sources-layer"
              checked={sourcesVisible}
              onCheckedChange={onSourcesVisibleChange}
            />
          </div>
          
          {sourcesVisible && (
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[rgb(168,85,247)]" />
                <span className="text-muted-foreground">Källor</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Bakgrundskarta: OpenStreetMap
        </p>
      </div>
    </Card>
  );
};
