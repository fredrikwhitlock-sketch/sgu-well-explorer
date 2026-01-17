interface ZoomIndicatorProps {
  zoom: number;
}

export const ZoomIndicator = ({ zoom }: ZoomIndicatorProps) => {
  return (
    <div className="absolute bottom-2 left-2 z-10 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-md shadow-md border border-border">
      <span className="text-sm font-medium text-foreground">
        Zoom: {zoom.toFixed(1)}
      </span>
    </div>
  );
};
