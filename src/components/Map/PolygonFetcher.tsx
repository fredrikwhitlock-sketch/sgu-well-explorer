import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Download, Loader2, Database } from "lucide-react";
import { Separator } from "@/components/ui/separator";
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
  count: number;
  error?: string;
}

interface LinkedState {
  features: any[];
  loading: boolean;
  count: number;
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
  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
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

const PAGE_SIZE = 5000;
const today = new Date().toISOString().split('T')[0];

// Hybrid pagination: parallel offset fetching when numberMatched available,
// otherwise follows links.next sequentially. Uses PAGE_SIZE=5000 to minimise requests.
async function fetchAllPages(
  baseUrl: string,
  onProgress?: (count: number) => void
): Promise<any[]> {
  const sep = baseUrl.includes('?') ? '&' : '?';
  const firstUrl = `${baseUrl}${sep}limit=${PAGE_SIZE}`;

  const firstResp = await fetch(firstUrl);
  if (!firstResp.ok) throw new Error(`HTTP ${firstResp.status}`);
  const firstData = await firstResp.json();

  const features: any[] = [...(firstData.features ?? [])];
  onProgress?.(features.length);

  const hasNext = firstData.links?.some((l: any) => l.rel === 'next');
  if (!hasNext) return features;

  const total: number | null = firstData.numberMatched ?? null;

  if (total !== null && total > features.length) {
    // Parallel offset fetching — all remaining pages at once
    const remaining = Math.ceil((total - features.length) / PAGE_SIZE);
    const pages = await Promise.all(
      Array.from({ length: remaining }, (_, i) =>
        fetch(`${baseUrl}${sep}limit=${PAGE_SIZE}&offset=${(i + 1) * PAGE_SIZE}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => d?.features ?? [])
          .catch(() => [])
      )
    );
    for (const page of pages) {
      features.push(...page);
      onProgress?.(features.length);
    }
  } else {
    // Sequential link-following fallback (most reliable)
    let nextUrl: string | null =
      firstData.links?.find((l: any) => l.rel === 'next')?.href ?? null;
    while (nextUrl) {
      const resp = await fetch(nextUrl);
      if (!resp.ok) break;
      const data = await resp.json();
      features.push(...(data.features ?? []));
      onProgress?.(features.length);
      nextUrl = data.links?.find((l: any) => l.rel === 'next')?.href ?? null;
    }
  }

  return features;
}

// Fetch linked data filtered by IDs in parallel batches.
async function fetchByIdBatches(
  baseUrl: string,
  filterFn: (ids: string[]) => string,
  ids: string[],
  onProgress?: (count: number) => void,
  batchSize = 80
): Promise<any[]> {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) batches.push(ids.slice(i, i + batchSize));

  let total = 0;
  const results = await Promise.all(
    batches.map(async batch => {
      const url = `${baseUrl}&filter=${encodeURIComponent(filterFn(batch))}&filter-lang=cql2-text`;
      const features = await fetchAllPages(url, (n) => {
        total += n;
        onProgress?.(total);
      });
      return features;
    })
  );
  return results.flat();
}

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

  const handleFetch = async () => {
    setFetching(true);
    setLinked({});
    const sources = DATA_SOURCES.filter(s => selected.has(s.id));

    const init: Record<string, SourceState> = {};
    for (const s of sources) init[s.id] = { features: [], loading: true, count: 0 };
    setResults(init);

    await Promise.all(
      sources.map(async s => {
        try {
          const features = await fetchAllPages(s.buildUrl(bboxStr), (count) => {
            setResults(r => ({ ...r, [s.id]: { ...r[s.id], count } }));
          });
          setResults(r => ({ ...r, [s.id]: { features, loading: false, count: features.length } }));

          // Auto-start linked data fetch as soon as parent data arrives
          if (s.id === 'nivaer' && features.length > 0) {
            const ids = features
              .map((f: any) => f.properties?.platsbeteckning)
              .filter((v: any): v is string => typeof v === 'string' && v.length > 0);
            if (ids.length > 0) {
              setLinked(l => ({ ...l, nivaObs: { features: [], loading: true, count: 0 } }));
              try {
                const base = 'https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/nivaer/items?f=json';
                const obs = await fetchByIdBatches(
                  base,
                  batch => `platsbeteckning IN (${batch.map(id => `'${id.replace(/'/g, "''")}'`).join(',')})`,
                  ids,
                  (count) => setLinked(l => ({ ...l, nivaObs: { ...l.nivaObs!, count } }))
                );
                setLinked(l => ({ ...l, nivaObs: { features: obs, loading: false, count: obs.length } }));
              } catch {
                setLinked(l => ({ ...l, nivaObs: { features: [], loading: false, count: 0, error: 'Misslyckades' } }));
              }
            }
          }

          if (s.id === 'kvalitet' && features.length > 0) {
            const ids = features
              .map((f: any) => f.properties?.nationellt_provplatsid ?? f.properties?.provplatsid ?? f.id)
              .filter((v: any): v is string | number => v != null && v !== '')
              .map(String);
            if (ids.length > 0) {
              setLinked(l => ({ ...l, analysresultat: { features: [], loading: true, count: 0 } }));
              try {
                const base = 'https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/analysresultat/items?f=json';
                const analys = await fetchByIdBatches(
                  base,
                  batch => `nationellt_provplatsid IN (${batch.join(',')})`,
                  ids,
                  (count) => setLinked(l => ({ ...l, analysresultat: { ...l.analysresultat!, count } }))
                );
                setLinked(l => ({ ...l, analysresultat: { features: analys, loading: false, count: analys.length } }));
              } catch {
                setLinked(l => ({ ...l, analysresultat: { features: [], loading: false, count: 0, error: 'Misslyckades' } }));
              }
            }
          }
        } catch {
          setResults(r => ({ ...r, [s.id]: { features: [], loading: false, count: 0, error: 'Misslyckades' } }));
        }
      })
    );

    setFetching(false);
  };

  const hasFetched = Object.keys(results).length > 0;
  const anyResults =
    Object.values(results).some(r => r.features.length > 0) ||
    !!linked.nivaObs?.features.length ||
    !!linked.analysresultat?.features.length;

  const ExportRow = ({
    label, features, csvName, geojsonName, loading, count,
  }: {
    label: string;
    features: any[];
    csvName: string;
    geojsonName: string;
    loading?: boolean;
    count?: number;
  }) => (
    <div className="flex items-center gap-1 px-2 py-1 flex-wrap">
      <span className="text-xs text-foreground flex-1">
        {label}
        {loading
          ? <span className="text-muted-foreground"> ({count ?? 0}…)</span>
          : <span> ({features.length})</span>}
      </span>
      {features.length > 0 && (
        <>
          <button
            className="text-xs text-sgu-link hover:underline inline-flex items-center gap-0.5"
            onClick={() => triggerCSV(features, csvName)}
          >
            <Download className="w-3 h-3" /> CSV
          </button>
          <span className="text-muted-foreground text-xs">/</span>
          <button
            className="text-xs text-sgu-link hover:underline inline-flex items-center gap-0.5"
            onClick={() => triggerGeoJSON(features, geojsonName)}
          >
            GeoJSON
          </button>
        </>
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
                {r?.loading && (
                  <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {r.count > 0 ? r.count : ''}
                  </span>
                )}
                {r && !r.loading && !r.error && (
                  <span className="ml-auto text-xs text-muted-foreground">{r.features.length}</span>
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

        {hasFetched && anyResults && (
          <>
            <Separator />
            <p className="text-xs font-semibold text-foreground">Exportera</p>
            <div className="space-y-0.5">
              {DATA_SOURCES.filter(s => results[s.id] && (results[s.id].features.length > 0 || results[s.id].loading)).map(s => {
                const r = results[s.id];
                return (
                  <div key={s.id}>
                    <ExportRow
                      label={s.label}
                      features={r.features}
                      loading={r.loading}
                      count={r.count}
                      csvName={`${s.id}_polygon_${today}.csv`}
                      geojsonName={`${s.id}_polygon_${today}.geojson`}
                    />

                    {s.id === 'nivaer' && linked.nivaObs !== undefined && (
                      <div className="ml-3 border-l-2 border-border pl-2">
                        {linked.nivaObs.error ? (
                          <span className="text-xs text-destructive">{linked.nivaObs.error}</span>
                        ) : (
                          <ExportRow
                            label="nivåobservationer"
                            features={linked.nivaObs.features}
                            loading={linked.nivaObs.loading}
                            count={linked.nivaObs.count}
                            csvName={`nivaer_observationer_polygon_${today}.csv`}
                            geojsonName={`nivaer_observationer_polygon_${today}.geojson`}
                          />
                        )}
                      </div>
                    )}

                    {s.id === 'kvalitet' && linked.analysresultat !== undefined && (
                      <div className="ml-3 border-l-2 border-border pl-2">
                        {linked.analysresultat.error ? (
                          <span className="text-xs text-destructive">{linked.analysresultat.error}</span>
                        ) : (
                          <ExportRow
                            label="analysresultat"
                            features={linked.analysresultat.features}
                            loading={linked.analysresultat.loading}
                            count={linked.analysresultat.count}
                            csvName={`analysresultat_polygon_${today}.csv`}
                            geojsonName={`analysresultat_polygon_${today}.geojson`}
                          />
                        )}
                      </div>
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
