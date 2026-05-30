import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const startIndex = body.startIndex || 0;
    const maxPages = body.maxPages || 40; // ~40k per invocation to stay within timeout

    await supabase
      .from("sync_status")
      .update({ status: "syncing", started_at: new Date().toISOString() })
      .eq("id", "wells");

    const SGU_API_BASE =
      "https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items";
    const BATCH_SIZE = 1000;
    let totalInserted = 0;
    let failedChunks = 0;
    let currentIndex = startIndex;
    let hasMore = true;

    for (let page = 0; page < maxPages && hasMore; page++) {
      const url = `${SGU_API_BASE}?f=json&limit=${BATCH_SIZE}&startIndex=${currentIndex}`;
      console.log(`Fetching page ${page + 1} (startIndex=${currentIndex})`);

      const response = await fetch(url);
      if (!response.ok) throw new Error(`SGU API error: ${response.status}`);

      const data = await response.json();
      const features = data.features || [];

      if (features.length === 0) {
        hasMore = false;
        break;
      }

      const rows = features
        .filter((f: any) => f.geometry?.coordinates && f.properties?.brunnsid)
        .map((f: any) => {
          const p = f.properties;
          // Store only the properties actually used by the app (~25 fields)
          // to keep storage well under 500 MB for all ~820k wells.
          const slim = {
            brunnsid:              p.brunnsid,
            obsplatsid:            p.obsplatsid ?? null,
            ort:                   p.ort ?? null,
            kommunnamn:            p.kommunnamn ?? null,
            fastighet:             p.fastighet ?? null,
            borrdatum:             p.borrdatum ?? null,
            totaldjup:             p.totaldjup ?? null,
            jorddjup:              p.jorddjup ?? null,
            kapacitet:             p.kapacitet ?? null,
            tecken_vattenmangd:    p.tecken_vattenmangd ?? null,
            grundvattenniva:       p.grundvattenniva ?? null,
            tecken_niva:           p.tecken_niva ?? null,
            nivadatum:             p.nivadatum ?? null,
            bottendiam:            p.bottendiam ?? null,
            anvandning:            p.anvandning ?? null,
            anvandning_kod:        p.anvandning_kod ?? null,
            allman_anmarkning:     p.allman_anmarkning ?? null,
            grundvattenanmarkning: p.grundvattenanmarkning ?? null,
            posvardering:          p.posvardering ?? null,
            tatning_kod:           p.tatning_kod ?? null,
            rorborrning_till:      p.rorborrning_till ?? null,
            stalror_till:          p.stalror_till ?? null,
            plastror_till:         p.plastror_till ?? null,
            gradborrning:          p.gradborrning ?? null,
            lage_specifikt:        p.lage_specifikt ?? null,
          };
          return {
            brunnsid:  String(p.brunnsid),
            obsplatsid: p.obsplatsid ? String(p.obsplatsid) : null,
            properties: slim,
            lon: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          };
        });

      if (rows.length > 0) {
        // Deduplicate within the page – SGU occasionally returns duplicate brunnsid
        // in a single response; ON CONFLICT DO UPDATE aborts if the same PK appears twice.
        const seen = new Map<string, typeof rows[0]>();
        for (const r of rows) seen.set(r.brunnsid, r);
        const deduped = Array.from(seen.values());

        const CHUNK_SIZE = 500;
        for (let i = 0; i < deduped.length; i += CHUNK_SIZE) {
          const chunk = deduped.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase
            .from("wells_cache")
            .upsert(chunk, { onConflict: "brunnsid" });
          if (error) { console.error(`Upsert error:`, error); failedChunks++; }
          else totalInserted += chunk.length;
        }
      }

      currentIndex += BATCH_SIZE;
      hasMore = features.length === BATCH_SIZE;

      // Check for next page link as well
      if (data.links) {
        const nextLink = data.links.find((l: any) => l.rel === "next");
        if (!nextLink) hasMore = false;
      }
    }

    // Get total count from DB
    const { count } = await supabase
      .from("wells_cache")
      .select("*", { count: "exact", head: true });

    const status = failedChunks > 0 ? "error" : hasMore ? "partial" : "complete";
    await supabase
      .from("sync_status")
      .update({
        status,
        total_records: count || 0,
        // last_synced_at marks successful completion, not start
        last_synced_at: hasMore ? undefined : new Date().toISOString(),
      })
      .eq("id", "wells");

    return new Response(
      JSON.stringify({
        success: true,
        inserted: totalInserted,
        nextStartIndex: hasMore ? currentIndex : null,
        totalInDb: count,
        status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    await supabase
      .from("sync_status")
      .update({ status: "error" })
      .eq("id", "wells");
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
