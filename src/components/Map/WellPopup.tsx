import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface WellPopupProps {
  properties: Record<string, any>;
  type: 'source' | 'well';
  onClose: () => void;
}

export const WellPopup = ({ properties, type, onClose }: WellPopupProps) => {
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return "Ej angivet";
    if (typeof value === "string" && value.includes("T00:00:00Z")) {
      return value.split("T")[0];
    }
    return String(value);
  };

  const title = type === 'source' ? 'Källinformation' : 'Brunnsinformation';

  return (
    <Card className="absolute top-20 right-4 w-96 max-h-[calc(100vh-120px)] overflow-y-auto bg-card/95 backdrop-blur-sm shadow-lg border-border">
      <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
        <h3 className="font-semibold text-lg text-foreground">{title}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="p-4 space-y-3">
        {type === 'source' ? (
          <>
            {properties.namn && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Namn</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.namn)}</dd>
              </div>
            )}
            
            {properties.id && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">ID</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.id)}</dd>
              </div>
            )}

            {properties.kommun && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Kommun</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.kommun)}</dd>
              </div>
            )}
            
            {properties.obsdat && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Observationsdatum</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.obsdat)}</dd>
              </div>
            )}
            
            {properties.kalltyp_tx && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Källtyp</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.kalltyp_tx)}</dd>
              </div>
            )}

            {properties.akvtyp_txt && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Akvifertyp</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.akvtyp_txt)}</dd>
              </div>
            )}

            {properties.fl_txt && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Flöde</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.fl_txt)}</dd>
              </div>
            )}
            
            {properties.temp_f && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Temperatur</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.temp_f)}°C</dd>
              </div>
            )}

            {properties.ph_f && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">pH</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.ph_f)}</dd>
              </div>
            )}

            {properties.lednform_f && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Ledningsförmåga</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.lednform_f)} mS/m</dd>
              </div>
            )}

            {properties.utf_txt && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Utfällning</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.utf_txt)}</dd>
              </div>
            )}
            
            {properties.notering && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Notering</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.notering)}</dd>
              </div>
            )}
          </>
        ) : (
          <>
            {properties.obsplatsid && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Observationsplats-ID</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.obsplatsid)}</dd>
              </div>
            )}

            {properties.brunnsid && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Brunns-ID</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.brunnsid)}</dd>
              </div>
            )}

            {properties.ort && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Ort</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.ort)}</dd>
              </div>
            )}

            {properties.kommunnamn && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Kommun</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.kommunnamn)}</dd>
              </div>
            )}

            {properties.fastighet && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Fastighet</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.fastighet)}</dd>
              </div>
            )}

            {properties.borrdatum && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Borrdatum</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.borrdatum)}</dd>
              </div>
            )}

            <Separator />

            {properties.totaldjup && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Totaldjup</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.totaldjup)} m</dd>
              </div>
            )}

            {properties.jorddjup && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Jorddjup</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.jorddjup)} m</dd>
              </div>
            )}

            {properties.kapacitet && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Kapacitet</dt>
                <dd className="text-sm text-foreground mt-1">
                  {properties.tecken_vattenmangd && formatValue(properties.tecken_vattenmangd)}
                  {formatValue(properties.kapacitet)} l/h
                </dd>
              </div>
            )}

            {properties.grundvattenniva && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Grundvattennivå</dt>
                <dd className="text-sm text-foreground mt-1">
                  {properties.tecken_niva && formatValue(properties.tecken_niva)}
                  {formatValue(properties.grundvattenniva)} m
                </dd>
              </div>
            )}

            {properties.nivadatum && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Nivådatum</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.nivadatum)}</dd>
              </div>
            )}

            <Separator />

            {properties.bottendiam && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Bottendiameter</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.bottendiam)} mm</dd>
              </div>
            )}

            {properties.anvandning && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Användning</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.anvandning)}</dd>
              </div>
            )}

            {properties.allman_anmarkning && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Allmän anmärkning</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.allman_anmarkning)}</dd>
              </div>
            )}

            {properties.grundvattenanmarkning && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Grundvattenanmärkning</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.grundvattenanmarkning)}</dd>
              </div>
            )}

            {properties.posvardering && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Positionsvärdering</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.posvardering)}</dd>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
};
