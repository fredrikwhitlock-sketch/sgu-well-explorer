import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SGU_BASE =
  "https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/stationer/items";
const LIMIT = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    await supabase
      .from("sync_status")
      .update({ status: "syncing", last_synced_at: new Date().toISOString() })
      .eq("id", "obs_stationer");

    let url: string | null = `${SGU_BASE}?f=json&limit=${LIMIT}`;
    let totalInserted = 0;
    let safety = 0;

    while (url && safety < 100) {
      safety++;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`SGU stationer error: ${res.status}`);
      const data = await res.json();
      const features: any[] = data.features ?? [];

      const rows = features
        .filter((f) => f.geometry?.coordinates && f.properties?.platsbeteckning)
        .map((f) => {
          const p = f.properties ?? {};
          return {
            platsbeteckning: String(p.platsbeteckning),
            stationsnamn: p.stationsnamn ?? p.namn ?? null,
            jordart_tx: p.jordart_tx ?? p.jordart ?? null,
            akvifer: p.akvifer ?? null,
            lon: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          };
        });

      if (rows.length > 0) {
        const { error } = await supabase
          .from("obs_stationer")
          .upsert(rows, { onConflict: "platsbeteckning" });
        if (error) console.error("Upsert error:", error);
        else totalInserted += rows.length;
      }

      const next = (data.links ?? []).find((l: any) => l.rel === "next");
      url = next?.href ?? null;
    }

    const { count } = await supabase
      .from("obs_stationer")
      .select("*", { count: "exact", head: true });

    await supabase
      .from("sync_status")
      .update({ status: "complete", total_records: count ?? 0, last_synced_at: new Date().toISOString() })
      .eq("id", "obs_stationer");

    return new Response(
      JSON.stringify({ success: true, inserted: totalInserted, totalInDb: count }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sync-obs-stationer error:", err);
    await supabase.from("sync_status").update({ status: "error" }).eq("id", "obs_stationer");
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
