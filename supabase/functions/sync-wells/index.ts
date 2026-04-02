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
      .update({ status: "syncing", last_synced_at: new Date().toISOString() })
      .eq("id", "wells");

    const SGU_API_BASE =
      "https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items";
    const BATCH_SIZE = 1000;
    let totalInserted = 0;
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
        .map((f: any) => ({
          brunnsid: String(f.properties.brunnsid),
          obsplatsid: f.properties.obsplatsid ? String(f.properties.obsplatsid) : null,
          properties: f.properties,
          lon: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
        }));

      if (rows.length > 0) {
        const CHUNK_SIZE = 500;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const chunk = rows.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase
            .from("wells_cache")
            .upsert(chunk, { onConflict: "brunnsid", ignoreDuplicates: true });
          if (error) console.error(`Upsert error:`, error);
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

    const status = hasMore ? "partial" : "complete";
    await supabase
      .from("sync_status")
      .update({
        status,
        total_records: count || 0,
        last_synced_at: new Date().toISOString(),
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
