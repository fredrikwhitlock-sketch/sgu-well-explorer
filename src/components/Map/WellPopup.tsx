import { Card } from "@/components/ui/card";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WellPopupProps {
  properties: Record<string, any>;
  onClose: () => void;
}

export const WellPopup = ({ properties, onClose }: WellPopupProps) => {
  return (
    <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 max-h-[80vh] overflow-auto bg-card shadow-lg border-border z-50">
      <div className="sticky top-0 bg-card border-b border-border p-4 flex justify-between items-center">
        <h3 className="font-semibold text-foreground">Källinformation</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="p-4 space-y-3">
        {properties.namn && (
          <div>
            <div className="text-xs text-muted-foreground">Namn</div>
            <div className="font-medium">{properties.namn}</div>
          </div>
        )}
        
        {properties.id && (
          <div>
            <div className="text-xs text-muted-foreground">ID</div>
            <div className="font-medium">{properties.id}</div>
          </div>
        )}
        
        {properties.kommun && (
          <div>
            <div className="text-xs text-muted-foreground">Kommun</div>
            <div className="font-medium">{properties.kommun}</div>
          </div>
        )}
        
        {properties.obsdat && (
          <div>
            <div className="text-xs text-muted-foreground">Observationsdatum</div>
            <div className="font-medium">
              {new Date(properties.obsdat).toLocaleDateString('sv-SE')}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          {properties.kalltyp_tx && (
            <div>
              <div className="text-xs text-muted-foreground">Källtyp</div>
              <div className="font-medium text-sm">{properties.kalltyp_tx}</div>
            </div>
          )}
          
          {properties.akvtyp_txt && (
            <div>
              <div className="text-xs text-muted-foreground">Akvifertyp</div>
              <div className="font-medium text-sm">{properties.akvtyp_txt}</div>
            </div>
          )}
          
          {properties.fl_txt && (
            <div>
              <div className="text-xs text-muted-foreground">Flödesintervall</div>
              <div className="font-medium">{properties.fl_txt}</div>
            </div>
          )}
          
          {properties.temp_f !== null && properties.temp_f !== undefined && (
            <div>
              <div className="text-xs text-muted-foreground">Temperatur</div>
              <div className="font-medium">{properties.temp_f} °C</div>
            </div>
          )}
          
          {properties.ph_f !== null && properties.ph_f !== undefined && (
            <div>
              <div className="text-xs text-muted-foreground">pH-värde</div>
              <div className="font-medium">{properties.ph_f}</div>
            </div>
          )}
          
          {properties.lednform_f !== null && properties.lednform_f !== undefined && (
            <div>
              <div className="text-xs text-muted-foreground">Ledningsförmåga</div>
              <div className="font-medium">{properties.lednform_f} mS/m</div>
            </div>
          )}
          
          {properties.utf_txt && (
            <div>
              <div className="text-xs text-muted-foreground">Utfällningar</div>
              <div className="font-medium text-sm">{properties.utf_txt}</div>
            </div>
          )}
        </div>
        
        {properties.notering && (
          <div className="pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground">Notering</div>
            <div className="text-sm">{properties.notering}</div>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border text-xs">
          {properties.mne_txt && (
            <div>
              <div className="text-muted-foreground">Lägesbestämning</div>
              <div>{properties.mne_txt}</div>
            </div>
          )}
          
          {properties.vne_txt && (
            <div>
              <div className="text-muted-foreground">Positionsfel</div>
              <div>{properties.vne_txt}</div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
