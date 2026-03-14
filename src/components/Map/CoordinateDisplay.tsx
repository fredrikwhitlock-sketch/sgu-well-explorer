import { MapPin } from "lucide-react";
import { transform } from "ol/proj";

interface CoordinateDisplayProps {
  coordinates: [number, number] | null;
  zoom: number;
}

export const CoordinateDisplay = ({ coordinates, zoom }: CoordinateDisplayProps) => {
  if (!coordinates) return null;

  const swerefCoords = transform(coordinates, "EPSG:3857", "EPSG:3006");

  return (
    <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-12 z-10 bg-card/90 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-md shadow-md border border-border max-w-[calc(100vw-1rem)]">
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="w-3 h-3" />
          <span>SWEREF 99 TM</span>
        </div>
        <div className="font-mono text-foreground">
          <span className="text-muted-foreground">N</span>{" "}
          {swerefCoords[1].toFixed(0)}{" "}
          <span className="text-muted-foreground ml-1">E</span>{" "}
          {swerefCoords[0].toFixed(0)}
        </div>
        <div className="border-l border-border pl-3 text-muted-foreground">
          Zoom {zoom.toFixed(1)}
        </div>
      </div>
    </div>
  );
};
