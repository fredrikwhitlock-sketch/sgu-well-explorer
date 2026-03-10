import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WmsLegendProps {
  sguBerggrund1MVisible: boolean;
  sguBerggrund50kVisible: boolean;
  sguJordarter1MVisible: boolean;
  sguJordarter25kVisible: boolean;
  sguGvTillgangVisible: boolean;
}

const WmsLegend: React.FC<WmsLegendProps> = ({
  sguBerggrund1MVisible,
  sguBerggrund50kVisible,
  sguJordarter1MVisible,
  sguJordarter25kVisible,
  sguGvTillgangVisible,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const legendRef = useRef<HTMLDivElement>(null);

  const wmsProxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wms-proxy`;

  // Check if any layer is visible
  const hasVisibleLayers = sguBerggrund1MVisible || sguBerggrund50kVisible || sguJordarter1MVisible || sguJordarter25kVisible || sguGvTillgangVisible;

  // Auto-show legend when layers become visible
  useEffect(() => {
    if (hasVisibleLayers && !isVisible) {
      setIsVisible(true);
    }
  }, [hasVisibleLayers]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (legendRef.current) {
      setIsDragging(true);
      const rect = legendRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  if (!hasVisibleLayers || !isVisible) {
    return null;
  }

  const legendItems = [
    {
      visible: sguBerggrund1MVisible,
      label: 'Berggrund 1:1M',
      url: `${wmsProxyUrl}?url=${encodeURIComponent('https://maps3.sgu.se/geoserver/berg/ows')}&REQUEST=GetLegendGraphic&SERVICE=WMS&VERSION=1.1.1&FORMAT=image/png&LAYER=berg:SE.GOV.SGU.BERGGRUND_NA10&WIDTH=20&HEIGHT=20`,
    },
    {
      visible: sguBerggrund50kVisible,
      label: 'Berggrund 1:50k',
      url: `${wmsProxyUrl}?url=${encodeURIComponent('https://maps3.sgu.se/geoserver/berg/ows')}&REQUEST=GetLegendGraphic&SERVICE=WMS&VERSION=1.1.1&FORMAT=image/png&LAYER=SE.GOV.SGU.BERG.GEOLOGISK_ENHET.YTA.50K&WIDTH=20&HEIGHT=20`,
    },
    {
      visible: sguJordarter1MVisible,
      label: 'Jordarter 1:1M',
      url: `${wmsProxyUrl}?url=${encodeURIComponent('https://maps3.sgu.se/geoserver/jord/ows')}&REQUEST=GetLegendGraphic&SERVICE=WMS&VERSION=1.1.1&FORMAT=image/png&LAYER=jord:SE.GOV.SGU.JORD.GRUNDLAGER.1M&WIDTH=20&HEIGHT=20`,
    },
    {
      visible: sguJordarter25kVisible,
      label: 'Jordarter 1:25k',
      url: `${wmsProxyUrl}?url=${encodeURIComponent('https://maps3.sgu.se/geoserver/jord/ows')}&REQUEST=GetLegendGraphic&SERVICE=WMS&VERSION=1.1.1&FORMAT=image/png&LAYER=jord:SE.GOV.SGU.JORD.GRUNDLAGER.25K&WIDTH=20&HEIGHT=20`,
    },
    {
      visible: sguGvTillgangVisible,
      label: 'GV-tillgång små magasin',
      url: `${wmsProxyUrl}?url=${encodeURIComponent('https://api.sgu.se/oppnadata/grundvattentillgang-sma-magasin/wms')}&REQUEST=GetLegendGraphic&SERVICE=WMS&VERSION=1.1.1&FORMAT=image/png&LAYER=grundvattentillgang-sma-magasin&WIDTH=20&HEIGHT=20`,
    },
  ];

  const visibleItems = legendItems.filter(item => item.visible);

  return (
    <div
      ref={legendRef}
      className={cn(
        "absolute z-50 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg",
        "select-none",
        isDragging && "cursor-grabbing"
      )}
      style={{
        left: position.x,
        top: position.y,
        maxWidth: '300px',
        maxHeight: isMinimized ? 'auto' : '400px',
      }}
    >
      {/* Header - draggable */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-t-lg cursor-grab border-b border-border"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Teckenförklaring</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-accent rounded"
            title={isMinimized ? "Expandera" : "Minimera"}
          >
            {isMinimized ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-accent rounded"
            title="Stäng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="p-3 overflow-y-auto" style={{ maxHeight: '350px' }}>
          <div className="space-y-4">
            {visibleItems.map((item, index) => (
              <div key={index} className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {item.label}
                </h4>
                <div className="bg-white rounded border p-2">
                  <img
                    src={item.url}
                    alt={`Legend for ${item.label}`}
                    className="max-w-full h-auto"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WmsLegend;
