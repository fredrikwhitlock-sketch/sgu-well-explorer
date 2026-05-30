import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, Database, Layers, Activity,
  Waves, BarChart3, Zap, ArrowLeft, Clock,
} from "lucide-react";
import { toast } from "sonner";

/* ── Data sources ─────────────────────────────────────────── */
const SOURCES = [
  {
    id: "wells",
    label: "Brunnar",
    description: "SGU brunnsarkivet",
    icon: Database,
    edgeFunction: "sync-wells",
    maxRecords: 825_000,
    color: "from-blue-900/40 to-blue-950/60 border-blue-800/50",
    accentColor: "bg-blue-500",
    textColor: "text-blue-400",
  },
  {
    id: "well_lager",
    label: "Borrhålslager",
    description: "Geologiska lagerföljder",
    icon: Layers,
    edgeFunction: "sync-well-lager",
    maxRecords: 1_050_000,
    color: "from-indigo-900/40 to-indigo-950/60 border-indigo-800/50",
    accentColor: "bg-indigo-500",
    textColor: "text-indigo-400",
  },
  {
    id: "obs_stationer",
    label: "Obs. stationer",
    description: "Grundvattennivåstationer",
    icon: Activity,
    edgeFunction: "sync-obs-stationer",
    maxRecords: 1_600,
    color: "from-purple-900/40 to-purple-950/60 border-purple-800/50",
    accentColor: "bg-purple-500",
    textColor: "text-purple-400",
  },
  {
    id: "obs_nivaer",
    label: "Grundvattennivåer",
    description: "Observerade mätningar",
    icon: Waves,
    edgeFunction: "sync-obs-nivaer",
    maxRecords: 50_000,
    color: "from-cyan-900/40 to-cyan-950/60 border-cyan-800/50",
    accentColor: "bg-cyan-500",
    textColor: "text-cyan-400",
  },
  {
    id: "hype_nivaer",
    label: "HYPE-modellen",
    description: "SGU-HYPE fyllnadsgrad per avrinningsområde",
    icon: BarChart3,
    edgeFunction: null,
    maxRecords: null,
    color: "from-emerald-900/40 to-emerald-950/60 border-emerald-800/50",
    accentColor: "bg-emerald-500",
    textColor: "text-emerald-400",
  },
] as const;

/* ── Types ───────────────────────────────────────────────── */
interface SyncRow {
  id: string;
  status: string;
  total_records: number | null;
  last_synced_at: string | null;
  started_at: string | null;
}

/* ── Helpers ─────────────────────────────────────────────── */
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ??
  "https://ivambqyukfbkezijjmho.supabase.co";

async function triggerEdgeFunction(slug: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startIndex: 0 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const STATUS_DOT: Record<string, string> = {
  complete: "bg-green-400",
  syncing:  "bg-yellow-400 animate-pulse",
  partial:  "bg-blue-400 animate-pulse",
  pending:  "bg-gray-500",
  error:    "bg-red-500 animate-pulse",
};

const STATUS_LABEL: Record<string, string> = {
  complete: "Klar",
  syncing:  "Synkar…",
  partial:  "Delvis",
  pending:  "Väntar",
  error:    "Fel",
};

function relativeTime(iso: string | null) {
  if (!iso) return null;
  try {
    return formatDistanceToNow(new Date(iso), { locale: sv, addSuffix: true });
  } catch {
    return null;
  }
}

/* ── Component ───────────────────────────────────────────── */
export default function SyncDashboard() {
  const [rows, setRows] = useState<Record<string, SyncRow>>({});
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [pendingSync, setPendingSync] = useState<Set<string>>(new Set());

  /* Initial fetch + Realtime subscription */
  useEffect(() => {
    supabase
      .from("sync_status")
      .select("*")
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, SyncRow> = {};
        data.forEach((r) => (map[r.id] = r as SyncRow));
        setRows(map);
      });

    const channel = supabase
      .channel("sync_status_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sync_status" },
        (payload) => {
          const row = payload.new as SyncRow;
          setRows((prev) => ({ ...prev, [row.id]: row }));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  /* Trigger one edge function */
  const handleSync = async (src: typeof SOURCES[number]) => {
    if (!src.edgeFunction) return;
    setBusy((prev) => new Set(prev).add(src.id));
    setPendingSync((prev) => new Set(prev).add(src.id));
    try {
      await triggerEdgeFunction(src.edgeFunction);
      toast.success(`Synk startad: ${src.label}`);
    } catch (err) {
      toast.error(`Kunde inte starta synk: ${src.label}`);
    } finally {
      setBusy((prev) => { const s = new Set(prev); s.delete(src.id); return s; });
      setPendingSync((prev) => { const s = new Set(prev); s.delete(src.id); return s; });
    }
  };

  /* Trigger all simultaneously */
  const handleSyncAll = () => {
    const syncable = SOURCES.filter((s) => s.edgeFunction);
    toast.info(`Startar ${syncable.length} synkar simultant…`);
    syncable.forEach((s) => handleSync(s));
  };

  const anyActive =
    pendingSync.size > 0 ||
    Object.values(rows).some((r) => r.status === "syncing" || r.status === "partial");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mb-2 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> Kartvisaren
            </Link>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              SGU Data Sync Dashboard
              {anyActive && (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  Live
                </span>
              )}
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">
              Realtidsstatus via Supabase Realtime · UNLOGGED cache-tabeller
            </p>
          </div>

          <Button
            onClick={handleSyncAll}
            className="bg-blue-600 hover:bg-blue-500 gap-2 shrink-0"
            disabled={anyActive}
          >
            <Zap className="w-4 h-4" />
            Synka alla simultant
          </Button>
        </div>
      </div>

      {/* Cards */}
      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SOURCES.map((src) => {
          const row = rows[src.id];
          const status = row?.status ?? "pending";
          const isActive = status === "syncing" || status === "partial";
          const isBusy = busy.has(src.id);
          const Icon = src.icon;

          const progress =
            src.maxRecords && row?.total_records
              ? Math.min(100, Math.round((row.total_records / src.maxRecords) * 100))
              : null;

          return (
            <div
              key={src.id}
              className={`relative rounded-xl border bg-gradient-to-br p-5 flex flex-col gap-4 transition-all duration-300 ${src.color} ${isActive ? "shadow-lg shadow-black/40" : ""}`}
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-black/30 rounded-lg">
                    <Icon className={`w-5 h-5 ${src.textColor}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-white">{src.label}</h3>
                    <p className="text-xs text-gray-400">{src.description}</p>
                  </div>
                </div>
                {/* Status indicator */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status] ?? "bg-gray-500"}`} />
                  <span className="text-xs text-gray-400 tabular-nums">
                    {STATUS_LABEL[status] ?? status}
                  </span>
                </div>
              </div>

              {/* Record count */}
              <div>
                <div className="text-3xl font-bold tabular-nums tracking-tight text-white">
                  {row?.total_records != null
                    ? row.total_records.toLocaleString("sv-SE")
                    : "—"}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">rader i databasen</div>
              </div>

              {/* Progress bar */}
              {progress !== null && (
                <div className="space-y-1">
                  <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-700 ${src.accentColor}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 text-right">{progress}%</div>
                </div>
              )}

              {/* Timestamps */}
              <div className="flex flex-col gap-1 text-xs text-gray-500">
                {row?.started_at && isActive && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Startad {relativeTime(row.started_at)}
                  </div>
                )}
                {row?.last_synced_at && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Klar {relativeTime(row.last_synced_at)}
                  </div>
                )}
                {!row?.last_synced_at && !isActive && (
                  <span>Aldrig synkad</span>
                )}
              </div>

              {/* Sync button */}
              {src.edgeFunction && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSync(src)}
                  disabled={isBusy || isActive}
                  className="border-white/10 hover:border-white/25 hover:bg-white/5 text-gray-300 gap-1.5 text-xs"
                >
                  <RefreshCw className={`w-3 h-3 ${isActive ? "animate-spin" : ""}`} />
                  {isActive ? "Synkar…" : "Synka nu"}
                </Button>
              )}

              {/* Active glow overlay */}
              {isActive && (
                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-yellow-400/20 pointer-events-none" />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto px-6 pb-8 text-xs text-gray-700 flex flex-wrap gap-x-6 gap-y-1">
        <span>Supabase Realtime (postgres_changes)</span>
        <span>UNLOGGED cache-tabeller – ingen WAL</span>
        <span>Delta-sync ej tillgängligt (SGU datetime-filter saknas)</span>
        <span>Upsert med uppdatering – ändrad SGU-data reflekteras vid ny synk</span>
      </div>
    </div>
  );
}
