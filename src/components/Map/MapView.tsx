import { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
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
import { toast } from "sonner";

// Define SWEREF99 TM projection
proj4.defs("EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
register(proj4);

export const MapView = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const [sourcesVisible, setSourcesVisible] = useState(false);
  const [wellsVisible, setWellsVisible] = useState(false);
  const [aquifersVisible, setAquifersVisible] = useState(false);
  const [aquifersOpacity, setAquifersOpacity] = useState(0.5);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<{ properties: Record<string, any>; type: 'source' | 'well' | 'aquifer' } | null>(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const [loadingWells, setLoadingWells] = useState(false);
  const [loadingAquifers, setLoadingAquifers] = useState(false);
  const [sourcesLoaded, setSourcesLoaded] = useState(0);
  const [wellsLoaded, setWellsLoaded] = useState(0);
  const [aquifersLoaded, setAquifersLoaded] = useState(0);
  const sourcesLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const wellsLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const aquifersLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

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
          fill: new Fill({ color: "rgba(168, 85, 247, 0.8)" }),
          stroke: new Stroke({
            color: "rgba(255, 255, 255, 0.8)",
            width: 2,
          }),
        }),
      }),
    });
    sourcesLayerRef.current = sourcesLayer;

    // OGC API Features layer for Brunnar (wells) - bbox-filtered
    const wellsSource = new VectorSource({
      format: new GeoJSON(),
      strategy: (extent) => [extent],
      loader: async (extent) => {
        try {
          setLoadingWells(true);
          console.log("Loading wells from OGC API with bbox...");
          
          // Convert Web Mercator extent to WGS84 bbox
          const [minX, minY, maxX, maxY] = extent;
          const minLon = (minX / 20037508.34) * 180;
          const maxLon = (maxX / 20037508.34) * 180;
          const minLat = (Math.atan(Math.exp((minY / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
          const maxLat = (Math.atan(Math.exp((maxY / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
          
          const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
          const url = `https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items?f=json&bbox=${bbox}&limit=1000`;
          
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`Received ${data.features?.length || 0} wells`);
          
          if (data.features && data.features.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: data.features },
              {
                dataProjection: "EPSG:4326",
                featureProjection: "EPSG:3857",
              }
            );
            
            wellsSource.addFeatures(features);
            setWellsLoaded(wellsSource.getFeatures().length);
            
            if (data.features.length >= 1000) {
              toast.info("Visar max 1000 brunnar. Zooma in för fler detaljer.");
            }
          }
        } catch (error) {
          console.error("Error loading wells:", error);
          toast.error("Kunde inte ladda brunnar från OGC API");
        } finally {
          setLoadingWells(false);
        }
      },
    });

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

    // OGC API Features layer for Grundvattenmagasin (aquifers)
    const aquifersSource = new VectorSource({
      format: new GeoJSON(),
      loader: async () => {
        try {
          setLoadingAquifers(true);
          setAquifersLoaded(0);
          console.log("Loading aquifers from OGC API...");
          
          const url = `https://api.sgu.se/oppnadata/grundvattenmagasin/ogc/features/v1/collections/grundvattenmagasin/items?f=json&limit=5000`;
          
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`Received ${data.features?.length || 0} aquifers`);
          
          if (data.features && data.features.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: data.features },
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

    // Create map
    const map = new Map({
      target: mapRef.current,
      layers: [osmLayer, aquifersLayer, wellsLayer, sourcesLayer],
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
        layerFilter: (layer) => layer === sourcesLayer || layer === wellsLayer || layer === aquifersLayer,
      });
      map.getTargetElement().style.cursor = hit ? "pointer" : "";
    });

    // Handle feature clicks
    map.on("click", (evt) => {
      const features = map.getFeaturesAtPixel(evt.pixel, {
        layerFilter: (layer) => layer === sourcesLayer || layer === wellsLayer || layer === aquifersLayer,
      });
      
      if (features && features.length > 0) {
        const feature = features[0];
        const properties = feature.getProperties();
        
        // Determine feature type based on layer
        const pixel = evt.pixel;
        const clickedLayers: any[] = [];
        map.forEachFeatureAtPixel(pixel, (f, layer) => {
          if (layer === sourcesLayer || layer === wellsLayer || layer === aquifersLayer) {
            clickedLayers.push({ feature: f, layer });
          }
        });
        
        if (clickedLayers.length > 0) {
          const { layer } = clickedLayers[0];
          let type: 'source' | 'well' | 'aquifer' = 'source';
          if (layer === wellsLayer) type = 'well';
          else if (layer === aquifersLayer) type = 'aquifer';
          setSelectedFeature({ properties, type });
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

  // Update Wells visibility and reload data when enabled
  useEffect(() => {
    if (wellsLayerRef.current) {
      wellsLayerRef.current.setVisible(wellsVisible);
      if (wellsVisible && mapInstanceRef.current) {
        const extent = mapInstanceRef.current.getView().calculateExtent();
        wellsLayerRef.current.getSource()?.clear();
        wellsLayerRef.current.getSource()?.loadFeatures(
          extent,
          1,
          wellsLayerRef.current.getSource()!.getProjection()
        );
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
        sourcesLoaded={sourcesLoaded}
        wellsLoaded={wellsLoaded}
        aquifersLoaded={aquifersLoaded}
        onSourcesVisibleChange={setSourcesVisible}
        onWellsVisibleChange={setWellsVisible}
        onAquifersVisibleChange={setAquifersVisible}
        onAquifersOpacityChange={setAquifersOpacity}
      />
      
      <CoordinateDisplay coordinates={coordinates} />
      
      {(loadingSources || loadingWells || loadingAquifers) && (
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
          </div>
        </div>
      )}
      
      {selectedFeature && (
        <WellPopup
          properties={selectedFeature.properties}
          type={selectedFeature.type}
          onClose={() => setSelectedFeature(null)}
        />
      )}
    </div>
  );
};
