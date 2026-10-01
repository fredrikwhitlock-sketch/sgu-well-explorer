import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { escapeCSV, downloadBlob } from "@/lib/utils";

/** Flattens nested Lantmäteriet properties to dotted keys for CSV. */
function flatten(obj: any, prefix = "", out: Record<string, unknown> = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
  }
  return out;
}

export const LmAddressFetcher = ({ bbox }: { bbox: [number, number, number, number] }) => {
  const [loading, setLoading] = useState(false);
  const [features, setFeatures] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAddresses = async () => {
    setLoading(true); setError(null); setFeatures(null);
    const [minX, minY, maxX, maxY] = bbox;
    const polygon = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]];
    const { data, error } = await supabase.functions.invoke("lm-adresser", { body: { polygon } });
    setLoading(false);
    if (error) {
      let msg = "Kunde inte hämta adresser.";
      try { const b = await (error as any).context?.json(); if (b?.message) msg = b.message; } catch { /* ignore */ }
      setError(msg); return;
    }
    setFeatures(data?.features ?? []);
  };

  const today = new Date().toISOString().slice(0, 10);
  const downloadCSV = () => {
    if (!features?.length) return;
    const rows = features.map(f => flatten(f.properties));
    const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
    const csv = [keys.join(";"), ...rows.map(r => keys.map(k => escapeCSV(r[k])).join(";"))].join("\n");
    downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), `adresser_polygon_${today}.csv`);
  };
  const downloadGeoJSON = () => {
    if (!features?.length) return;
    downloadBlob(new Blob([JSON.stringify({ type: "FeatureCollection", features })], { type: "application/geo+json" }), `adresser_polygon_${today}.geojson`);
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-foreground">Adresser (Lantmäteriet)</p>
      <Button variant="outline" size="sm" className="w-full" onClick={fetchAddresses} disabled={loading}>
        {loading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <MapPin className="w-3 h-3 mr-2" />}
        Hämta adresser
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {features && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p>{features.length.toLocaleString("sv-SE")} adresser</p>
          {features.length > 0 && (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={downloadCSV}>CSV</Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={downloadGeoJSON}>GeoJSON</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
