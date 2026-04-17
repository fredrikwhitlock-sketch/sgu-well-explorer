// Color scale for magasinsdelomraden by uttagsmöjlighet (SGU J1-legend).

export interface AquiferStyleEntry {
  label: string;
  fill: string;
  stroke: string;
  match: (uttag: string) => boolean;
}

export const AQUIFER_LEGEND: AquiferStyleEntry[] = [
  { label: '<1 l/s',     fill: 'rgba(205,120,75,0.5)',   stroke: 'rgba(180,90,40,0.85)',    match: u => u.includes('<1') },
  { label: '1–5 l/s',    fill: 'rgba(240,190,170,0.5)',  stroke: 'rgba(210,140,110,0.85)',  match: u => u.startsWith('1') },
  { label: '5–25 l/s',   fill: 'rgba(175,230,240,0.5)',  stroke: 'rgba(100,180,210,0.85)',  match: u => u.startsWith('5') },
  { label: '25–125 l/s', fill: 'rgba(80,195,230,0.5)',   stroke: 'rgba(0,160,200,0.85)',    match: u => u.startsWith('25') },
  { label: '>125 l/s',   fill: 'rgba(50,80,200,0.55)',   stroke: 'rgba(30,60,180,0.9)',     match: u => u.startsWith('>') },
];

export const AQUIFER_UNKNOWN: AquiferStyleEntry = {
  label: 'Okänd',
  fill: 'rgba(160,160,160,0.35)',
  stroke: 'rgba(120,120,120,0.7)',
  match: () => true,
};

export const getAquiferColorFor = (uttag: string) =>
  AQUIFER_LEGEND.find(e => e.match(uttag.toLowerCase())) ?? AQUIFER_UNKNOWN;
