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
  // Strip collection prefix like "brunnar." if present
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
        // Fetch well data
        const wellRes = await fetch(
          `https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items/${obsplatsid}?f=json`
        );
        if (!wellRes.ok) throw new Error("Kunde inte hämta brunnsdata");
        const wellJson = await wellRes.json();
        // API returns FeatureCollection or single Feature depending on endpoint
        const feature = wellJson.type === "FeatureCollection"
          ? wellJson.features?.[0]
          : wellJson;
        if (!feature) throw new Error("Brunnen hittades inte i svaret");
        setWell(feature.properties);

        // Fetch lagerföljd
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
    // Format YYYYMM or YYYY-MM-DD
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Laddar protokoll...</p>
        </div>
      </div>
    );
  }

  if (error || !well) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-destructive text-lg">{error || "Brunnen hittades inte"}</p>
        </div>
      </div>
    );
  }

  const anvChecks = getAnvandningChecks();
  const tatChecks = getTatningChecks();

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Print button - hidden in print */}
      <div className="fixed top-4 right-4 z-50 print:hidden flex gap-2">
        <Button onClick={() => window.print()} className="shadow-lg">
          <Printer className="w-4 h-4 mr-2" />
          Skriv ut
        </Button>
      </div>

      {/* Protocol page */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none p-8 print:p-6 text-black text-[11px] leading-tight">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4">
          <div>
            <p className="text-[10px]">SGU Brunns-ID: <span className="font-bold">{well.brunnsid}</span></p>
          </div>
          <div className="text-center">
            <h1 className="text-base font-bold tracking-wide">BRUNNS- OCH BORRPROTOKOLL</h1>
          </div>
          <div className="text-right text-[10px]">
            <p>Borrdatum</p>
            <p className="font-semibold">{formatDate(well.borrdatum)}</p>
          </div>
        </div>

        {/* Fastighet & Ort */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="border border-black p-2">
            <p className="text-[9px] font-bold text-gray-600 mb-1">Fastighetsbeteckning (namn och nummer)</p>
            <p className="text-sm">{well.fastighet || "—"}</p>
          </div>
          <div className="border border-black p-2">
            <p className="text-[9px] font-bold text-gray-600 mb-1">Ort</p>
            <p className="text-sm">{well.ort || "—"}</p>
          </div>
        </div>

        {/* Borrplatsens läge */}
        <div className="border border-black p-2 mb-4">
          <p className="text-[9px] font-bold text-gray-600 mb-2">Borrplatsens läge</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[9px] text-gray-500">Kommun</p>
              <p>{well.kommunnamn || "—"}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-500">Platsspecificering</p>
              <p>{well.lage_specifikt || "—"}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-500">Koordinater (SWEREF 99 TM)</p>
              <p>N: {well.n || "—"}, E: {well.e || "—"}</p>
            </div>
          </div>
        </div>

        {/* Lagerföljd - Jordarter/bergarter */}
        <div className="border border-black mb-4">
          <div className="bg-gray-100 px-2 py-1 border-b border-black">
            <p className="font-bold text-[10px]">Jordarter/bergarter m.m. – Djup under markytan</p>
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left p-1 border-r border-black w-20">Från (m)</th>
                <th className="text-left p-1 border-r border-black w-20">Till (m)</th>
                <th className="text-left p-1 border-r border-black">Jordart/bergart</th>
                <th className="text-left p-1">Anmärkningar</th>
              </tr>
            </thead>
            <tbody>
              {lager.length > 0 ? (
                lager.map((l, i) => (
                  <tr key={i} className="border-b border-gray-300">
                    <td className="p-1 border-r border-black">{l.djup_fran}</td>
                    <td className="p-1 border-r border-black">{l.djup_till}</td>
                    <td className="p-1 border-r border-black">{l.jordart_bergart}</td>
                    <td className="p-1">{l.lageranmarkning || ""}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-2 text-center text-gray-400 italic">
                    Inga lagerföljder registrerade för denna brunn
                  </td>
                </tr>
              )}
              {/* Empty rows to fill space like original form */}
              {lager.length < 6 &&
                Array.from({ length: 6 - lager.length }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b border-gray-200">
                    <td className="p-1 border-r border-black h-5">&nbsp;</td>
                    <td className="p-1 border-r border-black">&nbsp;</td>
                    <td className="p-1 border-r border-black">&nbsp;</td>
                    <td className="p-1">&nbsp;</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Tekniskt utförande */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="border border-black p-2">
            <p className="font-bold text-[10px] mb-2 bg-gray-100 -mx-2 -mt-2 px-2 py-1 border-b border-black">
              Tekniskt utförande
            </p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[9px] text-gray-500">Totaldjup från markytan</p>
                  <p className="font-semibold">{well.totaldjup ? `${well.totaldjup} m` : "—"}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-500">Jorddjup från markytan</p>
                  <p className="font-semibold">{well.jorddjup !== null && well.jorddjup !== undefined ? `${well.jorddjup} m` : "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[9px] text-gray-500">Borrhålets bottendiameter</p>
                  <p>{well.bottendiam ? `${well.bottendiam} mm` : "—"}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-500">Gradborrning</p>
                  <p>{well.gradborrning ? `${well.gradborrning}°` : "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-[9px] text-gray-500">Tätning</p>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-1">
                    <span className={`inline-block w-3 h-3 border border-black ${tatChecks.cementering ? "bg-black" : ""}`} />
                    <span>Cementering</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <span className={`inline-block w-3 h-3 border border-black ${tatChecks.tryckning ? "bg-black" : ""}`} />
                    <span>Tryckning</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <span className={`inline-block w-3 h-3 border border-black ${tatChecks.sprangning ? "bg-black" : ""}`} />
                    <span>Sprängning</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-black p-2">
            <p className="font-bold text-[10px] mb-2 bg-gray-100 -mx-2 -mt-2 px-2 py-1 border-b border-black">
              Borrhål fodrat
            </p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[9px] text-gray-500">Stålrör till</p>
                  <p>{well.stalror_till ? `${well.stalror_till} m` : "—"}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-500">Plaströr till</p>
                  <p>{well.plastror_till ? `${well.plastror_till} m` : "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-[9px] text-gray-500">Rörfodring till</p>
                <p>{well.rorborrning_till ? `${well.rorborrning_till} m` : "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Brunnens användning */}
        <div className="border border-black p-2 mb-4">
          <p className="font-bold text-[10px] mb-2 bg-gray-100 -mx-2 -mt-2 px-2 py-1 border-b border-black">
            Brunnens användning
          </p>
          <div className="flex gap-6">
            <label className="flex items-center gap-1">
              <span className={`inline-block w-3 h-3 border border-black ${anvChecks.hushall ? "bg-black" : ""}`} />
              <span>Hushållsvatten</span>
            </label>
            <label className="flex items-center gap-1">
              <span className={`inline-block w-3 h-3 border border-black ${anvChecks.energi ? "bg-black" : ""}`} />
              <span>Energi (värme/kyla)</span>
            </label>
            <label className="flex items-center gap-1">
              <span className={`inline-block w-3 h-3 border border-black ${anvChecks.kommunalt ? "bg-black" : ""}`} />
              <span>Kommunalt vatten</span>
            </label>
            <label className="flex items-center gap-1">
              <span className={`inline-block w-3 h-3 border border-black ${anvChecks.ovrigt ? "bg-black" : ""}`} />
              <span>Övrigt: {anvChecks.ovrigt ? (well.anvandning || "") : ""}</span>
            </label>
          </div>
        </div>

        {/* Provpumpning */}
        <div className="border border-black p-2 mb-4">
          <p className="font-bold text-[10px] mb-2 bg-gray-100 -mx-2 -mt-2 px-2 py-1 border-b border-black">
            Provpumpning m.m.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[9px] text-gray-500">Vattenmängd (kapacitet)</p>
              <p className="font-semibold">
                {well.tecken_vattenmangd || ""}{well.kapacitet !== null && well.kapacitet !== undefined ? `${well.kapacitet} l/h` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-gray-500">Grundvattennivå under markytan</p>
              <p className="font-semibold">
                {well.tecken_niva || ""}{well.grundvattenniva !== null && well.grundvattenniva !== undefined ? `${well.grundvattenniva} m` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-gray-500">Datum vid mätning</p>
              <p>{formatDate(well.nivadatum)}</p>
            </div>
          </div>
        </div>

        {/* Anmärkningar */}
        <div className="border border-black p-2 mb-4">
          <p className="font-bold text-[10px] mb-2 bg-gray-100 -mx-2 -mt-2 px-2 py-1 border-b border-black">
            Anmärkningar
          </p>
          <div className="space-y-2 min-h-[40px]">
            {well.allman_anmarkning && (
              <p>{well.allman_anmarkning}</p>
            )}
            {well.grundvattenanmarkning && (
              <p><span className="text-[9px] text-gray-500">Grundvatten: </span>{well.grundvattenanmarkning}</p>
            )}
            {!well.allman_anmarkning && !well.grundvattenanmarkning && (
              <p className="text-gray-400 italic">Inga anmärkningar</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-black pt-3 mt-6">
          <div className="flex justify-between text-[9px] text-gray-500">
            <p>Positionsvärdering: {well.posvardering || "—"}</p>
            <p>Data hämtad från SGU:s Brunnsarkiv</p>
            <p>Genererad: {new Date().toLocaleDateString("sv-SE")}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WellProtocol;
