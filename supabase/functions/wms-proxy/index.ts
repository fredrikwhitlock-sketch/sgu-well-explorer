import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Only allow trusted WMS hosts
    const allowedHosts = ['resource.sgu.se', 'maps3.sgu.se', 'api.sgu.se', 'image.discomap.eea.europa.eu'];
    const targetUrl = new URL(baseUrl);

    if (!allowedHosts.some((host) => targetUrl.hostname.includes(host))) {
      return new Response(
        JSON.stringify({ error: 'URL not allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Forward all other query parameters to the WMS service
    const wmsParams = new URLSearchParams();
    for (const [key, value] of requestUrl.searchParams.entries()) {
      if (key !== 'url') {
        wmsParams.append(key, value);
      }
    }

    // Construct full WMS URL
    const fullWmsUrl = `${baseUrl}?${wmsParams.toString()}`;
    console.log(`Proxying WMS request to: ${fullWmsUrl}`);

    const response = await fetch(fullWmsUrl, {
      headers: {
        'Accept': 'application/json, image/png, image/jpeg, image/gif, */*',
        'User-Agent': 'SGU-Well-Explorer/1.0',
      },
    });

    if (!response.ok) {
      console.error(`WMS request failed with status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return new Response(
        JSON.stringify({ error: `WMS request failed: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentType = response.headers.get('Content-Type') || 'image/png';
    const imageData = await response.arrayBuffer();

    return new Response(imageData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: unknown) {
    console.error('Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Proxy error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
