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
  const [selectedFeature, setSelectedFeature] = useState<{ properties: Record<string, any>; type: 'source' | 'well' | 'aquifer' | 'waterBody' | 'gwLevelsObserved' | 'gwLevelsModeled'; analysisResults?: any[] } | null>(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const [loadingWells, setLoadingWells] = useState(false);
  const [loadingAquifers, setLoadingAquifers] = useState(false);
  const [sourcesLoaded, setSourcesLoaded] = useState(0);
  const [wellsLoaded, setWellsLoaded] = useState(0);
  const [aquifersLoaded, setAquifersLoaded] = useState(0);
  const [waterBodiesVisible, setWaterBodiesVisible] = useState(false);
  const [gwLevelsObservedVisible, setGwLevelsObservedVisible] = useState(false);
  const [gwLevelsModeledVisible, setGwLevelsModeledVisible] = useState(false);
  const [loadingWaterBodies, setLoadingWaterBodies] = useState(false);
  const [loadingGwLevelsObserved, setLoadingGwLevelsObserved] = useState(false);
  const [loadingGwLevelsModeled, setLoadingGwLevelsModeled] = useState(false);
  const [waterBodiesLoaded, setWaterBodiesLoaded] = useState(0);
  const [gwLevelsObservedLoaded, setGwLevelsObservedLoaded] = useState(0);
  const [gwLevelsModeledLoaded, setGwLevelsModeledLoaded] = useState(0);
  const sourcesLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const wellsLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const aquifersLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const waterBodiesLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const gwLevelsObservedLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const gwLevelsModeledLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

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
          const url = `https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items?f=json&bbox=${bbox}&limit=2000`;
          
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
            
            if (data.features.length >= 2000) {
              toast.info("Visar max 2000 brunnar. Zooma in för fler detaljer.");
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

    // OGC API Features layer for Grundvattenförekomster (water bodies)
    const waterBodiesSource = new VectorSource({
      format: new GeoJSON(),
      loader: async () => {
        try {
          setLoadingWaterBodies(true);
          setWaterBodiesLoaded(0);
          console.log("Loading water bodies from OGC API...");
          
          const url = `https://api.sgu.se/oppnadata/grundvattenforekomster/ogc/features/v1/collections/grundvattenforekomster/items?f=json&limit=5000`;
          
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`Received ${data.features?.length || 0} water bodies`);
          
          if (data.features && data.features.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: data.features },
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
          
          const url = `https://api.sgu.se/oppnadata/grundvattennivaer-observerade/ogc/features/v1/collections/stationer/items?f=json&limit=5000`;
          
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`Received ${data.features?.length || 0} groundwater level stations`);
          
          if (data.features && data.features.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: data.features },
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

    // OGC API Features layer for Grundvattennivåer modellerade (modeled groundwater levels - HYPE)
    // Function to get color based on fill degree (fyllnadsgrad) - red (dry) to blue (high levels)
    const getGwFillColor = (fillDegree: number) => {
      if (fillDegree < 20) return "rgba(239, 68, 68, 0.7)"; // Red - very dry
      if (fillDegree < 40) return "rgba(249, 115, 22, 0.7)"; // Orange - dry
      if (fillDegree < 60) return "rgba(250, 204, 21, 0.7)"; // Yellow - normal
      if (fillDegree < 80) return "rgba(34, 197, 94, 0.7)"; // Green - wet
      return "rgba(59, 130, 246, 0.7)"; // Blue - very wet
    };

    const gwLevelsModeledSource = new VectorSource({
      format: new GeoJSON(),
      loader: async () => {
        try {
          setLoadingGwLevelsModeled(true);
          setGwLevelsModeledLoaded(0);
          console.log("Loading modeled groundwater levels from OGC API...");
          
          const url = `https://api.sgu.se/oppnadata/grundvattennivaer-sgu-hype-omraden/ogc/features/v1/collections/omraden/items?f=json&limit=5000`;
          
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`Received ${data.features?.length || 0} modeled groundwater level areas`);
          
          if (data.features && data.features.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: data.features },
              {
                dataProjection: "EPSG:4326",
                featureProjection: "EPSG:3857",
              }
            );
            
            gwLevelsModeledSource.addFeatures(features);
            setGwLevelsModeledLoaded(features.length);
            
            if (gwLevelsModeledLayerRef.current) {
              gwLevelsModeledLayerRef.current.setVisible(true);
              gwLevelsModeledLayerRef.current.changed();
            }
            
            toast.success(`Laddade ${features.length} modellerade grundvattennivåområden`);
          }
        } catch (error) {
          console.error("Error loading modeled groundwater levels:", error);
          toast.error("Kunde inte ladda modellerade grundvattennivåer");
        } finally {
          setLoadingGwLevelsModeled(false);
        }
      },
    });

    const gwLevelsModeledLayer = new VectorLayer({
      source: gwLevelsModeledSource,
      visible: gwLevelsModeledVisible,
      style: (feature: Feature) => {
        const props = feature.getProperties();
        // Try to get the latest fyllnadsgrad value from properties
        const fillDegree = props.fyllnadsgrad || props.fill_degree || 50; // Default to 50 if not found
        return new Style({
          stroke: new Stroke({
            color: "rgba(0, 0, 0, 0.3)",
            width: 1,
          }),
          fill: new Fill({
            color: getGwFillColor(fillDegree),
          }),
        });
      },
    });
    gwLevelsModeledLayerRef.current = gwLevelsModeledLayer;

    // Create map
    const map = new Map({
      target: mapRef.current,
      layers: [osmLayer, waterBodiesLayer, aquifersLayer, gwLevelsModeledLayer, gwLevelsObservedLayer, wellsLayer, sourcesLayer],
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
        layerFilter: (layer) => layer === sourcesLayer || layer === wellsLayer || layer === aquifersLayer || layer === waterBodiesLayer || layer === gwLevelsObservedLayer || layer === gwLevelsModeledLayer,
      });
      map.getTargetElement().style.cursor = hit ? "pointer" : "";
    });

    // Handle feature clicks
    map.on("click", async (evt) => {
      const features = map.getFeaturesAtPixel(evt.pixel, {
        layerFilter: (layer) => layer === sourcesLayer || layer === wellsLayer || layer === aquifersLayer || layer === waterBodiesLayer || layer === gwLevelsObservedLayer || layer === gwLevelsModeledLayer,
      });
      
      if (features && features.length > 0) {
        const feature = features[0];
        const properties = feature.getProperties();
        
        // Determine feature type based on layer
        const pixel = evt.pixel;
        const clickedLayers: any[] = [];
        map.forEachFeatureAtPixel(pixel, (f, layer) => {
          if (layer === sourcesLayer || layer === wellsLayer || layer === aquifersLayer || layer === waterBodiesLayer || layer === gwLevelsObservedLayer || layer === gwLevelsModeledLayer) {
            clickedLayers.push({ feature: f, layer });
          }
        });
        
        if (clickedLayers.length > 0) {
          const { layer } = clickedLayers[0];
          let type: 'source' | 'well' | 'aquifer' | 'waterBody' | 'gwLevelsObserved' | 'gwLevelsModeled' = 'source';
          if (layer === wellsLayer) type = 'well';
          else if (layer === aquifersLayer) type = 'aquifer';
          else if (layer === waterBodiesLayer) type = 'waterBody';
          else if (layer === gwLevelsObservedLayer) type = 'gwLevelsObserved';
          else if (layer === gwLevelsModeledLayer) type = 'gwLevelsModeled';
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

  // Update Sampling Sites visibility and load data when enabled
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

  // Update Modeled Groundwater Levels visibility and load data when enabled
  useEffect(() => {
    if (gwLevelsModeledLayerRef.current) {
      if (gwLevelsModeledVisible && gwLevelsModeledLayerRef.current.getSource()?.getFeatures().length === 0) {
        gwLevelsModeledLayerRef.current.getSource()?.loadFeatures(
          gwLevelsModeledLayerRef.current.getSource()!.getExtent(),
          1,
          gwLevelsModeledLayerRef.current.getSource()!.getProjection()
        );
      }
      gwLevelsModeledLayerRef.current.setVisible(gwLevelsModeledVisible);
    }
  }, [gwLevelsModeledVisible]);

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
        waterBodiesVisible={waterBodiesVisible}
        gwLevelsObservedVisible={gwLevelsObservedVisible}
        gwLevelsModeledVisible={gwLevelsModeledVisible}
        sourcesLoaded={sourcesLoaded}
        wellsLoaded={wellsLoaded}
        aquifersLoaded={aquifersLoaded}
        waterBodiesLoaded={waterBodiesLoaded}
        gwLevelsObservedLoaded={gwLevelsObservedLoaded}
        gwLevelsModeledLoaded={gwLevelsModeledLoaded}
        onSourcesVisibleChange={setSourcesVisible}
        onWellsVisibleChange={setWellsVisible}
        onAquifersVisibleChange={setAquifersVisible}
        onAquifersOpacityChange={setAquifersOpacity}
        onWaterBodiesVisibleChange={setWaterBodiesVisible}
        onGwLevelsObservedVisibleChange={setGwLevelsObservedVisible}
        onGwLevelsModeledVisibleChange={setGwLevelsModeledVisible}
      />
      
      <CoordinateDisplay coordinates={coordinates} />
      
      {(loadingSources || loadingWells || loadingAquifers || loadingWaterBodies || loadingGwLevelsObserved || loadingGwLevelsModeled) && (
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
            {loadingGwLevelsModeled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Laddar modellerade grundvattennivåer...</span>
                  <span className="text-muted-foreground">{gwLevelsModeledLoaded} områden</span>
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
          analysisResults={selectedFeature.analysisResults}
          onClose={() => setSelectedFeature(null)}
        />
      )}
    </div>
  );
};
