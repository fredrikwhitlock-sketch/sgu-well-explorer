import { useState, useRef, useCallback, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, Download, BarChart3, PlusCircle, ChevronLeft, ChevronRight, GripHorizontal, Layers } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface LagerItem {
  lagernr: number;
  djup_fran: number;
  djup_till: number;
  jordart_bergart: string;
  lageranmarkning?: string;
}

interface WellPopupProps {
  properties: Record<string, any>;
  type: 'source' | 'well' | 'aquifer' | 'waterBody' | 'gwLevelsObserved' | 'gwQuality' | 'soilType' | 'gvTillgang' | 'observation' | 'hypoArea' | 'jorddjupObs' | 'jorddjupKartor' | 'jorddjupSprick';
  analysisResults?: any[];
  onClose: () => void;
  onOpenChart?: (location: { id: string; name: string; type: 'level' | 'quality'; platsbeteckning?: string; provplatsid?: string }) => void;
  onAddToChart?: (location: { id: string; name: string; type: 'level' | 'quality'; platsbeteckning?: string; provplatsid?: string }) => void;
  chartOpen?: boolean;
  chartType?: 'level' | 'quality' | null;
  totalFeatures?: number;
  currentFeatureIndex?: number;
  onNavigateFeature?: (index: number) => void;
}

export const WellPopup = ({ 
  properties, 
  type, 
  analysisResults, 
  onClose, 
  onOpenChart, 
  onAddToChart, 
  chartOpen, 
  chartType,
  totalFeatures = 1,
  currentFeatureIndex = 0,
  onNavigateFeature
}: WellPopupProps) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lagerData, setLagerData] = useState<LagerItem[]>([]);
  const [lagerLoading, setLagerLoading] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Fetch lagerföljd for wells
  useEffect(() => {
    if (type !== 'well' || !properties.obsplatsid) {
      setLagerData([]);
      return;
    }
    setLagerLoading(true);
    fetch(
      `https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar-lager/items?f=json&filter=obsplatsid%3D%27${encodeURIComponent(properties.obsplatsid)}%27&limit=100`
    )
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json?.features) {
          const items: LagerItem[] = json.features
            .map((f: any) => f.properties)
            .sort((a: LagerItem, b: LagerItem) => a.lagernr - b.lagernr);
          setLagerData(items);
        }
      })
      .catch(() => setLagerData([]))
      .finally(() => setLagerLoading(false));
  }, [type, properties.obsplatsid]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y
    };
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      
      setPosition({
        x: dragRef.current.initialX + deltaX,
        y: dragRef.current.initialY + deltaY
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

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

  const parseHtmlLinks = (text: string): React.ReactNode => {
    // Match <a href="...">text</a> patterns
    const linkRegex = /<a\s+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let keyIndex = 0;

    while ((match = linkRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      // Add the link
      const [, href, linkText] = match;
      parts.push(
        <a
          key={keyIndex++}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sgu-link hover:underline inline-flex items-center gap-1"
        >
          {linkText || 'Länk'} <ExternalLink className="w-3 h-3" />
        </a>
      );
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const containsHtmlLinks = (value: any): boolean => {
    if (typeof value !== 'string') return false;
    return /<a\s+href=/i.test(value);
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
    if (type === 'gwQuality') return 'Grundvattenkvalitet - Provplats';
    if (type === 'soilType') return 'Jordartsinformation';
    if (type === 'gvTillgang') return 'Grundvattentillgång';
    if (type === 'observation') return 'Observation';
    if (type === 'hypoArea') return 'Beräknad grundvattennivå';
    if (type === 'jorddjupObs') return 'Jorddjupsobservation';
    if (type === 'jorddjupKartor') return 'Jordartskartor – underlag';
    if (type === 'jorddjupSprick') return 'Sprickzon – underlag';
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
    <Card 
      ref={cardRef}
      className="absolute top-20 right-4 w-[calc(100vw-2rem)] sm:w-96 max-w-96 max-h-[calc(100vh-120px)] overflow-y-auto bg-card/95 backdrop-blur-sm shadow-lg border-border z-30"
      style={{ 
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      <div 
        className="sticky top-0 bg-sgu-maroon border-b border-border p-4 flex items-center justify-between z-10 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-4 w-4 text-white/50" />
          <h3 className="font-semibold text-lg text-white">{title}</h3>
          {totalFeatures > 1 && (
            <span className="text-sm text-white/70">
              ({currentFeatureIndex + 1}/{totalFeatures})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          {totalFeatures > 1 && onNavigateFeature && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateFeature(currentFeatureIndex > 0 ? currentFeatureIndex - 1 : totalFeatures - 1)}
                className="h-8 w-8 p-0 text-white hover:bg-sgu-dark-maroon"
                title="Föregående objekt"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateFeature(currentFeatureIndex < totalFeatures - 1 ? currentFeatureIndex + 1 : 0)}
                className="h-8 w-8 p-0 text-white hover:bg-sgu-dark-maroon"
                title="Nästa objekt"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-white hover:bg-sgu-dark-maroon"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
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
                  ) : containsHtmlLinks(properties.notering) ? (
                    parseHtmlLinks(properties.notering)
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

            {/* Lagerföljd section */}
            {properties.obsplatsid && (
              <>
                <Separator />
                <div>
                  <dt className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
                    <Layers className="w-3 h-3" />
                    Lagerföljd
                  </dt>
                  {lagerLoading ? (
                    <p className="text-xs text-muted-foreground italic">Laddar lagerföljd...</p>
                  ) : lagerData.length > 0 ? (
                    <div className="border border-border rounded overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left px-2 py-1 font-medium text-muted-foreground">Från</th>
                            <th className="text-left px-2 py-1 font-medium text-muted-foreground">Till</th>
                            <th className="text-left px-2 py-1 font-medium text-muted-foreground">Jordart/bergart</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lagerData.map((l, i) => (
                            <tr key={i} className="border-t border-border/50">
                              <td className="px-2 py-1">{l.djup_fran} m</td>
                              <td className="px-2 py-1">{l.djup_till} m</td>
                              <td className="px-2 py-1">{l.jordart_bergart}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Inga lagerföljder registrerade</p>
                  )}
                </div>

                <div>
                  <a
                    href={`/protokoll?id=${properties.obsplatsid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-sgu-link hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Visa brunns- och borrprotokoll
                  </a>
                </div>
              </>
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

            <Separator className="my-3" />

            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground">Hämta mätdata</div>
              {properties.platsbeteckning && (
                <div className="flex flex-wrap gap-2">
                  <a 
                    href={`https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/nivaer/items?filter=platsbeteckning%20%3D%20%27${encodeURIComponent(properties.platsbeteckning)}%27&f=text/csv`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> CSV
                  </a>
                  <a 
                    href={`https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/nivaer/items?filter=platsbeteckning%20%3D%20%27${encodeURIComponent(properties.platsbeteckning)}%27&f=json`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1"
                  >
                    JSON
                  </a>
                </div>
              )}
            </div>

            <Separator className="my-3" />

            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground">Diagram</div>
              <div className="flex flex-wrap gap-2">
                {chartOpen && chartType === 'level' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddToChart?.({
                      id: `${properties.platsbeteckning}-${Date.now()}`,
                      name: properties.platsbeteckning || properties.obsplatsnamn || 'Station',
                      type: 'level',
                      platsbeteckning: properties.platsbeteckning
                    })}
                    className="text-xs"
                  >
                    <PlusCircle className="w-3 h-3 mr-1" /> Lägg till i diagram
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChart?.({
                      id: `${properties.platsbeteckning}-${Date.now()}`,
                      name: properties.platsbeteckning || properties.obsplatsnamn || 'Station',
                      type: 'level',
                      platsbeteckning: properties.platsbeteckning
                    })}
                    className="text-xs"
                  >
                    <BarChart3 className="w-3 h-3 mr-1" /> Visa diagram
                  </Button>
                )}
              </div>
            </div>

          </>
        ) : type === 'gwQuality' ? (
          <>
            {properties.platsbeteckning && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Platsbeteckning</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.platsbeteckning)}</dd>
              </div>
            )}

            {properties.provplatsnamn && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Provplatsnamn</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.provplatsnamn)}</dd>
              </div>
            )}

            {properties.provplatstyp_tx && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Provplatstyp</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.provplatstyp_tx)}</dd>
              </div>
            )}

            {properties.provplatskat_bedgr_tx && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Kategori</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.provplatskat_bedgr_tx)}</dd>
              </div>
            )}

            <Separator className="my-3" />

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

            {properties.vattendistrikt_tx && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Vattendistrikt</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.vattendistrikt_tx)}</dd>
              </div>
            )}

            {properties.eucd_gwb && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Grundvattenförekomst (EU-kod)</dt>
                <dd className="text-sm text-foreground mt-1">
                  <a 
                    href={`https://viss.lansstyrelsen.se/Waters.aspx?waterMSCD=${properties.eucd_gwb.trim()}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sgu-link hover:underline inline-flex items-center gap-1"
                  >
                    {formatValue(properties.eucd_gwb.trim())} <ExternalLink className="w-3 h-3" />
                  </a>
                </dd>
              </div>
            )}

            <Separator className="my-3" />

            {properties.akvifer_tx && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Akvifer</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.akvifer_tx)}</dd>
              </div>
            )}

            {properties.genes_jord_tx && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Jordart (genes)</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.genes_jord_tx)}</dd>
              </div>
            )}

            {properties.gvmiljo_bedgr_tx && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Grundvattenmiljö</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.gvmiljo_bedgr_tx)}</dd>
              </div>
            )}

            {properties.geohylag_tx && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Geohydrologiskt läge</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.geohylag_tx)}</dd>
              </div>
            )}

            <Separator className="my-3" />

            {properties.antal_prov && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Antal prover</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.antal_prov)}</dd>
              </div>
            )}

            {properties.fdat && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Första provdatum</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.fdat)}</dd>
              </div>
            )}

            {properties.tdat && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Senaste provdatum</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.tdat)}</dd>
              </div>
            )}

            {properties.programkoppl && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Programkoppling</dt>
                <dd className="text-sm text-foreground mt-1 text-xs">{formatValue(properties.programkoppl)}</dd>
              </div>
            )}

            <Separator className="my-3" />

            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground">Hämta analysresultat</div>
              <div className="flex flex-wrap gap-2">
                {properties.nationellt_provplatsid && (
                  <a 
                    href={`https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/analysresultat/items?f=csv&filter=nationellt_provplatsid%20%3D%20${properties.nationellt_provplatsid}&limit=10000`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> CSV
                  </a>
                )}
                {properties.nationellt_provplatsid && (
                  <a 
                    href={`https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/analysresultat/items?f=json&filter=nationellt_provplatsid%20%3D%20${properties.nationellt_provplatsid}&limit=10000`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> JSON
                  </a>
                )}
              </div>
            </div>

            <Separator className="my-3" />

            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground">Diagram</div>
              <div className="flex flex-wrap gap-2">
                {chartOpen && chartType === 'quality' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddToChart?.({
                      id: `${properties.nationellt_provplatsid}-${Date.now()}`,
                      name: properties.platsbeteckning || properties.provplatsnamn || 'Provplats',
                      type: 'quality',
                      provplatsid: properties.nationellt_provplatsid
                    })}
                    className="text-xs"
                  >
                    <PlusCircle className="w-3 h-3 mr-1" /> Lägg till i diagram
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChart?.({
                      id: `${properties.nationellt_provplatsid}-${Date.now()}`,
                      name: properties.platsbeteckning || properties.provplatsnamn || 'Provplats',
                      type: 'quality',
                      provplatsid: properties.nationellt_provplatsid
                    })}
                    className="text-xs"
                  >
                    <BarChart3 className="w-3 h-3 mr-1" /> Visa diagram
                  </Button>
                )}
              </div>
            </div>

            <Separator className="my-3" />

            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground">Statistiska analyser</div>
              <a 
                href="https://deep-well-insights.lovable.app/"
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1"
              >
                <BarChart3 className="w-3 h-3" /> Öppna statistikverktyg
              </a>
            </div>
          </>
        ) : type === 'soilType' ? (
          <>
            {/* Main soil type info */}
            {properties.jg2_tx && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Jordart</dt>
                <dd className="text-lg font-semibold text-foreground mt-1">{formatValue(properties.jg2_tx)}</dd>
              </div>
            )}

            {properties.jg2 && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Jordartskod (JG2)</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.jg2)}</dd>
              </div>
            )}

            {properties.symbol && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Symbolkod</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.symbol)}</dd>
              </div>
            )}

            <Separator className="my-3" />

            {properties.kartering && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Kartering</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.kartering)}</dd>
              </div>
            )}

            {properties.karttyp && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Karttyp</dt>
                <dd className="text-sm text-foreground mt-1">
                  {properties.karttyp === 5 ? '1:25 000' : 
                   properties.karttyp === 10 ? '1:50 000' : 
                   properties.karttyp === 20 ? '1:100 000' : 
                   formatValue(properties.karttyp)}
                </dd>
              </div>
            )}

            <Separator className="my-3" />

            {properties.geom_area && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Area</dt>
                <dd className="text-sm text-foreground mt-1">
                  {properties.geom_area > 1000000 
                    ? `${(properties.geom_area / 1000000).toFixed(2)} km²`
                    : `${(properties.geom_area / 10000).toFixed(2)} ha`}
                </dd>
              </div>
            )}

            {properties.geom_length && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Omkrets</dt>
                <dd className="text-sm text-foreground mt-1">
                  {properties.geom_length > 1000 
                    ? `${(properties.geom_length / 1000).toFixed(2)} km`
                    : `${properties.geom_length.toFixed(0)} m`}
                </dd>
              </div>
            )}

            <Separator className="my-3" />

            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground">Mer information</div>
              <a 
                href="https://www.sgu.se/produkter-och-tjanster/geologiska-data/jordarter--geologiska-data/jordartsdata/"
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1"
              >
                Om SGU:s jordartsdata <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </>
        ) : type === 'observation' ? (
          <>
            {properties.station_name && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Station</dt>
                <dd className="text-sm font-semibold text-foreground mt-1">{formatValue(properties.station_name)}</dd>
              </div>
            )}
            {properties.station_id && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Stations-ID</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.station_id)}</dd>
              </div>
            )}
            {properties.obs_datum && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Observationsdatum</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.obs_datum)}</dd>
              </div>
            )}
            {properties.kalltyp && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Källtyp</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.kalltyp)}</dd>
              </div>
            )}
            <Separator className="my-3" />
            {properties.temperatur !== null && properties.temperatur !== undefined && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Temperatur</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.temperatur)} °C</dd>
              </div>
            )}
            {properties.ph_falt !== null && properties.ph_falt !== undefined && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">pH (fält)</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.ph_falt)}</dd>
              </div>
            )}
            {properties.konduktivitet_falt !== null && properties.konduktivitet_falt !== undefined && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Konduktivitet (fält)</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.konduktivitet_falt)} µS/cm</dd>
              </div>
            )}
            {properties.flode !== null && properties.flode !== undefined && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Flöde</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.flode)} l/s</dd>
              </div>
            )}
            {properties.utfallningar && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Utfällningar</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.utfallningar)}</dd>
              </div>
            )}
            {properties.kommentar && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Kommentar</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.kommentar)}</dd>
              </div>
            )}
            {properties.foto_url && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Foto</dt>
                <dd className="text-sm mt-1">
                  <a href={properties.foto_url} target="_blank" rel="noopener noreferrer" className="text-sgu-link hover:underline inline-flex items-center gap-1">
                    Visa foto <ExternalLink className="w-3 h-3" />
                  </a>
                </dd>
              </div>
            )}
          </>
        ) : type === 'gvTillgang' ? (
          <>
            {properties.GRAY_INDEX !== undefined && (
              <div className="bg-primary/10 rounded-lg p-3">
                <dt className="text-xs font-medium text-muted-foreground">Grundvattentillgång</dt>
                <dd className="text-lg font-bold text-foreground mt-1">{formatValue(properties.GRAY_INDEX)} l/dygn/ha</dd>
              </div>
            )}
            {Object.entries(properties)
              .filter(([key]) => key !== 'geometry' && key !== 'GRAY_INDEX')
              .map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs font-medium text-muted-foreground">{key}</dt>
                  <dd className="text-sm text-foreground mt-1">{formatValue(value)}</dd>
                </div>
              ))}
            <div className="mt-2">
              <a
                href="https://resource.sgu.se/dokument/produkter/grundvattentillgang-sma-magasin-beskrivning.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1"
              >
                Produktbeskrivning <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </>
        ) : type === 'jorddjupObs' ? (
          <>
            {properties.djup !== undefined && (
              <div className="bg-primary/10 rounded-lg p-3">
                <dt className="text-xs font-medium text-muted-foreground">Jorddjup</dt>
                <dd className="text-2xl font-bold text-foreground mt-1">{properties.djup} m</dd>
              </div>
            )}
            {properties.avslut && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Avslut</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.avslut)}</dd>
              </div>
            )}
            {properties.db_del && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Datakälla</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.db_del)}</dd>
              </div>
            )}
            {(properties.n !== undefined || properties.e !== undefined) && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Koordinater (SWEREF99)</dt>
                <dd className="text-sm text-foreground mt-1">N {properties.n} / E {properties.e}</dd>
              </div>
            )}
            <div className="mt-2">
              <a href="https://www.sgu.se/produkter-och-tjanster/geologiska-data/jorddjupsmodell/" target="_blank" rel="noopener noreferrer" className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1">
                Om jorddjupsmodellen <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </>
        ) : type === 'jorddjupKartor' ? (
          <>
            {properties.karttyp !== undefined && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Karttyp</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.karttyp)}</dd>
              </div>
            )}
            {properties.kartering && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Kartering</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.kartering)}</dd>
              </div>
            )}
            {properties.insamling && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Insamlingsmetod</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.insamling)}</dd>
              </div>
            )}
            {properties.rek_skala && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Rekommenderad skala</dt>
                <dd className="text-sm text-foreground mt-1">1:{formatValue(properties.rek_skala)}</dd>
              </div>
            )}
            {properties.avslut_ar && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Avslutningsår</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.avslut_ar)}</dd>
              </div>
            )}
            {properties.und_hojd && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Höjdmodell</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.und_hojd)}</dd>
              </div>
            )}
          </>
        ) : type === 'jorddjupSprick' ? (
          <>
            {properties.struktur && (
              <div className="bg-primary/10 rounded-lg p-3">
                <dt className="text-xs font-medium text-muted-foreground">Struktur</dt>
                <dd className="text-sm font-semibold text-foreground mt-1">{formatValue(properties.struktur)}</dd>
              </div>
            )}
            {properties.geom_length !== undefined && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Längd</dt>
                <dd className="text-sm text-foreground mt-1">{Math.round(properties.geom_length)} m</dd>
              </div>
            )}
            <div className="mt-2">
              <a href="https://www.sgu.se/produkter-och-tjanster/geologiska-data/jorddjupsmodell/" target="_blank" rel="noopener noreferrer" className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1">
                Om jorddjupsmodellen <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </>
        ) : type === 'hypoArea' ? (
          <>
            {/* Area ID */}
            {properties.omrade_id !== undefined && (
              <div className="bg-primary/10 rounded-lg p-3">
                <dt className="text-xs font-medium text-muted-foreground">Område-ID (HYPE)</dt>
                <dd className="text-lg font-bold text-foreground mt-1">{properties.omrade_id}</dd>
              </div>
            )}

            {/* Datum */}
            {properties.datum && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Datum</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.datum)}</dd>
              </div>
            )}

            <Separator className="my-3" />

            {/* Små magasin */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Små magasin</p>

            {properties.fyllnadsgrad_sma !== undefined && properties.fyllnadsgrad_sma !== null && properties.fyllnadsgrad_sma !== -1 && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Fyllnadsgrad (percentil)</dt>
                <dd className="text-sm text-foreground mt-1 font-semibold">
                  {properties.fyllnadsgrad_sma}%
                  {' '}
                  <span className="font-normal text-muted-foreground">
                    {properties.fyllnadsgrad_sma < 10 ? '— Mycket under normalt' :
                     properties.fyllnadsgrad_sma < 25 ? '— Under normalt' :
                     properties.fyllnadsgrad_sma < 75 ? '— Normalt' :
                     properties.fyllnadsgrad_sma < 90 ? '— Över normalt' :
                     '— Mycket över normalt'}
                  </span>
                </dd>
              </div>
            )}

            {properties.grundvattensituation_sma !== undefined && properties.grundvattensituation_sma !== null && properties.grundvattensituation_sma !== -1 && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Grundvattensituation</dt>
                <dd className="text-sm text-foreground mt-1">{properties.grundvattensituation_sma}</dd>
              </div>
            )}

            {/* Stora magasin */}
            {(properties.fyllnadsgrad_stora !== undefined && properties.fyllnadsgrad_stora !== -1) && (
              <>
                <Separator className="my-3" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stora magasin</p>

                {properties.fyllnadsgrad_stora !== -1 && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Fyllnadsgrad (percentil)</dt>
                    <dd className="text-sm text-foreground mt-1 font-semibold">
                      {properties.fyllnadsgrad_stora}%
                      {' '}
                      <span className="font-normal text-muted-foreground">
                        {properties.fyllnadsgrad_stora < 10 ? '— Mycket under normalt' :
                         properties.fyllnadsgrad_stora < 25 ? '— Under normalt' :
                         properties.fyllnadsgrad_stora < 75 ? '— Normalt' :
                         properties.fyllnadsgrad_stora < 90 ? '— Över normalt' :
                         '— Mycket över normalt'}
                      </span>
                    </dd>
                  </div>
                )}

                {properties.grundvattensituation_stora !== undefined && properties.grundvattensituation_stora !== -1 && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Grundvattensituation</dt>
                    <dd className="text-sm text-foreground mt-1">{properties.grundvattensituation_stora}</dd>
                  </div>
                )}
              </>
            )}

            <Separator className="my-3" />

            {/* Time series link */}
            {properties.url_tidsserie && (
              <div>
                <a
                  href={properties.url_tidsserie}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1"
                >
                  Tidsserie för detta område <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            <div className="mt-2">
              <a
                href="https://www.sgu.se/grundvatten/grundvattennivaer/berakningsmodell/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1"
              >
                Om beräkningsmodellen <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </>
        ) : (
          <>
            {properties.magasinsidentitet && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Magasins-ID</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.magasinsidentitet)}</dd>
              </div>
            )}

            {properties.magasinsnamn && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Namn</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.magasinsnamn)}</dd>
              </div>
            )}

            {properties.akvifertyp && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Akvifertyp</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.akvifertyp)}</dd>
              </div>
            )}

            {properties.genes && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Genes</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.genes)}</dd>
              </div>
            )}

            {properties.grvbildningstyp && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Grundvattenbildning</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.grvbildningstyp)}</dd>
              </div>
            )}

            {properties.magasinsposition && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Magasinsposition</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.magasinsposition)}</dd>
              </div>
            )}

            <Separator />

            {properties.geom_area && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Area</dt>
                <dd className="text-sm text-foreground mt-1">{(properties.geom_area / 1000000).toFixed(2)} km²</dd>
              </div>
            )}

            {properties.infiltrationsmojligheter && properties.infiltrationsmojligheter !== "bedömning ej utförd" && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Infiltrationsmöjligheter</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.infiltrationsmojligheter)}</dd>
              </div>
            )}

            {properties.medelmaktighet_mattad_zon && properties.medelmaktighet_mattad_zon !== "bedömning ej utförd" && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Medelmäktighet mättad zon</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.medelmaktighet_mattad_zon)}</dd>
              </div>
            )}

            {properties.medelmaktighet_omattad_zon && properties.medelmaktighet_omattad_zon !== "bedömning ej utförd" && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Medelmäktighet omättad zon</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.medelmaktighet_omattad_zon)}</dd>
              </div>
            )}

            {properties.tillrinning_fran_tillrinningsomraden_l_per_s && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Tillrinning från tillrinningsområden</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.tillrinning_fran_tillrinningsomraden_l_per_s)} l/s</dd>
              </div>
            )}

            {properties.bergart && properties.bergart !== "bedömning ej utförd" && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Bergart</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.bergart)}</dd>
              </div>
            )}

            {properties.geologisk_period && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Geologisk period</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.geologisk_period)}</dd>
              </div>
            )}

            <Separator />

            {properties.geometrikvalitet && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Geometrikvalitet</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.geometrikvalitet)}</dd>
              </div>
            )}

            {properties.karteringsprocess && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Karteringsprocess</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.karteringsprocess)}</dd>
              </div>
            )}

            {properties.anmarkning_grundvattenmagasin && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Anmärkning</dt>
                <dd className="text-sm text-foreground mt-1">{formatValue(properties.anmarkning_grundvattenmagasin)}</dd>
              </div>
            )}

            <Separator />

            {properties.lank_magasinsbeskrivning && (
              <div className="mt-2">
                <a 
                  href={properties.lank_magasinsbeskrivning} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1"
                >
                  Magasinsbeskrivning <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {properties.unik_magasinsidentitet && (
              <div className="mt-2">
                <a 
                  href={`https://apps.sgu.se/grundvattenmagasin/${properties.unik_magasinsidentitet}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-sgu-link hover:underline inline-flex items-center gap-1"
                >
                  Öppna i SGU:s magasinsvisare <ExternalLink className="w-3 h-3" />
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