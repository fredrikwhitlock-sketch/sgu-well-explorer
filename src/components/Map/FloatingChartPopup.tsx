import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

// ── FloatingChartPopup ────────────────────────────────────────────────────────

export interface FloatingChartPopupProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function FloatingChartPopup({ title, onClose, children }: FloatingChartPopupProps) {
  const [pos, setPos] = useState(() => ({
    left: Math.max(20, Math.min(window.innerWidth / 2 - 360, window.innerWidth - 740)),
    top: 80,
  }));
  const popupDragRef = useRef({ dragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!popupDragRef.current.dragging) return;
      setPos({
        left: popupDragRef.current.startLeft + (e.clientX - popupDragRef.current.startX),
        top: popupDragRef.current.startTop + (e.clientY - popupDragRef.current.startY),
      });
    };
    const onUp = () => { popupDragRef.current.dragging = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const handlePopupMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    popupDragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, startLeft: pos.left, startTop: pos.top };
    e.preventDefault();
  };

  return (
    <div
      className="fixed z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
      style={{ left: pos.left, top: pos.top, width: 700, maxHeight: '80vh' }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-sgu-maroon text-white select-none cursor-move shrink-0"
        onMouseDown={handlePopupMouseDown}
      >
        <span className="text-sm font-semibold">{title}</span>
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/20 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 overflow-y-auto flex-1">
        {children}
      </div>
    </div>
  );
}

export type ChartPopupState =
  | { kind: 'obs'; stationId: string; namn: string; distKm: number }
  | { kind: 'hype'; dataKey: 'fyllnadSma' | 'fyllnadStora'; label: string; color: string; gradId: string }
  | null;
