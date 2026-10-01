import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Lantmäteriet Belägenhetsadress Direkt v4.2 — addresses within a polygon.
// Auth: OAuth2 client_credentials via LANTMATERIET_CONSUMER_KEY / _SECRET.
const BASE = 'https://api.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2'
const TOKEN_URL = 'https://apimanager.lantmateriet.se/oauth2/token'

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

async function getToken(key: string, secret: string) {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${key}:${secret}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!r.ok) throw new Error(`Token ${r.status}: ${await r.text()}`)
  return (await r.json()).access_token as string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const key = Deno.env.get('LANTMATERIET_CONSUMER_KEY')
    const secret = Deno.env.get('LANTMATERIET_CONSUMER_SECRET')
    if (!key || !secret) return json({ error: 'missing_key', message: 'Lantmäteriets API-nyckel är inte inlagd ännu.' }, 503)

    const body = await req.json().catch(() => null)
    const coords = body?.polygon // [[lon,lat],...] WGS84, closed ring
    if (!Array.isArray(coords) || coords.length < 4 || coords.length > 2000 ||
        !coords.every((p: unknown) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && isFinite(n)))) {
      return json({ error: 'invalid_polygon' }, 400)
    }

    const token = await getToken(key, secret)
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }

    // 1) References within geometry
    const refRes = await fetch(`${BASE}/referens/geometri?srid=4326`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ geometri: { type: 'Polygon', coordinates: [coords] } }),
    })
    if (!refRes.ok) return json({ error: 'lm_error', status: refRes.status, message: await refRes.text() }, 502)
    const refs: any[] = await refRes.json()
    const ids = refs.map((r) => r.objektidentitet ?? r).filter((x) => typeof x === 'string')

    // 2) Full objects, max 250 per request
    const features: any[] = []
    for (let i = 0; i < ids.length && i < 10000; i += 250) {
      const r = await fetch(`${BASE}/?includeData=total&srid=4326`, {
        method: 'POST', headers: auth, body: JSON.stringify(ids.slice(i, i + 250)),
      })
      if (!r.ok) return json({ error: 'lm_error', status: r.status, message: await r.text() }, 502)
      const fc = await r.json()
      features.push(...(fc.features ?? []))
    }
    return json({ type: 'FeatureCollection', features, total: ids.length })
  } catch (e) {
    return json({ error: 'internal', message: String(e) }, 500)
  }
})
