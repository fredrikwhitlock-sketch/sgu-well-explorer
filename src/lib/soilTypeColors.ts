// SGU Jordarter färgschema baserat på officiell kartvisare
// jg2 = jordartskod

export const SOIL_TYPE_COLORS: Record<number, { fill: string; stroke: string; name: string }> = {
  // Morän (100-serien)
  100: { fill: 'rgba(255, 204, 153, 0.7)', stroke: 'rgba(204, 153, 102, 1)', name: 'Morän' },
  101: { fill: 'rgba(255, 204, 153, 0.7)', stroke: 'rgba(204, 153, 102, 1)', name: 'Morän, sandig-moig' },
  102: { fill: 'rgba(255, 204, 153, 0.7)', stroke: 'rgba(204, 153, 102, 1)', name: 'Morän, sandig' },
  103: { fill: 'rgba(255, 230, 179, 0.7)', stroke: 'rgba(204, 179, 128, 1)', name: 'Morän, moig' },
  104: { fill: 'rgba(255, 204, 153, 0.7)', stroke: 'rgba(204, 153, 102, 1)', name: 'Morän, lerig' },
  105: { fill: 'rgba(255, 185, 130, 0.7)', stroke: 'rgba(204, 140, 90, 1)', name: 'Morän, siltig' },
  106: { fill: 'rgba(255, 170, 120, 0.7)', stroke: 'rgba(204, 130, 80, 1)', name: 'Morän, blockig' },
  107: { fill: 'rgba(240, 190, 140, 0.7)', stroke: 'rgba(190, 140, 90, 1)', name: 'Morän, ospec.' },
  
  // Isälvssediment / Grus (200-serien)
  200: { fill: 'rgba(255, 255, 0, 0.7)', stroke: 'rgba(200, 200, 0, 1)', name: 'Isälvssediment' },
  201: { fill: 'rgba(255, 255, 100, 0.7)', stroke: 'rgba(200, 200, 50, 1)', name: 'Grus' },
  202: { fill: 'rgba(255, 255, 100, 0.7)', stroke: 'rgba(200, 200, 50, 1)', name: 'Grus, sandig' },
  203: { fill: 'rgba(255, 255, 50, 0.7)', stroke: 'rgba(200, 200, 25, 1)', name: 'Grovgrus' },
  210: { fill: 'rgba(255, 255, 180, 0.7)', stroke: 'rgba(200, 200, 130, 1)', name: 'Isälvssediment, finkornigt' },
  
  // Sand (300-serien)
  300: { fill: 'rgba(255, 255, 153, 0.7)', stroke: 'rgba(200, 200, 100, 1)', name: 'Sand' },
  301: { fill: 'rgba(255, 255, 170, 0.7)', stroke: 'rgba(200, 200, 120, 1)', name: 'Sand, grovsand' },
  302: { fill: 'rgba(255, 255, 180, 0.7)', stroke: 'rgba(200, 200, 130, 1)', name: 'Sand, mellansand' },
  303: { fill: 'rgba(255, 255, 200, 0.7)', stroke: 'rgba(200, 200, 150, 1)', name: 'Sand, finsand' },
  310: { fill: 'rgba(255, 255, 220, 0.7)', stroke: 'rgba(200, 200, 170, 1)', name: 'Sandigt-siltigt sediment' },
  
  // Silt/Mo (400-serien)
  400: { fill: 'rgba(153, 204, 153, 0.7)', stroke: 'rgba(100, 153, 100, 1)', name: 'Silt' },
  401: { fill: 'rgba(153, 204, 153, 0.7)', stroke: 'rgba(100, 153, 100, 1)', name: 'Silt, grov' },
  402: { fill: 'rgba(170, 214, 170, 0.7)', stroke: 'rgba(120, 163, 120, 1)', name: 'Silt, fin' },
  410: { fill: 'rgba(180, 220, 180, 0.7)', stroke: 'rgba(130, 170, 130, 1)', name: 'Moränlera' },
  
  // Lera (500-serien)
  500: { fill: 'rgba(153, 204, 255, 0.7)', stroke: 'rgba(100, 153, 204, 1)', name: 'Lera' },
  501: { fill: 'rgba(120, 180, 240, 0.7)', stroke: 'rgba(80, 130, 190, 1)', name: 'Lera, varvig' },
  502: { fill: 'rgba(140, 190, 250, 0.7)', stroke: 'rgba(90, 140, 200, 1)', name: 'Lera, sulfidhaltig' },
  503: { fill: 'rgba(100, 160, 220, 0.7)', stroke: 'rgba(60, 110, 170, 1)', name: 'Glaciallera' },
  504: { fill: 'rgba(170, 210, 255, 0.7)', stroke: 'rgba(120, 160, 205, 1)', name: 'Postglacial lera' },
  510: { fill: 'rgba(130, 175, 230, 0.7)', stroke: 'rgba(80, 125, 180, 1)', name: 'Siltlera' },
  
  // Organiska jordarter / Torv (600-serien)
  600: { fill: 'rgba(153, 102, 51, 0.7)', stroke: 'rgba(100, 60, 30, 1)', name: 'Torv' },
  601: { fill: 'rgba(165, 115, 60, 0.7)', stroke: 'rgba(115, 75, 35, 1)', name: 'Torv, odlad' },
  602: { fill: 'rgba(140, 90, 45, 0.7)', stroke: 'rgba(90, 50, 25, 1)', name: 'Torv, högmosse' },
  603: { fill: 'rgba(175, 125, 70, 0.7)', stroke: 'rgba(125, 85, 40, 1)', name: 'Torv, lågmosse' },
  610: { fill: 'rgba(130, 80, 40, 0.7)', stroke: 'rgba(80, 40, 20, 1)', name: 'Gyttja' },
  611: { fill: 'rgba(140, 90, 50, 0.7)', stroke: 'rgba(90, 50, 30, 1)', name: 'Gyttjelera' },
  620: { fill: 'rgba(120, 70, 35, 0.7)', stroke: 'rgba(70, 35, 15, 1)', name: 'Dy' },
  
  // Berg (700-serien)
  700: { fill: 'rgba(255, 153, 153, 0.7)', stroke: 'rgba(204, 102, 102, 1)', name: 'Berg' },
  701: { fill: 'rgba(255, 120, 120, 0.7)', stroke: 'rgba(204, 80, 80, 1)', name: 'Berg i dagen' },
  702: { fill: 'rgba(255, 180, 180, 0.7)', stroke: 'rgba(204, 130, 130, 1)', name: 'Berg, tunt jordtäcke' },
  710: { fill: 'rgba(255, 140, 140, 0.7)', stroke: 'rgba(204, 90, 90, 1)', name: 'Urberg' },
  
  // Fyllning (800-serien)
  800: { fill: 'rgba(204, 102, 204, 0.7)', stroke: 'rgba(153, 51, 153, 1)', name: 'Fyllning' },
  801: { fill: 'rgba(214, 112, 214, 0.7)', stroke: 'rgba(163, 61, 163, 1)', name: 'Fyllning, anlagd mark' },
  
  // Vatten (900-serien)
  900: { fill: 'rgba(102, 178, 255, 0.5)', stroke: 'rgba(51, 127, 204, 1)', name: 'Vatten' },
  901: { fill: 'rgba(102, 178, 255, 0.5)', stroke: 'rgba(51, 127, 204, 1)', name: 'Sjö' },
  902: { fill: 'rgba(102, 178, 255, 0.5)', stroke: 'rgba(51, 127, 204, 1)', name: 'Vattendrag' },
  
  // Oklassificerat (0 eller 999)
  0: { fill: 'rgba(200, 200, 200, 0.5)', stroke: 'rgba(150, 150, 150, 1)', name: 'Oklassificerat' },
  999: { fill: 'rgba(200, 200, 200, 0.5)', stroke: 'rgba(150, 150, 150, 1)', name: 'Oklassificerat' },
};

// Fallback color for unknown soil types
export const DEFAULT_SOIL_COLOR = { 
  fill: 'rgba(180, 180, 180, 0.5)', 
  stroke: 'rgba(130, 130, 130, 1)', 
  name: 'Okänd jordart' 
};

export const getSoilTypeColor = (jg2: number): { fill: string; stroke: string; name: string } => {
  // Try exact match first
  if (SOIL_TYPE_COLORS[jg2]) {
    return SOIL_TYPE_COLORS[jg2];
  }
  
  // Try to match by hundred (e.g., 150 -> 100 for morän)
  const baseCode = Math.floor(jg2 / 100) * 100;
  if (SOIL_TYPE_COLORS[baseCode]) {
    return { ...SOIL_TYPE_COLORS[baseCode], name: `Jordart ${jg2}` };
  }
  
  return DEFAULT_SOIL_COLOR;
};

// Get main soil type categories for legend
export const SOIL_TYPE_CATEGORIES = [
  { code: 100, name: 'Morän', fill: 'rgba(255, 204, 153, 0.7)', stroke: 'rgba(204, 153, 102, 1)' },
  { code: 200, name: 'Isälvssediment/Grus', fill: 'rgba(255, 255, 0, 0.7)', stroke: 'rgba(200, 200, 0, 1)' },
  { code: 300, name: 'Sand', fill: 'rgba(255, 255, 153, 0.7)', stroke: 'rgba(200, 200, 100, 1)' },
  { code: 400, name: 'Silt', fill: 'rgba(153, 204, 153, 0.7)', stroke: 'rgba(100, 153, 100, 1)' },
  { code: 500, name: 'Lera', fill: 'rgba(153, 204, 255, 0.7)', stroke: 'rgba(100, 153, 204, 1)' },
  { code: 600, name: 'Torv/Organiskt', fill: 'rgba(153, 102, 51, 0.7)', stroke: 'rgba(100, 60, 30, 1)' },
  { code: 700, name: 'Berg', fill: 'rgba(255, 153, 153, 0.7)', stroke: 'rgba(204, 102, 102, 1)' },
  { code: 800, name: 'Fyllning', fill: 'rgba(204, 102, 204, 0.7)', stroke: 'rgba(153, 51, 153, 1)' },
  { code: 900, name: 'Vatten', fill: 'rgba(102, 178, 255, 0.5)', stroke: 'rgba(51, 127, 204, 1)' },
];
