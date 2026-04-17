// SGU Jordarter färgschema
// https://maps3.sgu.se/geoserver/jord/wms

// Konvertera hex till rgba
const hexToRgba = (hex: string, alpha: number = 0.8): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const hexToRgbaStroke = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)}, 1)`;
};

// Färgschema:
//   Berg           = röd          (fast mark)
//   Morän          = ljusblå      (dominerande i norra Sverige)
//   Sand (generisk) = orange      (sorterat material)
//   Postglacial sand = mörkare orange
//   Isälvssediment  = grön        (bra akvifer)
//   Lera/Silt       = gul         (täckande lager)
//   Torv            = mörkbrun    (organiskt)
const SGU_COLORS = {
  moran: '#80b8e8',           // Morän - ljusblå
  moranLera: '#5090c8',       // Moränlera - blå (finkornigare)
  isalvs: '#2db82d',          // Isälvssediment - klargrönt
  sand: '#f0a030',             // Sand (generisk) - orange
  postglacialSand: '#c86010', // Postglacial sand - mörkare orange
  lera: '#f5d400',            // Lera/Silt - gul (täckande lager)
  svamsediment: '#c89860',    // Svämsediment - tan/brun
  alvsediment: '#d8a840',     // Älvsediment - amberfärgad
  berg: '#cc2020',            // Berg/Urberg - röd
  sedimentartBerg: '#b03030', // Sedimentärt berg - mörkröd
  diabas: '#5050c0',          // Fanerozoisk diabas - blålila (distinkt bergart)
  fyllning: '#c060b0',        // Fyllning - lila/magenta (artificiellt)
  vatten: '#3090c8',          // Vatten - klar blå
  torv: '#8a6040',            // Torv/Mosse - mörkbrun (organiskt)
  karrtorv: '#a07060',        // Kärrtorv - rödbrun
  gyttja: '#b09060',          // Gyttja - olivbrun
  kalktuff: '#c09858',        // Kalktuff - orange-brun
  blockmark: '#909090',       // Blockmark - grå
  oklassat: '#d8e8f0',        // Oklassat - ljusblå
};

export const SOIL_TYPE_COLORS: Record<number, { fill: string; stroke: string; name: string }> = {
  // Torv och organiska jordarter (1-serie)
  1: { fill: hexToRgba(SGU_COLORS.torv), stroke: hexToRgbaStroke(SGU_COLORS.torv), name: 'Mossetorv' },
  5: { fill: hexToRgba(SGU_COLORS.karrtorv), stroke: hexToRgbaStroke(SGU_COLORS.karrtorv), name: 'Kärrtorv' },
  6: { fill: hexToRgba(SGU_COLORS.gyttja), stroke: hexToRgbaStroke(SGU_COLORS.gyttja), name: 'Gyttja' },
  9: { fill: hexToRgba(SGU_COLORS.svamsediment), stroke: hexToRgbaStroke(SGU_COLORS.svamsediment), name: 'Svämsediment, ler-silt' },
  10: { fill: hexToRgba(SGU_COLORS.svamsediment), stroke: hexToRgbaStroke(SGU_COLORS.svamsediment), name: 'Svämsediment, sand' },
  13: { fill: hexToRgba(SGU_COLORS.postglacialSand), stroke: hexToRgbaStroke(SGU_COLORS.postglacialSand), name: 'Flygsand' },
  16: { fill: hexToRgba(SGU_COLORS.gyttja), stroke: hexToRgbaStroke(SGU_COLORS.gyttja), name: 'Gyttjelera (eller lergyttja)' },
  17: { fill: hexToRgba(SGU_COLORS.lera), stroke: hexToRgbaStroke(SGU_COLORS.lera), name: 'Postglacial lera' },
  19: { fill: hexToRgba(SGU_COLORS.lera), stroke: hexToRgbaStroke(SGU_COLORS.lera), name: 'Postglacial finlera' },
  21: { fill: hexToRgba(SGU_COLORS.sand), stroke: hexToRgbaStroke(SGU_COLORS.sand), name: 'Sand' },
  22: { fill: hexToRgba(SGU_COLORS.lera), stroke: hexToRgbaStroke(SGU_COLORS.lera), name: 'Postglacial grovlera' },
  24: { fill: hexToRgba(SGU_COLORS.lera), stroke: hexToRgbaStroke(SGU_COLORS.lera), name: 'Postglacial silt' },
  26: { fill: hexToRgba(SGU_COLORS.sand), stroke: hexToRgbaStroke(SGU_COLORS.sand), name: 'Finsand' },
  28: { fill: hexToRgba(SGU_COLORS.postglacialSand), stroke: hexToRgbaStroke(SGU_COLORS.postglacialSand), name: 'Postglacial finsand' },
  31: { fill: hexToRgba(SGU_COLORS.postglacialSand), stroke: hexToRgbaStroke(SGU_COLORS.postglacialSand), name: 'Postglacial sand' },
  33: { fill: hexToRgba(SGU_COLORS.sand), stroke: hexToRgbaStroke(SGU_COLORS.sand), name: 'Svallsediment, grus' },
  34: { fill: hexToRgba(SGU_COLORS.sand), stroke: hexToRgbaStroke(SGU_COLORS.sand), name: 'Klapper' },
  36: { fill: hexToRgba(SGU_COLORS.gyttja), stroke: hexToRgbaStroke(SGU_COLORS.gyttja), name: 'Skaljord' },
  39: { fill: hexToRgba(SGU_COLORS.lera), stroke: hexToRgbaStroke(SGU_COLORS.lera), name: 'Silt' },
  40: { fill: hexToRgba(SGU_COLORS.lera), stroke: hexToRgbaStroke(SGU_COLORS.lera), name: 'Glacial lera' },
  43: { fill: hexToRgba(SGU_COLORS.lera), stroke: hexToRgbaStroke(SGU_COLORS.lera), name: 'Glacial finlera' },
  44: { fill: hexToRgba(SGU_COLORS.lera), stroke: hexToRgbaStroke(SGU_COLORS.lera), name: 'Glacial grovlera' },
  48: { fill: hexToRgba(SGU_COLORS.lera), stroke: hexToRgbaStroke(SGU_COLORS.lera), name: 'Glacial silt' },
  
  // Isälvssediment (50-serie)
  50: { fill: hexToRgba(SGU_COLORS.isalvs), stroke: hexToRgbaStroke(SGU_COLORS.isalvs), name: 'Isälvssediment' },
  51: { fill: hexToRgba(SGU_COLORS.isalvs), stroke: hexToRgbaStroke(SGU_COLORS.isalvs), name: 'Isälvssediment, sten-block' },
  55: { fill: hexToRgba(SGU_COLORS.isalvs), stroke: hexToRgbaStroke(SGU_COLORS.isalvs), name: 'Isälvssediment, sand' },
  57: { fill: hexToRgba(SGU_COLORS.isalvs), stroke: hexToRgbaStroke(SGU_COLORS.isalvs), name: 'Isälvssediment, grus' },
  62: { fill: hexToRgba(SGU_COLORS.svamsediment), stroke: hexToRgbaStroke(SGU_COLORS.svamsediment), name: 'Svämsediment, grus' },
  
  // Blockmark och liknande (66, 75, 79, 81, 82)
  66: { fill: hexToRgba(SGU_COLORS.blockmark), stroke: hexToRgbaStroke(SGU_COLORS.blockmark), name: 'Blockmark' },
  75: { fill: hexToRgba(SGU_COLORS.torv), stroke: hexToRgbaStroke(SGU_COLORS.torv), name: 'Torv' },
  79: { fill: hexToRgba(SGU_COLORS.postglacialSand), stroke: hexToRgbaStroke(SGU_COLORS.postglacialSand), name: 'Postglacial grovsilt-finsand' },
  81: { fill: hexToRgba(SGU_COLORS.blockmark), stroke: hexToRgbaStroke(SGU_COLORS.blockmark), name: 'Talus (rasmassor)' },
  82: { fill: hexToRgba(SGU_COLORS.blockmark), stroke: hexToRgbaStroke(SGU_COLORS.blockmark), name: 'Vittringsjord' },
  84: { fill: hexToRgba(SGU_COLORS.postglacialSand), stroke: hexToRgbaStroke(SGU_COLORS.postglacialSand), name: 'Postglacial sand-grus' },
  85: { fill: hexToRgba(SGU_COLORS.lera), stroke: hexToRgbaStroke(SGU_COLORS.lera), name: 'Lera' },
  86: { fill: hexToRgba(SGU_COLORS.lera), stroke: hexToRgbaStroke(SGU_COLORS.lera), name: 'Lera-silt' },
  87: { fill: hexToRgba(SGU_COLORS.sand), stroke: hexToRgbaStroke(SGU_COLORS.sand), name: 'Sand-grus' },
  89: { fill: hexToRgba(SGU_COLORS.sand), stroke: hexToRgbaStroke(SGU_COLORS.sand), name: 'Svallsediment, grus-block' },
  
  // Oklassat och diverse (90-92)
  90: { fill: hexToRgba(SGU_COLORS.oklassat, 0.3), stroke: 'rgba(150, 150, 150, 1)', name: 'Oklassat område' },
  91: { fill: hexToRgba(SGU_COLORS.vatten, 0.5), stroke: hexToRgbaStroke(SGU_COLORS.vatten), name: 'Vatten' },
  92: { fill: hexToRgba(SGU_COLORS.blockmark), stroke: hexToRgbaStroke(SGU_COLORS.blockmark), name: 'Sten-block' },
  
  // Morän (93-101)
  93: { fill: hexToRgba(SGU_COLORS.moran), stroke: hexToRgbaStroke(SGU_COLORS.moran), name: 'Grusig morän' },
  95: { fill: hexToRgba(SGU_COLORS.moran), stroke: hexToRgbaStroke(SGU_COLORS.moran), name: 'Sandig morän' },
  97: { fill: hexToRgba(SGU_COLORS.moran), stroke: hexToRgbaStroke(SGU_COLORS.moran), name: 'Sandig-siltig morän' },
  98: { fill: hexToRgba(SGU_COLORS.moranLera), stroke: hexToRgbaStroke(SGU_COLORS.moranLera), name: 'Morängrovlera' },
  99: { fill: hexToRgba(SGU_COLORS.moranLera), stroke: hexToRgbaStroke(SGU_COLORS.moranLera), name: 'Moränfinlera' },
  100: { fill: hexToRgba(SGU_COLORS.moran), stroke: hexToRgbaStroke(SGU_COLORS.moran), name: 'Morän' },
  101: { fill: hexToRgba(SGU_COLORS.moranLera), stroke: hexToRgbaStroke(SGU_COLORS.moranLera), name: 'Moränlera' },
  
  // Fyllning (200, 322)
  200: { fill: hexToRgba(SGU_COLORS.fyllning), stroke: hexToRgbaStroke(SGU_COLORS.fyllning), name: 'Fyllning' },
  322: { fill: hexToRgba(SGU_COLORS.fyllning), stroke: hexToRgbaStroke(SGU_COLORS.fyllning), name: 'Fyllning, rödfyr' },
  
  // Berg (823, 849, 850, 888, 890)
  823: { fill: hexToRgba(SGU_COLORS.diabas), stroke: hexToRgbaStroke(SGU_COLORS.diabas), name: 'Fanerozoisk diabas' },
  849: { fill: hexToRgba(SGU_COLORS.sedimentartBerg), stroke: hexToRgbaStroke(SGU_COLORS.sedimentartBerg), name: 'Rösberg' },
  850: { fill: hexToRgba(SGU_COLORS.sedimentartBerg), stroke: hexToRgbaStroke(SGU_COLORS.sedimentartBerg), name: 'Sedimentärt berg' },
  888: { fill: hexToRgba(SGU_COLORS.berg), stroke: hexToRgbaStroke(SGU_COLORS.berg), name: 'Berg' },
  890: { fill: hexToRgba(SGU_COLORS.berg), stroke: hexToRgbaStroke(SGU_COLORS.berg), name: 'Urberg' },
  
  // Kalktuff (1950)
  1950: { fill: hexToRgba(SGU_COLORS.kalktuff), stroke: hexToRgbaStroke(SGU_COLORS.kalktuff), name: 'Kalktuff' },
  
  // Bleke och kalkgyttja (2306)
  2306: { fill: hexToRgba(SGU_COLORS.gyttja), stroke: hexToRgbaStroke(SGU_COLORS.gyttja), name: 'Bleke och kalkgyttja' },
  
  // Slamströmssediment och flytjord (2368, 2372)
  2368: { fill: hexToRgba(SGU_COLORS.svamsediment), stroke: hexToRgbaStroke(SGU_COLORS.svamsediment), name: 'Slamströmssediment, ler-block' },
  2372: { fill: hexToRgba(SGU_COLORS.svamsediment), stroke: hexToRgbaStroke(SGU_COLORS.svamsediment), name: 'Flytjord eller skredjord' },
  
  // Tidvis under vatten (8114, 8175, 8186)
  8114: { fill: hexToRgba(SGU_COLORS.oklassat, 0.3), stroke: 'rgba(150, 150, 150, 1)', name: 'Oklassat område, tidvis under vatten' },
  8175: { fill: hexToRgba(SGU_COLORS.torv), stroke: hexToRgbaStroke(SGU_COLORS.torv), name: 'Torv, tidvis under vatten' },
  8186: { fill: hexToRgba(SGU_COLORS.lera), stroke: hexToRgbaStroke(SGU_COLORS.lera), name: 'Lera-silt, tidvis under vatten' },
  
  // Älvsediment (8800-serie)
  8802: { fill: hexToRgba(SGU_COLORS.alvsediment), stroke: hexToRgbaStroke(SGU_COLORS.alvsediment), name: 'Älvsediment, grovsilt-finsand' },
  8803: { fill: hexToRgba(SGU_COLORS.alvsediment), stroke: hexToRgbaStroke(SGU_COLORS.alvsediment), name: 'Älvsediment, grus' },
  8804: { fill: hexToRgba(SGU_COLORS.alvsediment), stroke: hexToRgbaStroke(SGU_COLORS.alvsediment), name: 'Älvsediment' },
  8806: { fill: hexToRgba(SGU_COLORS.alvsediment), stroke: hexToRgbaStroke(SGU_COLORS.alvsediment), name: 'Älvsediment, ler-silt' },
  8809: { fill: hexToRgba(SGU_COLORS.alvsediment), stroke: hexToRgbaStroke(SGU_COLORS.alvsediment), name: 'Älvsediment, sand' },
  8814: { fill: hexToRgba(SGU_COLORS.alvsediment), stroke: hexToRgbaStroke(SGU_COLORS.alvsediment), name: 'Älvsediment sten-block' },
  
  // Vittringsjord (8919, 8950)
  8919: { fill: hexToRgba(SGU_COLORS.berg), stroke: hexToRgbaStroke(SGU_COLORS.berg), name: 'Vittringsjord, ler-silt' },
  8937: { fill: hexToRgba(SGU_COLORS.svamsediment), stroke: hexToRgbaStroke(SGU_COLORS.svamsediment), name: 'Svämsediment' },
  8950: { fill: hexToRgba(SGU_COLORS.berg), stroke: hexToRgbaStroke(SGU_COLORS.berg), name: 'Vittringsjord, sand-grus' },
  
  // Svämsediment (9010)
  9010: { fill: hexToRgba(SGU_COLORS.svamsediment), stroke: hexToRgbaStroke(SGU_COLORS.svamsediment), name: 'Svämsediment, grovsilt-finsand' },
  
  // Glacial grovsilt-finsand (9060)
  9060: { fill: hexToRgba(SGU_COLORS.lera), stroke: hexToRgbaStroke(SGU_COLORS.lera), name: 'Glacial grovsilt-finsand' },
  
  // Morän omväxlande (9147)
  9147: { fill: hexToRgba(SGU_COLORS.moran), stroke: hexToRgbaStroke(SGU_COLORS.moran), name: 'Morän omväxlande med sorterade sediment' },
  
  // Glaciär (9191)
  9191: { fill: hexToRgba('#FFFFFF', 0.5), stroke: 'rgba(180, 180, 180, 1)', name: 'Glaciär' },
  
  // Morän sand (9299)
  9299: { fill: hexToRgba(SGU_COLORS.moran), stroke: hexToRgbaStroke(SGU_COLORS.moran), name: 'Morän, sand' },
  
  // Morän sten-block (9336)
  9336: { fill: hexToRgba(SGU_COLORS.moran), stroke: hexToRgbaStroke(SGU_COLORS.moran), name: 'Morän, sten-block' },
  
  // Moränlera eller lerig morän (9792, 9794)
  9792: { fill: hexToRgba(SGU_COLORS.moranLera), stroke: hexToRgbaStroke(SGU_COLORS.moranLera), name: 'Moränlera eller lerig morän' },
  9794: { fill: hexToRgba(SGU_COLORS.moranLera), stroke: hexToRgbaStroke(SGU_COLORS.moranLera), name: 'Lerig morän' },
  
  // Skålla av berg (9950, 9960)
  9950: { fill: hexToRgba(SGU_COLORS.berg), stroke: hexToRgbaStroke(SGU_COLORS.berg), name: 'Skålla av sedimentärt berg' },
  9960: { fill: hexToRgba(SGU_COLORS.berg), stroke: hexToRgbaStroke(SGU_COLORS.berg), name: 'Skålla av sandsten' },
};

// Legend entries for LayerPanel
export const SOIL_LEGEND = [
  { label: 'Berg',             fill: hexToRgba(SGU_COLORS.berg),            stroke: hexToRgbaStroke(SGU_COLORS.berg) },
  { label: 'Sedimentärt berg', fill: hexToRgba(SGU_COLORS.sedimentartBerg), stroke: hexToRgbaStroke(SGU_COLORS.sedimentartBerg) },
  { label: 'Morän',            fill: hexToRgba(SGU_COLORS.moran),           stroke: hexToRgbaStroke(SGU_COLORS.moran) },
  { label: 'Moränlera',        fill: hexToRgba(SGU_COLORS.moranLera),       stroke: hexToRgbaStroke(SGU_COLORS.moranLera) },
  { label: 'Isälvssediment',   fill: hexToRgba(SGU_COLORS.isalvs),          stroke: hexToRgbaStroke(SGU_COLORS.isalvs) },
  { label: 'Sand',             fill: hexToRgba(SGU_COLORS.sand),            stroke: hexToRgbaStroke(SGU_COLORS.sand) },
  { label: 'Postglacial sand', fill: hexToRgba(SGU_COLORS.postglacialSand), stroke: hexToRgbaStroke(SGU_COLORS.postglacialSand) },
  { label: 'Lera/Silt',        fill: hexToRgba(SGU_COLORS.lera),            stroke: hexToRgbaStroke(SGU_COLORS.lera) },
  { label: 'Torv/Gyttja',      fill: hexToRgba(SGU_COLORS.torv),            stroke: hexToRgbaStroke(SGU_COLORS.torv) },
  { label: 'Vatten',           fill: hexToRgba(SGU_COLORS.vatten, 0.5),     stroke: hexToRgbaStroke(SGU_COLORS.vatten) },
];

// Fallback color for unknown soil types
export const DEFAULT_SOIL_COLOR = { 
  fill: 'rgba(200, 200, 200, 0.5)', 
  stroke: 'rgba(150, 150, 150, 1)', 
  name: 'Okänd jordart' 
};

// Kategorisering baserad på SGU:s officiella grupper
const CATEGORY_COLORS: Record<string, string> = {
  moran: SGU_COLORS.moran,
  moranLera: SGU_COLORS.moranLera,
  isalvs: SGU_COLORS.isalvs,
  sand: SGU_COLORS.sand,
  postglacialSand: SGU_COLORS.postglacialSand,
  lera: SGU_COLORS.lera,
  svamsediment: SGU_COLORS.svamsediment,
  alvsediment: SGU_COLORS.alvsediment,
  torv: SGU_COLORS.torv,
  berg: SGU_COLORS.berg,
  fyllning: SGU_COLORS.fyllning,
  vatten: SGU_COLORS.vatten,
};

export const getSoilTypeColor = (jg2: number): { fill: string; stroke: string; name: string } => {
  // Try exact match first
  if (SOIL_TYPE_COLORS[jg2]) {
    return SOIL_TYPE_COLORS[jg2];
  }
  
  // Fallback baserat på kodens kategori
  // Morän: 93-101, 9147, 9299, 9336
  if ((jg2 >= 93 && jg2 <= 101) || jg2 === 9147 || jg2 === 9299 || jg2 === 9336) {
    return { fill: hexToRgba(SGU_COLORS.moran), stroke: hexToRgbaStroke(SGU_COLORS.moran), name: `Morän (${jg2})` };
  }
  
  // Isälvssediment: 50-59
  if (jg2 >= 50 && jg2 < 60) {
    return { fill: hexToRgba(SGU_COLORS.isalvs), stroke: hexToRgbaStroke(SGU_COLORS.isalvs), name: `Isälvssediment (${jg2})` };
  }
  
  // Lera/Silt: 17-48, 85-86
  if ((jg2 >= 17 && jg2 <= 48) || jg2 === 85 || jg2 === 86) {
    return { fill: hexToRgba(SGU_COLORS.lera), stroke: hexToRgbaStroke(SGU_COLORS.lera), name: `Lera/Silt (${jg2})` };
  }
  
  // Postglacial sand: 13, 21, 26, 28, 31, 33, 34, 79, 84, 87, 89
  if ([13, 21, 26, 28, 31, 33, 34, 79, 84, 87, 89].includes(jg2)) {
    return { fill: hexToRgba(SGU_COLORS.postglacialSand), stroke: hexToRgbaStroke(SGU_COLORS.postglacialSand), name: `Sand/Grus (${jg2})` };
  }
  
  // Torv: 1, 5, 75
  if ([1, 5, 75].includes(jg2) || (jg2 >= 8175 && jg2 <= 8176)) {
    return { fill: hexToRgba(SGU_COLORS.torv), stroke: hexToRgbaStroke(SGU_COLORS.torv), name: `Torv (${jg2})` };
  }
  
  // Gyttja: 6, 16
  if ([6, 16].includes(jg2)) {
    return { fill: hexToRgba(SGU_COLORS.gyttja), stroke: hexToRgbaStroke(SGU_COLORS.gyttja), name: `Gyttja (${jg2})` };
  }
  
  // Berg: 81, 82, 823, 849, 850, 888, 890
  if ([81, 82, 823, 849, 850, 888, 890].includes(jg2) || (jg2 >= 8919 && jg2 <= 8950) || jg2 >= 9950) {
    return { fill: hexToRgba(SGU_COLORS.berg), stroke: hexToRgbaStroke(SGU_COLORS.berg), name: `Berg (${jg2})` };
  }
  
  // Fyllning: 200-399
  if (jg2 >= 200 && jg2 < 400) {
    return { fill: hexToRgba(SGU_COLORS.fyllning), stroke: hexToRgbaStroke(SGU_COLORS.fyllning), name: `Fyllning (${jg2})` };
  }
  
  // Älvsediment: 8800-serie
  if (jg2 >= 8800 && jg2 < 8900) {
    return { fill: hexToRgba(SGU_COLORS.alvsediment), stroke: hexToRgbaStroke(SGU_COLORS.alvsediment), name: `Älvsediment (${jg2})` };
  }
  
  // Svämsediment: 9, 10, 62
  if ([9, 10, 62].includes(jg2) || (jg2 >= 8937 && jg2 <= 9010)) {
    return { fill: hexToRgba(SGU_COLORS.svamsediment), stroke: hexToRgbaStroke(SGU_COLORS.svamsediment), name: `Svämsediment (${jg2})` };
  }
  
  return DEFAULT_SOIL_COLOR;
};

// Officiella huvudkategorier för legend
export const SOIL_TYPE_CATEGORIES = [
  { code: 100, name: 'Morän', fill: hexToRgba(SGU_COLORS.moran), stroke: hexToRgbaStroke(SGU_COLORS.moran) },
  { code: 101, name: 'Moränlera', fill: hexToRgba(SGU_COLORS.moranLera), stroke: hexToRgbaStroke(SGU_COLORS.moranLera) },
  { code: 50, name: 'Isälvssediment', fill: hexToRgba(SGU_COLORS.isalvs), stroke: hexToRgbaStroke(SGU_COLORS.isalvs) },
  { code: 21, name: 'Postglacial sand', fill: hexToRgba(SGU_COLORS.postglacialSand), stroke: hexToRgbaStroke(SGU_COLORS.postglacialSand) },
  { code: 40, name: 'Lera/Silt', fill: hexToRgba(SGU_COLORS.lera), stroke: hexToRgbaStroke(SGU_COLORS.lera) },
  { code: 10, name: 'Svämsediment', fill: hexToRgba(SGU_COLORS.svamsediment), stroke: hexToRgbaStroke(SGU_COLORS.svamsediment) },
  { code: 8804, name: 'Älvsediment', fill: hexToRgba(SGU_COLORS.alvsediment), stroke: hexToRgbaStroke(SGU_COLORS.alvsediment) },
  { code: 75, name: 'Torv', fill: hexToRgba(SGU_COLORS.torv), stroke: hexToRgbaStroke(SGU_COLORS.torv) },
  { code: 6, name: 'Gyttja', fill: hexToRgba(SGU_COLORS.gyttja), stroke: hexToRgbaStroke(SGU_COLORS.gyttja) },
  { code: 888, name: 'Berg', fill: hexToRgba(SGU_COLORS.berg), stroke: hexToRgbaStroke(SGU_COLORS.berg) },
  { code: 850, name: 'Sedimentärt berg', fill: hexToRgba(SGU_COLORS.sedimentartBerg), stroke: hexToRgbaStroke(SGU_COLORS.sedimentartBerg) },
  { code: 200, name: 'Fyllning', fill: hexToRgba(SGU_COLORS.fyllning), stroke: hexToRgbaStroke(SGU_COLORS.fyllning) },
  { code: 91, name: 'Vatten', fill: hexToRgba(SGU_COLORS.vatten, 0.5), stroke: hexToRgbaStroke(SGU_COLORS.vatten) },
];
