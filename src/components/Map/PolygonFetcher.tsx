import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Download, Loader2, Database } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CheckSquare, Square } from "lucide-react";

interface DataSource {
  id: string;
  label: string;
  buildUrl: (bbox: string) => string;
}

const DATA_SOURCES: DataSource[] = [
  {
    id: 'brunnar',
    label: 'Brunnar',
    buildUrl: (bbox) =>
      `https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items?f=json&bbox=${bbox}`,
  },
  {
    id: 'kallor',
    label: 'Källor',
    buildUrl: (bbox) =>
      `https://api.sgu.se/oppnadata/kallor/ogc/features/v1/collections/kallor/items?f=json&bbox=${bbox}`,
  },
  {
    id: 'magasin',
    label: 'Grundvattenmagasin',
    buildUrl: (bbox) =>
      `https://api.sgu.se/oppnadata/grundvattenmagasin/ogc/features/v1/collections/grundvattenmagasin/items?f=json&bbox=${bbox}`,
  },
  {
    id: 'nivaer',
    label: 'GV-nivåstationer',
    buildUrl: (bbox) =>
      `https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/stationer/items?f=json&bbox=${bbox}`,
  },
  {
    id: 'kvalitet',
    label: 'GV-kvalitet (provplatser)',
    buildUrl: (bbox) =>
      `https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/provplatser/items?f=json&bbox=${bbox}`,
  },
  {
    id: 'jordarter',
    label: 'Jordarter',
    buildUrl: (bbox) =>
      `https://api.sgu.se/oppnadata/jordarter25k-100k/ogc/features/v1/collections/grundlager/items?f=json&bbox=${bbox}`,
  },
];

// Default on/off per source
const DEFAULT_SELECTED = new Set(['brunnar', 'kallor', 'magasin', 'nivaer', 'kvalitet']);

interface SourceState {
  features: any[];
  loading: boolean;
  error?: string;
}

interface PolygonFetcherProps {
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  areaKm2: number;
  onClose: () => void;
}

function escapeCSV(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r'))
    return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(features: any[], sourceId: string) {
  if (features.length === 0) return;
  const keys = Array.from(
    new Set(features.flatMap(f => Object.keys(f.properties || {})))
  );
  const rows = [
    keys.join(';'),
    ...features.map(f => keys.map(k => escapeCSV(f.properties?.[k])).join(';')),
  ];
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sourceId}_polygon_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadGeoJSON(features: any[], sourceId: string) {
  const geojson = { type: 'FeatureCollection', features };
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sourceId}_polygon_${new Date().toISOString().split('T')[0]}.geojson`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const PolygonFetcher = ({ bbox, areaKm2, onClose }: PolygonFetcherProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_SELECTED));
  const [results, setResults] = useState<Record<string, SourceState>>({});
  const [fetching, setFetching] = useState(false);

  const bboxStr = bbox.join(',');

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const fetchAllPages = async (baseUrl: string): Promise<any[]> => {
    const all: any[] = [];
    let nextUrl: string | null = `${baseUrl}&limit=1000`;
    while (nextUrl) {
      const res = await fetch(nextUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      all.push(...(data.features || []));
      nextUrl = data.links?.find((l: any) => l.rel === 'next')?.href ?? null;
    }
    return all;
  };

  const handleFetch = async () => {
    setFetching(true);
    const sources = DATA_SOURCES.filter(s => selected.has(s.id));

    // Initialize loading states
    const init: Record<string, SourceState> = {};
    for (const s of sources) init[s.id] = { features: [], loading: true };
    setResults(init);

    await Promise.all(
      sources.map(async s => {
        try {
          const features = await fetchAllPages(s.buildUrl(bboxStr));
          setResults(r => ({ ...r, [s.id]: { features, loading: false } }));
        } catch {
          setResults(r => ({ ...r, [s.id]: { features: [], loading: false, error: 'Misslyckades' } }));
        }
      })
    );

    setFetching(false);
    const total = Object.values(results).reduce((sum, r) => sum + r.features.length, 0);
    if (total > 0) toast.success(`Hämtade totalt ${total} objekt`);
  };

  const hasFetched = Object.keys(results).length > 0;
  const anyResults = Object.values(results).some(r => r.features.length > 0);

  return (
    <Card className="absolute top-20 left-4 w-72 max-h-[calc(100vh-120px)] overflow-y-auto bg-card/95 backdrop-blur-sm shadow-lg border-border z-30">
      {/* Header */}
      <div className="sticky top-0 bg-sgu-maroon border-b border-border p-3 flex items-center justify-between z-10">
        <h3 className="font-semibold text-white text-sm">Hämta data i polygon</h3>
        <button onClick={onClose} className="text-white/70 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Area */}
        <div className="text-xs text-muted-foreground">
          Ritat område:{' '}
          <span className="font-medium text-foreground">{areaKm2.toFixed(2)} km²</span>
          <span className="block text-[10px] mt-0.5">
            Bbox: {bbox.map(v => v.toFixed(4)).join(', ')}
          </span>
        </div>

        <Separator />

        {/* Source selector */}
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-foreground mb-1">Välj datakällor</p>
          {DATA_SOURCES.map(s => {
            const r = results[s.id];
            return (
              <button
                key={s.id}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-muted/50 text-sm"
                onClick={() => toggle(s.id)}
              >
                {selected.has(s.id)
                  ? <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" />
                  : <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                <span className={selected.has(s.id) ? 'text-foreground' : 'text-muted-foreground'}>
                  {s.label}
                </span>
                {r?.loading && <Loader2 className="ml-auto w-3 h-3 animate-spin text-muted-foreground" />}
                {r && !r.loading && !r.error && (
                  <span className="ml-auto text-xs text-muted-foreground">{r.features.length} st</span>
                )}
                {r?.error && <span className="ml-auto text-xs text-destructive">!</span>}
              </button>
            );
          })}
        </div>

        <Button
          className="w-full"
          size="sm"
          onClick={handleFetch}
          disabled={fetching || selected.size === 0}
        >
          {fetching
            ? <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Hämtar…</>
            : <><Database className="w-3 h-3 mr-2" /> Hämta data</>}
        </Button>

        {/* Export section */}
        {hasFetched && !fetching && anyResults && (
          <>
            <Separator />
            <p className="text-xs font-semibold text-foreground">Exportera</p>
            <div className="space-y-0.5">
              {DATA_SOURCES.filter(s => results[s.id]?.features.length > 0).map(s => {
                const r = results[s.id];
                return (
                  <div key={s.id} className="flex items-center gap-1 px-2 py-1">
                    <span className="text-xs text-foreground flex-1">{s.label} ({r.features.length})</span>
                    <button
                      className="text-xs text-sgu-link hover:underline inline-flex items-center gap-0.5"
                      onClick={() => downloadCSV(r.features, s.id)}
                      title="Ladda ned CSV"
                    >
                      <Download className="w-3 h-3" /> CSV
                    </button>
                    <span className="text-muted-foreground text-xs">/</span>
                    <button
                      className="text-xs text-sgu-link hover:underline inline-flex items-center gap-0.5"
                      onClick={() => downloadGeoJSON(r.features, s.id)}
                      title="Ladda ned GeoJSON"
                    >
                      GeoJSON
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {hasFetched && !fetching && !anyResults && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Inga objekt hittades i det ritade området.
          </p>
        )}
      </div>
    </Card>
  );
};
