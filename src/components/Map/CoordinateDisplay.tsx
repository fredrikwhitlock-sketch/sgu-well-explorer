import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";

interface CoordinateDisplayProps {
  coordinates: [number, number] | null;
}

export const CoordinateDisplay = ({ coordinates }: CoordinateDisplayProps) => {
  if (!coordinates) return null;

  return (
    <Card className="absolute bottom-4 left-4 px-4 py-2 bg-card/95 backdrop-blur-sm shadow-md border-border">
      <div className="flex items-center gap-2 text-sm">
        <MapPin className="w-4 h-4 text-primary" />
        <div className="font-mono text-foreground">
          <span className="text-muted-foreground">X:</span>{" "}
          {coordinates[0].toFixed(2)}{" "}
          <span className="text-muted-foreground ml-2">Y:</span>{" "}
          {coordinates[1].toFixed(2)}
        </div>
      </div>
    </Card>
  );
};
