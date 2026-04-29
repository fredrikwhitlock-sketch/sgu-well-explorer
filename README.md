# SGU Well Explorer – Grundvattenutforskaren

An interactive map application for exploring Swedish groundwater data from [SGU (Sveriges geologiska undersökning)](https://www.sgu.se/). Click anywhere on the map to get a detailed groundwater analysis report, or draw a polygon to bulk-export data from an area.

## Features

### Groundwater Analysis Report
Click any point on the map to open a three-column analysis panel:

**Column 1 – Coordinates & Interpretation**
- WGS84 and SWEREF99TM coordinates
- Soil type and soil depth (10×10 m raster)
- Aquifer type interpretation

**Column 2 – Grundvattentillgång (Availability)**
- Nearby observed groundwater level stations (within 50 km), matched to selected date ±7 days
- Inline time-series charts per station, expandable to a larger draggable popup on desktop
- SGU-HYPE fill-degree for small and large aquifers (percentile + situation)
- Calibrated depth-to-groundwater estimate with quartile range
- Nearby groundwater reservoirs (grundvattenmagasin)
- Closest wells (brunnar) sorted by distance, with capacity and depth

**Column 3 – Grundvattenkvalitet (Quality)**
- Nearest groundwater chemistry station (SGU monitoring network), latest values classified against SGU assessment criteria (class 1–5)
- Mann-Kendall trend analysis per parameter
- Geochemical background (markgeokemi) from SGU's geochemical atlas
- AI-powered analysis button (requires Supabase + Claude backend)

### Map Layers
Toggleable layers via the layer panel:
- **SGU:** Wells (brunnar), springs (källor), groundwater reservoirs, observed level stations, quality monitoring stations, soil types, aquifer polygons, water bodies
- **SGU-HYPE:** Fill-degree and groundwater situation for small/large aquifers, coloured by area
- **Lantmäteriet:** Topographic map, ortho imagery, property boundaries
- **Copernicus Land Service:** Land cover
- **Jorddjupsmodell:** Soil depth observations, maps, bedrock fracture zones

### Polygon Data Tool
Draw a polygon on the map to fetch and export all data within the area:
- **Data sources:** Brunnar, källor, grundvattenmagasin, GV-nivåstationer, GV-kvalitet (provplatser)
- **Linked data:** Nivåobservationer (time series) and analysresultat (lab results) fetched by station ID
- **Export formats:** CSV, GeoJSON, and **GeoPackage** (all layers bundled into one `.gpkg` file)

## Technology Stack

| Purpose | Library |
|---|---|
| Map | [OpenLayers](https://openlayers.org/) |
| UI components | [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/) |
| Charts | [Recharts](https://recharts.org/) |
| GeoPackage export | [sql.js](https://sql.js.org/) (SQLite WASM) |
| Projections | [proj4](https://proj4js.org/) |
| Backend / AI | [Supabase](https://supabase.com/) |
| Framework | React + TypeScript + Vite |

## Data Sources

All data is fetched live from public APIs — no API keys required for map or data functions:

| Source | API |
|---|---|
| SGU OGC Features (brunnar, källor, magasin, nivåer, kvalitet) | `api.sgu.se/oppnadata/…/ogc/features/v1` |
| SGU-HYPE groundwater model | `api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/…` |
| SGU Markgeokemi | `apps.sgu.se/markgeokemi/…` |
| Lantmäteriet WMS | `minkarta.lantmateriet.se/…` |
| Copernicus Land Service WMS | `image.discomap.eea.europa.eu/…` |

## Getting Started

Requirements: Node.js ≥ 18 and npm.

```sh
# Clone the repo
git clone https://github.com/fredrikwhitlock-sketch/sgu-well-explorer.git
cd sgu-well-explorer

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app runs at `http://localhost:8080`.

### Environment Variables (optional)

Only needed for the AI analysis feature. Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
```

All map and data functions work without these.

## Build

```sh
npm run build       # production build → dist/
npm run preview     # preview the production build locally
```
