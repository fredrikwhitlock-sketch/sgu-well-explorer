import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import proj4 from "proj4";

interface SearchControlProps {
  onSearchResult: (coordinates: [number, number], zoom?: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface Suggestion {
  text: string;
  e: number;
  n: number;
}

const LM_PROXY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lm-address`;

proj4.defs("EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

const toMercator = (lon: number, lat: number): [number, number] => [
  lon * 20037508.34 / 180,
  Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180,
];

const swerefToMercator = (e: number, n: number): [number, number] => {
  const [lon, lat] = proj4("EPSG:3006", "EPSG:4326", [e, n]);
  return toMercator(lon, lat);
};

// Extract a readable label and SWEREF coordinates from a LM address feature
function parseFeature(f: any): Suggestion | null {
  const coords = f.geometry?.coordinates;
  if (!coords) return null;
  const [e, n] = coords;
  const p = f.properties ?? {};
  // Try common property paths for address text
  const text =
    p.adresstext ??
    p.adress?.adresstext ??
    p.adress?.adresser?.[0]?.adresstext ??
    p.beteckning ??
    p.kortadress ??
    `E ${Math.round(e)}, N ${Math.round(n)}`;
  return { text, e, n };
}

export const SearchControl = ({ onSearchResult, isOpen, onClose }: SearchControlProps) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect coordinate input — skip autocomplete for these
  const isCoordinate = (s: string) => {
    const nums = s.replace(/[NEne°,]/g, ' ').trim().match(/-?\d+\.?\d*/g);
    return nums?.length === 2;
  };

  // Autocomplete via LM API
  const fetchSuggestions = async (q: string) => {
    if (q.length < 3 || isCoordinate(q)) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`${LM_PROXY}?path=/referens/fritext&adress=${encodeURIComponent(q)}&maxHits=6`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const features: any[] = data.features ?? [];
      setSuggestions(features.map(parseFeature).filter((s): s is Suggestion => s !== null));
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const navigateTo = (e: number, n: number, label: string) => {
    onSearchResult(swerefToMercator(e, n), 14);
    toast.success(`Hittade: ${label}`);
    setShowSuggestions(false);
    onClose();
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) { toast.error("Ange en söksträng"); return; }

    // Coordinate detection
    const numTokens = q.replace(/[NEne°,]/g, ' ').trim().match(/-?\d+\.?\d*/g);
    if (numTokens?.length === 2) {
      const num1 = parseFloat(numTokens[0]);
      const num2 = parseFloat(numTokens[1]);
      if (num1 > 1_000_000) {
        const [lon, lat] = proj4("EPSG:3006", "EPSG:4326", [num2, num1]);
        onSearchResult(toMercator(lon, lat), 14);
        toast.success(`SWEREF 99 TM: N ${Math.round(num1)}, E ${Math.round(num2)}`);
        onClose(); return;
      }
      if (num1 >= -90 && num1 <= 90 && num2 >= -180 && num2 <= 180) {
        onSearchResult(toMercator(num2, num1), 14);
        toast.success(`WGS84: ${num1.toFixed(5)}°N, ${num2.toFixed(5)}°E`);
        onClose(); return;
      }
    }

    // Use first suggestion if available
    if (suggestions.length > 0) {
      navigateTo(suggestions[0].e, suggestions[0].n, suggestions[0].text);
      return;
    }

    // Fetch directly
    setLoading(true);
    try {
      const res = await fetch(`${LM_PROXY}?path=/referens/fritext&adress=${encodeURIComponent(q)}&maxHits=1`);
      if (res.ok) {
        const data = await res.json();
        const f = data.features?.[0];
        const s = f ? parseFeature(f) : null;
        if (s) { navigateTo(s.e, s.n, s.text); return; }
      }
    } catch { /* fall through to Nominatim */ }

    // Fallback: Nominatim
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=se&limit=1&accept-language=sv`,
        { headers: { 'Accept': 'application/json' } }
      );
      const data = await res.json();
      if (!data.length) { toast.error("Platsen hittades inte"); return; }
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      onSearchResult(toMercator(lon, lat), 14);
      toast.success(`Hittade: ${data[0].display_name.split(',').slice(0, 2).join(', ')}`);
      onClose();
    } catch {
      toast.error("Sökningen misslyckades");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="absolute inset-0 z-20 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      )}
      <div
        className={`absolute top-0 right-0 h-full w-80 max-w-[calc(100vw-3.5rem)] bg-card/98 backdrop-blur-sm shadow-2xl border-l border-border z-30 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="bg-sgu-maroon text-white px-4 py-3 flex items-center gap-2 shrink-0">
          <Search className="w-5 h-5" />
          <h3 className="font-semibold flex-1">Sök plats</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Sök på adress, ortnamn eller koordinat (WGS84 / SWEREF 99 TM)
          </p>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            {loading && <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground z-10" />}
            <Input
              ref={inputRef}
              type="text"
              placeholder="Adress, plats eller koordinat..."
              value={query}
              onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
              onKeyDown={e => { if (e.key === "Enter") handleSearch(); if (e.key === "Escape") setShowSuggestions(false); }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className="pl-8 pr-8 h-10 text-sm"
              autoFocus={isOpen}
            />
            {query && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
                onClick={() => { setQuery(""); setSuggestions([]); setShowSuggestions(false); }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors border-b border-border last:border-0 truncate"
                    onClick={() => navigateTo(s.e, s.n, s.text)}
                  >
                    {s.text}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button onClick={handleSearch} disabled={loading} className="w-full h-10">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Söker…</> : "Sök"}
          </Button>

          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
            <p className="font-medium text-foreground">Exempel:</p>
            <p>Drottninggatan 1, Uppsala</p>
            <p>59.8586, 17.6389 <span className="text-muted-foreground">(WGS84)</span></p>
            <p>6638870 657890 <span className="text-muted-foreground">(SWEREF)</span></p>
          </div>
        </div>
      </div>
    </>
  );
};
