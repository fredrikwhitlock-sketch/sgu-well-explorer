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
        <h3 className="font-semibold text-foreground">Brunnsinformation</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="p-4 space-y-3">
        {properties.brunnsid && (
          <div>
            <div className="text-xs text-muted-foreground">Brunns-ID</div>
            <div className="font-medium">{properties.brunnsid}</div>
          </div>
        )}
        
        {properties.fastighet && (
          <div>
            <div className="text-xs text-muted-foreground">Fastighet</div>
            <div className="font-medium">{properties.fastighet}</div>
          </div>
        )}
        
        {properties.ort && (
          <div>
            <div className="text-xs text-muted-foreground">Ort</div>
            <div className="font-medium">{properties.ort}</div>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          {properties.totaldjup && (
            <div>
              <div className="text-xs text-muted-foreground">Total djup</div>
              <div className="font-medium">{properties.totaldjup} m</div>
            </div>
          )}
          
          {properties.jorddjup !== null && properties.jorddjup !== undefined && (
            <div>
              <div className="text-xs text-muted-foreground">Djup till berg</div>
              <div className="font-medium">{properties.jorddjup} m</div>
            </div>
          )}
          
          {properties.kapacitet && (
            <div>
              <div className="text-xs text-muted-foreground">Kapacitet</div>
              <div className="font-medium">{properties.kapacitet} l/h</div>
            </div>
          )}
          
          {properties.grundvattenniva !== null && properties.grundvattenniva !== undefined && (
            <div>
              <div className="text-xs text-muted-foreground">Grundvattennivå</div>
              <div className="font-medium">{properties.grundvattenniva} m</div>
            </div>
          )}
        </div>
        
        {properties.borrdatum && (
          <div className="pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground">Borrdatum</div>
            <div className="font-medium">{properties.borrdatum}</div>
          </div>
        )}
        
        {properties.anvandning && (
          <div>
            <div className="text-xs text-muted-foreground">Användning</div>
            <div className="font-medium">{properties.anvandning}</div>
          </div>
        )}
        
        {properties.rorborrning_till && (
          <div>
            <div className="text-xs text-muted-foreground">Rörborrning till</div>
            <div className="font-medium">{properties.rorborrning_till} m</div>
          </div>
        )}
        
        {properties.stalror_till && (
          <div>
            <div className="text-xs text-muted-foreground">Stålrör till</div>
            <div className="font-medium">{properties.stalror_till} m</div>
          </div>
        )}
        
        {properties.tatning && (
          <div>
            <div className="text-xs text-muted-foreground">Tätning</div>
            <div className="font-medium">{properties.tatning}</div>
          </div>
        )}
        
        {properties.allman_anmarkning && (
          <div className="pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground">Allmän anmärkning</div>
            <div className="text-sm">{properties.allman_anmarkning}</div>
          </div>
        )}
        
        {properties.grundvattenanmarkning && (
          <div>
            <div className="text-xs text-muted-foreground">Grundvattenanmärkning</div>
            <div className="text-sm">{properties.grundvattenanmarkning}</div>
          </div>
        )}
      </div>
    </Card>
  );
};
