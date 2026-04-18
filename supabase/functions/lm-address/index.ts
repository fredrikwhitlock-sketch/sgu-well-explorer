import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const LM_BASE = 'https://api.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const username = Deno.env.get('LM_USERNAME');
  const password = Deno.env.get('LM_PASSWORD');
  if (!username || !password) {
    return new Response(
      JSON.stringify({ error: 'LM credentials not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const requestUrl = new URL(req.url);
  const path = requestUrl.searchParams.get('path') ?? '/referens/fritext';
  const params = new URLSearchParams();
  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (key !== 'path') params.append(key, value);
  }

  const targetUrl = `${LM_BASE}${path}?${params.toString()}`;
  const auth = btoa(`${username}:${password}`);

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
