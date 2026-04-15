import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Layers, ExternalLink, Download, Trash2, X } from "lucide-react";
import { SOIL_TYPE_CATEGORIES } from "@/lib/soilTypeColors";

interface LayerPanelProps {
  sourcesVisible: boolean;
  wellsVisible: boolean;
  aquifersVisible: boolean;
  aquifersOpacity: number;
  soilTypesVisible: boolean;
  soilTypesOpacity: number;
  waterBodiesVisible: boolean;
  gwLevelsObservedVisible: boolean;
  gwQualityVisible: boolean;
  observationsVisible: boolean;
  // Lantmäteriet WMS layers
  topoWebbVisible: boolean;
  ortofotoVisible: boolean;
  terrangskuggningVisible: boolean;
  terrangskuggningOpacity: number;
  // SGU WMS layers
  sguBerggrund1MVisible: boolean;
  sguBerggrund1MOpacity: number;
  sguBerggrund50kVisible: boolean;
  sguBerggrund50kOpacity: number;
  sguJordarter1MVisible: boolean;
  sguJordarter1MOpacity: number;
  sguJordarter25kVisible: boolean;
  sguJordarter25kOpacity: number;
  sguGvTillgangVisible: boolean;
  sguGvTillgangOpacity: number;
  sourcesLoaded: number;
  wellsLoaded: number;
  aquifersLoaded: number;
  soilTypesLoaded: number;
  waterBodiesLoaded: number;
  gwLevelsObservedLoaded: number;
  gwQualityLoaded: number;
  observationsLoaded: number;
  onSourcesVisibleChange: (visible: boolean) => void;
  onWellsVisibleChange: (visible: boolean) => void;
  onAquifersVisibleChange: (visible: boolean) => void;
  onAquifersOpacityChange: (opacity: number) => void;
  onSoilTypesVisibleChange: (visible: boolean) => void;
  onSoilTypesOpacityChange: (opacity: number) => void;
  onWaterBodiesVisibleChange: (visible: boolean) => void;
  onGwLevelsObservedVisibleChange: (visible: boolean) => void;
  onGwQualityVisibleChange: (visible: boolean) => void;
  onObservationsVisibleChange: (visible: boolean) => void;
  // Lantmäteriet WMS layer callbacks
  onTopoWebbVisibleChange: (visible: boolean) => void;
  onOrtofotoVisibleChange: (visible: boolean) => void;
  onTerrangskuggningVisibleChange: (visible: boolean) => void;
  onTerrangskuggningOpacityChange: (opacity: number) => void;
  // SGU WMS layer callbacks
  onSguBerggrund1MVisibleChange: (visible: boolean) => void;
  onSguBerggrund1MOpacityChange: (opacity: number) => void;
  onSguBerggrund50kVisibleChange: (visible: boolean) => void;
  onSguBerggrund50kOpacityChange: (opacity: number) => void;
  onSguJordarter1MVisibleChange: (visible: boolean) => void;
  onSguJordarter1MOpacityChange: (opacity: number) => void;
  onSguJordarter25kVisibleChange: (visible: boolean) => void;
  onSguJordarter25kOpacityChange: (opacity: number) => void;
  onSguGvTillgangVisibleChange: (visible: boolean) => void;
  onSguGvTillgangOpacityChange: (opacity: number) => void;
  onDownloadGvTillgangGeoTiff?: () => void;
  onExportWells?: () => void;
  onClearWells?: () => void;
  onExportSources?: () => void;
  onClearSources?: () => void;
  onExportAquifers?: () => void;
  onClearAquifers?: () => void;
  onExportSoilTypes?: () => void;
  onClearSoilTypes?: () => void;
  onExportWaterBodies?: () => void;
  onClearWaterBodies?: () => void;
  onExportGwLevelsObserved?: () => void;
  onClearGwLevelsObserved?: () => void;
  onExportGwQuality?: () => void;
  onClearGwQuality?: () => void;
  onExportObservations?: () => void;
  onClearObservations?: () => void;
  jorddjupObsVisible: boolean;
  jorddjupKartorVisible: boolean;
  jorddjupSprickVisible: boolean;
  loadingJorddjupObs: boolean;
  loadingJorddjupKartor: boolean;
  loadingJorddjupSprick: boolean;
  jorddjupObsLoaded: number;
  jorddjupKartorLoaded: number;
  jorddjupSprickLoaded: number;
  onJorddjupObsVisibleChange: (v: boolean) => void;
  onJorddjupKartorVisibleChange: (v: boolean) => void;
  onJorddjupSprickVisibleChange: (v: boolean) => void;
  onClearJorddjupObs?: () => void;
  onClearJorddjupKartor?: () => void;
  onClearJorddjupSprick?: () => void;
  hypoFyllnadSmaVisible: boolean;
  hypoFyllnadStoraVisible: boolean;
  hypoSitSmaVisible: boolean;
  hypoSitStoraVisible: boolean;
  loadingHypoAreas: boolean;
  hypoAreasLoaded: number;
  hypoAreasOpacity: number;
  hypoAreasDate: string;
  onHypoFyllnadSmaVisibleChange: (v: boolean) => void;
  onHypoFyllnadStoraVisibleChange: (v: boolean) => void;
  onHypoSitSmaVisibleChange: (v: boolean) => void;
  onHypoSitStoraVisibleChange: (v: boolean) => void;
  onHypoAreasOpacityChange: (opacity: number) => void;
  onHypoAreasDateChange: (date: string) => void;
  onClearHypoAreas?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const LayerPanel = ({
  sourcesVisible,
  wellsVisible,
  aquifersVisible,
  aquifersOpacity,
  soilTypesVisible,
  soilTypesOpacity,
  waterBodiesVisible,
  gwLevelsObservedVisible,
  gwQualityVisible,
  observationsVisible,
  topoWebbVisible,
  ortofotoVisible,
  terrangskuggningVisible,
  terrangskuggningOpacity,
  sguBerggrund1MVisible,
  sguBerggrund1MOpacity,
  sguBerggrund50kVisible,
  sguBerggrund50kOpacity,
  sguJordarter1MVisible,
  sguJordarter1MOpacity,
  sguJordarter25kVisible,
  sguJordarter25kOpacity,
  sguGvTillgangVisible,
  sguGvTillgangOpacity,
  sourcesLoaded,
  wellsLoaded,
  aquifersLoaded,
  soilTypesLoaded,
  waterBodiesLoaded,
  gwLevelsObservedLoaded,
  gwQualityLoaded,
  observationsLoaded,
  onSourcesVisibleChange,
  onWellsVisibleChange,
  onAquifersVisibleChange,
  onAquifersOpacityChange,
  onSoilTypesVisibleChange,
  onSoilTypesOpacityChange,
  onWaterBodiesVisibleChange,
  onGwLevelsObservedVisibleChange,
  onGwQualityVisibleChange,
  onObservationsVisibleChange,
  onTopoWebbVisibleChange,
  onOrtofotoVisibleChange,
  onTerrangskuggningVisibleChange,
  onTerrangskuggningOpacityChange,
  onSguBerggrund1MVisibleChange,
  onSguBerggrund1MOpacityChange,
  onSguBerggrund50kVisibleChange,
  onSguBerggrund50kOpacityChange,
  onSguJordarter1MVisibleChange,
  onSguJordarter1MOpacityChange,
  onSguJordarter25kVisibleChange,
  onSguJordarter25kOpacityChange,
  onSguGvTillgangVisibleChange,
  onSguGvTillgangOpacityChange,
  onDownloadGvTillgangGeoTiff,
  onExportWells,
  onClearWells,
  onExportSources,
  onClearSources,
  onExportAquifers,
  onClearAquifers,
  onExportSoilTypes,
  onClearSoilTypes,
  onExportWaterBodies,
  onClearWaterBodies,
  onExportGwLevelsObserved,
  onClearGwLevelsObserved,
  onExportGwQuality,
  onClearGwQuality,
  onExportObservations,
  onClearObservations,
  jorddjupObsVisible,
  jorddjupKartorVisible,
  jorddjupSprickVisible,
  loadingJorddjupObs,
  loadingJorddjupKartor,
  loadingJorddjupSprick,
  jorddjupObsLoaded,
  jorddjupKartorLoaded,
  jorddjupSprickLoaded,
  onJorddjupObsVisibleChange,
  onJorddjupKartorVisibleChange,
  onJorddjupSprickVisibleChange,
  onClearJorddjupObs,
  onClearJorddjupKartor,
  onClearJorddjupSprick,
  hypoFyllnadSmaVisible,
  hypoFyllnadStoraVisible,
  hypoSitSmaVisible,
  hypoSitStoraVisible,
  loadingHypoAreas,
  hypoAreasLoaded,
  hypoAreasOpacity,
  hypoAreasDate,
  onHypoFyllnadSmaVisibleChange,
  onHypoFyllnadStoraVisibleChange,
  onHypoSitSmaVisibleChange,
  onHypoSitStoraVisibleChange,
  onHypoAreasOpacityChange,
  onHypoAreasDateChange,
  onClearHypoAreas,
  isOpen,
  onClose,
}: LayerPanelProps) => {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="absolute inset-0 z-20 bg-black/20 backdrop-blur-[1px]"
          onClick={onClose}
        />
      )}
      {/* Drawer */}
      <div
        className={`absolute top-0 right-0 h-full w-80 max-w-[calc(100vw-3.5rem)] bg-card/98 backdrop-blur-sm shadow-2xl border-l border-border z-30 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
      {/* Header */}
      <div className="bg-sgu-maroon text-white px-4 py-3 flex items-center gap-2 shrink-0">
        <Layers className="w-5 h-5" />
        <h3 className="font-semibold flex-1">Kartlager</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/20 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
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
              {wellsLoaded > 0 && (
                <div className="flex gap-2 mt-2">
                  {onExportWells && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onExportWells}
                      className="flex-1 text-xs h-7"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Exportera ({wellsLoaded})
                    </Button>
                  )}
                  {onClearWells && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onClearWells}
                      className="text-xs h-7"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
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
              <div className="text-xs space-y-1">
                <div className="font-medium text-muted-foreground mb-2">Akvifertyp:</div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm border-2 border-[rgba(34,197,94,0.9)] bg-[rgba(34,197,94,0.25)]" />
                  <span className="text-muted-foreground">Porakvifer (jord)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm border-2 border-[rgba(245,158,11,0.9)] bg-[rgba(245,158,11,0.25)]" />
                  <span className="text-muted-foreground">Porakvifer (berg/komb.)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm border-2 border-[rgba(220,38,38,0.9)] bg-[rgba(220,38,38,0.25)]" />
                  <span className="text-muted-foreground">Sprickakvifer</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm border-2 border-[rgba(147,51,234,0.9)] bg-[rgba(147,51,234,0.25)]" />
                  <span className="text-muted-foreground">Por- och sprickakvifer</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Laddas per vy (zoom ≥ 9)</p>
                <a 
                  href="https://www.sgu.se/produkter-och-tjanster/geologiska-data/grundvatten--geologiska-data/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sgu-link hover:underline inline-flex items-center gap-1 mt-2"
                >
                  Produktbeskrivning <ExternalLink className="w-3 h-3" />
                </a>
                {aquifersLoaded > 0 && (
                  <div className="flex gap-2 mt-2">
                    {onExportAquifers && (
                      <Button variant="outline" size="sm" onClick={onExportAquifers} className="flex-1 text-xs h-7">
                        <Download className="w-3 h-3 mr-1" />
                        Exportera ({aquifersLoaded})
                      </Button>
                    )}
                    {onClearAquifers && (
                      <Button variant="outline" size="sm" onClick={onClearAquifers} className="text-xs h-7">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Soil Types Layer Control */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="soiltypes-layer" className="text-sm font-medium">
                Jordarter 1:25k-100k
              </Label>
              <p className="text-xs text-muted-foreground">
                Grundlager {soilTypesLoaded > 0 && `(${soilTypesLoaded})`}
              </p>
            </div>
            <Switch
              id="soiltypes-layer"
              checked={soilTypesVisible}
              onCheckedChange={onSoilTypesVisibleChange}
            />
          </div>
          
          {soilTypesVisible && (
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="soiltypes-opacity" className="text-xs text-muted-foreground">
                  Transparens: {Math.round(soilTypesOpacity * 100)}%
                </Label>
                <Slider
                  id="soiltypes-opacity"
                  min={0}
                  max={1}
                  step={0.1}
                  value={[soilTypesOpacity]}
                  onValueChange={([value]) => onSoilTypesOpacityChange(value)}
                  className="w-full"
                />
              </div>
              <div className="text-xs space-y-1">
                <div className="font-medium text-muted-foreground mb-2">Jordartskategorier:</div>
                <div className="grid grid-cols-2 gap-1">
                  {SOIL_TYPE_CATEGORIES.slice(0, 8).map((cat) => (
                    <div key={cat.code} className="flex items-center gap-1">
                      <div 
                        className="w-3 h-3 rounded-sm border" 
                        style={{ 
                          backgroundColor: cat.fill, 
                          borderColor: cat.stroke 
                        }} 
                      />
                      <span className="text-muted-foreground text-[10px] truncate">{cat.name}</span>
                    </div>
                  ))}
                </div>
                <a 
                  href="https://www.sgu.se/produkter-och-tjanster/geologiska-data/jordarter--geologiska-data/jordartsdata/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sgu-link hover:underline inline-flex items-center gap-1 mt-2"
                >
                  Produktbeskrivning <ExternalLink className="w-3 h-3" />
                </a>
                {soilTypesLoaded > 0 && (
                  <div className="flex gap-2 mt-2">
                    {onExportSoilTypes && (
                      <Button variant="outline" size="sm" onClick={onExportSoilTypes} className="flex-1 text-xs h-7">
                        <Download className="w-3 h-3 mr-1" />
                        Exportera ({soilTypesLoaded})
                      </Button>
                    )}
                    {onClearSoilTypes && (
                      <Button variant="outline" size="sm" onClick={onClearSoilTypes} className="text-xs h-7">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                )}
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
              {sourcesLoaded > 0 && (
                <div className="flex gap-2 mt-2">
                  {onExportSources && (
                    <Button variant="outline" size="sm" onClick={onExportSources} className="flex-1 text-xs h-7">
                      <Download className="w-3 h-3 mr-1" />
                      Exportera ({sourcesLoaded})
                    </Button>
                  )}
                  {onClearSources && (
                    <Button variant="outline" size="sm" onClick={onClearSources} className="text-xs h-7">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
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
              {waterBodiesLoaded > 0 && (
                <div className="flex gap-2 mt-2">
                  {onExportWaterBodies && (
                    <Button variant="outline" size="sm" onClick={onExportWaterBodies} className="flex-1 text-xs h-7">
                      <Download className="w-3 h-3 mr-1" />
                      Exportera ({waterBodiesLoaded})
                    </Button>
                  )}
                  {onClearWaterBodies && (
                    <Button variant="outline" size="sm" onClick={onClearWaterBodies} className="text-xs h-7">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
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
              {gwLevelsObservedLoaded > 0 && (
                <div className="flex gap-2 mt-2">
                  {onExportGwLevelsObserved && (
                    <Button variant="outline" size="sm" onClick={onExportGwLevelsObserved} className="flex-1 text-xs h-7">
                      <Download className="w-3 h-3 mr-1" />
                      Exportera ({gwLevelsObservedLoaded})
                    </Button>
                  )}
                  {onClearGwLevelsObserved && (
                    <Button variant="outline" size="sm" onClick={onClearGwLevelsObserved} className="text-xs h-7">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Jorddjupsmodell */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Jorddjupsmodell</Label>
            <p className="text-xs text-muted-foreground">SGU – underlagsdata för modellen</p>
          </div>

          {/* Punktobservationer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="jorddjup-obs" className="text-xs text-foreground">Djupobservationer</Label>
                <p className="text-xs text-muted-foreground">
                  {loadingJorddjupObs ? 'Laddar…' : jorddjupObsLoaded > 0 ? `${jorddjupObsLoaded} punkter` : 'Punktmätningar'}
                </p>
              </div>
              <Switch id="jorddjup-obs" checked={jorddjupObsVisible} onCheckedChange={onJorddjupObsVisibleChange} />
            </div>
            {jorddjupObsVisible && (
              <div className="space-y-1 text-xs pl-1">
                <p className="text-muted-foreground font-medium">Djup (meter):</p>
                {[
                  { color: 'rgb(255,245,210)', label: '< 1 m' },
                  { color: 'rgb(222,184,100)', label: '1–5 m' },
                  { color: 'rgb(180,120,55)',  label: '5–20 m' },
                  { color: 'rgb(120,70,20)',   label: '20–50 m' },
                  { color: 'rgb(60,30,5)',     label: '> 50 m' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color, border: '1px solid rgba(0,0,0,0.3)' }} />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                ))}
                {jorddjupObsLoaded > 0 && onClearJorddjupObs && (
                  <Button variant="outline" size="sm" onClick={onClearJorddjupObs} className="text-xs h-7 mt-1">
                    <Trash2 className="w-3 h-3 mr-1" /> Rensa ({jorddjupObsLoaded})
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Jordartskartor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="jorddjup-kartor" className="text-xs text-foreground">Jordartskartor (underlag)</Label>
                <p className="text-xs text-muted-foreground">
                  {loadingJorddjupKartor ? 'Laddar…' : jorddjupKartorLoaded > 0 ? `${jorddjupKartorLoaded} ytor` : 'Polygoner'}
                </p>
              </div>
              <Switch id="jorddjup-kartor" checked={jorddjupKartorVisible} onCheckedChange={onJorddjupKartorVisibleChange} />
            </div>
            {jorddjupKartorVisible && jorddjupKartorLoaded > 0 && onClearJorddjupKartor && (
              <div className="pl-1">
                <Button variant="outline" size="sm" onClick={onClearJorddjupKartor} className="text-xs h-7">
                  <Trash2 className="w-3 h-3 mr-1" /> Rensa ({jorddjupKartorLoaded})
                </Button>
              </div>
            )}
          </div>

          {/* Sprickzoner */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="jorddjup-sprick" className="text-xs text-foreground">Sprickzoner (underlag)</Label>
                <p className="text-xs text-muted-foreground">
                  {loadingJorddjupSprick ? 'Laddar…' : jorddjupSprickLoaded > 0 ? `${jorddjupSprickLoaded} linjer` : 'Linjegeometrier'}
                </p>
              </div>
              <Switch id="jorddjup-sprick" checked={jorddjupSprickVisible} onCheckedChange={onJorddjupSprickVisibleChange} />
            </div>
            {jorddjupSprickVisible && jorddjupSprickLoaded > 0 && onClearJorddjupSprick && (
              <div className="pl-1">
                <Button variant="outline" size="sm" onClick={onClearJorddjupSprick} className="text-xs h-7">
                  <Trash2 className="w-3 h-3 mr-1" /> Rensa ({jorddjupSprickLoaded})
                </Button>
              </div>
            )}
          </div>

          <div className="text-xs">
            <a href="https://www.sgu.se/produkter-och-tjanster/geologiska-data/jorddjupsmodell/" target="_blank" rel="noopener noreferrer" className="text-sgu-link hover:underline inline-flex items-center gap-1">
              Om jorddjupsmodellen <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* HYPE Beräknade grundvattennivåer – fyra lager */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Beräknade grundvattennivåer</Label>
            <p className="text-xs text-muted-foreground">
              SGU-HYPE {loadingHypoAreas ? '(laddar…)' : hypoAreasLoaded > 0 ? `(${hypoAreasLoaded} områden)` : ''}
            </p>
          </div>

          {/* Four sub-layer toggles */}
          <div className="space-y-2 pl-1">
            {[
              { id: 'hypo-fyllnad-sma', label: 'Fyllnadsgrad – Små magasin', checked: hypoFyllnadSmaVisible, onChange: onHypoFyllnadSmaVisibleChange },
              { id: 'hypo-fyllnad-stora', label: 'Fyllnadsgrad – Stora magasin', checked: hypoFyllnadStoraVisible, onChange: onHypoFyllnadStoraVisibleChange },
              { id: 'hypo-sit-sma', label: 'Grundvattensituation – Små magasin', checked: hypoSitSmaVisible, onChange: onHypoSitSmaVisibleChange },
              { id: 'hypo-sit-stora', label: 'Grundvattensituation – Stora magasin', checked: hypoSitStoraVisible, onChange: onHypoSitStoraVisibleChange },
            ].map(({ id, label, checked, onChange }) => (
              <div key={id} className="flex items-center justify-between">
                <Label htmlFor={id} className="text-xs text-foreground cursor-pointer">{label}</Label>
                <Switch id={id} checked={checked} onCheckedChange={onChange} />
              </div>
            ))}
          </div>

          {(hypoFyllnadSmaVisible || hypoFyllnadStoraVisible || hypoSitSmaVisible || hypoSitStoraVisible) && (
            <div className="space-y-3">
              {/* Date selector */}
              <div className="space-y-1">
                <Label htmlFor="hypo-areas-date" className="text-xs text-muted-foreground">Datum</Label>
                <input
                  id="hypo-areas-date"
                  type="date"
                  value={hypoAreasDate}
                  min="1961-01-01"
                  onChange={(e) => onHypoAreasDateChange(e.target.value)}
                  className="w-full text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
                />
              </div>

              {/* Opacity slider */}
              <div className="space-y-2">
                <Label htmlFor="hypo-areas-opacity" className="text-xs text-muted-foreground">
                  Transparens: {Math.round(hypoAreasOpacity * 100)}%
                </Label>
                <Slider
                  id="hypo-areas-opacity"
                  min={0} max={1} step={0.1}
                  value={[hypoAreasOpacity]}
                  onValueChange={([v]) => onHypoAreasOpacityChange(v)}
                  className="w-full"
                />
              </div>

              {/* Legend */}
              <div className="space-y-1 text-xs">
                <p className="text-muted-foreground font-medium">Färgskala (percentil):</p>
                {[
                  { color: 'rgb(165,0,38)',   label: 'Mycket under normalt (<10%)' },
                  { color: 'rgb(215,90,40)',   label: 'Under normalt (10–25%)' },
                  { color: 'rgb(254,224,70)',  label: 'Normalt (25–75%)' },
                  { color: 'rgb(90,174,97)',   label: 'Över normalt (75–90%)' },
                  { color: 'rgb(0,104,55)',    label: 'Mycket över normalt (>90%)' },
                  { color: 'rgb(200,200,200)', label: 'Ingen data' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>

              <div className="text-xs space-y-1">
                <a
                  href="https://www.sgu.se/grundvatten/grundvattennivaer/berakningsmodell/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sgu-link hover:underline inline-flex items-center gap-1"
                >
                  Om beräkningsmodellen <ExternalLink className="w-3 h-3" />
                </a>
                {hypoAreasLoaded > 0 && onClearHypoAreas && (
                  <div>
                    <Button variant="outline" size="sm" onClick={onClearHypoAreas} className="text-xs h-7 mt-1">
                      <Trash2 className="w-3 h-3 mr-1" />
                      Rensa ({hypoAreasLoaded})
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Groundwater Quality Layer Control */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="gw-quality-layer" className="text-sm font-medium">
                Grundvattenkvalitet
              </Label>
              <p className="text-xs text-muted-foreground">
                Provplatser {gwQualityLoaded > 0 && `(${gwQualityLoaded})`}
              </p>
            </div>
            <Switch
              id="gw-quality-layer"
              checked={gwQualityVisible}
              onCheckedChange={onGwQualityVisibleChange}
            />
          </div>
          
          {gwQualityVisible && (
            <div className="mt-2 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[rgb(234,88,12)]" />
                <span className="text-muted-foreground">Klickbara provplatser</span>
              </div>
              <a 
                href="https://resource.sgu.se/dokument/produkter/grundvattenkvalitet-analysresultat-provplatser-beskrivning.pdf" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sgu-link hover:underline inline-flex items-center gap-1"
              >
                Produktbeskrivning <ExternalLink className="w-3 h-3" />
              </a>
              {gwQualityLoaded > 0 && (
                <div className="flex gap-2 mt-2">
                  {onExportGwQuality && (
                    <Button variant="outline" size="sm" onClick={onExportGwQuality} className="flex-1 text-xs h-7">
                      <Download className="w-3 h-3 mr-1" />
                      Exportera ({gwQualityLoaded})
                    </Button>
                  )}
                  {onClearGwQuality && (
                    <Button variant="outline" size="sm" onClick={onClearGwQuality} className="text-xs h-7">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Observations Layer Control */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="observations-layer" className="text-sm font-medium">
                Observationer
              </Label>
              <p className="text-xs text-muted-foreground">
                Fältobservationer {observationsLoaded > 0 && `(${observationsLoaded})`}
              </p>
            </div>
            <Switch
              id="observations-layer"
              checked={observationsVisible}
              onCheckedChange={onObservationsVisibleChange}
            />
          </div>
          
          {observationsVisible && (
            <div className="mt-2 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[rgb(16,185,129)]" />
                <span className="text-muted-foreground">Klickbara observationer</span>
              </div>
              {observationsLoaded > 0 && (
                <div className="flex gap-2 mt-2">
                  {onExportObservations && (
                    <Button variant="outline" size="sm" onClick={onExportObservations} className="flex-1 text-xs h-7">
                      <Download className="w-3 h-3 mr-1" />
                      Exportera ({observationsLoaded})
                    </Button>
                  )}
                  {onClearObservations && (
                    <Button variant="outline" size="sm" onClick={onClearObservations} className="text-xs h-7">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lantmäteriet WMS Section Header */}
        <div className="pt-4 border-t-2 border-primary/30">
          <h4 className="text-sm font-semibold text-primary mb-3">Lantmäteriet bakgrundskartor</h4>
        </div>

        {/* Topografisk Webbkarta Layer Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="topowebb-layer" className="text-sm font-medium">
                Topografisk webbkarta
              </Label>
              <p className="text-xs text-muted-foreground">
                Lantmäteriets topografiska karta
              </p>
            </div>
            <Switch
              id="topowebb-layer"
              checked={topoWebbVisible}
              onCheckedChange={onTopoWebbVisibleChange}
            />
          </div>
          
          {topoWebbVisible && (
            <div className="mt-2 text-xs">
              <a 
                href="https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/topografisk-webbkarta-visning/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sgu-link hover:underline inline-flex items-center gap-1"
              >
                Produktbeskrivning <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Ortofoto Layer Control */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="ortofoto-layer" className="text-sm font-medium">
                Ortofoto
              </Label>
              <p className="text-xs text-muted-foreground">
                Flygbilder över Sverige
              </p>
            </div>
            <Switch
              id="ortofoto-layer"
              checked={ortofotoVisible}
              onCheckedChange={onOrtofotoVisibleChange}
            />
          </div>
          
          {ortofotoVisible && (
            <div className="mt-2 text-xs">
              <a 
                href="https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/ortofoto/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sgu-link hover:underline inline-flex items-center gap-1"
              >
                Produktbeskrivning <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Terrängskuggning Layer Control */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="terrangskuggning-layer" className="text-sm font-medium">
                Terrängskuggning
              </Label>
              <p className="text-xs text-muted-foreground">
                Höjdmodell med skuggning
              </p>
            </div>
            <Switch
              id="terrangskuggning-layer"
              checked={terrangskuggningVisible}
              onCheckedChange={onTerrangskuggningVisibleChange}
            />
          </div>
          
          {terrangskuggningVisible && (
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="terrangskuggning-opacity" className="text-xs text-muted-foreground">
                  Transparens: {Math.round(terrangskuggningOpacity * 100)}%
                </Label>
                <Slider
                  id="terrangskuggning-opacity"
                  min={0}
                  max={1}
                  step={0.1}
                  value={[terrangskuggningOpacity]}
                  onValueChange={([value]) => onTerrangskuggningOpacityChange(value)}
                  className="w-full"
                />
              </div>
              <div className="text-xs">
                <a 
                  href="https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/hojdmodell/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sgu-link hover:underline inline-flex items-center gap-1"
                >
                  Produktbeskrivning <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* SGU WMS Section Header */}
        <div className="pt-4 border-t-2 border-primary/30">
          <h4 className="text-sm font-semibold text-primary mb-3">SGU bakgrundskartor</h4>
        </div>

        {/* SGU Berggrund 1:1 miljon Layer Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="sgu-berggrund-1m-layer" className="text-sm font-medium">
                Berggrund 1:1 miljon
              </Label>
              <p className="text-xs text-muted-foreground">
                Översiktlig berggrundskarta
              </p>
            </div>
            <Switch
              id="sgu-berggrund-1m-layer"
              checked={sguBerggrund1MVisible}
              onCheckedChange={onSguBerggrund1MVisibleChange}
            />
          </div>
          
          {sguBerggrund1MVisible && (
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="sgu-berggrund-1m-opacity" className="text-xs text-muted-foreground">
                  Transparens: {Math.round(sguBerggrund1MOpacity * 100)}%
                </Label>
                <Slider
                  id="sgu-berggrund-1m-opacity"
                  min={0}
                  max={1}
                  step={0.1}
                  value={[sguBerggrund1MOpacity]}
                  onValueChange={([value]) => onSguBerggrund1MOpacityChange(value)}
                  className="w-full"
                />
              </div>
              <div className="text-xs">
                <a 
                  href="https://www.sgu.se/produkter-och-tjanster/geologiska-data/berggrund--geologiska-data/berggrund/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sgu-link hover:underline inline-flex items-center gap-1"
                >
                  Produktbeskrivning <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* SGU Berggrund 1:50 000 Layer Control */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="sgu-berggrund-50k-layer" className="text-sm font-medium">
                Berggrund 1:50 000-1:250 000
              </Label>
              <p className="text-xs text-muted-foreground">
                Detaljerad berggrundskarta
              </p>
            </div>
            <Switch
              id="sgu-berggrund-50k-layer"
              checked={sguBerggrund50kVisible}
              onCheckedChange={onSguBerggrund50kVisibleChange}
            />
          </div>
          
          {sguBerggrund50kVisible && (
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="sgu-berggrund-50k-opacity" className="text-xs text-muted-foreground">
                  Transparens: {Math.round(sguBerggrund50kOpacity * 100)}%
                </Label>
                <Slider
                  id="sgu-berggrund-50k-opacity"
                  min={0}
                  max={1}
                  step={0.1}
                  value={[sguBerggrund50kOpacity]}
                  onValueChange={([value]) => onSguBerggrund50kOpacityChange(value)}
                  className="w-full"
                />
              </div>
              <div className="text-xs">
                <a 
                  href="https://www.sgu.se/produkter-och-tjanster/geologiska-data/berggrund--geologiska-data/berggrund/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sgu-link hover:underline inline-flex items-center gap-1"
                >
                  Produktbeskrivning <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* SGU Jordarter 1:1 miljon Layer Control */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="sgu-jordarter-1m-layer" className="text-sm font-medium">
                Jordarter 1:1 miljon (WMS)
              </Label>
              <p className="text-xs text-muted-foreground">
                Översiktlig jordartsgeologi
              </p>
            </div>
            <Switch
              id="sgu-jordarter-1m-layer"
              checked={sguJordarter1MVisible}
              onCheckedChange={onSguJordarter1MVisibleChange}
            />
          </div>
          
          {sguJordarter1MVisible && (
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="sgu-jordarter-1m-opacity" className="text-xs text-muted-foreground">
                  Transparens: {Math.round(sguJordarter1MOpacity * 100)}%
                </Label>
                <Slider
                  id="sgu-jordarter-1m-opacity"
                  min={0}
                  max={1}
                  step={0.1}
                  value={[sguJordarter1MOpacity]}
                  onValueChange={([value]) => onSguJordarter1MOpacityChange(value)}
                  className="w-full"
                />
              </div>
              <div className="text-xs">
                <a 
                  href="https://www.sgu.se/produkter-och-tjanster/geologiska-data/jordarter--geologiska-data/jordartsdata/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sgu-link hover:underline inline-flex items-center gap-1"
                >
                  Produktbeskrivning <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* SGU Jordarter 1:25 000-1:100 000 Layer Control */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="sgu-jordarter-25k-layer" className="text-sm font-medium">
                Jordarter 1:25 000-1:100 000 (WMS)
              </Label>
              <p className="text-xs text-muted-foreground">
                Detaljerad jordartsgeologi
              </p>
            </div>
            <Switch
              id="sgu-jordarter-25k-layer"
              checked={sguJordarter25kVisible}
              onCheckedChange={onSguJordarter25kVisibleChange}
            />
          </div>
          
          {sguJordarter25kVisible && (
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="sgu-jordarter-25k-opacity" className="text-xs text-muted-foreground">
                  Transparens: {Math.round(sguJordarter25kOpacity * 100)}%
                </Label>
                <Slider
                  id="sgu-jordarter-25k-opacity"
                  min={0}
                  max={1}
                  step={0.1}
                  value={[sguJordarter25kOpacity]}
                  onValueChange={([value]) => onSguJordarter25kOpacityChange(value)}
                  className="w-full"
                />
              </div>
              <div className="text-xs">
                <a 
                  href="https://www.sgu.se/produkter-och-tjanster/geologiska-data/jordarter--geologiska-data/jordartsdata/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sgu-link hover:underline inline-flex items-center gap-1"
                >
                  Produktbeskrivning <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* SGU Grundvattentillgång i små magasin Layer Control */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="sgu-gv-tillgang-layer" className="text-sm font-medium">
                Grundvattentillgång små magasin
              </Label>
              <p className="text-xs text-muted-foreground">
                Beräknad tillgång (l/dygn/ha)
              </p>
            </div>
            <Switch
              id="sgu-gv-tillgang-layer"
              checked={sguGvTillgangVisible}
              onCheckedChange={onSguGvTillgangVisibleChange}
            />
          </div>
          
          {sguGvTillgangVisible && (
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="sgu-gv-tillgang-opacity" className="text-xs text-muted-foreground">
                  Transparens: {Math.round(sguGvTillgangOpacity * 100)}%
                </Label>
                <Slider
                  id="sgu-gv-tillgang-opacity"
                  min={0}
                  max={1}
                  step={0.1}
                  value={[sguGvTillgangOpacity]}
                  onValueChange={([value]) => onSguGvTillgangOpacityChange(value)}
                  className="w-full"
                />
              </div>
              <div className="text-xs space-y-2">
                <a 
                  href="https://resource.sgu.se/dokument/produkter/grundvattentillgang-sma-magasin-beskrivning.pdf" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sgu-link hover:underline inline-flex items-center gap-1"
                >
                  Produktbeskrivning <ExternalLink className="w-3 h-3" />
                </a>
                {onDownloadGvTillgangGeoTiff && (
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onDownloadGvTillgangGeoTiff}
                      className="w-full text-xs h-7"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Ladda ner GeoTIFF (aktuell vy)
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
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
          {" / "}
          <a 
            href="https://www.lantmateriet.se" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sgu-link hover:underline"
          >
            Lantmäteriet
          </a>
        </p>
      </div>
      </div>
    </>
  );
};
