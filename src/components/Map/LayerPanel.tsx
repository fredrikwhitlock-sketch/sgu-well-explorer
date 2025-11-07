import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Layers } from "lucide-react";

interface LayerPanelProps {
  wmsVisible: boolean;
  wmsOpacity: number;
  ogcVisible: boolean;
  onWmsVisibleChange: (visible: boolean) => void;
  onWmsOpacityChange: (opacity: number) => void;
  onOgcVisibleChange: (visible: boolean) => void;
}

export const LayerPanel = ({
  wmsVisible,
  wmsOpacity,
  ogcVisible,
  onWmsVisibleChange,
  onWmsOpacityChange,
  onOgcVisibleChange,
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

        {/* OGC API Layer Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="ogc-layer" className="text-sm font-medium">
                Uppsala Brunnar (OGC API)
              </Label>
              <p className="text-xs text-muted-foreground">
                Features från SGU OGC API
              </p>
            </div>
            <Switch
              id="ogc-layer"
              checked={ogcVisible}
              onCheckedChange={onOgcVisibleChange}
            />
          </div>
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
