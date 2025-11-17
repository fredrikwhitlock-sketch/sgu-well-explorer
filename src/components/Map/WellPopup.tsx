import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
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

  const getTitle = () => {
    if (type === 'well') return 'Brunnsinformation';
    if (type === 'aquifer') return 'Grundvattenmagasin';
    if (type === 'waterBody') return 'Grundvattenförekomst';
    if (type === 'gwLevelsObserved') return 'Observerad grundvattennivå';
    if (type === 'gwLevelsModeled') return 'Modellerad grundvattennivå (HYPE)';
    return 'Källinformation';
  };

  const title = getTitle();

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
                  className="text-sm text-primary hover:underline"
                >
                  Visa i VISS →
                </a>
              </div>
            )}
          </>
        ) : type === 'samplingsite' ? (
          <>
            {properties.obsplatsid && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Obsplats-ID</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.obsplatsid)}</dd>
              </div>
            )}

            {properties.provplatsnamn && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Namn</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.provplatsnamn)}</dd>
              </div>
            )}

            {properties.kommun && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Kommun</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.kommun)}</dd>
              </div>
            )}

            {properties.lan && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Län</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.lan)}</dd>
              </div>
            )}

            {properties.provplatsbeskrivning && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Beskrivning</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.provplatsbeskrivning)}</dd>
              </div>
            )}

            {properties.provplatstyp && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Typ</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.provplatstyp)}</dd>
              </div>
            )}

            {properties.magasin && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Magasin</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.magasin)}</dd>
              </div>
            )}
            
            {analysisResults && analysisResults.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Senaste provtagning</h4>
                  {analysisResults[0].provtagningsdatum && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Datum</dt>
                      <dd className="text-sm text-foreground mt-1">{formatValue(analysisResults[0].provtagningsdatum)}</dd>
                    </div>
                  )}
                  {analysisResults[0].parameter && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Parameter</dt>
                      <dd className="text-sm text-foreground mt-1">{formatValue(analysisResults[0].parameter)}</dd>
                    </div>
                  )}
                  {analysisResults[0].varde && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Värde</dt>
                      <dd className="text-sm text-foreground mt-1">{formatValue(analysisResults[0].varde)} {analysisResults[0].enhet || ''}</dd>
                    </div>
                  )}
                  {analysisResults[0].metod && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Metod</dt>
                      <dd className="text-sm text-foreground mt-1">{formatValue(analysisResults[0].metod)}</dd>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {properties.magasinsnamn && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Magasinsnamn</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.magasinsnamn)}</dd>
              </div>
            )}

            {properties.unik_magasinsidentitet && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Magasins-ID</dt>
                <dd className="text-sm text-foreground mt-1 break-all">{formatValue(properties.unik_magasinsidentitet)}</dd>
              </div>
            )}

            {properties.magasinsidentitet && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Magasinsidentitet</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.magasinsidentitet)}</dd>
              </div>
            )}

            {properties.lank_magasinsbeskrivning && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Magasinsbeskrivning</dt>
                <dd className="text-sm text-foreground mt-1">
                  <a href={properties.lank_magasinsbeskrivning} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Läs mer
                  </a>
                </dd>
              </div>
            )}

            <Separator />

            {properties.akvifertyp && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Akvifertyp</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.akvifertyp)}</dd>
              </div>
            )}

            {properties.akvifertyp_kod && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Akvifertyp kod</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.akvifertyp_kod)}</dd>
              </div>
            )}

            {properties.grvbildningstyp && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Grundvattenbildningstyp</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.grvbildningstyp)}</dd>
              </div>
            )}

            {properties.grvbildningstyp_kod && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Grundvattenbildningstyp kod</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.grvbildningstyp_kod)}</dd>
              </div>
            )}

            {properties.genes && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Genes</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.genes)}</dd>
              </div>
            )}

            {properties.genes_kod && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Genes kod</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.genes_kod)}</dd>
              </div>
            )}

            {properties.magasinsposition && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Magasinsposition</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.magasinsposition)}</dd>
              </div>
            )}

            {properties.magasinsposition_kod && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Magasinsposition kod</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.magasinsposition_kod)}</dd>
              </div>
            )}

            <Separator />

            {properties.infiltrationsmojligheter && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Infiltrationsmöjligheter</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.infiltrationsmojligheter)}</dd>
              </div>
            )}

            {properties.infiltrationsmojligheter_kod && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Infiltrationsmöjligheter kod</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.infiltrationsmojligheter_kod)}</dd>
              </div>
            )}

            {properties.medelmaktighet_mattad_zon && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Medelmäktighet mättad zon</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.medelmaktighet_mattad_zon)}</dd>
              </div>
            )}

            {properties.medelmaktighet_mattad_zon_kod && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Medelmäktighet mättad zon kod</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.medelmaktighet_mattad_zon_kod)}</dd>
              </div>
            )}

            {properties.medelmaktighet_omattad_zon && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Medelmäktighet omättad zon</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.medelmaktighet_omattad_zon)}</dd>
              </div>
            )}

            {properties.medelmaktighet_omattad_zon_kod && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Medelmäktighet omättad zon kod</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.medelmaktighet_omattad_zon_kod)}</dd>
              </div>
            )}

            {properties.tillrinning_fran_tillrinningsomraden_l_per_s && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Tillrinning från tillrinningsområden</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.tillrinning_fran_tillrinningsomraden_l_per_s)} l/s</dd>
              </div>
            )}

            <Separator />

            {properties.bergart && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Bergart</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.bergart)}</dd>
              </div>
            )}

            {properties.bergart_kod && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Bergart kod</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.bergart_kod)}</dd>
              </div>
            )}

            {properties.geologisk_period && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Geologisk period</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.geologisk_period)}</dd>
              </div>
            )}

            {properties.geologisk_period_kod && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Geologisk period kod</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.geologisk_period_kod)}</dd>
              </div>
            )}

            {properties.geometrikvalitet && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Geometrikvalitet</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.geometrikvalitet)}</dd>
              </div>
            )}

            {properties.geometrikvalitet_kod && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Geometrikvalitet kod</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.geometrikvalitet_kod)}</dd>
              </div>
            )}

            {properties.geometriunderlag && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Geometriunderlag</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.geometriunderlag)}</dd>
              </div>
            )}

            {properties.geometriunderlag_kod && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Geometriunderlag kod</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.geometriunderlag_kod)}</dd>
              </div>
            )}

            {properties.karteringsprocess && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Karteringsprocess</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.karteringsprocess)}</dd>
              </div>
            )}

            {properties.karteringsprocess_kod && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Karteringsprocess kod</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.karteringsprocess_kod)}</dd>
              </div>
            )}

            <Separator />

            {properties.geom_area && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Area</dt>
                <dd className="text-sm text-foreground mt-1">{Math.round(properties.geom_area).toLocaleString('sv-SE')} m²</dd>
              </div>
            )}

            {properties.geom_length && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Omkrets</dt>
                <dd className="text-sm text-foreground mt-1">{Math.round(properties.geom_length).toLocaleString('sv-SE')} m</dd>
              </div>
            )}

            {properties.anmarkning_grundvattenmagasin && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Anmärkning</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.anmarkning_grundvattenmagasin)}</dd>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
};
