import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Layers, ExternalLink } from "lucide-react";

interface LayerPanelProps {
  sourcesVisible: boolean;
  wellsVisible: boolean;
  aquifersVisible: boolean;
  aquifersOpacity: number;
  waterBodiesVisible: boolean;
  gwLevelsObservedVisible: boolean;
  gwLevelsModeledSmaVisible: boolean;
  gwLevelsModeledStoraVisible: boolean;
  gwLevelsModeledSmaOpacity: number;
  gwLevelsModeledStoraOpacity: number;
  sourcesLoaded: number;
  wellsLoaded: number;
  aquifersLoaded: number;
  waterBodiesLoaded: number;
  gwLevelsObservedLoaded: number;
  gwLevelsModeledLoaded: number;
  onSourcesVisibleChange: (visible: boolean) => void;
  onWellsVisibleChange: (visible: boolean) => void;
  onAquifersVisibleChange: (visible: boolean) => void;
  onAquifersOpacityChange: (opacity: number) => void;
  onWaterBodiesVisibleChange: (visible: boolean) => void;
  onGwLevelsObservedVisibleChange: (visible: boolean) => void;
  onGwLevelsModeledSmaVisibleChange: (visible: boolean) => void;
  onGwLevelsModeledStoraVisibleChange: (visible: boolean) => void;
  onGwLevelsModeledSmaOpacityChange: (opacity: number) => void;
  onGwLevelsModeledStoraOpacityChange: (opacity: number) => void;
}

export const LayerPanel = ({
  sourcesVisible,
  wellsVisible,
  aquifersVisible,
  aquifersOpacity,
  waterBodiesVisible,
  gwLevelsObservedVisible,
  gwLevelsModeledSmaVisible,
  gwLevelsModeledStoraVisible,
  gwLevelsModeledSmaOpacity,
  gwLevelsModeledStoraOpacity,
  sourcesLoaded,
  wellsLoaded,
  aquifersLoaded,
  waterBodiesLoaded,
  gwLevelsObservedLoaded,
  gwLevelsModeledLoaded,
  onSourcesVisibleChange,
  onWellsVisibleChange,
  onAquifersVisibleChange,
  onAquifersOpacityChange,
  onWaterBodiesVisibleChange,
  onGwLevelsObservedVisibleChange,
  onGwLevelsModeledSmaVisibleChange,
  onGwLevelsModeledStoraVisibleChange,
  onGwLevelsModeledSmaOpacityChange,
  onGwLevelsModeledStoraOpacityChange,
}: LayerPanelProps) => {
  return (
    <Card className="absolute top-4 right-4 w-80 bg-card/95 backdrop-blur-sm shadow-lg border-border overflow-hidden">
      <div className="bg-sgu-maroon text-white p-3 flex items-center gap-2">
        <Layers className="w-5 h-5" />
        <h3 className="font-semibold">Kartlager</h3>
      </div>
      
      <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Wells Layer Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="wells-layer" className="text-sm font-medium">
                Brunnar
              </Label>
              <p className="text-xs text-muted-foreground">
                SGU Brunnsarkivet {wellsLoaded > 0 && `(${wellsLoaded})`}
              </p>
            </div>
            <Switch
              id="wells-layer"
              checked={wellsVisible}
              onCheckedChange={onWellsVisibleChange}
            />
          </div>
          
          {wellsVisible && (
            <div className="mt-2 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[rgb(59,130,246)]" />
                <span className="text-muted-foreground">Brunnar (laddas per vy)</span>
              </div>
              <a 
                href="https://www.sgu.se/produkter-och-tjanster/geologiska-data/brunnar--geologiska-data/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sgu-link hover:underline inline-flex items-center gap-1"
              >
                Produktbeskrivning <ExternalLink className="w-3 h-3" />
              </a>
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
                Avgränsningar {aquifersLoaded > 0 && `(${aquifersLoaded})`}
              </p>
            </div>
            <Switch
              id="aquifers-layer"
              checked={aquifersVisible}
              onCheckedChange={onAquifersVisibleChange}
            />
          </div>
          
          {aquifersVisible && (
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="aquifers-opacity" className="text-xs text-muted-foreground">
                  Transparens: {Math.round(aquifersOpacity * 100)}%
                </Label>
                <Slider
                  id="aquifers-opacity"
                  min={0}
                  max={1}
                  step={0.1}
                  value={[aquifersOpacity]}
                  onValueChange={([value]) => onAquifersOpacityChange(value)}
                  className="w-full"
                />
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-[rgb(34,197,94)] bg-[rgba(34,197,94,0.2)]" />
                  <span className="text-muted-foreground">Klickbara magasin</span>
                </div>
                <a 
                  href="https://www.sgu.se/produkter-och-tjanster/geologiska-data/grundvatten--geologiska-data/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sgu-link hover:underline inline-flex items-center gap-1 mt-2"
                >
                  Produktbeskrivning <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Sources Layer Control */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="sources-layer" className="text-sm font-medium">
                Källor
              </Label>
              <p className="text-xs text-muted-foreground">
                Naturliga källor {sourcesLoaded > 0 && `(${sourcesLoaded})`}
              </p>
            </div>
            <Switch
              id="sources-layer"
              checked={sourcesVisible}
              onCheckedChange={onSourcesVisibleChange}
            />
          </div>
          
          {sourcesVisible && (
            <div className="mt-2 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-sgu-maroon" />
                <span className="text-muted-foreground">Källor</span>
              </div>
              <a 
                href="https://www.sgu.se/grundvatten/kallor/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sgu-link hover:underline inline-flex items-center gap-1"
              >
                Produktbeskrivning <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Water Bodies Layer Control */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="waterbodies-layer" className="text-sm font-medium">
                Grundvattenförekomster
              </Label>
              <p className="text-xs text-muted-foreground">
                Vattenförvaltning {waterBodiesLoaded > 0 && `(${waterBodiesLoaded})`}
              </p>
            </div>
            <Switch
              id="waterbodies-layer"
              checked={waterBodiesVisible}
              onCheckedChange={onWaterBodiesVisibleChange}
            />
          </div>
          
          {waterBodiesVisible && (
            <div className="mt-2 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-[rgb(59,130,246)] bg-[rgba(59,130,246,0.15)]" />
                <span className="text-muted-foreground">Klickbara förekomster</span>
              </div>
              <a 
                href="https://resource.sgu.se/dokument/produkter/grundvattenforekomster-beskrivning.pdf" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sgu-link hover:underline inline-flex items-center gap-1"
              >
                Produktbeskrivning <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Observed Groundwater Levels Layer Control */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="gw-observed-layer" className="text-sm font-medium">
                Grundvattennivåer observerade
              </Label>
              <p className="text-xs text-muted-foreground">
                Mätstationer {gwLevelsObservedLoaded > 0 && `(${gwLevelsObservedLoaded})`}
              </p>
            </div>
            <Switch
              id="gw-observed-layer"
              checked={gwLevelsObservedVisible}
              onCheckedChange={onGwLevelsObservedVisibleChange}
            />
          </div>
          
          {gwLevelsObservedVisible && (
            <div className="mt-2 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[rgb(147,51,234)]" />
                <span className="text-muted-foreground">Klickbara stationer</span>
              </div>
              <a 
                href="https://resource.sgu.se/dokument/produkter/grundvattennivaer-observerade-beskrivning.pdf" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sgu-link hover:underline inline-flex items-center gap-1"
              >
                Produktbeskrivning <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Modeled Groundwater Levels - Small Aquifers */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="gw-modeled-sma-layer" className="text-sm font-medium">
                HYPE - Små magasin
              </Label>
              <p className="text-xs text-muted-foreground">
                Beräknad fyllnadsgrad {gwLevelsModeledLoaded > 0 && `(${gwLevelsModeledLoaded})`}
              </p>
            </div>
            <Switch
              id="gw-modeled-sma-layer"
              checked={gwLevelsModeledSmaVisible}
              onCheckedChange={onGwLevelsModeledSmaVisibleChange}
            />
          </div>
          
          {gwLevelsModeledSmaVisible && (
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="gw-sma-opacity" className="text-xs text-muted-foreground">
                  Transparens: {Math.round(gwLevelsModeledSmaOpacity * 100)}%
                </Label>
                <Slider
                  id="gw-sma-opacity"
                  min={0}
                  max={1}
                  step={0.1}
                  value={[gwLevelsModeledSmaOpacity]}
                  onValueChange={([value]) => onGwLevelsModeledSmaOpacityChange(value)}
                  className="w-full"
                />
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-3 bg-gradient-to-r from-red-600 via-yellow-400 to-blue-500 border border-black/30 rounded-sm"></div>
                  <span className="text-muted-foreground">Torrt → Högt</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modeled Groundwater Levels - Large Aquifers */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="gw-modeled-stora-layer" className="text-sm font-medium">
                HYPE - Stora magasin
              </Label>
              <p className="text-xs text-muted-foreground">
                Beräknad fyllnadsgrad {gwLevelsModeledLoaded > 0 && `(${gwLevelsModeledLoaded})`}
              </p>
            </div>
            <Switch
              id="gw-modeled-stora-layer"
              checked={gwLevelsModeledStoraVisible}
              onCheckedChange={onGwLevelsModeledStoraVisibleChange}
            />
          </div>
          
          {gwLevelsModeledStoraVisible && (
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="gw-stora-opacity" className="text-xs text-muted-foreground">
                  Transparens: {Math.round(gwLevelsModeledStoraOpacity * 100)}%
                </Label>
                <Slider
                  id="gw-stora-opacity"
                  min={0}
                  max={1}
                  step={0.1}
                  value={[gwLevelsModeledStoraOpacity]}
                  onValueChange={([value]) => onGwLevelsModeledStoraOpacityChange(value)}
                  className="w-full"
                />
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-3 bg-gradient-to-r from-red-600 via-yellow-400 to-blue-500 border border-black/30 rounded-sm"></div>
                  <span className="text-muted-foreground">Torrt → Högt</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {(gwLevelsModeledSmaVisible || gwLevelsModeledStoraVisible) && (
          <div className="pt-2 text-xs">
            <a 
              href="https://resource.sgu.se/dokument/produkter/grundvattennivaer-sgu-hype-omraden-beskrivning.pdf" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sgu-link hover:underline inline-flex items-center gap-1"
            >
              HYPE produktbeskrivning <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border bg-muted/50">
        <p className="text-xs text-muted-foreground">
          Bakgrundskarta: OpenStreetMap
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Data:{" "}
          <a 
            href="https://www.sgu.se" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sgu-link hover:underline"
          >
            SGU
          </a>
        </p>
      </div>
    </Card>
  );
};