# SGU Well Explorer – Grundvattenutforskaren

An interactive map application for exploring Swedish groundwater data from [SGU (Sveriges geologiska undersökning)](https://www.sgu.se/). Click anywhere on the map to get a detailed groundwater analysis report, or draw a polygon to bulk-export data from an area.

## Features

### Groundwater Analysis Report
Click any point on the map to open a three-column analysis panel:

**Column 1 – Coordinates & Interpretation**
- WGS84 and SWEREF99TM coordinates
- Soil type and soil depth (10×10 m raster)
- Aquifer type interpretation (jord/berg, large/small)
- Groundwater reservoir (grundvattenmagasin) and sub-area (delområde) information
- Nearby dug wells (brunnar) sorted by distance, with capacity and depth

**Column 2 – Grundvattentillgång (Availability)**
- Nearby observed groundwater level stations (within 50 km), matched to selected date ±7 days
- Inline time-series charts per station, expandable to a draggable popup
- SGU-HYPE fill-degree (fyllnadsgrad) for **both** small and large aquifers (percentile + situation)
- **Pastas-style transfer model**: HYPE fill-degree is convolved with an exponential impulse-response kernel and regressed against observed levels (80/20 chronological validation split, optional annual harmonics). The calibrated model fills gaps in sparse level records and extends into the full HYPE record.
- Calibrated depth-to-groundwater estimate with quartile range

**Column 3 – Grundvattenkvalitet (Quality)**
- Nearest groundwater chemistry stations (SGU monitoring network), latest values classified against SGU assessment criteria (class 1–5)
- Mann-Kendall trend analysis per parameter with seasonality diagnostics
- **Chemistry transfer model**: the same Pastas-style machinery as the level model, fitted per hydrogeochemical parameter class:
  - *Dilution-driven* (Cl, Na, conductivity, SO₄): fast response, log space
  - *Weathering/residence-time* (alkalinity, Ca, Mg, Si, pH): slow response
  - *Redox-sensitive* (Fe, Mn, NH₄, NO₃): fast response, log space; correctly rejected by the validation gate when local chemistry is regime-controlled rather than level-controlled
- Censored (`<DL`) values handled at DL/2 in calibration, full DL in display
- Geochemical background (markgeokemi) from SGU's regional geochemical atlas
- AI-powered analysis via the geo-chat function (requires optional Supabase backend)

### Printable Well Protocol
Navigate to `/protokoll?id=<brunnsid>` to render a print-ready SGU-style well protocol for any well in the national database, including the full layer log (lagerföljd) fetched from the SGU OGC API.

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
| Framework | React + TypeScript + Vite |

## Data Sources

All data is fetched live from public APIs — no API keys required for the map or core data functions:

| Source | API |
|---|---|
| SGU OGC Features (brunnar, källor, magasin, nivåer, kvalitet) | `api.sgu.se/oppnadata/…/ogc/features/v1` |
| SGU-HYPE groundwater model | `api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/…` |
| SGU Markgeokemi (regional geochemical atlas) | `api.sgu.se/oppnadata/markgeokemi-regional/ogc/features/v1` |
| Lantmäteriet WMS (via wms-proxy) | `minkarta.lantmateriet.se/…` |
| Copernicus Land Service WMS (via wms-proxy) | `image.discomap.eea.europa.eu/…` |
| Elevation (EU-DEM 25 m) | `api.opentopodata.org/v1/eudem25m` |
| Street-level imagery | [Mapillary](https://www.mapillary.com/) (requires API token) |

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

Create a `.env` file in the project root. All variables are optional — the map and all SGU data functions work without them.

```env
# Required only for the AI geo-chat feature (Supabase geo-chat edge function)
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>

# Cloudflare Worker for cached groundwater level time series (optional speed-up)
VITE_CF_WORKER_URL=https://<your-worker>.workers.dev

# Mapillary API token for street-level imagery layer
VITE_MAPILLARY_TOKEN=<your-token>
```

## Build

```sh
npm run build       # production build → dist/
npm run preview     # preview the production build locally
```
