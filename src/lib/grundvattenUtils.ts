export function mercatorToWGS84(x: number, y: number): [number, number] {
  const lon = (x / 20037508.34) * 180;
  const lat = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
  return [lon, lat];
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function fetchWithTimeout(url: string, ms: number, signal: AbortSignal): Promise<Response> {
  const tc = new AbortController();
  const timer = setTimeout(() => tc.abort(), ms);
  signal.addEventListener('abort', () => { clearTimeout(timer); tc.abort(); }, { once: true });
  return fetch(url, { signal: tc.signal }).finally(() => clearTimeout(timer));
}

export function findNearest(features: any[], lat: number, lon: number) {
  let best: { dist: number; p: any; artal?: number; provtyp?: string } | null = null;
  for (const f of features) {
    const coords = f.geometry?.coordinates;
    if (!coords) continue;
    const d = haversineKm(lat, lon, coords[1], coords[0]);
    if (!best || d < best.dist) best = { dist: d, p: f.properties ?? {}, artal: f.properties?.prov_artal, provtyp: f.properties?.provtyp };
  }
  return best;
}
