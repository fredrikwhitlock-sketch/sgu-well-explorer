import { useEffect, useRef, useState } from "react";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import VectorLayer from "ol/layer/Vector";
import OSM from "ol/source/OSM";
import ImageWMS from "ol/source/ImageWMS";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { register } from "ol/proj/proj4";
import proj4 from "proj4";
import { get as getProjection } from "ol/proj";
import { defaults as defaultControls } from "ol/control";
import { Style, Circle, Fill, Stroke } from "ol/style";
import Feature from "ol/Feature";
import "ol/ol.css";
import { LayerPanel } from "./LayerPanel";
import { CoordinateDisplay } from "./CoordinateDisplay";
import { WellPopup } from "./WellPopup";
import { SearchControl } from "./SearchControl";
import { ZoomIndicator } from "./ZoomIndicator";
import { ChartViewer } from "./ChartViewer";
import WmsLegend from "./WmsLegend";
import { AIChatPanel } from "./AIChatPanel";
import { toast } from "sonner";
import { getSoilTypeColor } from "@/lib/soilTypeColors";
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
  const [topoWebbVisible, setTopoWebbVisible] = useState(false);
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
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<{ properties: Record<string, any>; type: 'source' | 'well' | 'aquifer' | 'waterBody' | 'gwLevelsObserved' | 'gwQuality' | 'soilType' | 'gvTillgang'; analysisResults?: any[] }[]>([]);
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
  const [loadingWaterBodies, setLoadingWaterBodies] = useState(false);
  const [loadingGwLevelsObserved, setLoadingGwLevelsObserved] = useState(false);
  const [loadingGwQuality, setLoadingGwQuality] = useState(false);
  const [waterBodiesLoaded, setWaterBodiesLoaded] = useState(0);
  const [gwLevelsObservedLoaded, setGwLevelsObservedLoaded] = useState(0);
  const [gwQualityLoaded, setGwQualityLoaded] = useState(0);
  const [chartOpen, setChartOpen] = useState(false);
  const [chartLocation, setChartLocation] = useState<ChartLocation | null>(null);
  const [chartLocations, setChartLocations] = useState<ChartLocation[]>([]);
  const [currentZoom, setCurrentZoom] = useState(11);
  const sourcesLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const wellsLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const aquifersLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const soilTypesLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const waterBodiesLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const gwLevelsObservedLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const gwQualityLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const loadWellsForExtentRef = useRef<((extent: number[]) => Promise<void>) | null>(null);
  const loadSoilTypesForExtentRef = useRef<((extent: number[]) => Promise<void>) | null>(null);
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
        params: { 'LAYERS': 'terrangskuggning', 'VERSION': '1.1.1' },
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

    // OGC API Features layer for Källor (sources)
    const sourcesSource = new VectorSource({
      format: new GeoJSON(),
      loader: async () => {
        try {
          setLoadingSources(true);
          setSourcesLoaded(0);
          console.log("Loading sources from OGC API...");
          
          const url = `https://api.sgu.se/oppnadata/kallor/ogc/features/v1/collections/kallor/items?f=json`;
          
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`Received ${data.features?.length || 0} total sources`);
          
          if (data.features && data.features.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: data.features },
              {
                dataProjection: "EPSG:4326",
                featureProjection: "EPSG:3857",
              }
            );
            
            sourcesSource.addFeatures(features);
            setSourcesLoaded(features.length);
            
            if (sourcesLayerRef.current) {
              sourcesLayerRef.current.setVisible(true);
              sourcesLayerRef.current.changed();
            }
            
            toast.success(`Laddade ${features.length} källor från hela Sverige`);
          } else {
            toast.info("Inga källor returnerades från API:et");
          }
        } catch (error) {
          console.error("Error loading sources:", error);
          toast.error("Kunde inte ladda källor från OGC API");
        } finally {
          setLoadingSources(false);
        }
      },
    });

    const sourcesLayer = new VectorLayer({
      source: sourcesSource,
      visible: sourcesVisible,
      style: new Style({
        image: new Circle({
          radius: 6,
          fill: new Fill({ color: "rgba(92, 45, 81, 0.8)" }), // SGU maroon
          stroke: new Stroke({
            color: "rgba(255, 255, 255, 0.8)",
            width: 2,
          }),
        }),
      }),
    });
    sourcesLayerRef.current = sourcesLayer;

    // Minimum zoom level for loading wells and soil types (to avoid loading too much data)
    const MIN_ZOOM_FOR_WELLS = 12;
    const MIN_ZOOM_FOR_SOIL_TYPES = 12;

    // Track loaded extents to avoid duplicate loading
    const loadedWellExtentsRef: string[] = [];
    const loadedSoilExtentsRef: string[] = [];
    
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
    
    const loadWellsForExtent = async (extent: number[]) => {
      try {
        // Check zoom level before loading
        const currentZoom = mapInstanceRef.current?.getView().getZoom() || 0;
        if (currentZoom < MIN_ZOOM_FOR_WELLS) {
          console.log(`Zoom level ${currentZoom} is too low for wells (min: ${MIN_ZOOM_FOR_WELLS})`);
          return;
        }
        
        // Check if this extent area has already been loaded
        const gridKey = extentToGridKey(extent);
        if (loadedWellExtentsRef.includes(gridKey)) {
          console.log(`Wells for extent ${gridKey} already loaded, skipping`);
          return;
        }
        
        setLoadingWells(true);
        
        // Convert Web Mercator extent to WGS84 bbox
        const [minX, minY, maxX, maxY] = extent;
        const minLon = (minX / 20037508.34) * 180;
        const maxLon = (maxX / 20037508.34) * 180;
        const minLat = (Math.atan(Math.exp((minY / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
        const maxLat = (Math.atan(Math.exp((maxY / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
        
        // Load from database cache via edge function (bypasses 1000 row limit)
        const wellsQueryUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wells-query?minLon=${minLon}&maxLon=${maxLon}&minLat=${minLat}&maxLat=${maxLat}&limit=50000`;
        
        const cacheResponse = await fetch(wellsQueryUrl);
        const cacheData = cacheResponse.ok ? await cacheResponse.json() : null;
        
        if (cacheData && cacheData.wells && cacheData.wells.length > 0) {
          console.log(`Loaded ${cacheData.wells.length} wells from database cache`);
          
          const geojsonFeatures = cacheData.wells.map((w: any) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [w.lon, w.lat] },
            properties: { ...w.properties, brunnsid: w.brunnsid, obsplatsid: w.obsplatsid },
          }));
          
          const features = new GeoJSON().readFeatures(
            { type: "FeatureCollection", features: geojsonFeatures },
            { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" }
          );
          
          const existingIds = new Set(wellsSource.getFeatures().map(f => f.get('brunnsid')));
          const newFeatures = features.filter(f => !existingIds.has(f.get('brunnsid')));
          
          if (newFeatures.length > 0) {
            wellsSource.addFeatures(newFeatures);
          }
          
          setWellsLoaded(wellsSource.getFeatures().length);
          loadedWellExtentsRef.push(gridKey);
        } else {
          // Fallback to SGU API if database is empty
          console.log("Database cache empty, falling back to SGU API...");
          const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
          const url = `https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items?f=json&bbox=${bbox}&limit=50000`;
          
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          
          const data = await response.json();
          
          if (data.features && data.features.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: data.features },
              { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" }
            );
            
            const existingIds = new Set(wellsSource.getFeatures().map(f => f.get('brunnsid')));
            const newFeatures = features.filter(f => !existingIds.has(f.get('brunnsid')));
            
            if (newFeatures.length > 0) {
              wellsSource.addFeatures(newFeatures);
            }
            
            setWellsLoaded(wellsSource.getFeatures().length);
            loadedWellExtentsRef.push(gridKey);
          } else {
            loadedWellExtentsRef.push(gridKey);
          }
        }
      } catch (error) {
        console.error("Error loading wells:", error);
        toast.error("Kunde inte ladda brunnar");
      } finally {
        setLoadingWells(false);
      }
    };
    
    loadWellsForExtentRef.current = loadWellsForExtent;

    const wellsLayer = new VectorLayer({
      source: wellsSource,
      visible: wellsVisible,
      style: new Style({
        image: new Circle({
          radius: 5,
          fill: new Fill({ color: "rgba(59, 130, 246, 0.7)" }),
          stroke: new Stroke({
            color: "rgba(255, 255, 255, 0.8)",
            width: 1.5,
          }),
        }),
      }),
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

    // OGC API Features layer for Grundvattenmagasin (aquifers) - No limit
    const aquifersSource = new VectorSource({
      format: new GeoJSON(),
      loader: async () => {
        try {
          setLoadingAquifers(true);
          setAquifersLoaded(0);
          console.log("Loading all aquifers from OGC API...");
          
          const allFeatures = await fetchAllPages(
            `https://api.sgu.se/oppnadata/grundvattenmagasin/ogc/features/v1/collections/grundvattenmagasin/items?f=json`,
            (count) => setAquifersLoaded(count)
          );
          
          console.log(`Received ${allFeatures.length} aquifers total`);
          
          if (allFeatures.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: allFeatures },
              {
                dataProjection: "EPSG:4326",
                featureProjection: "EPSG:3857",
              }
            );
            
            aquifersSource.addFeatures(features);
            setAquifersLoaded(features.length);
            
            if (aquifersLayerRef.current) {
              aquifersLayerRef.current.setVisible(true);
              aquifersLayerRef.current.changed();
            }
            
            toast.success(`Laddade ${features.length} grundvattenmagasin`);
          }
        } catch (error) {
          console.error("Error loading aquifers:", error);
          toast.error("Kunde inte ladda grundvattenmagasin");
        } finally {
          setLoadingAquifers(false);
        }
      },
    });

    const aquifersLayer = new VectorLayer({
      source: aquifersSource,
      visible: aquifersVisible,
      opacity: aquifersOpacity,
      style: new Style({
        stroke: new Stroke({
          color: "rgba(34, 197, 94, 0.8)",
          width: 2,
        }),
        fill: new Fill({
          color: "rgba(34, 197, 94, 0.2)",
        }),
      }),
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
        const url = `https://api.sgu.se/oppnadata/jordarter25k-100k/ogc/features/v1/collections/grundlager/items?f=json&bbox=${bbox}&limit=20000`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Received ${data.features?.length || 0} soil type features`);
        
        if (data.features && data.features.length > 0) {
          const features = new GeoJSON().readFeatures(
            { type: "FeatureCollection", features: data.features },
            {
              dataProjection: "EPSG:4326",
              featureProjection: "EPSG:3857",
            }
          );
          
          // Add all features (polygons may overlap between areas, that's OK)
          soilTypesSource.addFeatures(features);
          setSoilTypesLoaded(soilTypesSource.getFeatures().length);
          loadedSoilExtentsRef.push(gridKey);
          
          if (data.features.length >= 20000) {
            toast.info("Visar max 20 000 jordarter per område. Zooma in för fler detaljer.");
          }
        } else {
          // Mark as loaded even if empty
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

    const soilTypesLayer = new VectorLayer({
      source: soilTypesSource,
      visible: soilTypesVisible,
      opacity: soilTypesOpacity,
      style: soilTypeStyleFunction,
    });
    soilTypesLayerRef.current = soilTypesLayer;

    // OGC API Features layer for Grundvattenförekomster (water bodies) - No limit
    const waterBodiesSource = new VectorSource({
      format: new GeoJSON(),
      loader: async () => {
        try {
          setLoadingWaterBodies(true);
          setWaterBodiesLoaded(0);
          console.log("Loading all water bodies from OGC API...");
          
          const allFeatures = await fetchAllPages(
            `https://api.sgu.se/oppnadata/grundvattenforekomster/ogc/features/v1/collections/grundvattenforekomster/items?f=json`,
            (count) => setWaterBodiesLoaded(count)
          );
          
          console.log(`Received ${allFeatures.length} water bodies total`);
          
          if (allFeatures.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: allFeatures },
              {
                dataProjection: "EPSG:4326",
                featureProjection: "EPSG:3857",
              }
            );
            
            waterBodiesSource.addFeatures(features);
            setWaterBodiesLoaded(features.length);
            
            if (waterBodiesLayerRef.current) {
              waterBodiesLayerRef.current.setVisible(true);
              waterBodiesLayerRef.current.changed();
            }
            
            toast.success(`Laddade ${features.length} grundvattenförekomster`);
          }
        } catch (error) {
          console.error("Error loading water bodies:", error);
          toast.error("Kunde inte ladda grundvattenförekomster");
        } finally {
          setLoadingWaterBodies(false);
        }
      },
    });

    const waterBodiesLayer = new VectorLayer({
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
      style: new Style({
        image: new Circle({
          radius: 6,
          fill: new Fill({ color: "rgba(147, 51, 234, 0.8)" }),
          stroke: new Stroke({
            color: "rgba(255, 255, 255, 0.8)",
            width: 2,
          }),
        }),
      }),
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
      style: new Style({
        image: new Circle({
          radius: 6,
          fill: new Fill({ color: "rgba(234, 88, 12, 0.8)" }), // Orange color
          stroke: new Stroke({
            color: "rgba(255, 255, 255, 0.8)",
            width: 2,
          }),
        }),
      }),
    });
    gwQualityLayerRef.current = gwQualityLayer;

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
        // Vector layers on top
        soilTypesLayer, 
        waterBodiesLayer, 
        aquifersLayer, 
        gwQualityLayer, 
        gwLevelsObservedLayer, 
        wellsLayer, 
        sourcesLayer
      ],
      view: new View({
        center: [1784000, 8347000], // Uppsala center in Web Mercator
        zoom: 11,
        projection: "EPSG:3857", // Web Mercator for OSM compatibility
      }),
      controls: defaultControls({
        attribution: true,
        zoom: true,
      }),
    });

    mapInstanceRef.current = map;

    // Track pointer coordinates
    map.on("pointermove", (evt) => {
      const coords = evt.coordinate;
      setCoordinates([coords[0], coords[1]]);
      
      // Change cursor when hovering over features
      const pixel = map.getEventPixel(evt.originalEvent);
      const hit = map.hasFeatureAtPixel(pixel, {
        layerFilter: (layer) => layer === sourcesLayer || layer === wellsLayer || layer === aquifersLayer || layer === waterBodiesLayer || layer === gwLevelsObservedLayer || layer === gwQualityLayer || layer === soilTypesLayer,
      });
      map.getTargetElement().style.cursor = hit ? "pointer" : "";
    });

    // Handle feature clicks - collect all features at the same location
    map.on("click", async (evt) => {
      const clickedItems: { properties: Record<string, any>; type: 'source' | 'well' | 'aquifer' | 'waterBody' | 'gwLevelsObserved' | 'gwQuality' | 'soilType' | 'gvTillgang' }[] = [];
      
      map.forEachFeatureAtPixel(evt.pixel, (f, layer) => {
        if (layer === sourcesLayer || layer === wellsLayer || layer === aquifersLayer || layer === waterBodiesLayer || layer === gwLevelsObservedLayer || layer === gwQualityLayer || layer === soilTypesLayer) {
          const properties = f.getProperties();
          let type: 'source' | 'well' | 'aquifer' | 'waterBody' | 'gwLevelsObserved' | 'gwQuality' | 'soilType' | 'gvTillgang' = 'source';
          if (layer === wellsLayer) type = 'well';
          else if (layer === aquifersLayer) type = 'aquifer';
          else if (layer === waterBodiesLayer) type = 'waterBody';
          else if (layer === gwLevelsObservedLayer) type = 'gwLevelsObserved';
          else if (layer === gwQualityLayer) type = 'gwQuality';
          else if (layer === soilTypesLayer) type = 'soilType';
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
      
      // Load data when zoom >= 12 and layer is visible
      if (zoom >= 12) {
        const extent = map.getView().calculateExtent();

        if (wellsLayerRef.current?.getVisible() && loadWellsForExtentRef.current) {
          loadWellsForExtentRef.current(extent);
        }

        if (soilTypesLayerRef.current?.getVisible() && loadSoilTypesForExtentRef.current) {
          loadSoilTypesForExtentRef.current(extent);
        }
      }
    });

    toast.success("Karta laddad!");

    return () => {
      map.setTarget(undefined);
    };
  }, []);

  // Update Sources visibility and load data when enabled
  useEffect(() => {
    if (sourcesLayerRef.current) {
      if (sourcesVisible && sourcesLayerRef.current.getSource()?.getFeatures().length === 0) {
        sourcesLayerRef.current.getSource()?.loadFeatures(
          sourcesLayerRef.current.getSource()!.getExtent(),
          1,
          sourcesLayerRef.current.getSource()!.getProjection()
        );
      }
      sourcesLayerRef.current.setVisible(sourcesVisible);
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
      if (aquifersVisible && aquifersLayerRef.current.getSource()?.getFeatures().length === 0) {
        aquifersLayerRef.current.getSource()?.loadFeatures(
          aquifersLayerRef.current.getSource()!.getExtent(),
          1,
          aquifersLayerRef.current.getSource()!.getProjection()
        );
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
      soilTypesLayerRef.current.setVisible(soilTypesVisible);
      if (soilTypesVisible && mapInstanceRef.current && loadSoilTypesForExtentRef.current) {
        const currentZoom = mapInstanceRef.current.getView().getZoom() || 0;
        if (currentZoom < 12) {
          toast.info("Zooma in för att ladda jordarter (minst zoomnivå 12)");
        } else {
          const extent = mapInstanceRef.current.getView().calculateExtent();
          loadSoilTypesForExtentRef.current(extent);
        }
      }
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
      if (waterBodiesVisible && waterBodiesLayerRef.current.getSource()?.getFeatures().length === 0) {
        waterBodiesLayerRef.current.getSource()?.loadFeatures(
          waterBodiesLayerRef.current.getSource()!.getExtent(),
          1,
          waterBodiesLayerRef.current.getSource()!.getProjection()
        );
      }
      waterBodiesLayerRef.current.setVisible(waterBodiesVisible);
    }
  }, [waterBodiesVisible]);

  // Update Observed GW Levels visibility and load data when enabled
  useEffect(() => {
    if (gwLevelsObservedLayerRef.current) {
      if (gwLevelsObservedVisible && gwLevelsObservedLayerRef.current.getSource()?.getFeatures().length === 0) {
        gwLevelsObservedLayerRef.current.getSource()?.loadFeatures(
          gwLevelsObservedLayerRef.current.getSource()!.getExtent(),
          1,
          gwLevelsObservedLayerRef.current.getSource()!.getProjection()
        );
      }
      gwLevelsObservedLayerRef.current.setVisible(gwLevelsObservedVisible);
    }
  }, [gwLevelsObservedVisible]);

  // Update Groundwater Quality visibility and load data when enabled
  useEffect(() => {
    if (gwQualityLayerRef.current) {
      if (gwQualityVisible && gwQualityLayerRef.current.getSource()?.getFeatures().length === 0) {
        gwQualityLayerRef.current.getSource()?.loadFeatures(
          gwQualityLayerRef.current.getSource()!.getExtent(),
          1,
          gwQualityLayerRef.current.getSource()!.getProjection()
        );
      }
      gwQualityLayerRef.current.setVisible(gwQualityVisible);
    }
  }, [gwQualityVisible]);

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

  const handleSearchResult = (coordinates: [number, number], zoom?: number) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.getView().animate({
        center: coordinates,
        zoom: zoom || 14,
        duration: 1000,
      });
    }
  };

  return (
    <div className="relative w-full h-screen">
      <div ref={mapRef} className="absolute inset-0" />
      
      <SearchControl onSearchResult={handleSearchResult} />
      
      <LayerPanel
        sourcesVisible={sourcesVisible}
        wellsVisible={wellsVisible}
        aquifersVisible={aquifersVisible}
        aquifersOpacity={aquifersOpacity}
        soilTypesVisible={soilTypesVisible}
        soilTypesOpacity={soilTypesOpacity}
        waterBodiesVisible={waterBodiesVisible}
        gwLevelsObservedVisible={gwLevelsObservedVisible}
        gwQualityVisible={gwQualityVisible}
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
        onSourcesVisibleChange={setSourcesVisible}
        onWellsVisibleChange={setWellsVisible}
        onAquifersVisibleChange={setAquifersVisible}
        onAquifersOpacityChange={setAquifersOpacity}
        onSoilTypesVisibleChange={setSoilTypesVisible}
        onSoilTypesOpacityChange={setSoilTypesOpacity}
        onWaterBodiesVisibleChange={setWaterBodiesVisible}
        onGwLevelsObservedVisibleChange={setGwLevelsObservedVisible}
        onGwQualityVisibleChange={setGwQualityVisible}
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
      />
      
      <CoordinateDisplay coordinates={coordinates} />
      
      <ZoomIndicator zoom={currentZoom} />
      
      {(loadingSources || loadingWells || loadingAquifers || loadingSoilTypes || loadingWaterBodies || loadingGwLevelsObserved || loadingGwQuality) && (
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
                  <span className="font-medium">Laddar grundvattenmagasin...</span>
                  <span className="text-muted-foreground">{aquifersLoaded} magasin</span>
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
          </div>
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
        getLayerData={() => {
          const layers = [
            { name: "Brunnar", ref: wellsLayerRef, count: wellsLoaded },
            { name: "Källor", ref: sourcesLayerRef, count: sourcesLoaded },
            { name: "Grundvattenmagasin", ref: aquifersLayerRef, count: aquifersLoaded },
            { name: "Jordarter", ref: soilTypesLayerRef, count: soilTypesLoaded },
            { name: "Grundvattenförekomster", ref: waterBodiesLayerRef, count: waterBodiesLoaded },
            { name: "GV-nivåer observerade", ref: gwLevelsObservedLayerRef, count: gwLevelsObservedLoaded },
            { name: "Grundvattenkvalitet", ref: gwQualityLayerRef, count: gwQualityLoaded },
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