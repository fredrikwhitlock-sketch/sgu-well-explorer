import { useEffect, useRef, useState, useCallback } from "react";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import VectorLayer from "ol/layer/Vector";
import VectorImageLayer from "ol/layer/VectorImage";
import OSM from "ol/source/OSM";
import ImageWMS from "ol/source/ImageWMS";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { register } from "ol/proj/proj4";
import proj4 from "proj4";
import { get as getProjection } from "ol/proj";
import { defaults as defaultControls } from "ol/control";
import { Style, Circle, Fill, Stroke, RegularShape } from "ol/style";
import Point from "ol/geom/Point";
import Polygon from "ol/geom/Polygon";
import Feature from "ol/Feature";
import Draw from "ol/interaction/Draw";
import { getArea } from "ol/sphere";
import "ol/ol.css";
import { LayerPanel } from "./LayerPanel";
import { CoordinateDisplay } from "./CoordinateDisplay";
import { WellPopup } from "./WellPopup";
import { SearchControl } from "./SearchControl";
import { GrundvattenRapport } from "./GrundvattenRapport";

import { ChartViewer } from "./ChartViewer";
import { PolygonFetcher } from "./PolygonFetcher";
import WmsLegend from "./WmsLegend";
import { AIChatPanel } from "./AIChatPanel";
import { Search, Locate, Layers, Droplets, PenLine } from "lucide-react";
import { toast } from "sonner";
import { getSoilTypeColor } from "@/lib/soilTypeColors";
import { getAquiferColorFor } from "@/lib/aquiferColors";
import { exportWellsToCSV, exportFeaturesToCSV } from "@/lib/exportWells";


interface ChartLocation {
  id: string;
  name: string;
  type: 'level' | 'quality';
  platsbeteckning?: string;
  provplatsid?: string;
}

// Define SWEREF99 TM projection
proj4.defs("EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
register(proj4);


export const MapView = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<OLMap | null>(null);
  const [sourcesVisible, setSourcesVisible] = useState(false);
  const [wellsVisible, setWellsVisible] = useState(false);
  const [aquifersVisible, setAquifersVisible] = useState(false);
  const [aquifersOpacity, setAquifersOpacity] = useState(0.5);
  const [soilTypesVisible, setSoilTypesVisible] = useState(false);
  const [soilTypesOpacity, setSoilTypesOpacity] = useState(0.7);
  // Lantmäteriet WMS layers
  const [topoWebbVisible, setTopoWebbVisible] = useState(true);
  const [ortofotoVisible, setOrtofotoVisible] = useState(false);
  const [terrangskuggningVisible, setTerrangskuggningVisible] = useState(false);
  const [terrangskuggningOpacity, setTerrangskuggningOpacity] = useState(0.5);
  // SGU WMS layers
  const [sguBerggrund1MVisible, setSguBerggrund1MVisible] = useState(false);
  const [sguBerggrund1MOpacity, setSguBerggrund1MOpacity] = useState(0.7);
  const [sguBerggrund50kVisible, setSguBerggrund50kVisible] = useState(false);
  const [sguBerggrund50kOpacity, setSguBerggrund50kOpacity] = useState(0.7);
  const [sguJordarter1MVisible, setSguJordarter1MVisible] = useState(false);
  const [sguJordarter1MOpacity, setSguJordarter1MOpacity] = useState(0.7);
  const [sguJordarter25kVisible, setSguJordarter25kVisible] = useState(false);
  const [sguJordarter25kOpacity, setSguJordarter25kOpacity] = useState(0.7);
  const [sguGvTillgangVisible, setSguGvTillgangVisible] = useState(false);
  const [sguGvTillgangOpacity, setSguGvTillgangOpacity] = useState(0.7);
  const [sguJorddjupVisible, setSguJorddjupVisible] = useState(false);
  const [sguJorddjupOpacity, setSguJorddjupOpacity] = useState(0.7);
  // Copernicus Land Service layers
  const [clcVisible, setClcVisible] = useState(false);
  const [clcOpacity, setClcOpacity] = useState(0.7);
  const [waterWetnessVisible, setWaterWetnessVisible] = useState(false);
  const [waterWetnessOpacity, setWaterWetnessOpacity] = useState(0.7);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<{ properties: Record<string, any>; type: 'source' | 'well' | 'aquifer' | 'waterBody' | 'gwLevelsObserved' | 'gwQuality' | 'soilType' | 'gvTillgang' | 'observation' | 'hypoArea' | 'jorddjupObs' | 'jorddjupKartor' | 'jorddjupSprick'; analysisResults?: any[] }[]>([]);
  const [selectedFeatureIndex, setSelectedFeatureIndex] = useState(0);
  const [loadingSources, setLoadingSources] = useState(false);
  const [loadingWells, setLoadingWells] = useState(false);
  const [loadingAquifers, setLoadingAquifers] = useState(false);
  const [loadingSoilTypes, setLoadingSoilTypes] = useState(false);
  const [sourcesLoaded, setSourcesLoaded] = useState(0);
  const [wellsLoaded, setWellsLoaded] = useState(0);
  const [aquifersLoaded, setAquifersLoaded] = useState(0);
  const [soilTypesLoaded, setSoilTypesLoaded] = useState(0);
  const [waterBodiesVisible, setWaterBodiesVisible] = useState(false);
  const [gwLevelsObservedVisible, setGwLevelsObservedVisible] = useState(false);
  const [gwQualityVisible, setGwQualityVisible] = useState(false);
  const [observationsVisible, setObservationsVisible] = useState(false);
  const [loadingWaterBodies, setLoadingWaterBodies] = useState(false);
  const [loadingGwLevelsObserved, setLoadingGwLevelsObserved] = useState(false);
  const [loadingGwQuality, setLoadingGwQuality] = useState(false);
  const [loadingObservations, setLoadingObservations] = useState(false);
  const [waterBodiesLoaded, setWaterBodiesLoaded] = useState(0);
  const [gwLevelsObservedLoaded, setGwLevelsObservedLoaded] = useState(0);
  const [gwQualityLoaded, setGwQualityLoaded] = useState(0);
  const [observationsLoaded, setObservationsLoaded] = useState(0);
  // Jorddjupsmodell layers
  const [jorddjupObsVisible, setJorddjupObsVisible] = useState(false);
  const [jorddjupKartorVisible, setJorddjupKartorVisible] = useState(false);
  const [jorddjupSprickVisible, setJorddjupSprickVisible] = useState(false);
  const [loadingJorddjupObs, setLoadingJorddjupObs] = useState(false);
  const [loadingJorddjupKartor, setLoadingJorddjupKartor] = useState(false);
  const [loadingJorddjupSprick, setLoadingJorddjupSprick] = useState(false);
  const [jorddjupObsLoaded, setJorddjupObsLoaded] = useState(0);
  const [jorddjupKartorLoaded, setJorddjupKartorLoaded] = useState(0);
  const [jorddjupSprickLoaded, setJorddjupSprickLoaded] = useState(0);
  const [hypoFyllnadSmaVisible, setHypoFyllnadSmaVisible] = useState(false);
  const [hypoFyllnadStoraVisible, setHypoFyllnadStoraVisible] = useState(false);
  const [hypoSitSmaVisible, setHypoSitSmaVisible] = useState(false);
  const [hypoSitStoraVisible, setHypoSitStoraVisible] = useState(false);
  const [loadingHypoAreas, setLoadingHypoAreas] = useState(false);
  const [hypoAreasLoaded, setHypoAreasLoaded] = useState(0);
  const [hypoAreasOpacity, setHypoAreasOpacity] = useState(0.7);
  const [hypoAreasDate, setHypoAreasDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 7) % 7)); // most recent Sunday
    return d.toISOString().split('T')[0];
  });
  const [chartOpen, setChartOpen] = useState(false);
  const [chartLocation, setChartLocation] = useState<ChartLocation | null>(null);
  const [chartLocations, setChartLocations] = useState<ChartLocation[]>([]);
  const [currentZoom, setCurrentZoom] = useState(11);
  const sourcesLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const wellsLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const aquifersLayerRef = useRef<VectorImageLayer<VectorSource> | null>(null);
  const soilTypesLayerRef = useRef<VectorImageLayer<VectorSource> | null>(null);
  const waterBodiesLayerRef = useRef<VectorImageLayer<VectorSource> | null>(null);
  const gwLevelsObservedLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const gwQualityLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const observationsLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const jorddjupObsLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const jorddjupKartorLayerRef = useRef<VectorImageLayer<VectorSource> | null>(null);
  const jorddjupSprickLayerRef = useRef<VectorImageLayer<VectorSource> | null>(null);
  const loadWellsForExtentRef = useRef<((extent: number[]) => Promise<void>) | null>(null);
  const loadSoilTypesForExtentRef = useRef<((extent: number[]) => Promise<void>) | null>(null);
  const loadWaterBodiesForExtentRef = useRef<((extent: number[]) => Promise<void>) | null>(null);
  const loadAquifersForExtentRef = useRef<((extent: number[]) => Promise<void>) | null>(null);
  const loadSourcesForExtentRef = useRef<((extent: number[]) => Promise<void>) | null>(null);
  const loadJorddjupObsForExtentRef = useRef<((extent: number[]) => Promise<void>) | null>(null);
  const loadJorddjupKartorForExtentRef = useRef<((extent: number[]) => Promise<void>) | null>(null);
  const loadJorddjupSprickForExtentRef = useRef<((extent: number[]) => Promise<void>) | null>(null);
  const clearAquifersRef = useRef<(() => void) | null>(null);
  const clearSoilTypesRef = useRef<(() => void) | null>(null);
  const clearWaterBodiesRef = useRef<(() => void) | null>(null);
  const clearJorddjupObsRef = useRef<(() => void) | null>(null);
  const clearJorddjupKartorRef = useRef<(() => void) | null>(null);
  const clearJorddjupSprickRef = useRef<(() => void) | null>(null);
  const hypoAreasSourceRef = useRef<VectorSource | null>(null);
  const hypoFyllnadSmaLayerRef = useRef<VectorImageLayer<VectorSource> | null>(null);
  const hypoFyllnadStoraLayerRef = useRef<VectorImageLayer<VectorSource> | null>(null);
  const hypoSitSmaLayerRef = useRef<VectorImageLayer<VectorSource> | null>(null);
  const hypoSitStoraLayerRef = useRef<VectorImageLayer<VectorSource> | null>(null);
  const fetchAndJoinHypoLevelsRef = useRef<((date: string) => Promise<void>) | null>(null);
  const hypoAreasDateRef = useRef((() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 7) % 7)); return d.toISOString().split('T')[0]; })());
  // Lantmäteriet WMS layer refs
  const topoWebbLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const ortofotoLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const terrangskuggningLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  // SGU WMS layer refs
  const sguBerggrund1MLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const sguBerggrund50kLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const sguJordarter1MLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const sguJordarter25kLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const sguGvTillgangLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const sguJorddjupLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const clcLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const waterWetnessLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const geolocationLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const geolocationWatchRef = useRef<number | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const rapportModeRef = useRef(false);
  const drawModeActiveRef = useRef(false);
  const drawInteractionRef = useRef<Draw | null>(null);
  const drawSourceRef = useRef<VectorSource | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const sweref99tm = getProjection("EPSG:3006");
    if (!sweref99tm) {
      toast.error("Kunde inte ladda SWEREF99 TM-projektion");
      return;
    }

    // OSM base layer
    const osmLayer = new TileLayer({
      source: new OSM(),
    });

    // Lantmäteriet WMS layers (inserted below OSM, above vector layers)
    const topoWebbLayer = new ImageLayer({
      source: new ImageWMS({
        url: 'https://minkarta.lantmateriet.se/map/topowebb',
        params: { 'LAYERS': 'topowebbkartan', 'VERSION': '1.1.1' },
        ratio: 1,
        serverType: 'geoserver',
      }),
      visible: topoWebbVisible,
    });
    topoWebbLayerRef.current = topoWebbLayer;

    const ortofotoLayer = new ImageLayer({
      source: new ImageWMS({
        url: 'https://minkarta.lantmateriet.se/map/ortofoto',
        params: { 'LAYERS': 'Ortofoto_0.5,Ortofoto_0.4,Ortofoto_0.25,Ortofoto_0.16', 'VERSION': '1.1.1' },
        ratio: 1,
        serverType: 'geoserver',
      }),
      visible: ortofotoVisible,
    });
    ortofotoLayerRef.current = ortofotoLayer;

    const terrangskuggningLayer = new ImageLayer({
      source: new ImageWMS({
        url: 'https://minkarta.lantmateriet.se/map/hojdmodell',
        params: { 'LAYERS': 'terrangskuggning', 'VERSION': '1.1.1', 'FORMAT': 'image/png', 'TRANSPARENT': 'TRUE' },
        ratio: 1,
        serverType: 'geoserver',
      }),
      visible: terrangskuggningVisible,
      opacity: terrangskuggningOpacity,
    });
    terrangskuggningLayerRef.current = terrangskuggningLayer;

    // SGU WMS layers - using CORS proxy edge function
    const wmsProxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wms-proxy`;
    
    const sguBerggrund1MLayer = new ImageLayer({
      source: new ImageWMS({
        url: wmsProxyUrl,
        params: {
          // NOTE: resource.sgu.se endpoints return capabilities; actual map rendering happens on maps3.sgu.se
          'url': 'https://maps3.sgu.se/geoserver/berg/ows',
          'LAYERS': 'berg:SE.GOV.SGU.BERGGRUND_NA10',
          'VERSION': '1.1.1',
          'FORMAT': 'image/png',
        },
        ratio: 1,
      }),
      visible: sguBerggrund1MVisible,
      opacity: sguBerggrund1MOpacity,
      maxZoom: 10, // Visible up to zoom level 10
    });
    sguBerggrund1MLayerRef.current = sguBerggrund1MLayer;

    const sguBerggrund50kLayer = new ImageLayer({
      source: new ImageWMS({
        url: wmsProxyUrl,
        params: {
          'url': 'https://maps3.sgu.se/geoserver/berg/ows',
          'LAYERS': 'SE.GOV.SGU.BERG.GEOLOGISK_ENHET.YTA.50K',
          'VERSION': '1.1.1',
          'FORMAT': 'image/png',
        },
        ratio: 1,
      }),
      visible: sguBerggrund50kVisible,
      opacity: sguBerggrund50kOpacity,
      minZoom: 10, // Visible from zoom level 10 and above
    });
    sguBerggrund50kLayerRef.current = sguBerggrund50kLayer;

    const sguJordarter1MLayer = new ImageLayer({
      source: new ImageWMS({
        url: wmsProxyUrl,
        params: {
          'url': 'https://maps3.sgu.se/geoserver/jord/ows',
          'LAYERS': 'jord:SE.GOV.SGU.JORD.GRUNDLAGER.1M',
          'VERSION': '1.1.1',
          'FORMAT': 'image/png',
        },
        ratio: 1,
      }),
      visible: sguJordarter1MVisible,
      opacity: sguJordarter1MOpacity,
    });
    sguJordarter1MLayerRef.current = sguJordarter1MLayer;

    // SGU Jordarter 1:25k-100k WMS layer
    const sguJordarter25kLayer = new ImageLayer({
      source: new ImageWMS({
        url: wmsProxyUrl,
        params: {
          'url': 'https://maps3.sgu.se/geoserver/jord/ows',
          'LAYERS': 'jord:SE.GOV.SGU.JORD.GRUNDLAGER.25K',
          'VERSION': '1.1.1',
          'FORMAT': 'image/png',
        },
        ratio: 1,
      }),
      visible: sguJordarter25kVisible,
      opacity: sguJordarter25kOpacity,
    });
    sguJordarter25kLayerRef.current = sguJordarter25kLayer;

    // SGU Grundvattentillgång i små magasin WMS layer
    const sguGvTillgangLayer = new ImageLayer({
      source: new ImageWMS({
        url: wmsProxyUrl,
        params: {
          'url': 'https://api.sgu.se/oppnadata/grundvattentillgang-sma-magasin/wms',
          'LAYERS': 'grundvattentillgang-sma-magasin',
          'VERSION': '1.1.1',
          'FORMAT': 'image/png',
        },
        ratio: 1,
      }),
      visible: sguGvTillgangVisible,
      opacity: sguGvTillgangOpacity,
    });
    sguGvTillgangLayerRef.current = sguGvTillgangLayer;

    // SGU Jorddjupsmodell WMS layer (10×10 m interpolerat raster)
    const sguJorddjupLayer = new ImageLayer({
      source: new ImageWMS({
        url: wmsProxyUrl,
        params: {
          'url': 'https://maps3.sgu.se/geoserver/misc/ows',
          'LAYERS': 'SE.GOV.SGU.MISC.JORDDJUPSMODELL.RASTER_INTERVALL',
          'VERSION': '1.3.0',
          'FORMAT': 'image/png',
        },
        ratio: 1,
        serverType: 'geoserver',
      }),
      visible: sguJorddjupVisible,
      opacity: sguJorddjupOpacity,
    });
    sguJorddjupLayerRef.current = sguJorddjupLayer;

    // Copernicus Land Service layers – EEA WMS supports CORS (reflects Origin header)
    const eeaWms = (url: string, layer: string) =>
      new ImageWMS({
        url,
        params: { 'LAYERS': layer, 'VERSION': '1.1.1', 'FORMAT': 'image/png', 'TRANSPARENT': 'TRUE', 'STYLES': '' },
        ratio: 1,
        crossOrigin: 'anonymous',
      });

    const clcLayer = new ImageLayer({
      source: eeaWms(
        'https://image.discomap.eea.europa.eu/arcgis/services/Corine/CLC2018_WM/MapServer/WmsServer',
        '12'
      ),
      visible: clcVisible,
      opacity: clcOpacity,
    });
    clcLayerRef.current = clcLayer;

    // Copernicus HRL Water and Wetness 2018 – satellitbaserad jordfuktighetsindikator
    const waterWetnessLayer = new ImageLayer({
      source: eeaWms(
        'https://image.discomap.eea.europa.eu/arcgis/services/GioLandPublic/HRL_WaterWetness_2018/ImageServer/WmsServer',
        'HRL_WaterWetness_2018:WAW_MosaicSymbology'
      ),
      visible: waterWetnessVisible,
      opacity: waterWetnessOpacity,
    });
    waterWetnessLayerRef.current = waterWetnessLayer;

    // OGC API Features layer for Källor (sources) - bbox-based loading
    const sourcesSource = new VectorSource({ format: new GeoJSON() });

    const MIN_ZOOM_FOR_SOURCES = 10;
    const loadedSourceExtentsRef: string[] = [];

    // Color-coded styles per källtyp
    const sourceStylePunkt = new Style({
      image: new Circle({
        radius: 6,
        fill: new Fill({ color: "rgba(6, 182, 212, 0.85)" }),  // teal – punktkälla
        stroke: new Stroke({ color: "rgba(255,255,255,0.85)", width: 2 }),
      }),
    });
    const sourceStyleHorisont = new Style({
      image: new Circle({
        radius: 6,
        fill: new Fill({ color: "rgba(245, 158, 11, 0.85)" }), // amber – horisontkälla
        stroke: new Stroke({ color: "rgba(255,255,255,0.85)", width: 2 }),
      }),
    });
    const sourceStyleDefault = new Style({
      image: new Circle({
        radius: 6,
        fill: new Fill({ color: "rgba(92, 45, 81, 0.85)" }),   // maroon – övriga
        stroke: new Stroke({ color: "rgba(255,255,255,0.85)", width: 2 }),
      }),
    });

    const getSourceStyle = (feature: any) => {
      const kt = (feature.get('kalltyp') || '').toLowerCase();
      if (kt.includes('punkt')) return sourceStylePunkt;
      if (kt.includes('horisont')) return sourceStyleHorisont;
      return sourceStyleDefault;
    };

    const loadSourcesForExtent = async (extent: number[]) => {
      try {
        const currentZoom = mapInstanceRef.current?.getView().getZoom() || 0;
        if (currentZoom < MIN_ZOOM_FOR_SOURCES) return;

        const gridKey = extentToGridKey(extent);
        if (loadedSourceExtentsRef.includes(gridKey)) return;
        loadedSourceExtentsRef.push(gridKey);

        setLoadingSources(true);

        const minLon = (extent[0] / 20037508.34) * 180;
        const maxLon = (extent[2] / 20037508.34) * 180;
        const minLat = (Math.atan(Math.exp((extent[1] / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
        const maxLat = (Math.atan(Math.exp((extent[3] / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;

        const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
        const allFeatures = await fetchAllPages(
          `https://api.sgu.se/oppnadata/kallor/ogc/features/v1/collections/kallor/items?f=json&bbox=${bbox}`,
          (count) => setSourcesLoaded(sourcesSource.getFeatures().length + count)
        );

        if (allFeatures.length > 0) {
          const existingIds = new Set(sourcesSource.getFeatures().map(f => String(f.get('id'))));
          const newFeatures = allFeatures.filter(f => {
            const id = String(f.properties?.id ?? '');
            return id && !existingIds.has(id);
          });

          if (newFeatures.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: newFeatures },
              { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" }
            );
            sourcesSource.addFeatures(features);
          }

          setSourcesLoaded(sourcesSource.getFeatures().length);
        }
      } catch (error) {
        console.error("Error loading sources:", error);
        toast.error("Kunde inte ladda källor");
      } finally {
        setLoadingSources(false);
      }
    };
    loadSourcesForExtentRef.current = loadSourcesForExtent;

    const sourcesLayer = new VectorLayer({
      source: sourcesSource,
      visible: sourcesVisible,
      style: getSourceStyle,
    });
    sourcesLayerRef.current = sourcesLayer;

    // Minimum zoom level for loading wells, soil types, and aquifers
    const MIN_ZOOM_FOR_WELLS = 12;
    const MIN_ZOOM_FOR_SOIL_TYPES = 12;
    const MIN_ZOOM_FOR_AQUIFERS = 9;

    // Track loaded extents to avoid duplicate loading
    const loadedWellExtentsRef: string[] = [];
    const loadedSoilExtentsRef: string[] = [];
    const loadedAquiferExtentsRef: string[] = [];
    
    const extentToGridKey = (extent: number[]) => {
      // Create a grid key based on ~5km grid cells
      const gridSize = 5000;
      const minXGrid = Math.floor(extent[0] / gridSize);
      const minYGrid = Math.floor(extent[1] / gridSize);
      const maxXGrid = Math.ceil(extent[2] / gridSize);
      const maxYGrid = Math.ceil(extent[3] / gridSize);
      return `${minXGrid},${minYGrid},${maxXGrid},${maxYGrid}`;
    };

    // OGC API Features layer for Brunnar (wells) - accumulative loading
    const wellsSource = new VectorSource({
      format: new GeoJSON(),
    });
    
    // Load a single ~5km grid cell of wells. Returns number of features added.
    const WELL_GRID_SIZE = 5000; // meters in EPSG:3857
    const loadWellsForCell = async (cellX: number, cellY: number) => {
      const cellKey = `${cellX},${cellY}`;
      if (loadedWellExtentsRef.includes(cellKey)) return 0;
      // Mark immediately to prevent duplicate concurrent fetches
      loadedWellExtentsRef.push(cellKey);

      const minX = cellX * WELL_GRID_SIZE;
      const minY = cellY * WELL_GRID_SIZE;
      const maxX = minX + WELL_GRID_SIZE;
      const maxY = minY + WELL_GRID_SIZE;

      const minLon = (minX / 20037508.34) * 180;
      const maxLon = (maxX / 20037508.34) * 180;
      const minLat = (Math.atan(Math.exp((minY / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
      const maxLat = (Math.atan(Math.exp((maxY / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;

      try {
        const wellsQueryUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wells-query?minLon=${minLon}&maxLon=${maxLon}&minLat=${minLat}&maxLat=${maxLat}&limit=50000`;
        const cacheResponse = await fetch(wellsQueryUrl);
        const cacheData = cacheResponse.ok ? await cacheResponse.json() : null;

        let geojsonFeatures: any[] = [];
        if (cacheData && cacheData.wells && cacheData.wells.length > 0) {
          geojsonFeatures = cacheData.wells.map((w: any) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [w.lon, w.lat] },
            properties: { ...w.properties, brunnsid: w.brunnsid, obsplatsid: w.obsplatsid },
          }));
        } else {
          // Fallback to SGU API
          const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
          const url = `https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items?f=json&bbox=${bbox}&limit=50000`;
          const response = await fetch(url);
          if (!response.ok) return 0;
          const data = await response.json();
          geojsonFeatures = data.features || [];
        }

        if (geojsonFeatures.length === 0) return 0;

        const features = new GeoJSON().readFeatures(
          { type: "FeatureCollection", features: geojsonFeatures },
          { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" }
        );
        const existingIds = new Set(wellsSource.getFeatures().map(f => f.get('brunnsid')));
        const newFeatures = features.filter(f => !existingIds.has(f.get('brunnsid')));
        if (newFeatures.length > 0) wellsSource.addFeatures(newFeatures);
        return newFeatures.length;
      } catch (err) {
        console.error(`Error loading wells for cell ${cellKey}:`, err);
        // Allow retry by removing the key
        const idx = loadedWellExtentsRef.indexOf(cellKey);
        if (idx >= 0) loadedWellExtentsRef.splice(idx, 1);
        return 0;
      }
    };

    const loadWellsForExtent = async (extent: number[]) => {
      const currentZoom = mapInstanceRef.current?.getView().getZoom() || 0;
      if (currentZoom < MIN_ZOOM_FOR_WELLS) {
        console.log(`Zoom level ${currentZoom} is too low for wells (min: ${MIN_ZOOM_FOR_WELLS})`);
        return;
      }

      // Iterate over all grid cells intersecting the viewport so the entire visible
      // area is loaded — important on wide desktop viewports where a single bbox
      // query could exceed the row limit and leave parts of the screen empty.
      const minCellX = Math.floor(extent[0] / WELL_GRID_SIZE);
      const minCellY = Math.floor(extent[1] / WELL_GRID_SIZE);
      const maxCellX = Math.floor(extent[2] / WELL_GRID_SIZE);
      const maxCellY = Math.floor(extent[3] / WELL_GRID_SIZE);

      const cells: Array<[number, number]> = [];
      for (let x = minCellX; x <= maxCellX; x++) {
        for (let y = minCellY; y <= maxCellY; y++) {
          if (!loadedWellExtentsRef.includes(`${x},${y}`)) cells.push([x, y]);
        }
      }
      if (cells.length === 0) return;

      setLoadingWells(true);
      try {
        // Limit concurrency to avoid hammering the edge function
        const CONCURRENCY = 6;
        let cursor = 0;
        const workers = Array.from({ length: Math.min(CONCURRENCY, cells.length) }, async () => {
          while (cursor < cells.length) {
            const i = cursor++;
            const [cx, cy] = cells[i];
            await loadWellsForCell(cx, cy);
          }
        });
        await Promise.all(workers);
        setWellsLoaded(wellsSource.getFeatures().length);
      } finally {
        setLoadingWells(false);
      }
    };
    
    loadWellsForExtentRef.current = loadWellsForExtent;

    // Pre-build three styles to avoid GC churn (style fn called on every render/pan/zoom)
    const wellStyleBerg = new Style({
      image: new Circle({
        radius: 5,
        fill: new Fill({ color: "rgba(29, 78, 216, 0.88)" }),   // dark navy – bedrock
        stroke: new Stroke({ color: "rgba(255,255,255,0.85)", width: 1.5 }),
      }),
    });
    const wellStyleJord = new Style({
      image: new Circle({
        radius: 5,
        fill: new Fill({ color: "rgba(14, 165, 233, 0.85)" }),  // sky blue – soil
        stroke: new Stroke({ color: "rgba(255,255,255,0.85)", width: 1.5 }),
      }),
    });
    const wellStyleUnkn = new Style({
      image: new Circle({
        radius: 4,
        fill: new Fill({ color: "rgba(148, 163, 184, 0.65)" }), // slate grey – no depth data
        stroke: new Stroke({ color: "rgba(255,255,255,0.7)", width: 1 }),
      }),
    });

    const wellsLayer = new VectorLayer({
      source: wellsSource,
      visible: wellsVisible,
      style: (feature) => {
        const td = feature.get('totaldjup');
        const jd = feature.get('jorddjup');
        if (typeof td === 'number' && td > 0 && typeof jd === 'number' && jd >= 0) {
          return (td - jd) > 15 ? wellStyleBerg : wellStyleJord;
        }
        return wellStyleUnkn;
      },
    });
    wellsLayerRef.current = wellsLayer;

    // Helper function to fetch all pages from OGC API
    const fetchAllPages = async (baseUrl: string, onProgress?: (count: number) => void): Promise<any[]> => {
      const allFeatures: any[] = [];
      let nextUrl: string | null = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}limit=1000`;
      
      while (nextUrl) {
        const response = await fetch(nextUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.features) {
          allFeatures.push(...data.features);
          onProgress?.(allFeatures.length);
        }
        
        // Check for next page link
        nextUrl = null;
        if (data.links) {
          const nextLink = data.links.find((l: any) => l.rel === 'next');
          if (nextLink) {
            nextUrl = nextLink.href;
          }
        }
      }
      
      return allFeatures;
    };

    // OGC API Features layer for Grundvattenmagasin (aquifers) - accumulative bbox loading
    const aquifersSource = new VectorSource({
      format: new GeoJSON(),
    });

    const getAquiferStyle = (feature: any) => {
      const { fill, stroke } = getAquiferColorFor(feature.get('uttagsmojligheter') || '');
      return new Style({
        stroke: new Stroke({ color: stroke, width: 1.5 }),
        fill: new Fill({ color: fill }),
      });
    };

    const loadAquifersForExtent = async (extent: number[]) => {
      try {
        const currentZoom = mapInstanceRef.current?.getView().getZoom() || 0;
        if (currentZoom < MIN_ZOOM_FOR_AQUIFERS) return;

        const gridKey = extentToGridKey(extent);
        if (loadedAquiferExtentsRef.includes(gridKey)) return;
        loadedAquiferExtentsRef.push(gridKey);

        setLoadingAquifers(true);

        // Convert extent from EPSG:3857 to EPSG:4326 for OGC API bbox
        const minLon = (extent[0] / 20037508.34) * 180;
        const maxLon = (extent[2] / 20037508.34) * 180;
        const minLat = (Math.atan(Math.exp((extent[1] / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
        const maxLat = (Math.atan(Math.exp((extent[3] / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;

        const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
        const allFeatures = await fetchAllPages(
          `https://api.sgu.se/oppnadata/grundvattenmagasin/ogc/features/v1/collections/magasinsdelomraden/items?f=json&bbox=${bbox}`,
          (count) => setAquifersLoaded(prev => aquifersSource.getFeatures().length + count)
        );

        if (allFeatures.length > 0) {
          // Deduplicate by unik_delomradesidentitet
          const existingIds = new (globalThis.Map as typeof Map)<string, boolean>();
          for (const f of aquifersSource.getFeatures()) {
            const id = f.get('unik_delomradesidentitet');
            if (id) existingIds.set(id, true);
          }

          const newFeatures = allFeatures.filter(f => {
            const id = f.properties?.unik_delomradesidentitet;
            return id && !existingIds.has(id);
          });

          if (newFeatures.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: newFeatures },
              { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" }
            );
            aquifersSource.addFeatures(features);
          }

          setAquifersLoaded(aquifersSource.getFeatures().length);
        }
      } catch (error) {
        console.error("Error loading aquifers:", error);
        toast.error("Kunde inte ladda grundvattenmagasin");
      } finally {
        setLoadingAquifers(false);
      }
    };
    loadAquifersForExtentRef.current = loadAquifersForExtent;
    clearAquifersRef.current = () => { loadedAquiferExtentsRef.length = 0; aquifersSource.clear(); setAquifersLoaded(0); };

    const aquifersLayer = new VectorImageLayer({
      source: aquifersSource,
      visible: aquifersVisible,
      opacity: aquifersOpacity,
      style: getAquiferStyle,
    });
    aquifersLayerRef.current = aquifersLayer;

    // OGC API Features layer for Jordarter (soil types) - accumulative loading
    const soilTypesSource = new VectorSource({
      format: new GeoJSON(),
    });
    
    const loadSoilTypesForExtent = async (extent: number[]) => {
      try {
        // Check zoom level before loading
        const currentZoom = mapInstanceRef.current?.getView().getZoom() || 0;
        if (currentZoom < MIN_ZOOM_FOR_SOIL_TYPES) {
          console.log(`Zoom level ${currentZoom} is too low for soil types (min: ${MIN_ZOOM_FOR_SOIL_TYPES})`);
          return;
        }
        
        // Check if this extent area has already been loaded
        const gridKey = extentToGridKey(extent);
        if (loadedSoilExtentsRef.includes(gridKey)) {
          console.log(`Soil types for extent ${gridKey} already loaded, skipping`);
          return;
        }
        
        setLoadingSoilTypes(true);
        console.log("Loading soil types from OGC API with bbox...");
        
        // Convert Web Mercator extent to WGS84 bbox
        const [minX, minY, maxX, maxY] = extent;
        const minLon = (minX / 20037508.34) * 180;
        const maxLon = (maxX / 20037508.34) * 180;
        const minLat = (Math.atan(Math.exp((minY / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
        const maxLat = (Math.atan(Math.exp((maxY / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
        
        const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
        const jordartBase = `https://api.sgu.se/oppnadata/jordarter25k-100k/ogc/features/v1/collections`;
        // Fetch grundlager (main layer), ytlager (thin surface) and oversta-ytlager (topmost thin) in parallel
        const layerLimits = [
          { url: `${jordartBase}/grundlager/items?f=json&bbox=${bbox}&limit=20000`, limit: 20000 },
          { url: `${jordartBase}/ytlager/items?f=json&bbox=${bbox}&limit=5000`,     limit: 5000 },
          { url: `${jordartBase}/oversta-ytlager/items?f=json&bbox=${bbox}&limit=5000`, limit: 5000 },
        ];
        const responses = await Promise.allSettled(layerLimits.map(l => fetch(l.url)));
        const parsed = await Promise.all(
          responses.map(res =>
            res.status === 'fulfilled' && res.value.ok
              ? res.value.json().catch(() => null)
              : Promise.resolve(null)
          )
        );

        let allRawFeatures: any[] = [];
        let hitLimit = false;
        parsed.forEach((d, i) => {
          const features = d?.features;
          if (features?.length) {
            allRawFeatures = allRawFeatures.concat(features);
            if (features.length >= layerLimits[i].limit) hitLimit = true;
          }
        });

        if (hitLimit) toast.info("Visar max jordarter per område. Zooma in för fler detaljer.");

        console.log(`Received ${allRawFeatures.length} soil type features`);

        if (allRawFeatures.length > 0) {
          const features = new GeoJSON().readFeatures(
            { type: "FeatureCollection", features: allRawFeatures },
            {
              dataProjection: "EPSG:4326",
              featureProjection: "EPSG:3857",
            }
          );

          soilTypesSource.addFeatures(features);
          setSoilTypesLoaded(soilTypesSource.getFeatures().length);
          loadedSoilExtentsRef.push(gridKey);
        } else {
          loadedSoilExtentsRef.push(gridKey);
        }
      } catch (error) {
        console.error("Error loading soil types:", error);
        toast.error("Kunde inte ladda jordarter från OGC API");
      } finally {
        setLoadingSoilTypes(false);
      }
    };
    
    loadSoilTypesForExtentRef.current = loadSoilTypesForExtent;
    clearSoilTypesRef.current = () => { loadedSoilExtentsRef.length = 0; soilTypesSource.clear(); setSoilTypesLoaded(0); };

    const soilTypeStyleFunction = (feature: any) => {
      const jg2 = feature.get('jg2') || 0;
      const colorInfo = getSoilTypeColor(jg2);
      
      return new Style({
        stroke: new Stroke({
          color: colorInfo.stroke,
          width: 1,
        }),
        fill: new Fill({
          color: colorInfo.fill,
        }),
      });
    };

    const soilTypesLayer = new VectorImageLayer({
      source: soilTypesSource,
      visible: soilTypesVisible,
      opacity: soilTypesOpacity,
      style: soilTypeStyleFunction,
    });
    soilTypesLayerRef.current = soilTypesLayer;

    // OGC API Features layer for Grundvattenförekomster (water bodies) - bbox per viewport
    const waterBodiesSource = new VectorSource({
      format: new GeoJSON(),
    });

    const loadedWaterBodyExtentsRef: string[] = [];
    const MIN_ZOOM_FOR_WATER_BODIES = 7;

    const loadWaterBodiesForExtent = async (extent: number[]) => {
      try {
        const currentZoom = mapInstanceRef.current?.getView().getZoom() || 0;
        if (currentZoom < MIN_ZOOM_FOR_WATER_BODIES) return;

        const gridKey = extentToGridKey(extent);
        if (loadedWaterBodyExtentsRef.includes(gridKey)) return;
        loadedWaterBodyExtentsRef.push(gridKey);

        setLoadingWaterBodies(true);

        const [minX, minY, maxX, maxY] = extent;
        const toWgs84 = (x: number, y: number) => {
          const lon = (x / 20037508.34) * 180;
          const lat = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360) / Math.PI - 90;
          return [lon, lat];
        };
        const [w, s] = toWgs84(minX, minY);
        const [e, n] = toWgs84(maxX, maxY);
        const bbox = `${w},${s},${e},${n}`;

        const allFeatures = await fetchAllPages(
          `https://api.sgu.se/oppnadata/grundvattenforekomster/ogc/features/v1/collections/grundvattenforekomster/items?f=json&bbox=${bbox}`,
          (count) => setWaterBodiesLoaded(prev => waterBodiesSource.getFeatures().length + count)
        );

        if (allFeatures.length > 0) {
          // Deduplicate by eucd
          const existingIds = new (globalThis.Map as typeof Map)<string, boolean>();
          for (const f of waterBodiesSource.getFeatures()) {
            const id = f.get('eucd') || f.get('eu_cd') || f.get('ms_cd');
            if (id) existingIds.set(String(id), true);
          }
          const newFeatures = allFeatures.filter(f => {
            const id = f.properties?.eucd || f.properties?.eu_cd || f.properties?.ms_cd;
            return !id || !existingIds.has(String(id));
          });
          if (newFeatures.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: newFeatures },
              { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" }
            );
            waterBodiesSource.addFeatures(features);
          }
          setWaterBodiesLoaded(waterBodiesSource.getFeatures().length);
        }
      } catch (error) {
        console.error("Error loading water bodies:", error);
        toast.error("Kunde inte ladda grundvattenförekomster");
      } finally {
        setLoadingWaterBodies(false);
      }
    };
    loadWaterBodiesForExtentRef.current = loadWaterBodiesForExtent;
    clearWaterBodiesRef.current = () => { loadedWaterBodyExtentsRef.length = 0; waterBodiesSource.clear(); setWaterBodiesLoaded(0); };

    const waterBodiesLayer = new VectorImageLayer({
      source: waterBodiesSource,
      visible: waterBodiesVisible,
      style: new Style({
        stroke: new Stroke({
          color: "rgba(59, 130, 246, 0.8)",
          width: 2,
        }),
        fill: new Fill({
          color: "rgba(59, 130, 246, 0.15)",
        }),
      }),
    });
    waterBodiesLayerRef.current = waterBodiesLayer;

    // OGC API Features layer for Grundvattennivåer observerade (observed groundwater levels)
    const gwLevelsObservedSource = new VectorSource({
      format: new GeoJSON(),
      loader: async () => {
        try {
          setLoadingGwLevelsObserved(true);
          setGwLevelsObservedLoaded(0);
          console.log("Loading observed groundwater levels from OGC API...");
          
          const allFeatures = await fetchAllPages(
            `https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/stationer/items?f=json`,
            (count) => setGwLevelsObservedLoaded(count)
          );
          
          console.log(`Received ${allFeatures.length} groundwater level stations`);
          
          if (allFeatures.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: allFeatures },
              {
                dataProjection: "EPSG:4326",
                featureProjection: "EPSG:3857",
              }
            );
            
            gwLevelsObservedSource.addFeatures(features);
            setGwLevelsObservedLoaded(features.length);
            
            if (gwLevelsObservedLayerRef.current) {
              gwLevelsObservedLayerRef.current.setVisible(true);
              gwLevelsObservedLayerRef.current.changed();
            }
            
            toast.success(`Laddade ${features.length} grundvattennivåstationer`);
          }
        } catch (error) {
          console.error("Error loading observed groundwater levels:", error);
          toast.error("Kunde inte ladda observerade grundvattennivåer");
        } finally {
          setLoadingGwLevelsObserved(false);
        }
      },
    });

    const gwLevelsObservedLayer = new VectorLayer({
      source: gwLevelsObservedSource,
      visible: gwLevelsObservedVisible,
      style: (feature) => {
        const inactive = !!feature.get('tdat');
        return new Style({
          image: new Circle({
            radius: 6,
            fill: new Fill({ color: inactive ? "rgba(150, 150, 150, 0.5)" : "rgba(147, 51, 234, 0.8)" }),
            stroke: new Stroke({
              color: inactive ? "rgba(200, 200, 200, 0.6)" : "rgba(255, 255, 255, 0.8)",
              width: inactive ? 1 : 2,
            }),
          }),
        });
      },
    });
    gwLevelsObservedLayerRef.current = gwLevelsObservedLayer;

    // OGC API Features layer for Grundvattenkvalitet (groundwater quality sampling sites)
    const gwQualitySource = new VectorSource({
      format: new GeoJSON(),
      loader: async () => {
        try {
          setLoadingGwQuality(true);
          setGwQualityLoaded(0);
          console.log("Loading groundwater quality sites from OGC API...");
          
          // Use API v2 for groundwater quality
          const allFeatures = await fetchAllPages(
            `https://api.sgu.se/oppnadata/grundvattenkvalitet-analysresultat-provplatser-v2/ogc/features/v1/collections/provplatser/items?f=json`,
            (count) => setGwQualityLoaded(count)
          );
          
          // Filter out features without geometry
          const featuresWithGeometry = allFeatures.filter(f => f.geometry !== null);
          console.log(`Received ${featuresWithGeometry.length} groundwater quality sites with geometry`);
          
          if (featuresWithGeometry.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: featuresWithGeometry },
              {
                dataProjection: "EPSG:4326",
                featureProjection: "EPSG:3857",
              }
            );
            
            gwQualitySource.addFeatures(features);
            setGwQualityLoaded(features.length);
            
            if (gwQualityLayerRef.current) {
              gwQualityLayerRef.current.setVisible(true);
              gwQualityLayerRef.current.changed();
            }
            
            toast.success(`Laddade ${features.length} provplatser för grundvattenkvalitet`);
          }
        } catch (error) {
          console.error("Error loading groundwater quality sites:", error);
          toast.error("Kunde inte ladda grundvattenkvalitet");
        } finally {
          setLoadingGwQuality(false);
        }
      },
    });

    const gwQualityLayer = new VectorLayer({
      source: gwQualitySource,
      visible: gwQualityVisible,
      style: (feature) => {
        const n = Number(feature.get('antal_prov') ?? 0);
        // >50 prover: large diamond – clearly marks trend/trend-like stations
        if (n > 50) {
          return new Style({
            image: new RegularShape({
              points: 4,
              radius: 11,
              angle: Math.PI / 4, // rotated square = diamond
              fill: new Fill({ color: 'rgba(127, 29, 29, 0.9)' }),  // deep red
              stroke: new Stroke({ color: 'rgba(255,255,255,0.95)', width: 2.5 }),
            }),
          });
        }
        // 20-50 prover
        if (n > 20) {
          return new Style({
            image: new Circle({
              radius: 8,
              fill: new Fill({ color: 'rgba(194, 65, 12, 0.88)' }), // dark orange
              stroke: new Stroke({ color: 'rgba(255,255,255,0.9)', width: 2 }),
            }),
          });
        }
        // 10-20 prover
        if (n > 10) {
          return new Style({
            image: new Circle({
              radius: 6,
              fill: new Fill({ color: 'rgba(234, 88, 12, 0.85)' }), // orange
              stroke: new Stroke({ color: 'rgba(255,255,255,0.85)', width: 1.5 }),
            }),
          });
        }
        // 5-10 prover
        if (n > 5) {
          return new Style({
            image: new Circle({
              radius: 5,
              fill: new Fill({ color: 'rgba(251, 146, 60, 0.8)' }), // light orange
              stroke: new Stroke({ color: 'rgba(255,255,255,0.8)', width: 1.5 }),
            }),
          });
        }
        // 0-5 prover
        return new Style({
          image: new Circle({
            radius: 4,
            fill: new Fill({ color: 'rgba(253, 186, 116, 0.75)' }), // peach
            stroke: new Stroke({ color: 'rgba(255,255,255,0.75)', width: 1 }),
          }),
        });
      },
    });
    gwQualityLayerRef.current = gwQualityLayer;

    // Observations layer from external OGC API
    const observationsSource = new VectorSource({
      format: new GeoJSON(),
      loader: async () => {
        try {
          setLoadingObservations(true);
          setObservationsLoaded(0);
          console.log("Loading observations from external OGC API...");
          
          const allFeatures: any[] = [];
          let nextUrl: string | null = `https://vwjynydirkjirkkzwdnb.supabase.co/functions/v1/ogc-api/collections/observations/items?limit=1000`;
          
          while (nextUrl) {
            const response = await fetch(nextUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (data.features) {
              allFeatures.push(...data.features);
              setObservationsLoaded(allFeatures.length);
            }
            nextUrl = null;
            if (data.links) {
              const nextLink = data.links.find((l: any) => l.rel === 'next');
              if (nextLink) nextUrl = nextLink.href;
            }
          }
          
          const featuresWithGeometry = allFeatures.filter(f => f.geometry !== null);
          console.log(`Received ${featuresWithGeometry.length} observations`);
          
          if (featuresWithGeometry.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: featuresWithGeometry },
              { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" }
            );
            
            observationsSource.addFeatures(features);
            setObservationsLoaded(features.length);
            
            if (observationsLayerRef.current) {
              observationsLayerRef.current.setVisible(true);
              observationsLayerRef.current.changed();
            }
            
            toast.success(`Laddade ${features.length} observationer`);
          }
        } catch (error) {
          console.error("Error loading observations:", error);
          toast.error("Kunde inte ladda observationer");
        } finally {
          setLoadingObservations(false);
        }
      },
    });

    const observationsLayer = new VectorLayer({
      source: observationsSource,
      visible: observationsVisible,
      style: new Style({
        image: new Circle({
          radius: 7,
          fill: new Fill({ color: "rgba(16, 185, 129, 0.8)" }), // Emerald/teal color
          stroke: new Stroke({
            color: "rgba(255, 255, 255, 0.9)",
            width: 2,
          }),
        }),
      }),
    });
    observationsLayerRef.current = observationsLayer;

    // ── Jorddjupsmodell – tre kollektioner (extent-based loading, minzoom 12) ──

    const loadedJorddjupObsExtents: string[] = [];
    const loadedJorddjupKartorExtents: string[] = [];
    const loadedJorddjupSprickExtents: string[] = [];
    const MIN_ZOOM_FOR_JORDDJUP = 12;

    // 1. Punktobservationer (underlag-jorddjup) – färgas efter djup
    const jorddjupObsSource = new VectorSource({ format: new GeoJSON() });

    const loadJorddjupObsForExtent = async (extent: number[]) => {
      const zoom = mapInstanceRef.current?.getView().getZoom() || 0;
      if (zoom < MIN_ZOOM_FOR_JORDDJUP) return;
      const gridKey = extentToGridKey(extent);
      if (loadedJorddjupObsExtents.includes(gridKey)) return;
      const [minX, minY, maxX, maxY] = extent;
      const minLon = (minX / 20037508.34) * 180;
      const maxLon = (maxX / 20037508.34) * 180;
      const minLat = (Math.atan(Math.exp((minY / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
      const maxLat = (Math.atan(Math.exp((maxY / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
      setLoadingJorddjupObs(true);
      try {
        const all = await fetchAllPages(
          `https://api.sgu.se/oppnadata/jorddjupsmodell/ogc/features/v1/collections/underlag-jorddjup/items?f=json&bbox=${minLon},${minLat},${maxLon},${maxLat}`,
          (n) => setJorddjupObsLoaded(jorddjupObsSource.getFeatures().length + n)
        );
        if (all.length > 0) {
          const feats = new GeoJSON().readFeatures(
            { type: "FeatureCollection", features: all },
            { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" }
          );
          jorddjupObsSource.addFeatures(feats);
          setJorddjupObsLoaded(jorddjupObsSource.getFeatures().length);
          jorddjupObsLayerRef.current?.changed();
        }
        loadedJorddjupObsExtents.push(gridKey);
      } catch (e) {
        console.error("Error loading jorddjup obs:", e);
        toast.error("Kunde inte ladda jorddjupsobservationer");
      } finally {
        setLoadingJorddjupObs(false);
      }
    };
    loadJorddjupObsForExtentRef.current = loadJorddjupObsForExtent;
    clearJorddjupObsRef.current = () => { loadedJorddjupObsExtents.length = 0; jorddjupObsSource.clear(); setJorddjupObsLoaded(0); };

    const jorddjupObsStyleFn = (feature: any) => {
      const djup = feature.get('djup') ?? 0;
      let color: string;
      if      (djup < 1)  color = 'rgba(255, 245, 210, 0.9)';
      else if (djup < 5)  color = 'rgba(222, 184, 100, 0.9)';
      else if (djup < 20) color = 'rgba(180, 120,  55, 0.9)';
      else if (djup < 50) color = 'rgba(120,  70,  20, 0.9)';
      else                color = 'rgba( 60,  30,   5, 0.9)';
      return new Style({
        image: new Circle({
          radius: 4,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: 'rgba(0,0,0,0.35)', width: 0.5 }),
        }),
      });
    };

    const jorddjupObsLayer = new VectorLayer({
      source: jorddjupObsSource,
      visible: jorddjupObsVisible,
      style: jorddjupObsStyleFn,
    });
    jorddjupObsLayerRef.current = jorddjupObsLayer;

    // 2. Jordartskartor-polygoner (underlag-jordartskartor)
    const jorddjupKartorSource = new VectorSource({ format: new GeoJSON() });

    const loadJorddjupKartorForExtent = async (extent: number[]) => {
      const zoom = mapInstanceRef.current?.getView().getZoom() || 0;
      if (zoom < MIN_ZOOM_FOR_JORDDJUP) return;
      const gridKey = extentToGridKey(extent);
      if (loadedJorddjupKartorExtents.includes(gridKey)) return;
      const [minX, minY, maxX, maxY] = extent;
      const minLon = (minX / 20037508.34) * 180;
      const maxLon = (maxX / 20037508.34) * 180;
      const minLat = (Math.atan(Math.exp((minY / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
      const maxLat = (Math.atan(Math.exp((maxY / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
      setLoadingJorddjupKartor(true);
      try {
        const all = await fetchAllPages(
          `https://api.sgu.se/oppnadata/jorddjupsmodell/ogc/features/v1/collections/underlag-jordartskartor/items?f=json&bbox=${minLon},${minLat},${maxLon},${maxLat}`,
          (n) => setJorddjupKartorLoaded(jorddjupKartorSource.getFeatures().length + n)
        );
        if (all.length > 0) {
          const feats = new GeoJSON().readFeatures(
            { type: "FeatureCollection", features: all },
            { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" }
          );
          jorddjupKartorSource.addFeatures(feats);
          setJorddjupKartorLoaded(jorddjupKartorSource.getFeatures().length);
          jorddjupKartorLayerRef.current?.changed();
        }
        loadedJorddjupKartorExtents.push(gridKey);
      } catch (e) {
        console.error("Error loading jorddjup kartor:", e);
        toast.error("Kunde inte ladda jordartskartor");
      } finally {
        setLoadingJorddjupKartor(false);
      }
    };
    loadJorddjupKartorForExtentRef.current = loadJorddjupKartorForExtent;
    clearJorddjupKartorRef.current = () => { loadedJorddjupKartorExtents.length = 0; jorddjupKartorSource.clear(); setJorddjupKartorLoaded(0); };

    const jorddjupKartorLayer = new VectorImageLayer({
      source: jorddjupKartorSource,
      visible: jorddjupKartorVisible,
      style: new Style({
        stroke: new Stroke({ color: 'rgba(139, 90, 43, 0.7)', width: 1 }),
        fill: new Fill({ color: 'rgba(222, 184, 135, 0.15)' }),
      }),
    });
    jorddjupKartorLayerRef.current = jorddjupKartorLayer;

    // 3. Sprickzoner (underlag-sprickzoner) – linjer
    const jorddjupSprickSource = new VectorSource({ format: new GeoJSON() });

    const loadJorddjupSprickForExtent = async (extent: number[]) => {
      const zoom = mapInstanceRef.current?.getView().getZoom() || 0;
      if (zoom < MIN_ZOOM_FOR_JORDDJUP) return;
      const gridKey = extentToGridKey(extent);
      if (loadedJorddjupSprickExtents.includes(gridKey)) return;
      const [minX, minY, maxX, maxY] = extent;
      const minLon = (minX / 20037508.34) * 180;
      const maxLon = (maxX / 20037508.34) * 180;
      const minLat = (Math.atan(Math.exp((minY / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
      const maxLat = (Math.atan(Math.exp((maxY / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
      setLoadingJorddjupSprick(true);
      try {
        const all = await fetchAllPages(
          `https://api.sgu.se/oppnadata/jorddjupsmodell/ogc/features/v1/collections/underlag-sprickzoner/items?f=json&bbox=${minLon},${minLat},${maxLon},${maxLat}`,
          (n) => setJorddjupSprickLoaded(jorddjupSprickSource.getFeatures().length + n)
        );
        if (all.length > 0) {
          const feats = new GeoJSON().readFeatures(
            { type: "FeatureCollection", features: all },
            { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" }
          );
          jorddjupSprickSource.addFeatures(feats);
          setJorddjupSprickLoaded(jorddjupSprickSource.getFeatures().length);
          jorddjupSprickLayerRef.current?.changed();
        }
        loadedJorddjupSprickExtents.push(gridKey);
      } catch (e) {
        console.error("Error loading sprickzoner:", e);
        toast.error("Kunde inte ladda sprickzoner");
      } finally {
        setLoadingJorddjupSprick(false);
      }
    };
    loadJorddjupSprickForExtentRef.current = loadJorddjupSprickForExtent;
    clearJorddjupSprickRef.current = () => { loadedJorddjupSprickExtents.length = 0; jorddjupSprickSource.clear(); setJorddjupSprickLoaded(0); };

    const jorddjupSprickLayer = new VectorImageLayer({
      source: jorddjupSprickSource,
      visible: jorddjupSprickVisible,
      style: new Style({
        stroke: new Stroke({ color: 'rgba(190, 50, 50, 0.8)', width: 1.5 }),
      }),
    });
    jorddjupSprickLayerRef.current = jorddjupSprickLayer;

    // OGC API Features – SGU-HYPE beräknade grundvattennivåer (shared source, 4 layers)
    const hypoAreasSource = new VectorSource({
      format: new GeoJSON(),
      loader: async () => {
        try {
          setLoadingHypoAreas(true);
          setHypoAreasLoaded(0);

          const date = hypoAreasDateRef.current;
          const levelBase = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/grundvattennivaer-tidigare/items?f=json`;

          // Fetch polygons and level data for the current date in parallel
          const [allAreaFeatures, allLevelFeatures] = await Promise.all([
            fetchAllPages(
              `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/omraden/items?f=json`,
              (count) => setHypoAreasLoaded(count)
            ),
            fetchAllPages(`${levelBase}&filter=${encodeURIComponent(`datum='${date}'`)}`),
          ]);

          if (allAreaFeatures.length === 0) return;

          // If the chosen date has no data, fall back to the latest available date
          let levelFeatures = allLevelFeatures;
          if (levelFeatures.length === 0) {
            const latestResp = await fetch(`${levelBase}&sortby=-datum&limit=1`).catch(() => null);
            if (latestResp?.ok) {
              const latestData = await latestResp.json().catch(() => null);
              const latestDate = String(latestData?.features?.[0]?.properties?.datum ?? '').split('T')[0];
              if (latestDate) {
                levelFeatures = await fetchAllPages(`${levelBase}&filter=${encodeURIComponent(`datum='${latestDate}'`)}`);
                toast.info(`Ingen data för ${date}, visar senaste tillgängliga (${latestDate})`);
              }
            }
          }

          // Build a level-data lookup keyed by omrade_id
          const levelMap = new Map<number, any>();
          for (const f of levelFeatures) {
            levelMap.set(f.properties.omrade_id, f.properties);
          }

          // Parse features and merge level properties before adding to source
          // so the very first render already has the color data
          const features = new GeoJSON().readFeatures(
            { type: 'FeatureCollection', features: allAreaFeatures },
            { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' }
          );
          for (const feature of features) {
            const ld = levelMap.get(feature.get('omrade_id'));
            feature.setProperties(ld
              ? { fyllnadsgrad_sma: ld.fyllnadsgrad_sma, fyllnadsgrad_stora: ld.fyllnadsgrad_stora, grundvattensituation_sma: ld.grundvattensituation_sma, grundvattensituation_stora: ld.grundvattensituation_stora, datum: ld.datum }
              : { fyllnadsgrad_sma: null, fyllnadsgrad_stora: null, grundvattensituation_sma: null, grundvattensituation_stora: null, datum: date }
            );
          }

          hypoAreasSource.addFeatures(features);
          setHypoAreasLoaded(features.length);

          // Fetch and join HYPE time-series data as before
          if (fetchAndJoinHypoLevelsRef.current) {
            await fetchAndJoinHypoLevelsRef.current(date);
          }

          toast.success(`Laddade ${features.length} HYPE-områden`);
        } catch (error) {
          console.error('Error loading HYPE areas:', error);
          toast.error('Kunde inte ladda beräknade grundvattennivåer');
        } finally {
          setLoadingHypoAreas(false);
        }
      },
    });
    hypoAreasSourceRef.current = hypoAreasSource;

    // Fyllnadsgrad – 7-klass SGU-skala (brun→grå→teal)
    const makeFyllnadStyle = (field: string) => (feature: any) => {
      const v = feature.get(field);
      let fillColor = 'rgba(200, 200, 200, 0.2)';
      const hasData = v !== null && v !== undefined && v !== -1 && v !== 99;
      if (hasData) {
        if      (v <= 6.5)  fillColor = 'rgba(122, 60, 16, 0.85)';  // mörkt brun
        else if (v <= 19.5) fillColor = 'rgba(200, 168, 96, 0.85)'; // tan/guldbrun
        else if (v <= 37.5) fillColor = 'rgba(232, 216, 152, 0.85)';// ljus beige
        else if (v <= 62.5) fillColor = 'rgba(160, 160, 160, 0.85)';// grå (normal)
        else if (v <= 80.5) fillColor = 'rgba(90, 180, 158, 0.85)'; // medium teal
        else if (v <= 93.5) fillColor = 'rgba(42, 122, 104, 0.85)'; // mörk teal
        else                fillColor = 'rgba(13, 79, 66, 0.85)';   // mycket mörk teal
      }
      return new Style({
        stroke: new Stroke({ color: 'rgba(0,0,0,0.25)', width: 0.5 }),
        fill: new Fill({ color: fillColor }),
      });
    };

    // Grundvattensituation – 5-klass SGU-skala (orange→gul→blå)
    const makeSitStyle = (field: string) => (feature: any) => {
      const v = feature.get(field);
      let fillColor = 'rgba(200, 200, 200, 0.2)';
      const hasData = v !== null && v !== undefined && v !== -1 && v !== 99;
      if (hasData) {
        if      (v <= 14) fillColor = 'rgba(232, 96, 48, 0.85)';   // orange
        else if (v <= 34) fillColor = 'rgba(240, 224, 64, 0.85)';  // gul
        else if (v <= 65) fillColor = 'rgba(74, 166, 100, 0.85)';  // grön
        else if (v <= 85) fillColor = 'rgba(72, 120, 200, 0.85)';  // medelblå
        else              fillColor = 'rgba(30, 58, 144, 0.85)';   // mörkblå
      }
      return new Style({
        stroke: new Stroke({ color: 'rgba(0,0,0,0.25)', width: 0.5 }),
        fill: new Fill({ color: fillColor }),
      });
    };

    const hypoFyllnadSmaLayer = new VectorImageLayer({ source: hypoAreasSource, visible: hypoFyllnadSmaVisible, opacity: hypoAreasOpacity, style: makeFyllnadStyle('fyllnadsgrad_sma') });
    const hypoFyllnadStoraLayer = new VectorImageLayer({ source: hypoAreasSource, visible: hypoFyllnadStoraVisible, opacity: hypoAreasOpacity, style: makeFyllnadStyle('fyllnadsgrad_stora') });
    const hypoSitSmaLayer = new VectorImageLayer({ source: hypoAreasSource, visible: hypoSitSmaVisible, opacity: hypoAreasOpacity, style: makeSitStyle('grundvattensituation_sma') });
    const hypoSitStoraLayer = new VectorImageLayer({ source: hypoAreasSource, visible: hypoSitStoraVisible, opacity: hypoAreasOpacity, style: makeSitStyle('grundvattensituation_stora') });

    hypoFyllnadSmaLayerRef.current = hypoFyllnadSmaLayer;
    hypoFyllnadStoraLayerRef.current = hypoFyllnadStoraLayer;
    hypoSitSmaLayerRef.current = hypoSitSmaLayer;
    hypoSitStoraLayerRef.current = hypoSitStoraLayer;

    // Fetch and join level data – uses fetchAllPages for full pagination
    const fetchAndJoinHypoLevels = async (date: string) => {
      try {
        const baseUrl = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/grundvattennivaer-tidigare/items?f=json&filter=${encodeURIComponent(`datum='${date}'`)}`;
        let allLevelFeatures = await fetchAllPages(baseUrl);

        // If no data for the requested date, find the latest available date
        if (allLevelFeatures.length === 0) {
          const latestResp = await fetch(
            `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/grundvattennivaer-tidigare/items?f=json&sortby=-datum&limit=1`
          );
          if (latestResp.ok) {
            const latestData = await latestResp.json().catch(() => null);
            const latestDate = String(latestData?.features?.[0]?.properties?.datum ?? '').split('T')[0];
            if (latestDate) {
              const latestUrl = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/grundvattennivaer-tidigare/items?f=json&filter=${encodeURIComponent(`datum='${latestDate}'`)}`;
              allLevelFeatures = await fetchAllPages(latestUrl);
              toast.info(`Ingen data för ${date}, visar senaste tillgängliga (${latestDate})`);
            }
          }
        }

        if (allLevelFeatures.length === 0) {
          toast.info(`Ingen data tillgänglig`);
          return;
        }

        const levelMap = new Map<number, any>();
        for (const f of allLevelFeatures) {
          levelMap.set(f.properties.omrade_id, f.properties);
        }

        for (const feature of hypoAreasSource.getFeatures()) {
          const omradeId = feature.get('omrade_id');
          const ld = levelMap.get(omradeId);
          // silent=true: suppress per-feature change events; one source.changed() below
          if (ld) {
            feature.setProperties({
              fyllnadsgrad_sma: ld.fyllnadsgrad_sma,
              fyllnadsgrad_stora: ld.fyllnadsgrad_stora,
              grundvattensituation_sma: ld.grundvattensituation_sma,
              grundvattensituation_stora: ld.grundvattensituation_stora,
              datum: ld.datum,
            }, true);
          } else {
            feature.setProperties({
              fyllnadsgrad_sma: null, fyllnadsgrad_stora: null,
              grundvattensituation_sma: null, grundvattensituation_stora: null,
              datum: date,
            }, true);
          }
        }

        // Single source.changed() invalidates VectorImageLayer's cached image
        hypoAreasSource.changed();
        mapInstanceRef.current?.render();
      } catch (error) {
        console.error("Error fetching HYPE level data:", error);
        toast.error("Kunde inte hämta beräknade grundvattennivåer");
      }
    };

    fetchAndJoinHypoLevelsRef.current = fetchAndJoinHypoLevels;

    // Geolocation tracking layer (blue dot)
    const geolocationSource = new VectorSource();
    const geolocationLayer = new VectorLayer({
      source: geolocationSource,
      style: [
        // Accuracy circle
        new Style({
          image: new Circle({
            radius: 20,
            fill: new Fill({ color: "rgba(59, 130, 246, 0.1)" }),
            stroke: new Stroke({ color: "rgba(59, 130, 246, 0.3)", width: 1 }),
          }),
        }),
        // Blue dot
        new Style({
          image: new Circle({
            radius: 7,
            fill: new Fill({ color: "rgba(59, 130, 246, 0.9)" }),
            stroke: new Stroke({ color: "rgba(255, 255, 255, 1)", width: 2.5 }),
          }),
        }),
      ],
      zIndex: 9999,
    });
    geolocationLayerRef.current = geolocationLayer;

    // Draw layer – polygon selection for data export
    const drawSource = new VectorSource();
    drawSourceRef.current = drawSource;
    const drawLayer = new VectorLayer({
      source: drawSource,
      style: new Style({
        stroke: new Stroke({ color: 'rgba(225, 29, 72, 0.9)', width: 2, lineDash: [6, 4] }),
        fill: new Fill({ color: 'rgba(225, 29, 72, 0.08)' }),
      }),
      zIndex: 9998,
    });

    // Create map
    const map = new OLMap({
      target: mapRef.current,
      layers: [
        osmLayer, 
        // Lantmäteriet WMS layers (base maps)
        topoWebbLayer, 
        ortofotoLayer, 
        terrangskuggningLayer, 
        // SGU WMS layers ABOVE Lantmäteriet so they display on top
        sguBerggrund1MLayer,
        sguBerggrund50kLayer,
        sguJordarter1MLayer,
        sguJordarter25kLayer,
        sguGvTillgangLayer,
        sguJorddjupLayer,
        clcLayer,
        waterWetnessLayer,
        // Vector layers on top
        jorddjupKartorLayer,
        jorddjupSprickLayer,
        jorddjupObsLayer,
        hypoFyllnadSmaLayer,
        hypoFyllnadStoraLayer,
        hypoSitSmaLayer,
        hypoSitStoraLayer,
        soilTypesLayer,
        waterBodiesLayer,
        aquifersLayer, 
        gwQualityLayer, 
        gwLevelsObservedLayer, 
        observationsLayer,
        wellsLayer,
        sourcesLayer,
        drawLayer,
        geolocationLayer,
      ],
      view: new View({
        center: proj4('EPSG:3006', 'EPSG:3857', [647927, 6638227]),
        zoom: 11,
        projection: "EPSG:3857", // Web Mercator for OSM compatibility
      }),
      controls: defaultControls({
        attribution: true,
        zoom: true,
      }),
    });

    mapInstanceRef.current = map;

    // Draw interaction for polygon data export
    const drawInteraction = new Draw({ source: drawSource, type: 'Polygon' });
    drawInteraction.setActive(false);
    drawInteraction.on('drawend', (event) => {
      const geom = event.feature.getGeometry() as Polygon;
      // Geodesic area from Web Mercator geometry
      const areaM2 = getArea(geom);
      // Transform to WGS84 to get bbox in lon/lat
      const geomWGS84 = geom.clone().transform('EPSG:3857', 'EPSG:4326') as Polygon;
      const ext = geomWGS84.getExtent(); // [minLon, minLat, maxLon, maxLat]
      setDrawnBbox([ext[0], ext[1], ext[2], ext[3]]);
      setDrawnAreaKm2(areaM2 / 1_000_000);
      drawInteraction.setActive(false);
      drawModeActiveRef.current = false;
      setDrawModeActive(false);
    });
    map.addInteraction(drawInteraction);
    drawInteractionRef.current = drawInteraction;

    // Track pointer coordinates
    map.on("pointermove", (evt) => {
      const coords = evt.coordinate;
      setCoordinates([coords[0], coords[1]]);
      
      // Change cursor when hovering over features
      const pixel = map.getEventPixel(evt.originalEvent);
      const hit = map.hasFeatureAtPixel(pixel, {
        layerFilter: (layer) => layer === sourcesLayer || layer === wellsLayer || layer === aquifersLayer || layer === waterBodiesLayer || layer === gwLevelsObservedLayer || layer === gwQualityLayer || layer === soilTypesLayer || layer === observationsLayer || layer === hypoFyllnadSmaLayer || layer === hypoFyllnadStoraLayer || layer === hypoSitSmaLayer || layer === hypoSitStoraLayer || layer === jorddjupObsLayer || layer === jorddjupKartorLayer || layer === jorddjupSprickLayer,
      });
      map.getTargetElement().style.cursor = hit ? "pointer" : "";
    });

    // Handle feature clicks - collect all features at the same location
    map.on("click", async (evt) => {
      // Suppress popup clicks while drawing a polygon
      if (drawModeActiveRef.current) return;

      // In rapport mode, set coordinate and show the analysis panel instead of feature popup
      if (rapportModeRef.current) {
        setRapportCoordinate([evt.coordinate[0], evt.coordinate[1]]);
        return;
      }

      const clickedItems: { properties: Record<string, any>; type: 'source' | 'well' | 'aquifer' | 'waterBody' | 'gwLevelsObserved' | 'gwQuality' | 'soilType' | 'gvTillgang' | 'observation' | 'hypoArea' | 'jorddjupObs' | 'jorddjupKartor' | 'jorddjupSprick' }[] = [];

      const hypoLayers = [hypoFyllnadSmaLayer, hypoFyllnadStoraLayer, hypoSitSmaLayer, hypoSitStoraLayer];
      map.forEachFeatureAtPixel(evt.pixel, (f, layer) => {
        if (layer === sourcesLayer || layer === wellsLayer || layer === aquifersLayer || layer === waterBodiesLayer || layer === gwLevelsObservedLayer || layer === gwQualityLayer || layer === soilTypesLayer || layer === observationsLayer || hypoLayers.includes(layer as any) || layer === jorddjupObsLayer || layer === jorddjupKartorLayer || layer === jorddjupSprickLayer) {
          const properties = f.getProperties();
          let type: 'source' | 'well' | 'aquifer' | 'waterBody' | 'gwLevelsObserved' | 'gwQuality' | 'soilType' | 'gvTillgang' | 'observation' | 'hypoArea' | 'jorddjupObs' | 'jorddjupKartor' | 'jorddjupSprick' = 'source';
          if (layer === wellsLayer) type = 'well';
          else if (layer === aquifersLayer) type = 'aquifer';
          else if (layer === waterBodiesLayer) type = 'waterBody';
          else if (layer === gwLevelsObservedLayer) type = 'gwLevelsObserved';
          else if (layer === gwQualityLayer) type = 'gwQuality';
          else if (layer === soilTypesLayer) type = 'soilType';
          else if (layer === observationsLayer) type = 'observation';
          else if (hypoLayers.includes(layer as any)) type = 'hypoArea';
          else if (layer === jorddjupObsLayer) type = 'jorddjupObs';
          else if (layer === jorddjupKartorLayer) type = 'jorddjupKartor';
          else if (layer === jorddjupSprickLayer) type = 'jorddjupSprick';
          clickedItems.push({ properties, type });
        }
      });
      
      // Query GV Tillgång WMS GetFeatureInfo if layer is visible
      if (sguGvTillgangLayerRef.current?.getVisible()) {
        try {
          const viewResolution = map.getView().getResolution() || 1;
          const wmsSource = sguGvTillgangLayerRef.current.getSource();
          if (wmsSource) {
            const infoUrl = wmsSource.getFeatureInfoUrl(
              evt.coordinate,
              viewResolution,
              'EPSG:3857',
              { 'INFO_FORMAT': 'application/json' }
            );
            if (infoUrl) {
              const response = await fetch(infoUrl);
              if (response.ok) {
                const data = await response.json();
                if (data.features && data.features.length > 0) {
                  for (const feature of data.features) {
                    clickedItems.push({
                      properties: feature.properties || {},
                      type: 'gvTillgang',
                    });
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("Error querying GV Tillgång:", error);
        }
      }

      if (clickedItems.length > 0) {
        // Enrich magasinsdelomraden features with parent grundvattenmagasin data
        // (adds lank_magasinsbeskrivning, tillrinning, medelmaktighet, etc.)
        const aquiferIndices = clickedItems
          .map((item, i) => item.type === 'aquifer' ? i : -1)
          .filter(i => i >= 0);
        if (aquiferIndices.length > 0) {
          try {
            const lon = (evt.coordinate[0] / 20037508.34) * 180;
            const lat = (Math.atan(Math.exp((evt.coordinate[1] / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
            const gvmUrl = `https://api.sgu.se/oppnadata/grundvattenmagasin/ogc/features/v1/collections/grundvattenmagasin/items?f=json&filter=${encodeURIComponent(`S_INTERSECTS(geom,POINT(${lon} ${lat}))`)}&filter-lang=cql2-text&limit=1`;
            const res = await fetch(gvmUrl);
            if (res.ok) {
              const data = await res.json();
              if (data.features?.length > 0) {
                const gvmProps = data.features[0].properties ?? {};
                for (const idx of aquiferIndices) {
                  // GVM props go first so delomrade-specific fields (uttagsmojligheter etc.) take precedence
                  clickedItems[idx] = {
                    ...clickedItems[idx],
                    properties: { ...gvmProps, ...clickedItems[idx].properties },
                  };
                }
              }
            }
          } catch { /* non-critical enrichment */ }
        }

        setSelectedFeatures(clickedItems);
        setSelectedFeatureIndex(0);
      }
    });

    // Update zoom level state on zoom change
    map.getView().on('change:resolution', () => {
      const zoom = map.getView().getZoom() || 0;
      setCurrentZoom(zoom);
    });
    
    // Load data when map movement ends (panning or zooming)
    map.on('moveend', () => {
      const zoom = map.getView().getZoom() || 0;
      const extent = map.getView().calculateExtent();

      // Water bodies load at zoom >= 7
      if (zoom >= 7 && waterBodiesLayerRef.current?.getVisible() && loadWaterBodiesForExtentRef.current) {
        loadWaterBodiesForExtentRef.current(extent);
      }

      // Aquifers load at zoom >= 9
      if (zoom >= 9 && aquifersLayerRef.current?.getVisible() && loadAquifersForExtentRef.current) {
        loadAquifersForExtentRef.current(extent);
      }

      // Sources load at zoom >= 10
      if (zoom >= 10 && sourcesLayerRef.current?.getVisible() && loadSourcesForExtentRef.current) {
        loadSourcesForExtentRef.current(extent);
      }

      // Other vector layers load at zoom >= 12
      if (zoom >= 12) {
        if (wellsLayerRef.current?.getVisible() && loadWellsForExtentRef.current) {
          loadWellsForExtentRef.current(extent);
        }

        if (soilTypesLayerRef.current?.getVisible() && loadSoilTypesForExtentRef.current) {
          loadSoilTypesForExtentRef.current(extent);
        }

        if (jorddjupObsLayerRef.current?.getVisible() && loadJorddjupObsForExtentRef.current) {
          loadJorddjupObsForExtentRef.current(extent);
        }
        if (jorddjupKartorLayerRef.current?.getVisible() && loadJorddjupKartorForExtentRef.current) {
          loadJorddjupKartorForExtentRef.current(extent);
        }
        if (jorddjupSprickLayerRef.current?.getVisible() && loadJorddjupSprickForExtentRef.current) {
          loadJorddjupSprickForExtentRef.current(extent);
        }
      }
    });

    toast.success("Karta laddad!");

    return () => {
      map.setTarget(undefined);
      // Clean up geolocation watch
      if (geolocationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geolocationWatchRef.current);
      }
    };
  }, []);

  // Geolocation tracking - start/stop watching position
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Positionering stöds inte i din webbläsare");
      return;
    }
    
    setIsTracking(true);
    
    const updatePosition = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      const x = longitude * 20037508.34 / 180;
      const y = Math.log(Math.tan((90 + latitude) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180;
      
      const source = geolocationLayerRef.current?.getSource();
      if (source) {
        source.clear();
        const feature = new Feature({ geometry: new Point([x, y]) });
        source.addFeature(feature);
      }
    };

    // Get initial position and pan to it
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updatePosition(position);
        const { latitude, longitude } = position.coords;
        const x = longitude * 20037508.34 / 180;
        const y = Math.log(Math.tan((90 + latitude) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180;
        mapInstanceRef.current?.getView().animate({ center: [x, y], zoom: 15, duration: 1000 });
        toast.success("Din position hittad");
      },
      (err) => {
        console.error("Geolocation error:", err);
        toast.error("Kunde inte hämta din position");
        setIsTracking(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    // Watch for updates
    geolocationWatchRef.current = navigator.geolocation.watchPosition(
      updatePosition,
      (err) => console.error("Watch error:", err),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }, []);

  const stopTracking = useCallback(() => {
    if (geolocationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(geolocationWatchRef.current);
      geolocationWatchRef.current = null;
    }
    geolocationLayerRef.current?.getSource()?.clear();
    setIsTracking(false);
  }, []);

  // Update Sources visibility and load data when enabled
  useEffect(() => {
    if (sourcesLayerRef.current) {
      sourcesLayerRef.current.setVisible(sourcesVisible);
      if (sourcesVisible && mapInstanceRef.current && loadSourcesForExtentRef.current) {
        const zoom = mapInstanceRef.current.getView().getZoom() || 0;
        if (zoom < 10) {
          toast.info("Zooma in för att ladda källor (minst zoomnivå 10)");
        } else {
          const extent = mapInstanceRef.current.getView().calculateExtent();
          loadSourcesForExtentRef.current(extent);
        }
      }
    }
  }, [sourcesVisible]);

  // Update Wells visibility and load data when enabled
  useEffect(() => {
    if (wellsLayerRef.current) {
      wellsLayerRef.current.setVisible(wellsVisible);
      if (wellsVisible && mapInstanceRef.current && loadWellsForExtentRef.current) {
        const currentZoom = mapInstanceRef.current.getView().getZoom() || 0;
        if (currentZoom < 12) {
          toast.info("Zooma in för att ladda brunnar (minst zoomnivå 12)");
        } else {
          const extent = mapInstanceRef.current.getView().calculateExtent();
          loadWellsForExtentRef.current(extent);
        }
      }
    }
  }, [wellsVisible]);

  // Update Aquifers visibility and load data when enabled
  useEffect(() => {
    if (aquifersLayerRef.current) {
      if (!aquifersVisible) {
        clearAquifersRef.current?.();
      } else if (mapInstanceRef.current) {
        const zoom = mapInstanceRef.current.getView().getZoom() || 0;
        if (zoom >= 9 && loadAquifersForExtentRef.current) {
          loadAquifersForExtentRef.current(mapInstanceRef.current.getView().calculateExtent());
        }
      }
      aquifersLayerRef.current.setVisible(aquifersVisible);
    }
  }, [aquifersVisible]);

  // Update Aquifers opacity
  useEffect(() => {
    if (aquifersLayerRef.current) {
      aquifersLayerRef.current.setOpacity(aquifersOpacity);
    }
  }, [aquifersOpacity]);

  // Update Soil Types visibility and load data when enabled
  useEffect(() => {
    if (soilTypesLayerRef.current) {
      if (!soilTypesVisible) {
        clearSoilTypesRef.current?.();
      } else if (mapInstanceRef.current && loadSoilTypesForExtentRef.current) {
        const currentZoom = mapInstanceRef.current.getView().getZoom() || 0;
        if (currentZoom < 12) {
          toast.info("Zooma in för att ladda jordarter (minst zoomnivå 12)");
        } else {
          loadSoilTypesForExtentRef.current(mapInstanceRef.current.getView().calculateExtent());
        }
      }
      soilTypesLayerRef.current.setVisible(soilTypesVisible);
    }
  }, [soilTypesVisible]);

  // Update Soil Types opacity
  useEffect(() => {
    if (soilTypesLayerRef.current) {
      soilTypesLayerRef.current.setOpacity(soilTypesOpacity);
    }
  }, [soilTypesOpacity]);

  // Update Water Bodies visibility and load data when enabled
  useEffect(() => {
    if (waterBodiesLayerRef.current) {
      if (!waterBodiesVisible) {
        clearWaterBodiesRef.current?.();
      } else if (mapInstanceRef.current) {
        const zoom = mapInstanceRef.current.getView().getZoom() || 0;
        if (zoom >= 7 && loadWaterBodiesForExtentRef.current) {
          loadWaterBodiesForExtentRef.current(mapInstanceRef.current.getView().calculateExtent());
        }
      }
      waterBodiesLayerRef.current.setVisible(waterBodiesVisible);
    }
  }, [waterBodiesVisible]);

  // Update Observed GW Levels visibility and load data when enabled
  useEffect(() => {
    const layer = gwLevelsObservedLayerRef.current;
    if (layer) {
      if (!gwLevelsObservedVisible) {
        layer.setVisible(false);
        layer.getSource()?.refresh();
        setGwLevelsObservedLoaded(0);
      } else {
        layer.setVisible(true);
      }
    }
  }, [gwLevelsObservedVisible]);

  // Update Groundwater Quality visibility and load data when enabled
  useEffect(() => {
    const layer = gwQualityLayerRef.current;
    if (layer) {
      if (!gwQualityVisible) {
        layer.setVisible(false);
        layer.getSource()?.refresh();
        setGwQualityLoaded(0);
      } else {
        layer.setVisible(true);
      }
    }
  }, [gwQualityVisible]);

  // Update Observations visibility and load data when enabled
  useEffect(() => {
    const layer = observationsLayerRef.current;
    if (layer) {
      if (!observationsVisible) {
        layer.setVisible(false);
        layer.getSource()?.refresh();
        setObservationsLoaded(0);
      } else {
        layer.setVisible(true);
      }
    }
  }, [observationsVisible]);

  // Update Lantmäteriet Topografisk Webbkarta visibility
  useEffect(() => {
    if (topoWebbLayerRef.current) {
      topoWebbLayerRef.current.setVisible(topoWebbVisible);
    }
  }, [topoWebbVisible]);

  // Update Lantmäteriet Ortofoto visibility
  useEffect(() => {
    if (ortofotoLayerRef.current) {
      ortofotoLayerRef.current.setVisible(ortofotoVisible);
    }
  }, [ortofotoVisible]);

  // Update Lantmäteriet Terrängskuggning visibility
  useEffect(() => {
    if (terrangskuggningLayerRef.current) {
      terrangskuggningLayerRef.current.setVisible(terrangskuggningVisible);
    }
  }, [terrangskuggningVisible]);

  // Update Lantmäteriet Terrängskuggning opacity
  useEffect(() => {
    if (terrangskuggningLayerRef.current) {
      terrangskuggningLayerRef.current.setOpacity(terrangskuggningOpacity);
    }
  }, [terrangskuggningOpacity]);

  // Update SGU Berggrund 1M visibility
  useEffect(() => {
    if (sguBerggrund1MLayerRef.current) {
      sguBerggrund1MLayerRef.current.setVisible(sguBerggrund1MVisible);
    }
  }, [sguBerggrund1MVisible]);

  // Update SGU Berggrund 1M opacity
  useEffect(() => {
    if (sguBerggrund1MLayerRef.current) {
      sguBerggrund1MLayerRef.current.setOpacity(sguBerggrund1MOpacity);
    }
  }, [sguBerggrund1MOpacity]);

  // Update SGU Berggrund 50k visibility
  useEffect(() => {
    if (sguBerggrund50kLayerRef.current) {
      sguBerggrund50kLayerRef.current.setVisible(sguBerggrund50kVisible);
    }
  }, [sguBerggrund50kVisible]);

  // Update SGU Berggrund 50k opacity
  useEffect(() => {
    if (sguBerggrund50kLayerRef.current) {
      sguBerggrund50kLayerRef.current.setOpacity(sguBerggrund50kOpacity);
    }
  }, [sguBerggrund50kOpacity]);

  // Update SGU Jordarter 1M visibility
  useEffect(() => {
    if (sguJordarter1MLayerRef.current) {
      sguJordarter1MLayerRef.current.setVisible(sguJordarter1MVisible);
    }
  }, [sguJordarter1MVisible]);

  // Update SGU Jordarter 1M opacity
  useEffect(() => {
    if (sguJordarter1MLayerRef.current) {
      sguJordarter1MLayerRef.current.setOpacity(sguJordarter1MOpacity);
    }
  }, [sguJordarter1MOpacity]);

  // Update SGU Jordarter 25k visibility
  useEffect(() => {
    if (sguJordarter25kLayerRef.current) {
      sguJordarter25kLayerRef.current.setVisible(sguJordarter25kVisible);
    }
  }, [sguJordarter25kVisible]);

  // Update SGU Jordarter 25k opacity
  useEffect(() => {
    if (sguJordarter25kLayerRef.current) {
      sguJordarter25kLayerRef.current.setOpacity(sguJordarter25kOpacity);
    }
  }, [sguJordarter25kOpacity]);

  // Update SGU GV Tillgång visibility
  useEffect(() => {
    if (sguGvTillgangLayerRef.current) {
      sguGvTillgangLayerRef.current.setVisible(sguGvTillgangVisible);
    }
  }, [sguGvTillgangVisible]);

  // Update SGU GV Tillgång opacity
  useEffect(() => {
    if (sguGvTillgangLayerRef.current) {
      sguGvTillgangLayerRef.current.setOpacity(sguGvTillgangOpacity);
    }
  }, [sguGvTillgangOpacity]);

  // Update SGU Jorddjup visibility
  useEffect(() => {
    if (sguJorddjupLayerRef.current) {
      sguJorddjupLayerRef.current.setVisible(sguJorddjupVisible);
    }
  }, [sguJorddjupVisible]);

  // Update SGU Jorddjup opacity
  useEffect(() => {
    if (sguJorddjupLayerRef.current) {
      sguJorddjupLayerRef.current.setOpacity(sguJorddjupOpacity);
    }
  }, [sguJorddjupOpacity]);

  useEffect(() => { clcLayerRef.current?.setVisible(clcVisible); }, [clcVisible]);
  useEffect(() => { clcLayerRef.current?.setOpacity(clcOpacity); }, [clcOpacity]);
  useEffect(() => { waterWetnessLayerRef.current?.setVisible(waterWetnessVisible); }, [waterWetnessVisible]);
  useEffect(() => { waterWetnessLayerRef.current?.setOpacity(waterWetnessOpacity); }, [waterWetnessOpacity]);

  // Jorddjupsmodell – extent-based loading (minzoom 12), same pattern as brunnar
  useEffect(() => {
    if (jorddjupObsLayerRef.current) {
      if (!jorddjupObsVisible) {
        clearJorddjupObsRef.current?.();
      } else if (mapInstanceRef.current && loadJorddjupObsForExtentRef.current) {
        const zoom = mapInstanceRef.current.getView().getZoom() || 0;
        if (zoom < 12) toast.info("Zooma in för att ladda jorddjupsobservationer (minst zoomnivå 12)");
        else loadJorddjupObsForExtentRef.current(mapInstanceRef.current.getView().calculateExtent());
      }
      jorddjupObsLayerRef.current.setVisible(jorddjupObsVisible);
    }
  }, [jorddjupObsVisible]);

  useEffect(() => {
    if (jorddjupKartorLayerRef.current) {
      if (!jorddjupKartorVisible) {
        clearJorddjupKartorRef.current?.();
      } else if (mapInstanceRef.current && loadJorddjupKartorForExtentRef.current) {
        const zoom = mapInstanceRef.current.getView().getZoom() || 0;
        if (zoom < 12) toast.info("Zooma in för att ladda jordartskartor (minst zoomnivå 12)");
        else loadJorddjupKartorForExtentRef.current(mapInstanceRef.current.getView().calculateExtent());
      }
      jorddjupKartorLayerRef.current.setVisible(jorddjupKartorVisible);
    }
  }, [jorddjupKartorVisible]);

  useEffect(() => {
    if (jorddjupSprickLayerRef.current) {
      if (!jorddjupSprickVisible) {
        clearJorddjupSprickRef.current?.();
      } else if (mapInstanceRef.current && loadJorddjupSprickForExtentRef.current) {
        const zoom = mapInstanceRef.current.getView().getZoom() || 0;
        if (zoom < 12) toast.info("Zooma in för att ladda sprickzoner (minst zoomnivå 12)");
        else loadJorddjupSprickForExtentRef.current(mapInstanceRef.current.getView().calculateExtent());
      }
      jorddjupSprickLayerRef.current.setVisible(jorddjupSprickVisible);
    }
  }, [jorddjupSprickVisible]);

  // Update all four HYPE layer visibilities; trigger source load when any becomes visible
  useEffect(() => {
    const anyVisible = hypoFyllnadSmaVisible || hypoFyllnadStoraVisible || hypoSitSmaVisible || hypoSitStoraVisible;
    hypoFyllnadSmaLayerRef.current?.setVisible(hypoFyllnadSmaVisible);
    hypoFyllnadStoraLayerRef.current?.setVisible(hypoFyllnadStoraVisible);
    hypoSitSmaLayerRef.current?.setVisible(hypoSitSmaVisible);
    hypoSitStoraLayerRef.current?.setVisible(hypoSitStoraVisible);
    // Keep source cached when hidden – data is re-used on next show without a fetch
  }, [hypoFyllnadSmaVisible, hypoFyllnadStoraVisible, hypoSitSmaVisible, hypoSitStoraVisible]);

  // Update HYPE opacity (shared across all four layers)
  useEffect(() => {
    [hypoFyllnadSmaLayerRef, hypoFyllnadStoraLayerRef, hypoSitSmaLayerRef, hypoSitStoraLayerRef]
      .forEach(r => r.current?.setOpacity(hypoAreasOpacity));
  }, [hypoAreasOpacity]);

  // Keep date ref in sync
  useEffect(() => {
    hypoAreasDateRef.current = hypoAreasDate;
  }, [hypoAreasDate]);

  // Re-fetch level data when date changes (only if polygons already loaded).
  // Debounce so partial typed dates don't trigger mid-entry fetches.
  useEffect(() => {
    const source = hypoAreasSourceRef.current;
    if (!source || source.getFeatures().length === 0) return;
    const timer = setTimeout(() => {
      fetchAndJoinHypoLevelsRef.current?.(hypoAreasDate);
    }, 500);
    return () => clearTimeout(timer);
  }, [hypoAreasDate]);

  const handleSearchResult = (coordinates: [number, number], zoom?: number) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.getView().animate({
        center: coordinates,
        zoom: zoom || 14,
        duration: 1000,
      });
    }
  };

  const [activePanel, setActivePanel] = useState<'search' | 'locate' | 'layers' | null>(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [grundvattenAnalysData, setGrundvattenAnalysData] = useState<string | null>(null);
  const [rapportMode, setRapportMode] = useState(false);
  const [rapportCoordinate, setRapportCoordinate] = useState<[number, number] | null>(null);
  const [drawModeActive, setDrawModeActive] = useState(false);
  const [drawnBbox, setDrawnBbox] = useState<[number, number, number, number] | null>(null);
  const [drawnAreaKm2, setDrawnAreaKm2] = useState(0);
  const wmsProxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wms-proxy`;

  // Keep rapportModeRef in sync so the map click handler closure can read current value
  useEffect(() => {
    rapportModeRef.current = rapportMode;
  }, [rapportMode]);

  // Activate / deactivate the Draw interaction
  useEffect(() => {
    if (!drawInteractionRef.current) return;
    drawModeActiveRef.current = drawModeActive;
    drawInteractionRef.current.setActive(drawModeActive);
    if (drawModeActive && drawSourceRef.current) {
      // Clear any previous polygon when entering draw mode
      drawSourceRef.current.clear();
      setDrawnBbox(null);
    }
  }, [drawModeActive]);

  // Escape key cancels drawing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawModeActive) {
        drawInteractionRef.current?.abortDrawing();
        drawInteractionRef.current?.setActive(false);
        drawModeActiveRef.current = false;
        setDrawModeActive(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawModeActive]);

  const openPanel = (panel: 'search' | 'locate' | 'layers') => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  const closePanel = () => setActivePanel(null);

  return (
    <div className="relative w-full h-screen">
      <div ref={mapRef} className="absolute inset-0" />
      
      <SearchControl
        onSearchResult={handleSearchResult}
        isOpen={activePanel === 'search'}
        onClose={closePanel}
      />

      {/* Right-side icon toolbar */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 pr-0">
        <div className="flex flex-col bg-card/95 backdrop-blur-sm shadow-lg border border-border rounded-l-xl overflow-hidden">
          {/* Sök */}
          <button
            onClick={() => openPanel('search')}
            className={`w-12 h-12 flex items-center justify-center transition-colors ${activePanel === 'search' ? 'bg-sgu-maroon text-white' : 'hover:bg-secondary text-muted-foreground'}`}
            title="Sök plats"
          >
            <Search className="w-5 h-5" />
          </button>
          <div className="h-px bg-border mx-2" />
          {/* Positionering */}
          <button
            onClick={() => { isTracking ? stopTracking() : startTracking(); }}
            className={`w-12 h-12 flex items-center justify-center transition-colors ${isTracking ? 'bg-sgu-maroon text-white' : 'hover:bg-secondary text-muted-foreground'}`}
            title={isTracking ? "Stoppa positionering" : "Min position"}
          >
            <Locate className={`w-5 h-5 ${isTracking ? 'animate-pulse' : ''}`} />
          </button>
          <div className="h-px bg-border mx-2" />
          {/* Kartlager */}
          <button
            onClick={() => openPanel('layers')}
            className={`w-12 h-12 flex items-center justify-center transition-colors ${activePanel === 'layers' ? 'bg-sgu-maroon text-white' : 'hover:bg-secondary text-muted-foreground'}`}
            title="Kartlager"
          >
            <Layers className="w-5 h-5" />
          </button>
          <div className="h-px bg-border mx-2" />
          {/* Grundvattenanalys */}
          <button
            onClick={() => {
              setRapportMode(prev => !prev);
              setRapportCoordinate(null);
            }}
            className={`w-12 h-12 flex items-center justify-center transition-colors ${rapportMode ? 'bg-sgu-maroon text-white' : 'hover:bg-secondary text-muted-foreground'}`}
            title={rapportMode ? 'Avsluta grundvattenanalys' : 'Grundvattenanalys – klicka på kartan'}
          >
            <Droplets className="w-5 h-5" />
          </button>
          <div className="h-px bg-border mx-2" />
          {/* Rita polygon */}
          <button
            onClick={() => setDrawModeActive(prev => !prev)}
            className={`w-12 h-12 flex items-center justify-center transition-colors ${drawModeActive ? 'bg-sgu-maroon text-white' : 'hover:bg-secondary text-muted-foreground'}`}
            title={drawModeActive ? 'Avbryt ritning (Esc)' : 'Rita polygon – hämta data i område'}
          >
            <PenLine className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <LayerPanel
        isOpen={activePanel === 'layers'}
        onClose={closePanel}
        sourcesVisible={sourcesVisible}
        wellsVisible={wellsVisible}
        aquifersVisible={aquifersVisible}
        aquifersOpacity={aquifersOpacity}
        soilTypesVisible={soilTypesVisible}
        soilTypesOpacity={soilTypesOpacity}
        waterBodiesVisible={waterBodiesVisible}
        gwLevelsObservedVisible={gwLevelsObservedVisible}
        gwQualityVisible={gwQualityVisible}
        observationsVisible={observationsVisible}
        topoWebbVisible={topoWebbVisible}
        ortofotoVisible={ortofotoVisible}
        terrangskuggningVisible={terrangskuggningVisible}
        terrangskuggningOpacity={terrangskuggningOpacity}
        sguBerggrund1MVisible={sguBerggrund1MVisible}
        sguBerggrund1MOpacity={sguBerggrund1MOpacity}
        sguBerggrund50kVisible={sguBerggrund50kVisible}
        sguBerggrund50kOpacity={sguBerggrund50kOpacity}
        sguJordarter1MVisible={sguJordarter1MVisible}
        sguJordarter1MOpacity={sguJordarter1MOpacity}
        sguJordarter25kVisible={sguJordarter25kVisible}
        sguJordarter25kOpacity={sguJordarter25kOpacity}
        sguGvTillgangVisible={sguGvTillgangVisible}
        sguGvTillgangOpacity={sguGvTillgangOpacity}
        sourcesLoaded={sourcesLoaded}
        wellsLoaded={wellsLoaded}
        aquifersLoaded={aquifersLoaded}
        soilTypesLoaded={soilTypesLoaded}
        waterBodiesLoaded={waterBodiesLoaded}
        gwLevelsObservedLoaded={gwLevelsObservedLoaded}
        gwQualityLoaded={gwQualityLoaded}
        observationsLoaded={observationsLoaded}
        jorddjupObsVisible={jorddjupObsVisible}
        jorddjupKartorVisible={jorddjupKartorVisible}
        jorddjupSprickVisible={jorddjupSprickVisible}
        loadingJorddjupObs={loadingJorddjupObs}
        loadingJorddjupKartor={loadingJorddjupKartor}
        loadingJorddjupSprick={loadingJorddjupSprick}
        jorddjupObsLoaded={jorddjupObsLoaded}
        jorddjupKartorLoaded={jorddjupKartorLoaded}
        jorddjupSprickLoaded={jorddjupSprickLoaded}
        onJorddjupObsVisibleChange={setJorddjupObsVisible}
        onJorddjupKartorVisibleChange={setJorddjupKartorVisible}
        onJorddjupSprickVisibleChange={setJorddjupSprickVisible}
        onClearJorddjupObs={() => { jorddjupObsLayerRef.current?.getSource()?.clear(); setJorddjupObsLoaded(0); }}
        onClearJorddjupKartor={() => { jorddjupKartorLayerRef.current?.getSource()?.clear(); setJorddjupKartorLoaded(0); }}
        onClearJorddjupSprick={() => { jorddjupSprickLayerRef.current?.getSource()?.clear(); setJorddjupSprickLoaded(0); }}
        hypoFyllnadSmaVisible={hypoFyllnadSmaVisible}
        hypoFyllnadStoraVisible={hypoFyllnadStoraVisible}
        hypoSitSmaVisible={hypoSitSmaVisible}
        hypoSitStoraVisible={hypoSitStoraVisible}
        loadingHypoAreas={loadingHypoAreas}
        hypoAreasLoaded={hypoAreasLoaded}
        hypoAreasOpacity={hypoAreasOpacity}
        hypoAreasDate={hypoAreasDate}
        onHypoFyllnadSmaVisibleChange={setHypoFyllnadSmaVisible}
        onHypoFyllnadStoraVisibleChange={setHypoFyllnadStoraVisible}
        onHypoSitSmaVisibleChange={setHypoSitSmaVisible}
        onHypoSitStoraVisibleChange={setHypoSitStoraVisible}
        onHypoAreasOpacityChange={setHypoAreasOpacity}
        onHypoAreasDateChange={(date) => {
          setHypoAreasDate(date);
          hypoAreasDateRef.current = date;
        }}
        onClearHypoAreas={() => {
          hypoAreasSourceRef.current?.clear();
          setHypoAreasLoaded(0);
        }}
        onSourcesVisibleChange={setSourcesVisible}
        onWellsVisibleChange={setWellsVisible}
        onAquifersVisibleChange={setAquifersVisible}
        onAquifersOpacityChange={setAquifersOpacity}
        onSoilTypesVisibleChange={setSoilTypesVisible}
        onSoilTypesOpacityChange={setSoilTypesOpacity}
        onWaterBodiesVisibleChange={setWaterBodiesVisible}
        onGwLevelsObservedVisibleChange={setGwLevelsObservedVisible}
        onGwQualityVisibleChange={setGwQualityVisible}
        onObservationsVisibleChange={setObservationsVisible}
        onTopoWebbVisibleChange={setTopoWebbVisible}
        onOrtofotoVisibleChange={setOrtofotoVisible}
        onTerrangskuggningVisibleChange={setTerrangskuggningVisible}
        onTerrangskuggningOpacityChange={setTerrangskuggningOpacity}
        onSguBerggrund1MVisibleChange={setSguBerggrund1MVisible}
        onSguBerggrund1MOpacityChange={setSguBerggrund1MOpacity}
        onSguBerggrund50kVisibleChange={setSguBerggrund50kVisible}
        onSguBerggrund50kOpacityChange={setSguBerggrund50kOpacity}
        onSguJordarter1MVisibleChange={setSguJordarter1MVisible}
        onSguJordarter1MOpacityChange={setSguJordarter1MOpacity}
        onSguJordarter25kVisibleChange={setSguJordarter25kVisible}
        onSguJordarter25kOpacityChange={setSguJordarter25kOpacity}
        onSguGvTillgangVisibleChange={setSguGvTillgangVisible}
        onSguGvTillgangOpacityChange={setSguGvTillgangOpacity}
        sguJorddjupVisible={sguJorddjupVisible}
        sguJorddjupOpacity={sguJorddjupOpacity}
        onSguJorddjupVisibleChange={setSguJorddjupVisible}
        onSguJorddjupOpacityChange={setSguJorddjupOpacity}
        clcVisible={clcVisible}
        clcOpacity={clcOpacity}
        onClcVisibleChange={setClcVisible}
        onClcOpacityChange={setClcOpacity}
        waterWetnessVisible={waterWetnessVisible}
        waterWetnessOpacity={waterWetnessOpacity}
        onWaterWetnessVisibleChange={setWaterWetnessVisible}
        onWaterWetnessOpacityChange={setWaterWetnessOpacity}
        onDownloadGvTillgangGeoTiff={() => {
          if (!mapInstanceRef.current) return;
          const extent = mapInstanceRef.current.getView().calculateExtent();
          // Convert Web Mercator to WGS84
          const minLon = (extent[0] / 20037508.34) * 180;
          const maxLon = (extent[2] / 20037508.34) * 180;
          const minLat = (Math.atan(Math.exp((extent[1] / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
          const maxLat = (Math.atan(Math.exp((extent[3] / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
          
          // Convert WGS84 to approximate SWEREF99 TM (EPSG:3006) for WCS subsetting
          // Using proj4 for accurate conversion
          const ll = proj4('EPSG:4326', 'EPSG:3006', [minLon, minLat]);
          const ur = proj4('EPSG:4326', 'EPSG:3006', [maxLon, maxLat]);
          
          const wcsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wms-proxy?url=${encodeURIComponent('https://api.sgu.se/oppnadata/grundvattentillgang-sma-magasin/wcs')}&SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=grundvattentillgang-sma-magasin&FORMAT=image/tiff&SUBSET=E(${Math.floor(ll[0])},${Math.ceil(ur[0])})&SUBSET=N(${Math.floor(ll[1])},${Math.ceil(ur[1])})`;
          
          toast.info('Laddar ner GeoTIFF...');
          
          fetch(wcsUrl)
            .then(response => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return response.blob();
            })
            .then(blob => {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `grundvattentillgang_sma_magasin_${Math.floor(ll[0])}_${Math.floor(ll[1])}.tif`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              toast.success('GeoTIFF nedladdad!');
            })
            .catch(error => {
              console.error('GeoTIFF download error:', error);
              toast.error('Kunde inte ladda ner GeoTIFF');
            });
        }}
        onExportWells={() => {
          if (wellsLayerRef.current) {
            const features = wellsLayerRef.current.getSource()?.getFeatures() || [];
            if (features.length > 0) {
              try {
                exportWellsToCSV(features);
                toast.success(`Exporterade ${features.length} brunnar till CSV`);
              } catch (error) {
                toast.error('Kunde inte exportera brunnar');
              }
            } else {
              toast.info('Inga brunnar att exportera');
            }
          }
        }}
        onClearWells={() => {
          if (wellsLayerRef.current) {
            wellsLayerRef.current.getSource()?.clear();
            setWellsLoaded(0);
            toast.success('Rensade alla brunnar');
          }
        }}
        onExportSources={() => {
          const features = sourcesLayerRef.current?.getSource()?.getFeatures() || [];
          if (features.length > 0) {
            try { exportFeaturesToCSV(features, 'kallor'); toast.success(`Exporterade ${features.length} källor till CSV`); }
            catch { toast.error('Kunde inte exportera källor'); }
          } else { toast.info('Inga källor att exportera'); }
        }}
        onClearSources={() => {
          if (sourcesLayerRef.current) { sourcesLayerRef.current.getSource()?.clear(); setSourcesLoaded(0); toast.success('Rensade alla källor'); }
        }}
        onExportAquifers={() => {
          const features = aquifersLayerRef.current?.getSource()?.getFeatures() || [];
          if (features.length > 0) {
            try { exportFeaturesToCSV(features, 'grundvattenmagasin'); toast.success(`Exporterade ${features.length} magasin till CSV`); }
            catch { toast.error('Kunde inte exportera magasin'); }
          } else { toast.info('Inga magasin att exportera'); }
        }}
        onClearAquifers={() => {
          if (aquifersLayerRef.current) { aquifersLayerRef.current.getSource()?.clear(); setAquifersLoaded(0); toast.success('Rensade alla magasin'); }
        }}
        onExportSoilTypes={() => {
          const features = soilTypesLayerRef.current?.getSource()?.getFeatures() || [];
          if (features.length > 0) {
            try { exportFeaturesToCSV(features, 'jordarter'); toast.success(`Exporterade ${features.length} jordarter till CSV`); }
            catch { toast.error('Kunde inte exportera jordarter'); }
          } else { toast.info('Inga jordarter att exportera'); }
        }}
        onClearSoilTypes={() => {
          if (soilTypesLayerRef.current) { soilTypesLayerRef.current.getSource()?.clear(); setSoilTypesLoaded(0); toast.success('Rensade alla jordarter'); }
        }}
        onExportWaterBodies={() => {
          const features = waterBodiesLayerRef.current?.getSource()?.getFeatures() || [];
          if (features.length > 0) {
            try { exportFeaturesToCSV(features, 'grundvattenforekomster'); toast.success(`Exporterade ${features.length} förekomster till CSV`); }
            catch { toast.error('Kunde inte exportera förekomster'); }
          } else { toast.info('Inga förekomster att exportera'); }
        }}
        onClearWaterBodies={() => {
          if (waterBodiesLayerRef.current) { waterBodiesLayerRef.current.getSource()?.clear(); setWaterBodiesLoaded(0); toast.success('Rensade alla förekomster'); }
        }}
        onExportGwLevelsObserved={() => {
          const features = gwLevelsObservedLayerRef.current?.getSource()?.getFeatures() || [];
          if (features.length > 0) {
            try { exportFeaturesToCSV(features, 'grundvattennivaer_observerade'); toast.success(`Exporterade ${features.length} stationer till CSV`); }
            catch { toast.error('Kunde inte exportera stationer'); }
          } else { toast.info('Inga stationer att exportera'); }
        }}
        onClearGwLevelsObserved={() => {
          if (gwLevelsObservedLayerRef.current) { gwLevelsObservedLayerRef.current.getSource()?.clear(); setGwLevelsObservedLoaded(0); toast.success('Rensade alla stationer'); }
        }}
        onExportGwQuality={() => {
          const features = gwQualityLayerRef.current?.getSource()?.getFeatures() || [];
          if (features.length > 0) {
            try { exportFeaturesToCSV(features, 'grundvattenkvalitet'); toast.success(`Exporterade ${features.length} provplatser till CSV`); }
            catch { toast.error('Kunde inte exportera provplatser'); }
          } else { toast.info('Inga provplatser att exportera'); }
        }}
        onClearGwQuality={() => {
          if (gwQualityLayerRef.current) { gwQualityLayerRef.current.getSource()?.clear(); setGwQualityLoaded(0); toast.success('Rensade alla provplatser'); }
        }}
        onExportObservations={() => {
          const features = observationsLayerRef.current?.getSource()?.getFeatures() || [];
          if (features.length > 0) {
            try { exportFeaturesToCSV(features, 'observationer'); toast.success(`Exporterade ${features.length} observationer till CSV`); }
            catch { toast.error('Kunde inte exportera observationer'); }
          } else { toast.info('Inga observationer att exportera'); }
        }}
        onClearObservations={() => {
          if (observationsLayerRef.current) { observationsLayerRef.current.getSource()?.clear(); setObservationsLoaded(0); toast.success('Rensade alla observationer'); }
        }}
      />
      
      <CoordinateDisplay coordinates={coordinates} zoom={currentZoom} />
      
      {(loadingSources || loadingWells || loadingAquifers || loadingSoilTypes || loadingWaterBodies || loadingGwLevelsObserved || loadingGwQuality || loadingObservations) && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-background/95 backdrop-blur-sm p-4 rounded-lg shadow-lg border z-10 min-w-[300px]">
          <div className="space-y-3">
            {loadingSources && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Laddar källor...</span>
                  <span className="text-muted-foreground">{sourcesLoaded} källor</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300 rounded-full animate-pulse" style={{ width: '100%' }} />
                </div>
              </div>
            )}
            {loadingWells && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Laddar brunnar...</span>
                  <span className="text-muted-foreground">{wellsLoaded} brunnar</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300 rounded-full animate-pulse" style={{ width: '100%' }} />
                </div>
              </div>
            )}
            {loadingAquifers && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Laddar magasinsdelområden...</span>
                  <span className="text-muted-foreground">{aquifersLoaded} delområden</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300 rounded-full animate-pulse" style={{ width: '100%' }} />
                </div>
              </div>
            )}
            {loadingSoilTypes && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Laddar jordarter...</span>
                  <span className="text-muted-foreground">{soilTypesLoaded} polygoner</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300 rounded-full animate-pulse" style={{ width: '100%' }} />
                </div>
              </div>
            )}
            {loadingWaterBodies && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Laddar grundvattenförekomster...</span>
                  <span className="text-muted-foreground">{waterBodiesLoaded} förekomster</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300 rounded-full animate-pulse" style={{ width: '100%' }} />
                </div>
              </div>
            )}
            {loadingGwLevelsObserved && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Laddar observerade grundvattennivåer...</span>
                  <span className="text-muted-foreground">{gwLevelsObservedLoaded} stationer</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300 rounded-full animate-pulse" style={{ width: '100%' }} />
                </div>
              </div>
            )}
            {loadingGwQuality && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Laddar grundvattenkvalitet...</span>
                  <span className="text-muted-foreground">{gwQualityLoaded} provplatser</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300 rounded-full animate-pulse" style={{ width: '100%' }} />
                </div>
              </div>
            )}
            {loadingObservations && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Laddar observationer...</span>
                  <span className="text-muted-foreground">{observationsLoaded} observationer</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300 rounded-full animate-pulse" style={{ width: '100%' }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Polygon data fetcher – shown after a polygon is drawn */}
      {drawnBbox && (
        <PolygonFetcher
          bbox={drawnBbox}
          areaKm2={drawnAreaKm2}
          onClose={() => {
            setDrawnBbox(null);
            drawSourceRef.current?.clear();
          }}
        />
      )}

      {/* Draw mode overlay hint */}
      {drawModeActive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-sgu-maroon/90 text-white text-sm px-4 py-2 rounded-full shadow pointer-events-none">
          Klicka på kartan för att rita polygon • Dubbelklicka för att avsluta • Esc för att avbryta
        </div>
      )}

      {selectedFeatures.length > 0 && (
        <WellPopup
          properties={selectedFeatures[selectedFeatureIndex].properties}
          type={selectedFeatures[selectedFeatureIndex].type}
          analysisResults={selectedFeatures[selectedFeatureIndex].analysisResults}
          onClose={() => {
            setSelectedFeatures([]);
            setSelectedFeatureIndex(0);
          }}
          chartOpen={chartOpen}
          chartType={chartLocation?.type || null}
          onOpenChart={(location) => {
            setChartLocation(location);
            setChartLocations([location]);
            setChartOpen(true);
          }}
          onAddToChart={(location) => {
            if (chartOpen && chartLocation?.type === location.type) {
              setChartLocations(prev => [...prev, location]);
            }
          }}
          totalFeatures={selectedFeatures.length}
          currentFeatureIndex={selectedFeatureIndex}
          onNavigateFeature={(index) => setSelectedFeatureIndex(index)}
        />
      )}

      {rapportMode && !rapportCoordinate && (
        <div className="absolute left-1/2 -translate-x-1/2 top-4 z-30 bg-sgu-maroon text-white text-sm px-4 py-2 rounded-full shadow-lg pointer-events-none">
          Klicka på kartan för att analysera en punkt
        </div>
      )}

      {rapportCoordinate && (
        <GrundvattenRapport
          coordinate={rapportCoordinate}
          wmsProxyUrl={wmsProxyUrl}
          onClose={() => {
            setRapportCoordinate(null);
            setRapportMode(false);
          }}
          onAnalysisData={setGrundvattenAnalysData}
          onOpenAI={() => setAiChatOpen(true)}
        />
      )}

      {chartOpen && chartLocation && (
        <ChartViewer
          initialLocation={chartLocation}
          locations={chartLocations}
          onLocationsChange={setChartLocations}
          onClose={() => {
            setChartOpen(false);
            setChartLocation(null);
            setChartLocations([]);
          }}
        />
      )}

      <WmsLegend
        sguBerggrund1MVisible={sguBerggrund1MVisible}
        sguBerggrund50kVisible={sguBerggrund50kVisible}
        sguJordarter1MVisible={sguJordarter1MVisible}
        sguJordarter25kVisible={sguJordarter25kVisible}
        sguGvTillgangVisible={sguGvTillgangVisible}
      />

      <AIChatPanel
        open={aiChatOpen}
        setOpen={setAiChatOpen}
        grundvattenData={grundvattenAnalysData}
        getLayerData={() => {
          const layers = [
            { name: "Brunnar", ref: wellsLayerRef, count: wellsLoaded },
            { name: "Källor", ref: sourcesLayerRef, count: sourcesLoaded },
            { name: "Grundvattenmagasin", ref: aquifersLayerRef, count: aquifersLoaded },
            { name: "Jordarter", ref: soilTypesLayerRef, count: soilTypesLoaded },
            { name: "Grundvattenförekomster", ref: waterBodiesLayerRef, count: waterBodiesLoaded },
            { name: "GV-nivåer observerade", ref: gwLevelsObservedLayerRef, count: gwLevelsObservedLoaded },
            { name: "Grundvattenkvalitet", ref: gwQualityLayerRef, count: gwQualityLoaded },
            { name: "Observationer", ref: observationsLayerRef, count: observationsLoaded },
          ];
          return layers.map(l => {
            const features = l.ref.current?.getSource()?.getFeatures() || [];
            const sample = features.slice(0, 50).map(f => {
              const props = { ...f.getProperties() };
              delete props.geometry;
              return props;
            });
            return { name: l.name, count: l.count, sample };
          });
        }}
      />
    </div>
  );
};