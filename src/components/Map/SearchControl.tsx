import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { toast } from "sonner";

interface SearchControlProps {
  onSearchResult: (coordinates: [number, number], zoom?: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const SearchControl = ({ onSearchResult, isOpen, onClose }: SearchControlProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Ange en söksträng");
      return;
    }

    setIsSearching(true);

    try {
      const coordMatch = searchQuery.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
      
      if (coordMatch) {
        const [, coord1, coord2] = coordMatch;
        const num1 = parseFloat(coord1);
        const num2 = parseFloat(coord2);
        
        let x: number, y: number;
        
        if (num1 > 1000000) {
          const N = num1;
          const E = num2;
          const proj4 = (await import('proj4')).default;
          proj4.defs("EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
          const [lon, lat] = proj4("EPSG:3006", "EPSG:4326", [E, N]);
          x = lon * 20037508.34 / 180;
          y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180;
          toast.success(`SWEREF 99 TM: N ${N.toFixed(0)}, E ${E.toFixed(0)}`);
        } else {
          const lat = num1;
          const lon = num2;
          x = lon * 20037508.34 / 180;
          y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180;
          toast.success(`WGS84: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        }
        
        onSearchResult([x, y], 14);
        onClose();
      } else {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&countrycodes=se&limit=1`
        );
        
        if (!response.ok) throw new Error("Sökning misslyckades");
        
        const data = await response.json();
        
        if (data.length === 0) {
          toast.error("Platsen hittades inte");
          return;
        }
        
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        const x = lon * 20037508.34 / 180;
        const y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180;
        
        onSearchResult([x, y], 14);
        toast.success(`Hittade: ${result.display_name}`);
        onClose();
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Sökningen misslyckades");
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

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
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-8 pr-8 h-10 text-sm"
              autoFocus={isOpen}
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            onClick={handleSearch}
            disabled={isSearching}
            className="w-full h-10"
          >
            {isSearching ? "Söker..." : "Sök"}
          </Button>
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
            <p className="font-medium text-foreground">Exempel:</p>
            <p>Uppsala</p>
            <p>59.8586, 17.6389</p>
            <p>6638870, 657890 (SWEREF)</p>
          </div>
        </div>
      </div>
    </>
  );
};
