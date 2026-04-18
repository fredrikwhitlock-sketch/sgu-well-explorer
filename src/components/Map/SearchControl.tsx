import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import proj4 from "proj4";

interface SearchControlProps {
  onSearchResult: (coordinates: [number, number], zoom?: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

proj4.defs("EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

const toMercator = (lon: number, lat: number): [number, number] => [
  lon * 20037508.34 / 180,
  Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180,
];

export const SearchControl = ({ onSearchResult, isOpen, onClose }: SearchControlProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) { toast.error("Ange en söksträng"); return; }

    setIsSearching(true);
    try {
      // Coordinate detection: SWEREF 99 TM or WGS84
      const numTokens = q.replace(/[NEne°,]/g, ' ').trim().match(/-?\d+\.?\d*/g);
      if (numTokens?.length === 2) {
        const num1 = parseFloat(numTokens[0]);
        const num2 = parseFloat(numTokens[1]);
        if (num1 > 1_000_000) {
          const [lon, lat] = proj4("EPSG:3006", "EPSG:4326", [num2, num1]);
          onSearchResult(toMercator(lon, lat), 14);
          toast.success(`SWEREF 99 TM: N ${Math.round(num1)}, E ${Math.round(num2)}`);
          onClose(); return;
        }
        if (num1 >= -90 && num1 <= 90 && num2 >= -180 && num2 <= 180) {
          onSearchResult(toMercator(num2, num1), 14);
          toast.success(`WGS84: ${num1.toFixed(5)}°N, ${num2.toFixed(5)}°E`);
          onClose(); return;
        }
      }

      // Place name via Nominatim
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=se&limit=1&accept-language=sv`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.length) { toast.error("Platsen hittades inte – prova ett annat stavningssätt"); return; }
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      onSearchResult(toMercator(lon, lat), 14);
      toast.success(`Hittade: ${data[0].display_name.split(',').slice(0, 2).join(', ')}`);
      onClose();
    } catch {
      toast.error("Sökningen misslyckades – kontrollera nätverksanslutningen");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="absolute inset-0 z-20 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      )}
      <div className={`absolute top-0 right-0 h-full w-80 max-w-[calc(100vw-3.5rem)] bg-card/98 backdrop-blur-sm shadow-2xl border-l border-border z-30 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="bg-sgu-maroon text-white px-4 py-3 flex items-center gap-2 shrink-0">
          <Search className="w-5 h-5" />
          <h3 className="font-semibold flex-1">Sök plats</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Sök på adress, ortnamn eller koordinat (WGS84 / SWEREF 99 TM)
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Adress, plats eller koordinat..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="pl-8 pr-8 h-10 text-sm"
              autoFocus={isOpen}
            />
            {searchQuery && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearchQuery("")}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button onClick={handleSearch} disabled={isSearching} className="w-full h-10">
            {isSearching ? "Söker..." : "Sök"}
          </Button>
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
            <p className="font-medium text-foreground">Exempel:</p>
            <p>Uppsala</p>
            <p>59.8586, 17.6389 <span className="text-muted-foreground">(WGS84)</span></p>
            <p>6638870 657890 <span className="text-muted-foreground">(SWEREF)</span></p>
            <p>N 6638870 E 657890 <span className="text-muted-foreground">(SWEREF)</span></p>
          </div>
        </div>
      </div>
    </>
  );
};
