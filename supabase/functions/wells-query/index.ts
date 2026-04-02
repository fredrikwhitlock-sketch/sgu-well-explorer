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

  try {
    const url = new URL(req.url);
    const minLon = parseFloat(url.searchParams.get("minLon") || "0");
    const maxLon = parseFloat(url.searchParams.get("maxLon") || "0");
    const minLat = parseFloat(url.searchParams.get("minLat") || "0");
    const maxLat = parseFloat(url.searchParams.get("maxLat") || "0");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50000"), 50000);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("wells_cache")
      .select("brunnsid, obsplatsid, properties, lon, lat")
      .gte("lon", minLon)
      .lte("lon", maxLon)
      .gte("lat", minLat)
      .lte("lat", maxLat)
      .limit(limit);

    if (error) throw error;

    return new Response(JSON.stringify({ wells: data || [], count: data?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
