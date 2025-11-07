import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { transform } from "ol/proj";

interface CoordinateDisplayProps {
  coordinates: [number, number] | null;
}

export const CoordinateDisplay = ({ coordinates }: CoordinateDisplayProps) => {
  if (!coordinates) return null;

  // Transform from Web Mercator (EPSG:3857) to SWEREF 99 TM (EPSG:3006)
  const swerefCoords = transform(coordinates, "EPSG:3857", "EPSG:3006");

  return (
    <Card className="absolute bottom-4 left-4 px-4 py-3 bg-card/95 backdrop-blur-sm shadow-md border-border">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3" />
          <span>SWEREF 99 TM (EPSG:3006)</span>
        </div>
        <div className="font-mono text-sm text-foreground">
          <span className="text-muted-foreground">N:</span>{" "}
          {swerefCoords[1].toFixed(2)} m{" "}
          <span className="text-muted-foreground ml-3">E:</span>{" "}
          {swerefCoords[0].toFixed(2)} m
        </div>
      </div>
    </Card>
  );
};
