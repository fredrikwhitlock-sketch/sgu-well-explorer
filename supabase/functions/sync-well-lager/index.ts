import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Paginates through the entire brunnar-lager collection using startIndex.
// Call with { startIndex: N } to resume; omit for a fresh start from 0.
// Returns nextStartIndex (null when done).

const SGU_BASE =
  "https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar-lager/items";
const LIMIT = 1000;
const MAX_PAGES = 50; // ~50k rows per invocation

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const startIndex: number = body.startIndex ?? 0;

    await supabase
      .from("sync_status")
      .update({ status: "syncing", last_synced_at: new Date().toISOString() })
      .eq("id", "well_lager");

    let currentIndex = startIndex;
    let totalInserted = 0;
    let hasMore = true;

    for (let page = 0; page < MAX_PAGES && hasMore; page++) {
      const url = `${SGU_BASE}?f=json&limit=${LIMIT}&startIndex=${currentIndex}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`SGU brunnar-lager error: ${res.status}`);
      const data = await res.json();
      const features: any[] = data.features ?? [];

      if (features.length === 0) { hasMore = false; break; }

      const rows = features
        .filter((f) => f.properties?.lagerid && f.properties?.obsplatsid)
        .map((f) => {
          const p = f.properties;
          return {
            lagerid:         String(p.lagerid),
            obsplatsid:      String(p.obsplatsid),
            lagernr:         Number(p.lagernr) || 0,
            djup_fran:       p.djup_fran != null ? Number(p.djup_fran) : null,
            djup_till:       p.djup_till != null ? Number(p.djup_till) : null,
            jordart_bergart: p.jordart_bergart ?? null,
            lageranmarkning: p.lageranmarkning ?? null,
          };
        });

      if (rows.length > 0) {
        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const { error } = await supabase
            .from("well_lager")
            .upsert(rows.slice(i, i + CHUNK), { onConflict: "lagerid", ignoreDuplicates: true });
          if (error) console.error("Upsert error:", error.message);
          else totalInserted += rows.slice(i, i + CHUNK).length;
        }
      }

      currentIndex += LIMIT;
      // Stop if we got fewer rows than the page size
      if (features.length < LIMIT) hasMore = false;
    }

    const { count } = await supabase
      .from("well_lager")
      .select("*", { count: "exact", head: true });

    const status = hasMore ? "partial" : "complete";
    await supabase
      .from("sync_status")
      .update({ status, total_records: count ?? 0, last_synced_at: new Date().toISOString() })
      .eq("id", "well_lager");

    return new Response(
      JSON.stringify({
        success: true,
        inserted: totalInserted,
        nextStartIndex: hasMore ? currentIndex : null,
        totalInDb: count,
        status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sync-well-lager error:", err);
    await supabase.from("sync_status").update({ status: "error" }).eq("id", "well_lager");
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
