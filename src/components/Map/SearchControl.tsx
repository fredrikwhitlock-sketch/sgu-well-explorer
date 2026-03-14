import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { toast } from "sonner";

interface SearchControlProps {
  onSearchResult: (coordinates: [number, number], zoom?: number) => void;
}

export const SearchControl = ({ onSearchResult }: SearchControlProps) => {
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

  const clearSearch = () => {
    setSearchQuery("");
  };

  return (
    <div className="absolute top-16 sm:top-4 left-2 sm:left-1/2 sm:-translate-x-1/2 z-10 w-[calc(100vw-5rem)] sm:w-96 sm:max-w-[calc(100vw-2rem)]">
      <div className="bg-card/95 backdrop-blur-sm shadow-lg border border-border rounded-lg p-2.5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Sök adress, plats eller koordinat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-8 pr-8 h-9 text-sm"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={clearSearch}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <Button 
            onClick={handleSearch} 
            disabled={isSearching}
            size="sm"
            className="h-9 px-3"
          >
            Sök
          </Button>
        </div>
      </div>
    </div>
  );
};
