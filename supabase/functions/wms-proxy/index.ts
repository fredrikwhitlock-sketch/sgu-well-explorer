import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestUrl = new URL(req.url);
    const baseUrl = requestUrl.searchParams.get('url');

    if (!baseUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowedHosts = ['resource.sgu.se', 'maps3.sgu.se', 'api.sgu.se', 'image.discomap.eea.europa.eu', 'api.opentopodata.org'];
    const targetUrl = new URL(baseUrl);

    if (!allowedHosts.some((host) => targetUrl.hostname === host || targetUrl.hostname.endsWith('.' + host))) {
      return new Response(
        JSON.stringify({ error: 'URL not allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Merge extra query params from this request (everything except 'url') into
    // the target URL, preserving any params already embedded in baseUrl.
    const full = new URL(baseUrl);
    for (const [key, value] of requestUrl.searchParams.entries()) {
      if (key !== 'url') full.searchParams.append(key, value);
    }
    const fullWmsUrl = full.toString();
    console.log(`Proxying request to: ${fullWmsUrl}`);

    const response = await fetch(fullWmsUrl, {
      headers: {
        'Accept': 'application/json, image/png, image/jpeg, image/gif, */*',
        'User-Agent': 'SGU-Well-Explorer/1.0',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Upstream failed ${response.status}: ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Upstream failed: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const body = await response.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Proxy error:', msg);
    return new Response(
      JSON.stringify({ error: 'Proxy error', details: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
