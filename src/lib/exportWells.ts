import Feature from "ol/Feature";

// Well attributes from the SGU product description
const WELL_ATTRIBUTES = [
  { key: 'brunnsid', label: 'Brunnsid' },
  { key: 'obsplatsid', label: 'Observationsplats-ID' },
  { key: 'n', label: 'N (SWEREF99 TM)' },
  { key: 'e', label: 'E (SWEREF99 TM)' },
  { key: 'posvardering', label: 'Positionsvärdering' },
  { key: 'posvardering_kod', label: 'Positionsvärdering kod' },
  { key: 'kommunkod', label: 'Kommunkod' },
  { key: 'kommunnamn', label: 'Kommunnamn' },
  { key: 'fastighet', label: 'Fastighet' },
  { key: 'ort', label: 'Ort' },
  { key: 'lage_specifikt', label: 'Läge specifikt' },
  { key: 'borrdatum', label: 'Borrdatum' },
  { key: 'tecken_vattenmangd', label: 'Tecken vattenmängd' },
  { key: 'kapacitet', label: 'Kapacitet (l/h)' },
  { key: 'tecken_niva', label: 'Tecken nivå' },
  { key: 'grundvattenniva', label: 'Grundvattennivå (m)' },
  { key: 'nivadatum', label: 'Nivådatum' },
  { key: 'bottendiam', label: 'Bottendiameter (mm)' },
  { key: 'totaldjup', label: 'Totaldjup (m)' },
  { key: 'tecken_jorddjup', label: 'Tecken jorddjup' },
  { key: 'jorddjup', label: 'Jorddjup (m)' },
  { key: 'rorborrning_till', label: 'Rörborrning till (m)' },
  { key: 'stalror_till', label: 'Stålrör till (m)' },
  { key: 'plastror_till', label: 'Plaströr till (m)' },
  { key: 'tatning_kod', label: 'Tätning kod' },
  { key: 'tatning', label: 'Tätning' },
  { key: 'anvandning_kod', label: 'Användning kod' },
  { key: 'anvandning', label: 'Användning' },
  { key: 'gradborrning', label: 'Gradborrning' },
  { key: 'allman_anmarkning', label: 'Allmän anmärkning' },
  { key: 'grundvattenanmarkning', label: 'Grundvattenanmärkning' },
];

function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (stringValue.includes(';') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function downloadCSV(csvContent: string, filename: string): void {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportWellsToCSV(features: Feature[]): void {
  if (features.length === 0) {
    throw new Error('Inga brunnar att exportera');
  }

  const headers = WELL_ATTRIBUTES.map(attr => attr.label);
  const headerRow = headers.join(';');

  const dataRows = features.map(feature => {
    const properties = feature.getProperties();
    return WELL_ATTRIBUTES.map(attr => escapeCSVValue(properties[attr.key])).join(';');
  });

  const csvContent = [headerRow, ...dataRows].join('\n');
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csvContent, `brunnar_export_${date}.csv`);
}

/**
 * Generic CSV export for any vector layer features.
 * Automatically discovers all properties from loaded features.
 */
export function exportFeaturesToCSV(features: Feature[], filename: string): void {
  if (features.length === 0) {
    throw new Error('Inga objekt att exportera');
  }

  // Collect all unique property keys across all features, excluding 'geometry'
  const allKeys = new Set<string>();
  features.forEach(feature => {
    const props = feature.getProperties();
    Object.keys(props).forEach(key => {
      if (key !== 'geometry') {
        allKeys.add(key);
      }
    });
  });

  const keys = Array.from(allKeys);
  const headerRow = keys.join(';');

  const dataRows = features.map(feature => {
    const properties = feature.getProperties();
    return keys.map(key => escapeCSVValue(properties[key])).join(';');
  });

  const csvContent = [headerRow, ...dataRows].join('\n');
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csvContent, `${filename}_export_${date}.csv`);
}

export function getWellCount(features: Feature[]): number {
  return features.length;
}
