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
        const lat = parseFloat(coord1);
        const lon = parseFloat(coord2);
        
        // Convert WGS84 to Web Mercator
        const x = lon * 20037508.34 / 180;
        const y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180;
        
        onSearchResult([x, y], 14);
        toast.success(`Koordinat: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
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
        Exempel: Stockholm, lat,lon (59.33,18.06)
      </p>
    </Card>
  );
};
