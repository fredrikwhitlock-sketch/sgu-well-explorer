import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface WellPopupProps {
  properties: Record<string, any>;
  type: 'source' | 'well' | 'aquifer' | 'waterBody' | 'gwLevelsObserved' | 'gwLevelsModeled';
  analysisResults?: any[];
  onClose: () => void;
}

export const WellPopup = ({ properties, type, analysisResults, onClose }: WellPopupProps) => {
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return "Ej angivet";
    if (typeof value === "string" && value.includes("T00:00:00Z")) {
      return value.split("T")[0];
    }
    return String(value);
  };

  const isUrl = (value: any): boolean => {
    if (typeof value !== 'string') return false;
    return value.startsWith('http://') || value.startsWith('https://');
  };

  const renderValue = (value: any, label?: string): React.ReactNode => {
    const formatted = formatValue(value);
    if (isUrl(value)) {
      return (
        <a 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sgu-link hover:underline inline-flex items-center gap-1"
        >
          {label || 'Öppna länk'} <ExternalLink className="w-3 h-3" />
        </a>
      );
    }
    return formatted;
  };

  const getTitle = () => {
    if (type === 'well') return 'Brunnsinformation';
    if (type === 'aquifer') return 'Grundvattenmagasin';
    if (type === 'waterBody') return 'Grundvattenförekomst';
    if (type === 'gwLevelsObserved') return 'Observerad grundvattennivå';
    if (type === 'gwLevelsModeled') return 'Modellerad grundvattennivå (HYPE)';
    return 'Källinformation';
  };

  const title = getTitle();

  const getSituationLabel = (value: number | undefined): string => {
    if (value === undefined || value === null) return "Ej angivet";
    if (value < 10) return "Mycket under normal";
    if (value < 25) return "Under normal";
    if (value < 75) return "Nära normal";
    if (value < 90) return "Över normal";
    return "Mycket över normal";
  };

  const getSituationColor = (value: number | undefined): string => {
    if (value === undefined || value === null) return "text-muted-foreground";
    if (value < 10) return "text-red-600";
    if (value < 25) return "text-orange-500";
    if (value < 75) return "text-yellow-600";
    if (value < 90) return "text-green-500";
    return "text-blue-600";
  };

  return (
    <Card className="absolute top-20 right-4 w-96 max-h-[calc(100vh-120px)] overflow-y-auto bg-card/95 backdrop-blur-sm shadow-lg border-border">
      <div className="sticky top-0 bg-sgu-maroon border-b border-border p-4 flex items-center justify-between z-10">
        <h3 className="font-semibold text-lg text-white">{title}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0 text-white hover:bg-sgu-dark-maroon"
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
                <dd className="text-sm text-foreground mt-1">
                  {isUrl(properties.notering) ? (
                    <a 
                      href={properties.notering} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sgu-link hover:underline inline-flex items-center gap-1"
                    >
                      Öppna länk <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : formatValue(properties.notering)}
                </dd>
              </div>
            )}

            {properties.url && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Mer information</dt>
                <dd className="text-sm mt-1">
                  <a 
                    href={properties.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sgu-link hover:underline inline-flex items-center gap-1"
                  >
                    Öppna länk <ExternalLink className="w-3 h-3" />
                  </a>
                </dd>
              </div>
            )}
          </>
        ) : type === 'well' ? (
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
        ) : type === 'waterBody' ? (
          <>
            {properties.eu_cd && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">EU-kod</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.eu_cd)}</dd>
              </div>
            )}

            {properties.ms_cd && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Nationell kod</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.ms_cd)}</dd>
              </div>
            )}

            {properties.name && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Namn</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.name)}</dd>
              </div>
            )}

            {properties.wb_type && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Typ</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.wb_type)}</dd>
              </div>
            )}

            {properties.wb && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Status</dt>
                <dd className="text-sm text-foreground mt-1">{properties.wb === 'Y' ? 'Beslutad' : 'Preliminär'}</dd>
              </div>
            )}

            <Separator />

            {properties.district && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Vattendistrikt</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.district)}</dd>
              </div>
            )}

            {properties.comp_auth && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Vattenmyndighet</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.comp_auth)}</dd>
              </div>
            )}

            {properties.version && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Version</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.version)}</dd>
              </div>
            )}

            {properties.versionname && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Versionens namn</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.versionname)}</dd>
              </div>
            )}

            <Separator />

            {properties.geom_area && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Area</dt>
                <dd className="text-sm text-foreground mt-1">{Math.round(properties.geom_area / 1000000)} km²</dd>
              </div>
            )}

            {properties.url_viss && (
              <div className="mt-2">
                <a 
                  href={properties.url_viss} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1"
                >
                  Visa i VISS <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </>
        ) : type === 'gwLevelsObserved' ? (
          <>
            {properties.platsbeteckning && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Platsbeteckning</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.platsbeteckning)}</dd>
              </div>
            )}

            {properties.obsplatsnamn && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Namn</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.obsplatsnamn)}</dd>
              </div>
            )}

            {properties.provplatsid && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Provplats-ID</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.provplatsid)}</dd>
              </div>
            )}

            {properties.fdat && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Startdatum</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.fdat)}</dd>
              </div>
            )}

            {properties.tdat && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Slutdatum</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.tdat)}</dd>
              </div>
            )}

            {properties.refniva && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Referensnivå</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.refniva)} m ö.h.</dd>
              </div>
            )}

            {properties.akvifer_tx && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Akvifertyp</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.akvifer_tx)}</dd>
              </div>
            )}

            {properties.jordart_tx && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Jordart</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.jordart_tx)}</dd>
              </div>
            )}

            {properties.url && (
              <div className="mt-2">
                <a 
                  href={properties.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1"
                >
                  Mer information <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </>
        ) : type === 'gwLevelsModeled' ? (
          <>
            {properties.omrade_id && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Område-ID</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.omrade_id)}</dd>
              </div>
            )}

            {properties.datum && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Datum</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.datum)}</dd>
              </div>
            )}

            <Separator className="my-3" />
            
            <div className="text-xs font-semibold text-foreground mb-2">Små magasin</div>

            {properties.fyllnadsgrad_sma !== undefined && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Fyllnadsgrad</dt>
                <dd className={`text-sm mt-1 font-medium ${getSituationColor(properties.fyllnadsgrad_sma)}`}>
                  {formatValue(properties.fyllnadsgrad_sma)}% - {getSituationLabel(properties.fyllnadsgrad_sma)}
                </dd>
              </div>
            )}

            {properties.grundvattensituation_sma !== undefined && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Grundvattensituation</dt>
                <dd className={`text-sm mt-1 font-medium ${getSituationColor(properties.grundvattensituation_sma)}`}>
                  {formatValue(properties.grundvattensituation_sma)}% - {getSituationLabel(properties.grundvattensituation_sma)}
                </dd>
              </div>
            )}

            <Separator className="my-3" />
            
            <div className="text-xs font-semibold text-foreground mb-2">Stora magasin</div>

            {properties.fyllnadsgrad_stora !== undefined && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Fyllnadsgrad</dt>
                <dd className={`text-sm mt-1 font-medium ${getSituationColor(properties.fyllnadsgrad_stora)}`}>
                  {formatValue(properties.fyllnadsgrad_stora)}% - {getSituationLabel(properties.fyllnadsgrad_stora)}
                </dd>
              </div>
            )}

            {properties.grundvattensituation_stora !== undefined && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Grundvattensituation</dt>
                <dd className={`text-sm mt-1 font-medium ${getSituationColor(properties.grundvattensituation_stora)}`}>
                  {formatValue(properties.grundvattensituation_stora)}% - {getSituationLabel(properties.grundvattensituation_stora)}
                </dd>
              </div>
            )}

            {properties.url_tidsserie && (
              <div className="mt-3">
                <a 
                  href={properties.url_tidsserie} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1"
                >
                  Hämta tidsserie (CSV) <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </>
        ) : (
          <>
            {properties.id && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">ID</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.id)}</dd>
              </div>
            )}

            {properties.namn && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Namn</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.namn)}</dd>
              </div>
            )}

            {properties.jordart_txt && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Jordart</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.jordart_txt)}</dd>
              </div>
            )}

            {properties.geom_area && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Area</dt>
                <dd className="text-sm text-foreground mt-1">{Math.round(properties.geom_area / 1000)} km²</dd>
              </div>
            )}

            {properties.url && (
              <div className="mt-2">
                <a 
                  href={properties.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1"
                >
                  Mer information <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </>
        )}

        <Separator className="my-2" />
        
        <div className="pt-2">
          <p className="text-xs text-muted-foreground">
            Källa:{" "}
            <a 
              href="https://www.sgu.se" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sgu-link hover:underline"
            >
              Sveriges geologiska undersökning (SGU)
            </a>
          </p>
        </div>
      </div>
    </Card>
  );
};