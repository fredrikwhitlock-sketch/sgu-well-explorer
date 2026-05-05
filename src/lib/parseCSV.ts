/** Minimal RFC 4180 CSV row parser – handles quoted fields with embedded commas/newlines. */
export function parseCSVRow(line: string): string[] {
  const cols: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cols.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

export interface AnalysRow {
  parameternamn: string;
  datum: string;
  matvardetal: string;
  enhet: string;
}

export function parseAnalysCSV(text: string): AnalysRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]);
  const paramIdx = headers.indexOf('parameternamn');
  const datumIdx = headers.indexOf('provtagningsdatum');
  const valIdx   = headers.indexOf('matvardetal');
  const enhetIdx = headers.findIndex(h => h === 'enhet_tx' || h === 'enhet');
  if (paramIdx < 0 || datumIdx < 0 || valIdx < 0) return [];
  return lines.slice(1).flatMap(line => {
    if (!line.trim()) return [];
    const cols = parseCSVRow(line);
    const p = cols[paramIdx]?.trim() ?? '';
    const d = (cols[datumIdx] ?? '').slice(0, 10);
    if (!p || !d) return [];
    return [{ parameternamn: p, datum: d, matvardetal: cols[valIdx]?.trim() ?? '', enhet: cols[enhetIdx]?.trim() ?? '' }];
  });
}

/** Fetch all analysresultat for a station as CSV (single request, no pagination). */
export async function fetchAnalysCSV(
  nationelltProvplatsid: string | number,
  signal?: AbortSignal,
): Promise<AnalysRow[]> {
  const url =
    `https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/analysresultat/items` +
    `?f=text/csv&limit=10000&filter=nationellt_provplatsid=${nationelltProvplatsid}&filter-lang=cql2-text&sortby=provtagningsdatum`;
  const resp = await fetch(url, signal ? { signal } : undefined);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return parseAnalysCSV(await resp.text());
}
