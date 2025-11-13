import { useState } from "react";
import { Card } from "@/components/ui/card";
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
      // Check if input is coordinates (format: lat,lon or N,E)
      const coordMatch = searchQuery.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
      
      if (coordMatch) {
        const [, coord1, coord2] = coordMatch;
        const num1 = parseFloat(coord1);
        const num2 = parseFloat(coord2);
        
        let x: number, y: number;
        
        // Determine coordinate system based on values
        // SWEREF 99 TM (EPSG:3006): N typically 6000000-7700000, E typically 250000-950000
        // WGS84: lat -90 to 90, lon -180 to 180
        if (num1 > 1000000) {
          // Likely SWEREF 99 TM (N, E format)
          const N = num1;
          const E = num2;
          
          // Convert SWEREF 99 TM to WGS84 using proj4
          const proj4 = (await import('proj4')).default;
          proj4.defs("EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
          const [lon, lat] = proj4("EPSG:3006", "EPSG:4326", [E, N]);
          
          // Convert WGS84 to Web Mercator
          x = lon * 20037508.34 / 180;
          y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180;
          
          toast.success(`SWEREF 99 TM: N ${N.toFixed(0)}, E ${E.toFixed(0)}`);
        } else {
          // Assume WGS84 (lat, lon)
          const lat = num1;
          const lon = num2;
          
          // Convert WGS84 to Web Mercator
          x = lon * 20037508.34 / 180;
          y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180;
          
          toast.success(`WGS84: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        }
        
        onSearchResult([x, y], 14);
      } else {
        // Use Nominatim for geocoding
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&countrycodes=se&limit=1`
        );
        
        if (!response.ok) {
          throw new Error("Sökning misslyckades");
        }
        
        const data = await response.json();
        
        if (data.length === 0) {
          toast.error("Platsen hittades inte");
          return;
        }
        
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        
        // Convert WGS84 to Web Mercator
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
    <Card className="absolute top-4 left-4 w-80 p-3 bg-card/95 backdrop-blur-sm shadow-lg border-border">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Sök adress, plats eller koordinat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pr-8"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button 
          onClick={handleSearch} 
          disabled={isSearching}
          size="default"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Exempel: Stockholm, 59.33,18.06 eller 6580822,674032 (SWEREF 99 TM)
      </p>
    </Card>
  );
};
