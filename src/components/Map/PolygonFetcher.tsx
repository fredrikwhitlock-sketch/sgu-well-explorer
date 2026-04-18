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
];

const DEFAULT_SELECTED = new Set(['brunnar', 'kallor', 'magasin', 'nivaer', 'kvalitet']);

interface SourceState {
  features: any[];
  loading: boolean;
  error?: string;
}

interface LinkedState {
  features: any[];
  loading: boolean;
  error?: string;
}

interface PolygonFetcherProps {
  bbox: [number, number, number, number];
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

function triggerCSV(features: any[], filename: string) {
  if (features.length === 0) return;
  const keys = Array.from(new Set(features.flatMap(f => Object.keys(f.properties || {}))));
  const rows = [
    keys.join(';'),
    ...features.map(f => keys.map(k => escapeCSV(f.properties?.[k])).join(';')),
  ];
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function triggerGeoJSON(features: any[], filename: string) {
  const blob = new Blob([JSON.stringify({ type: 'FeatureCollection', features }, null, 2)], {
    type: 'application/geo+json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const today = new Date().toISOString().split('T')[0];

export const PolygonFetcher = ({ bbox, areaKm2, onClose }: PolygonFetcherProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_SELECTED));
  const [results, setResults] = useState<Record<string, SourceState>>({});
  const [fetching, setFetching] = useState(false);
  const [linked, setLinked] = useState<{ analysresultat?: LinkedState; nivaObs?: LinkedState }>({});

  const bboxStr = bbox.join(',');

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const fetchAllPages = async (baseUrl: string): Promise<any[]> => {
    const pageSize = 1000;
    const first = await fetch(`${baseUrl}&limit=${pageSize}`);
    if (!first.ok) throw new Error(`HTTP ${first.status}`);
    const firstData = await first.json();
    const features: any[] = firstData.features ?? [];
    const total: number = firstData.numberMatched ?? firstData.numberReturned ?? features.length;
    const remaining = Math.ceil((total - features.length) / pageSize);
    if (remaining > 0) {
      const pages = await Promise.all(
        Array.from({ length: remaining }, (_, i) =>
          fetch(`${baseUrl}&limit=${pageSize}&offset=${(i + 1) * pageSize}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => d?.features ?? [])
            .catch(() => [])
        )
      );
      features.push(...pages.flat());
    }
    return features;
  };

  // Fetch linked data in batches, running all batches in parallel.
  const fetchByIdBatches = async (
    baseUrl: string,
    filterFn: (ids: string[]) => string,
    ids: string[],
    batchSize = 80
  ): Promise<any[]> => {
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += batchSize) batches.push(ids.slice(i, i + batchSize));
    const results = await Promise.all(
      batches.map(batch => fetchAllPages(`${baseUrl}&filter=${encodeURIComponent(filterFn(batch))}&filter-lang=cql2-text`))
    );
    return results.flat();
  };

  const handleFetch = async () => {
    setFetching(true);
    setLinked({});
    const sources = DATA_SOURCES.filter(s => selected.has(s.id));

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
  };

  const fetchAnalysresultat = async () => {
    const provplatser = results['kvalitet']?.features ?? [];
    const ids = provplatser
      .map(f => f.properties?.nationellt_provplatsid ?? f.properties?.provplatsid ?? f.id)
      .filter((v): v is string | number => v != null && v !== '')
      .map(String);
    if (ids.length === 0) { toast.info('Inga provplatser med ID hittades'); return; }

    setLinked(l => ({ ...l, analysresultat: { features: [], loading: true } }));
    try {
      const base = 'https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/analysresultat/items?f=json';
      const features = await fetchByIdBatches(
        base,
        batch => `nationellt_provplatsid IN (${batch.join(',')})`,
        ids.map(String)
      );
      setLinked(l => ({ ...l, analysresultat: { features, loading: false } }));
      toast.success(`Hämtade ${features.length} analysresultat`);
    } catch {
      setLinked(l => ({ ...l, analysresultat: { features: [], loading: false, error: 'Misslyckades' } }));
      toast.error('Kunde inte hämta analysresultat');
    }
  };

  const fetchNivaObs = async () => {
    const stationer = results['nivaer']?.features ?? [];
    const ids = stationer
      .map(f => f.properties?.platsbeteckning)
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (ids.length === 0) { toast.info('Inga stationer med platsbeteckning hittades'); return; }

    setLinked(l => ({ ...l, nivaObs: { features: [], loading: true } }));
    try {
      const base = 'https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/nivaer/items?f=json';
      const features = await fetchByIdBatches(
        base,
        batch => `platsbeteckning IN (${batch.map(id => `'${id.replace(/'/g, "''")}'`).join(',')})`,
        ids
      );
      setLinked(l => ({ ...l, nivaObs: { features, loading: false } }));
      toast.success(`Hämtade ${features.length} nivåobservationer`);
    } catch {
      setLinked(l => ({ ...l, nivaObs: { features: [], loading: false, error: 'Misslyckades' } }));
      toast.error('Kunde inte hämta nivåobservationer');
    }
  };

  const hasFetched = Object.keys(results).length > 0;
  const anyResults = Object.values(results).some(r => r.features.length > 0);

  const LinkedRow = ({
    label, state, onFetch, csvName, geojsonName,
  }: {
    label: string;
    state: LinkedState | undefined;
    onFetch: () => void;
    csvName: string;
    geojsonName: string;
  }) => (
    <div className="ml-3 mt-1 border-l-2 border-border pl-2">
      {!state ? (
        <button
          className="text-xs text-sgu-link hover:underline inline-flex items-center gap-1"
          onClick={onFetch}
        >
          <Download className="w-3 h-3" /> Hämta {label}
        </button>
      ) : state.loading ? (
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Hämtar {label}…
        </span>
      ) : state.error ? (
        <span className="text-xs text-destructive">{state.error}</span>
      ) : state.features.length === 0 ? (
        <span className="text-xs text-muted-foreground">Inga {label} hittades</span>
      ) : (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-muted-foreground">{label} ({state.features.length})</span>
          <button
            className="text-xs text-sgu-link hover:underline inline-flex items-center gap-0.5"
            onClick={() => triggerCSV(state.features, csvName)}
          >
            <Download className="w-3 h-3" /> CSV
          </button>
          <span className="text-muted-foreground text-xs">/</span>
          <button
            className="text-xs text-sgu-link hover:underline inline-flex items-center gap-0.5"
            onClick={() => triggerGeoJSON(state.features, geojsonName)}
          >
            GeoJSON
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Card className="absolute top-20 left-4 w-72 max-h-[calc(100vh-120px)] overflow-y-auto bg-card/95 backdrop-blur-sm shadow-lg border-border z-30">
      <div className="sticky top-0 bg-sgu-maroon border-b border-border p-3 flex items-center justify-between z-10">
        <h3 className="font-semibold text-white text-sm">Hämta data i polygon</h3>
        <button onClick={onClose} className="text-white/70 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div className="text-xs text-muted-foreground">
          Ritat område:{' '}
          <span className="font-medium text-foreground">{areaKm2.toFixed(2)} km²</span>
          <span className="block text-[10px] mt-0.5">
            Bbox: {bbox.map(v => v.toFixed(4)).join(', ')}
          </span>
        </div>

        <Separator />

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

        {hasFetched && !fetching && anyResults && (
          <>
            <Separator />
            <p className="text-xs font-semibold text-foreground">Exportera</p>
            <div className="space-y-1.5">
              {DATA_SOURCES.filter(s => results[s.id]?.features.length > 0).map(s => {
                const r = results[s.id];
                return (
                  <div key={s.id}>
                    <div className="flex items-center gap-1 px-2 py-1">
                      <span className="text-xs text-foreground flex-1">{s.label} ({r.features.length})</span>
                      <button
                        className="text-xs text-sgu-link hover:underline inline-flex items-center gap-0.5"
                        onClick={() => triggerCSV(r.features, `${s.id}_polygon_${today}.csv`)}
                      >
                        <Download className="w-3 h-3" /> CSV
                      </button>
                      <span className="text-muted-foreground text-xs">/</span>
                      <button
                        className="text-xs text-sgu-link hover:underline inline-flex items-center gap-0.5"
                        onClick={() => triggerGeoJSON(r.features, `${s.id}_polygon_${today}.geojson`)}
                      >
                        GeoJSON
                      </button>
                    </div>

                    {/* Linked: analysis results for quality stations */}
                    {s.id === 'kvalitet' && (
                      <LinkedRow
                        label="analysresultat"
                        state={linked.analysresultat}
                        onFetch={fetchAnalysresultat}
                        csvName={`analysresultat_polygon_${today}.csv`}
                        geojsonName={`analysresultat_polygon_${today}.geojson`}
                      />
                    )}

                    {/* Linked: level observations for level stations */}
                    {s.id === 'nivaer' && (
                      <LinkedRow
                        label="nivåobservationer"
                        state={linked.nivaObs}
                        onFetch={fetchNivaObs}
                        csvName={`nivaer_observationer_polygon_${today}.csv`}
                        geojsonName={`nivaer_observationer_polygon_${today}.geojson`}
                      />
                    )}
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
