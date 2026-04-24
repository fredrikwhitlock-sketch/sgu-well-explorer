import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Download, Loader2, Database, AlertTriangle } from "lucide-react";
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
const PAGE_SIZE = 5000;
const COUNT_WARN_THRESHOLD = 100_000;

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
  warning?: string; // set when count > threshold, halts auto-fetch
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
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function triggerGeoJSON(features: any[], filename: string) {
  const blob = new Blob([JSON.stringify({ type: 'FeatureCollection', features }, null, 2)], {
    type: 'application/geo+json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// Pure sequential link-following — guaranteed correct for CQL2-filtered SGU endpoints.
// Parallel offset-fetching breaks on the observations endpoint beyond ~45k rows.
async function fetchAllPages(
  baseUrl: string,
  onProgress?: (count: number) => void
): Promise<any[]> {
  const sep = baseUrl.includes('?') ? '&' : '?';
  const features: any[] = [];
  let nextUrl: string | null = `${baseUrl}${sep}limit=${PAGE_SIZE}`;

  while (nextUrl) {
    const resp = await fetch(nextUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    features.push(...(data.features ?? []));
    onProgress?.(features.length);
    nextUrl = data.links?.find((l: any) => l.rel === 'next')?.href ?? null;
  }

  return features;
}

// One-item probe to get numberMatched without loading the full dataset.
async function peekCount(baseUrl: string): Promise<number | null> {
  const sep = baseUrl.includes('?') ? '&' : '?';
  try {
    const resp = await fetch(`${baseUrl}${sep}limit=1`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return typeof data.numberMatched === 'number' ? data.numberMatched : null;
  } catch {
    return null;
  }
}

// Fetch linked data by ID batches in parallel, with correct incremental progress.
async function fetchByIdBatches(
  baseUrl: string,
  filterFn: (ids: string[]) => string,
  ids: string[],
  onProgress?: (count: number) => void,
  batchSize = 80
): Promise<any[]> {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) batches.push(ids.slice(i, i + batchSize));

  const batchCounts = new Array(batches.length).fill(0);
  const allFeatures = await Promise.all(
    batches.map(async (batch, idx) => {
      const url = `${baseUrl}&filter=${encodeURIComponent(filterFn(batch))}&filter-lang=cql2-text`;
      return fetchAllPages(url, (n) => {
        batchCounts[idx] = n;
        onProgress?.(batchCounts.reduce((a, b) => a + b, 0));
      });
    })
  );
  return allFeatures.flat();
}

const today = new Date().toISOString().split('T')[0];

export const PolygonFetcher = ({ bbox, areaKm2, onClose }: PolygonFetcherProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_SELECTED));
  const [results, setResults] = useState<Record<string, SourceState>>({});
  const [fetching, setFetching] = useState(false);
  const [linked, setLinked] = useState<{ analysresultat?: LinkedState; nivaObs?: LinkedState }>({});

  // Stores IDs for linked fetches that were blocked by the count warning.
  const pendingNivaIds = useRef<string[]>([]);
  const pendingAnalysIds = useRef<string[]>([]);

  const bboxStr = bbox.join(',');

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const doFetchNivaObs = async (ids: string[]) => {
    setLinked(l => ({ ...l, nivaObs: { features: [], loading: true, count: 0 } }));
    try {
      const base = 'https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/nivaer/items?f=json';
      const obs = await fetchByIdBatches(
        base,
        batch => `platsbeteckning IN (${batch.map(id => `'${id.replace(/'/g, "''")}'`).join(',')})`,
        ids,
        (count) => setLinked(l => ({ ...l, nivaObs: l.nivaObs ? { ...l.nivaObs, count } : { features: [], loading: true, count } }))
      );
      setLinked(l => ({ ...l, nivaObs: { features: obs, loading: false, count: obs.length } }));
    } catch {
      setLinked(l => ({ ...l, nivaObs: { features: [], loading: false, count: 0, error: 'Misslyckades' } }));
    }
  };

  const doFetchAnalysresultat = async (ids: string[]) => {
    setLinked(l => ({ ...l, analysresultat: { features: [], loading: true, count: 0 } }));
    try {
      const base = 'https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/analysresultat/items?f=json';
      const analys = await fetchByIdBatches(
        base,
        batch => `nationellt_provplatsid IN (${batch.join(',')})`,
        ids,
        (count) => setLinked(l => ({ ...l, analysresultat: l.analysresultat ? { ...l.analysresultat, count } : { features: [], loading: true, count } }))
      );
      setLinked(l => ({ ...l, analysresultat: { features: analys, loading: false, count: analys.length } }));
    } catch {
      setLinked(l => ({ ...l, analysresultat: { features: [], loading: false, count: 0, error: 'Misslyckades' } }));
    }
  };

  const handleFetch = async () => {
    setFetching(true);
    setLinked({});
    pendingNivaIds.current = [];
    pendingAnalysIds.current = [];

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

          if (s.id === 'nivaer' && features.length > 0) {
            const ids = features
              .map((f: any) => f.properties?.platsbeteckning)
              .filter((v: any): v is string => typeof v === 'string' && v.length > 0);
            if (ids.length > 0) {
              const base = 'https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/nivaer/items?f=json';
              const filterStr = `platsbeteckning IN (${ids.map(id => `'${id.replace(/'/g, "''")}'`).join(',')})`;
              const probeUrl = `${base}&filter=${encodeURIComponent(filterStr)}&filter-lang=cql2-text`;
              const count = await peekCount(probeUrl);

              if (count !== null && count > COUNT_WARN_THRESHOLD) {
                pendingNivaIds.current = ids;
                setLinked(l => ({
                  ...l,
                  nivaObs: {
                    features: [], loading: false, count: 0,
                    warning: `${count.toLocaleString('sv-SE')} observationer – för stort för automatisk hämtning.`,
                  },
                }));
              } else {
                await doFetchNivaObs(ids);
              }
            }
          }

          if (s.id === 'kvalitet' && features.length > 0) {
            const ids = features
              .map((f: any) => f.properties?.nationellt_provplatsid ?? f.properties?.provplatsid ?? f.id)
              .filter((v: any): v is string | number => v != null && v !== '')
              .map(String);
            if (ids.length > 0) {
              const base = 'https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/analysresultat/items?f=json';
              const filterStr = `nationellt_provplatsid IN (${ids.join(',')})`;
              const probeUrl = `${base}&filter=${encodeURIComponent(filterStr)}&filter-lang=cql2-text`;
              const count = await peekCount(probeUrl);

              if (count !== null && count > COUNT_WARN_THRESHOLD) {
                pendingAnalysIds.current = ids;
                setLinked(l => ({
                  ...l,
                  analysresultat: {
                    features: [], loading: false, count: 0,
                    warning: `${count.toLocaleString('sv-SE')} analysresultat – för stort för automatisk hämtning.`,
                  },
                }));
              } else {
                await doFetchAnalysresultat(ids);
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
    !!linked.analysresultat?.features.length ||
    !!linked.nivaObs?.warning ||
    !!linked.analysresultat?.warning;

  const ExportRow = ({
    label, features, csvName, geojsonName, loading, count,
  }: {
    label: string; features: any[]; csvName: string; geojsonName: string;
    loading?: boolean; count?: number;
  }) => (
    <div className="flex items-center gap-1 px-2 py-1 flex-wrap">
      <span className="text-xs text-foreground flex-1">
        {label}
        {loading
          ? <span className="text-muted-foreground"> ({(count ?? 0).toLocaleString('sv-SE')}…)</span>
          : <span> ({features.length.toLocaleString('sv-SE')})</span>}
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
          <span className="block text-[10px] mt-0.5">Bbox: {bbox.map(v => v.toFixed(4)).join(', ')}</span>
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
                    {r.count > 0 ? r.count.toLocaleString('sv-SE') : ''}
                  </span>
                )}
                {r && !r.loading && !r.error && (
                  <span className="ml-auto text-xs text-muted-foreground">{r.features.length.toLocaleString('sv-SE')}</span>
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

                    {s.id === 'nivaer' && linked.nivaObs && (
                      <div className="ml-3 border-l-2 border-border pl-2">
                        {linked.nivaObs.warning ? (
                          <div className="py-1 space-y-1">
                            <div className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                              <span>{linked.nivaObs.warning}</span>
                            </div>
                            <button
                              className="text-xs text-sgu-link hover:underline"
                              onClick={() => doFetchNivaObs(pendingNivaIds.current)}
                            >
                              Ladda ändå
                            </button>
                          </div>
                        ) : linked.nivaObs.error ? (
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

                    {s.id === 'kvalitet' && linked.analysresultat && (
                      <div className="ml-3 border-l-2 border-border pl-2">
                        {linked.analysresultat.warning ? (
                          <div className="py-1 space-y-1">
                            <div className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                              <span>{linked.analysresultat.warning}</span>
                            </div>
                            <button
                              className="text-xs text-sgu-link hover:underline"
                              onClick={() => doFetchAnalysresultat(pendingAnalysIds.current)}
                            >
                              Ladda ändå
                            </button>
                          </div>
                        ) : linked.analysresultat.error ? (
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
