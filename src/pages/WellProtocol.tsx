import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WellData {
  obsplatsid?: string;
  brunnsid?: number;
  fastighet?: string;
  ort?: string;
  kommunnamn?: string;
  borrdatum?: string;
  totaldjup?: number;
  jorddjup?: number;
  kapacitet?: number;
  tecken_vattenmangd?: string;
  grundvattenniva?: number;
  tecken_niva?: string;
  nivadatum?: string;
  bottendiam?: number;
  anvandning?: string;
  anvandning_kod?: string;
  tatning?: string;
  tatning_kod?: string;
  rorborrning_till?: number;
  stalror_till?: number;
  plastror_till?: number;
  gradborrning?: number;
  allman_anmarkning?: string;
  grundvattenanmarkning?: string;
  posvardering?: string;
  n?: number;
  e?: number;
  lage_specifikt?: string;
}

interface LagerData {
  lagernr: number;
  djup_fran: number;
  djup_till: number;
  jordart_bergart: string;
  lageranmarkning?: string;
}

const WellProtocol = () => {
  const [searchParams] = useSearchParams();
  const rawId = searchParams.get("id") || "";
  const obsplatsid = rawId.includes(".") ? rawId.split(".").slice(1).join(".") : rawId;
  const [well, setWell] = useState<WellData | null>(null);
  const [lager, setLager] = useState<LagerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!obsplatsid) {
      setError("Inget brunns-ID angivet");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const wellRes = await fetch(
          `https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items/${obsplatsid}?f=json`
        );
        if (!wellRes.ok) throw new Error("Kunde inte hämta brunnsdata");
        const wellJson = await wellRes.json();
        const feature = wellJson.type === "FeatureCollection"
          ? wellJson.features?.[0]
          : wellJson;
        if (!feature) throw new Error("Brunnen hittades inte i svaret");
        setWell(feature.properties);

        const lagerRes = await fetch(
          `https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar-lager/items?f=json&filter=obsplatsid%3D%27${encodeURIComponent(obsplatsid)}%27&limit=100`
        );
        if (lagerRes.ok) {
          const lagerJson = await lagerRes.json();
          const lagerItems: LagerData[] = (lagerJson.features || [])
            .map((f: any) => f.properties)
            .sort((a: LagerData, b: LagerData) => a.lagernr - b.lagernr);
          setLager(lagerItems);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [obsplatsid]);

  const formatDate = (d?: string) => {
    if (!d) return "";
    if (d.length === 6) return `${d.slice(0, 4)}-${d.slice(4, 6)}`;
    if (d.includes("T")) return d.split("T")[0];
    return d;
  };

  const getAnvandningChecks = () => {
    const kod = well?.anvandning_kod || "";
    return {
      hushall: kod === "HUS" || kod === "HU2",
      energi: kod === "ENE" || kod === "EN2",
      kommunalt: kod === "KOM",
      ovrigt: !["HUS", "HU2", "ENE", "EN2", "KOM"].includes(kod) && kod !== "",
    };
  };

  const getTatningChecks = () => {
    const kod = well?.tatning_kod || "";
    return {
      cementering: kod === "C",
      tryckning: kod === "T",
      sprangning: kod === "S",
    };
  };

  const Checkbox = ({ checked }: { checked: boolean }) => (
    <span
      className="inline-block w-4 h-4 border border-[#4a1942] rounded-sm mr-1.5 align-middle flex-shrink-0"
      style={{ background: checked ? '#4a1942' : 'transparent' }}
    >
      {checked && (
        <svg viewBox="0 0 14 14" className="w-full h-full text-white">
          <path d="M3 7l3 3 5-5" stroke="white" strokeWidth="2" fill="none" />
        </svg>
      )}
    </span>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f0eb', fontFamily: "'Georgia', 'Times New Roman', serif" }}>
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 animate-pulse" style={{ color: '#4a1942' }} />
          <p style={{ color: '#6b5b6e' }}>Laddar protokoll...</p>
        </div>
      </div>
    );
  }

  if (error || !well) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f0eb', fontFamily: "'Georgia', 'Times New Roman', serif" }}>
        <div className="text-center">
          <p className="text-lg" style={{ color: '#c0392b' }}>{error || "Brunnen hittades inte"}</p>
        </div>
      </div>
    );
  }

  const anvChecks = getAnvandningChecks();
  const tatChecks = getTatningChecks();

  return (
    <div
      className="min-h-screen print:bg-white"
      style={{
        background: '#f5f0eb',
        fontFamily: "'Georgia', 'Times New Roman', serif",
        color: '#1a1a1a',
      }}
    >
      {/* Mobile-responsive font sizes */}
      <style>{`
        .protocol-doc { font-size: 14px; line-height: 1.5; }
        .protocol-label { font-size: 11px; }
        .protocol-sublabel { font-size: 10px; }
        .protocol-section-title { font-size: 11px; }
        .protocol-value-lg { font-size: 14px; }
        .protocol-value-md { font-size: 13px; }
        @media (min-width: 640px) {
          .protocol-doc { font-size: 11px; line-height: 1.4; }
          .protocol-label { font-size: 9px; }
          .protocol-sublabel { font-size: 9px; }
          .protocol-section-title { font-size: 10px; }
          .protocol-value-lg { font-size: 12px; }
          .protocol-value-md { font-size: 11px; }
        }
        @media print {
          .protocol-doc { font-size: 11px !important; line-height: 1.4 !important; }
          .protocol-label { font-size: 9px !important; }
          .protocol-sublabel { font-size: 9px !important; }
          .protocol-section-title { font-size: 10px !important; }
          .protocol-value-lg { font-size: 12px !important; }
          .protocol-value-md { font-size: 11px !important; }
        }
      `}</style>

      {/* Print button */}
      <div className="fixed top-4 right-4 z-50 print:hidden">
        <Button
          onClick={() => window.print()}
          className="shadow-lg text-white"
          style={{ background: '#4a1942', borderColor: '#4a1942' }}
        >
          <Printer className="w-4 h-4 mr-2" />
          Skriv ut
        </Button>
      </div>

      {/* Protocol page */}
      <div
        className="w-full max-w-[210mm] mx-auto bg-white shadow-xl print:shadow-none protocol-doc"
      >
        {/* SGU Header bar */}
        <div
          className="px-4 sm:px-8 py-4 sm:py-5 flex flex-wrap items-center justify-between gap-3"
          style={{ background: '#4a1942', color: 'white' }}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            {/* SGU Crown symbol */}
            <div className="flex flex-col items-center flex-shrink-0" style={{ lineHeight: 1.2 }}>
              <svg viewBox="0 0 40 36" className="w-9 h-8 sm:w-10 sm:h-9 mb-0.5" fill="white">
                <path d="M20 0l3 8h8l-6.5 5 2.5 8L20 16l-7 5 2.5-8L9 8h8z" />
                <rect x="8" y="22" width="24" height="2" rx="1" />
                <rect x="6" y="26" width="28" height="2" rx="1" />
                <rect x="4" y="30" width="32" height="2" rx="1" />
                <rect x="2" y="34" width="36" height="2" rx="1" />
              </svg>
              <span className="protocol-section-title" style={{ letterSpacing: '0.15em', fontWeight: 600 }}>SGU</span>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '12px' }}>
              <div className="protocol-sublabel" style={{ opacity: 0.8, letterSpacing: '0.05em' }}>
                Sveriges geologiska undersökning
              </div>
              <h1 style={{ fontSize: 'clamp(13px, 4vw, 16px)', fontWeight: 700, letterSpacing: '0.02em', marginTop: '2px' }}>
                BRUNNS- OCH BORRPROTOKOLL
              </h1>
            </div>
          </div>
          <div className="text-right" style={{ minWidth: '60px' }}>
            <div className="protocol-sublabel" style={{ opacity: 0.7 }}>Brunns-ID</div>
            <div style={{ fontSize: 'clamp(13px, 3.5vw, 14px)', fontWeight: 700 }}>{well.brunnsid || "—"}</div>
          </div>
        </div>

        <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-4">
          {/* Row 1: Fastighet, Ort, Borrdatum */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0" style={{ border: '1px solid #4a1942' }}>
            <div className="p-2.5 sm:border-r sm:border-b-0 border-b" style={{ borderColor: '#4a1942' }}>
              <div className="protocol-label" style={{ color: '#6b5b6e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>
                Fastighetsbeteckning
              </div>
              <div className="protocol-value-md">{well.fastighet || "—"}</div>
            </div>
            <div className="p-2.5 sm:border-r sm:border-b-0 border-b" style={{ borderColor: '#4a1942' }}>
              <div className="protocol-label" style={{ color: '#6b5b6e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>
                Ort
              </div>
              <div className="protocol-value-md">{well.ort || "—"}</div>
            </div>
            <div className="p-2.5">
              <div className="protocol-label" style={{ color: '#6b5b6e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>
                Borrdatum
              </div>
              <div className="protocol-value-md" style={{ fontWeight: 600 }}>{formatDate(well.borrdatum) || "—"}</div>
            </div>
          </div>

          {/* Row 2: Borrplatsens läge */}
          <div style={{ border: '1px solid #4a1942' }}>
            <div
              className="px-2.5 py-1.5 protocol-section-title"
              style={{ background: '#f3eff2', borderBottom: '1px solid #4a1942', fontWeight: 700, color: '#4a1942', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Borrplatsens läge
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
              <div className="p-2.5 sm:border-r sm:border-b-0 border-b" style={{ borderColor: '#d4c6d1' }}>
                <div className="protocol-label" style={{ color: '#6b5b6e', marginBottom: '2px' }}>Kommun</div>
                <div>{well.kommunnamn || "—"}</div>
              </div>
              <div className="p-2.5 sm:border-r sm:border-b-0 border-b" style={{ borderColor: '#d4c6d1' }}>
                <div className="protocol-label" style={{ color: '#6b5b6e', marginBottom: '2px' }}>Platsspecificering</div>
                <div>{well.lage_specifikt || "—"}</div>
              </div>
              <div className="p-2.5">
                <div className="protocol-label" style={{ color: '#6b5b6e', marginBottom: '2px' }}>Koordinater (SWEREF 99 TM)</div>
                <div>N: {well.n || "—"}, E: {well.e || "—"}</div>
              </div>
            </div>
          </div>

          {/* Lagerföljd */}
          <div style={{ border: '1px solid #4a1942' }}>
            <div
              className="px-2.5 py-1.5 protocol-section-title"
              style={{ background: '#f3eff2', borderBottom: '1px solid #4a1942', fontWeight: 700, color: '#4a1942', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Jordarter / Bergarter — Djup under markytan
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: '280px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #4a1942', background: '#faf8f9' }}>
                    <th className="text-left p-2 w-16 sm:w-20 protocol-section-title" style={{ borderRight: '1px solid #d4c6d1', fontWeight: 600, color: '#4a1942' }}>Från (m)</th>
                    <th className="text-left p-2 w-16 sm:w-20 protocol-section-title" style={{ borderRight: '1px solid #d4c6d1', fontWeight: 600, color: '#4a1942' }}>Till (m)</th>
                    <th className="text-left p-2 protocol-section-title" style={{ borderRight: '1px solid #d4c6d1', fontWeight: 600, color: '#4a1942' }}>Jordart / bergart</th>
                    <th className="text-left p-2 protocol-section-title" style={{ fontWeight: 600, color: '#4a1942' }}>Anmärkningar</th>
                  </tr>
                </thead>
                <tbody>
                  {lager.length > 0 ? (
                    lager.map((l, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e8e0e5' }}>
                        <td className="p-2" style={{ borderRight: '1px solid #e8e0e5' }}>{l.djup_fran}</td>
                        <td className="p-2" style={{ borderRight: '1px solid #e8e0e5' }}>{l.djup_till}</td>
                        <td className="p-2" style={{ borderRight: '1px solid #e8e0e5', fontWeight: 500 }}>{l.jordart_bergart}</td>
                        <td className="p-2">{l.lageranmarkning || ""}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-3 text-center" style={{ color: '#9b8e9e', fontStyle: 'italic' }}>
                        Inga lagerföljder registrerade för denna brunn
                      </td>
                    </tr>
                  )}
                  {lager.length < 8 &&
                    Array.from({ length: Math.max(0, 8 - lager.length) }).map((_, i) => (
                      <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #f0eaee' }}>
                        <td className="p-2 h-5" style={{ borderRight: '1px solid #f0eaee' }}>&nbsp;</td>
                        <td className="p-2" style={{ borderRight: '1px solid #f0eaee' }}>&nbsp;</td>
                        <td className="p-2" style={{ borderRight: '1px solid #f0eaee' }}>&nbsp;</td>
                        <td className="p-2">&nbsp;</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tekniskt utförande + Borrhål fodrat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div style={{ border: '1px solid #4a1942' }}>
              <div
                className="px-2.5 py-1.5 protocol-section-title"
                style={{ background: '#f3eff2', borderBottom: '1px solid #4a1942', fontWeight: 700, color: '#4a1942', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Tekniskt utförande
              </div>
              <div className="p-2.5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="protocol-label" style={{ color: '#6b5b6e' }}>Totaldjup från markytan</div>
                    <div className="protocol-value-lg" style={{ fontWeight: 600 }}>{well.totaldjup ? `${well.totaldjup} m` : "—"}</div>
                  </div>
                  <div>
                    <div className="protocol-label" style={{ color: '#6b5b6e' }}>Jorddjup från markytan</div>
                    <div className="protocol-value-lg" style={{ fontWeight: 600 }}>{well.jorddjup !== null && well.jorddjup !== undefined ? `${well.jorddjup} m` : "—"}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="protocol-label" style={{ color: '#6b5b6e' }}>Borrhålets bottendiameter</div>
                    <div>{well.bottendiam ? `${well.bottendiam} mm` : "—"}</div>
                  </div>
                  <div>
                    <div className="protocol-label" style={{ color: '#6b5b6e' }}>Gradborrning</div>
                    <div>{well.gradborrning ? `${well.gradborrning}°` : "—"}</div>
                  </div>
                </div>
                <div>
                  <div className="protocol-label" style={{ color: '#6b5b6e', marginBottom: '4px' }}>Tätning</div>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center">
                      <Checkbox checked={tatChecks.cementering} />
                      <span>Cementering</span>
                    </label>
                    <label className="flex items-center">
                      <Checkbox checked={tatChecks.tryckning} />
                      <span>Tryckning</span>
                    </label>
                    <label className="flex items-center">
                      <Checkbox checked={tatChecks.sprangning} />
                      <span>Sprängning</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ border: '1px solid #4a1942' }}>
              <div
                className="px-2.5 py-1.5 protocol-section-title"
                style={{ background: '#f3eff2', borderBottom: '1px solid #4a1942', fontWeight: 700, color: '#4a1942', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Borrhål fodrat
              </div>
              <div className="p-2.5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="protocol-label" style={{ color: '#6b5b6e' }}>Stålrör till</div>
                    <div>{well.stalror_till ? `${well.stalror_till} m` : "—"}</div>
                  </div>
                  <div>
                    <div className="protocol-label" style={{ color: '#6b5b6e' }}>Plaströr till</div>
                    <div>{well.plastror_till ? `${well.plastror_till} m` : "—"}</div>
                  </div>
                </div>
                <div>
                  <div className="protocol-label" style={{ color: '#6b5b6e' }}>Rörfodring till</div>
                  <div>{well.rorborrning_till ? `${well.rorborrning_till} m` : "—"}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Brunnens användning */}
          <div style={{ border: '1px solid #4a1942' }}>
            <div
              className="px-2.5 py-1.5 protocol-section-title"
              style={{ background: '#f3eff2', borderBottom: '1px solid #4a1942', fontWeight: 700, color: '#4a1942', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Brunnens användning
            </div>
            <div className="p-2.5 flex flex-wrap gap-3 sm:gap-6">
              <label className="flex items-center">
                <Checkbox checked={anvChecks.hushall} />
                <span>Hushållsvatten</span>
              </label>
              <label className="flex items-center">
                <Checkbox checked={anvChecks.energi} />
                <span>Energi (värme/kyla)</span>
              </label>
              <label className="flex items-center">
                <Checkbox checked={anvChecks.kommunalt} />
                <span>Kommunalt vatten</span>
              </label>
              <label className="flex items-center">
                <Checkbox checked={anvChecks.ovrigt} />
                <span>Övrigt{anvChecks.ovrigt ? `: ${well.anvandning || ""}` : ""}</span>
              </label>
            </div>
          </div>

          {/* Provpumpning */}
          <div style={{ border: '1px solid #4a1942' }}>
            <div
              className="px-2.5 py-1.5 protocol-section-title"
              style={{ background: '#f3eff2', borderBottom: '1px solid #4a1942', fontWeight: 700, color: '#4a1942', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Provpumpning m.m.
            </div>
            <div className="p-2.5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="protocol-label" style={{ color: '#6b5b6e' }}>Vattenmängd (kapacitet)</div>
                <div className="protocol-value-lg" style={{ fontWeight: 600 }}>
                  {well.tecken_vattenmangd || ""}{well.kapacitet !== null && well.kapacitet !== undefined ? `${well.kapacitet} l/h` : "—"}
                </div>
              </div>
              <div>
                <div className="protocol-label" style={{ color: '#6b5b6e' }}>Grundvattennivå under markytan</div>
                <div className="protocol-value-lg" style={{ fontWeight: 600 }}>
                  {well.tecken_niva || ""}{well.grundvattenniva !== null && well.grundvattenniva !== undefined ? `${well.grundvattenniva} m` : "—"}
                </div>
              </div>
              <div>
                <div className="protocol-label" style={{ color: '#6b5b6e' }}>Datum vid mätning</div>
                <div>{formatDate(well.nivadatum) || "—"}</div>
              </div>
            </div>
          </div>

          {/* Anmärkningar */}
          <div style={{ border: '1px solid #4a1942' }}>
            <div
              className="px-2.5 py-1.5 protocol-section-title"
              style={{ background: '#f3eff2', borderBottom: '1px solid #4a1942', fontWeight: 700, color: '#4a1942', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Anmärkningar
            </div>
            <div className="p-2.5 min-h-[40px] space-y-1.5">
              {well.allman_anmarkning && <p>{well.allman_anmarkning}</p>}
              {well.grundvattenanmarkning && (
                <p><span className="protocol-label" style={{ color: '#6b5b6e' }}>Grundvatten: </span>{well.grundvattenanmarkning}</p>
              )}
              {!well.allman_anmarkning && !well.grundvattenanmarkning && (
                <p style={{ color: '#9b8e9e', fontStyle: 'italic' }}>Inga anmärkningar</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 mt-2" style={{ borderTop: '2px solid #4a1942' }}>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 protocol-label" style={{ color: '#6b5b6e' }}>
              <span>Positionsvärdering: {well.posvardering || "—"}</span>
              <span style={{ fontWeight: 600, color: '#4a1942' }}>Data hämtad från SGU:s Brunnsarkiv</span>
              <span>Genererad: {new Date().toLocaleDateString("sv-SE")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WellProtocol;
