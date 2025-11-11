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
import { toast } from "sonner";

// Define SWEREF99 TM projection
proj4.defs("EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
register(proj4);

// Style function based on depth to bedrock (jorddjup)
const getStyleByDepth = (jorddjup: number | null | undefined): Style => {
  let color: string;
  let radius: number;
  
  if (jorddjup === null || jorddjup === undefined) {
    // No data
    color = "rgba(156, 163, 175, 0.8)"; // gray
    radius = 4;
  } else if (jorddjup < 5) {
    // Shallow: 0-5m
    color = "rgba(239, 68, 68, 0.8)"; // red
    radius = 5;
  } else if (jorddjup < 10) {
    // Medium: 5-10m
    color = "rgba(251, 146, 60, 0.8)"; // orange
    radius = 6;
  } else if (jorddjup < 20) {
    // Deep: 10-20m
    color = "rgba(34, 197, 94, 0.8)"; // green
    radius = 6;
  } else {
    // Very deep: >20m
    color = "rgba(59, 130, 246, 0.8)"; // blue
    radius = 7;
  }
  
  return new Style({
    image: new Circle({
      radius: radius,
      fill: new Fill({ color: color }),
      stroke: new Stroke({
        color: "rgba(255, 255, 255, 0.8)",
        width: 2,
      }),
    }),
  });
};

export const MapView = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const [wmsOpacity, setWmsOpacity] = useState(0.7);
  const [wmsVisible, setWmsVisible] = useState(true);
  const [ogcVisible, setOgcVisible] = useState(false);
  const [sourcesVisible, setSourcesVisible] = useState(false);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [selectedWell, setSelectedWell] = useState<Record<string, any> | null>(null);
  const [loadingWells, setLoadingWells] = useState(false);
  const [wellsLoaded, setWellsLoaded] = useState(0);
  const [loadingSources, setLoadingSources] = useState(false);
  const [sourcesLoaded, setSourcesLoaded] = useState(0);
  const wmsLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const ogcLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const sourcesLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

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

    // WMS layer from SGU - Brunnar
    const wmsLayer = new ImageLayer({
      source: new ImageWMS({
        url: "https://resource.sgu.se/service/wms/130/brunnar",
        params: {
          LAYERS: "brunnar",
          TILED: true,
          VERSION: "1.3.0",
          FORMAT: "image/png",
        },
        serverType: "geoserver",
        crossOrigin: "anonymous",
      }),
      opacity: wmsOpacity,
      visible: wmsVisible,
    });
    wmsLayerRef.current = wmsLayer;

    // OGC API Features layer for Uppsala län (kommunkod 03*)
    const ogcSource = new VectorSource({
      format: new GeoJSON(),
      loader: async () => {
        try {
          setLoadingWells(true);
          setWellsLoaded(0);
          console.log("Loading features from OGC API for Uppsala län (03*)...");
          
          let allUppsalaFeatures: any[] = [];
          let offset = 0;
          const limit = 1000;
          let hasMore = true;
          let totalFetched = 0;
          
          while (hasMore) {
            const url = `https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items?limit=${limit}&offset=${offset}&f=json`;
            console.log(`Fetching page at offset ${offset}...`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            totalFetched += data.features?.length || 0;
            console.log(`Received ${data.features?.length || 0} features at offset ${offset} (total fetched: ${totalFetched})`);
            
            if (data.features && data.features.length > 0) {
              // Filter for Uppsala län (kommunkod starts with "03")
              const uppsalaFeatures = data.features.filter(
                (f: any) => f.properties?.kommunkod?.startsWith("03")
              );
              
              if (uppsalaFeatures.length > 0) {
                allUppsalaFeatures = allUppsalaFeatures.concat(uppsalaFeatures);
                setWellsLoaded(allUppsalaFeatures.length);
                console.log(`Total Uppsala län features so far: ${allUppsalaFeatures.length}`);
              }
              
              // Check if we got fewer features than limit (last page)
              if (data.features.length < limit) {
                hasMore = false;
                console.log("Reached last page of results");
              } else {
                offset += limit;
              }
            } else {
              hasMore = false;
              console.log("No more features returned");
            }
          }
          
          console.log(`Total Uppsala län features loaded: ${allUppsalaFeatures.length} (from ${totalFetched} total features)`);
          
          if (allUppsalaFeatures.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: allUppsalaFeatures },
              {
                dataProjection: "EPSG:4326",
                featureProjection: "EPSG:3857",
              }
            );
            
            ogcSource.addFeatures(features);
            
            // Ensure layer stays visible after features are added
            if (ogcLayerRef.current) {
              ogcLayerRef.current.setVisible(true);
              ogcLayerRef.current.changed(); // Force layer to re-render
            }
            
            toast.success(`Laddade ${features.length} brunnar från Uppsala län (03*)`);
          } else {
            toast.info("Inga brunnar hittades för Uppsala län");
          }
        } catch (error) {
          console.error("Error loading OGC features:", error);
          toast.error("Kunde inte ladda data från OGC API");
        } finally {
          setLoadingWells(false);
        }
      },
    });

    const ogcLayer = new VectorLayer({
      source: ogcSource,
      visible: ogcVisible,
      style: (feature: Feature) => {
        const jorddjup = feature.get("jorddjup");
        return getStyleByDepth(jorddjup);
      },
    });
    ogcLayerRef.current = ogcLayer;

    // OGC API Features layer for Källor (sources)
    const sourcesSource = new VectorSource({
      format: new GeoJSON(),
      loader: async () => {
        try {
          setLoadingSources(true);
          setSourcesLoaded(0);
          console.log("Loading sources from OGC API for Uppsala län (03*)...");
          
          let allUppsalaSources: any[] = [];
          let offset = 0;
          const limit = 1000;
          let hasMore = true;
          let totalFetched = 0;
          
          while (hasMore) {
            const url = `https://api.sgu.se/oppnadata/kallor/ogc/features/v1/collections/kallor/items?limit=${limit}&offset=${offset}&f=json`;
            console.log(`Fetching sources at offset ${offset}...`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            totalFetched += data.features?.length || 0;
            console.log(`Received ${data.features?.length || 0} sources at offset ${offset} (total fetched: ${totalFetched})`);
            
            if (data.features && data.features.length > 0) {
              // Filter for Uppsala län (kommunkod starts with "03")
              const uppsalaSources = data.features.filter(
                (f: any) => f.properties?.kommunkod?.startsWith("03")
              );
              
              if (uppsalaSources.length > 0) {
                allUppsalaSources = allUppsalaSources.concat(uppsalaSources);
                setSourcesLoaded(allUppsalaSources.length);
                console.log(`Total Uppsala län sources so far: ${allUppsalaSources.length}`);
              }
              
              if (data.features.length < limit) {
                hasMore = false;
                console.log("Reached last page of sources");
              } else {
                offset += limit;
              }
            } else {
              hasMore = false;
              console.log("No more sources returned");
            }
          }
          
          console.log(`Total Uppsala län sources loaded: ${allUppsalaSources.length} (from ${totalFetched} total features)`);
          
          if (allUppsalaSources.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: allUppsalaSources },
              {
                dataProjection: "EPSG:4326",
                featureProjection: "EPSG:3857",
              }
            );
            
            sourcesSource.addFeatures(features);
            
            if (sourcesLayerRef.current) {
              sourcesLayerRef.current.setVisible(true);
              sourcesLayerRef.current.changed();
            }
            
            toast.success(`Laddade ${features.length} källor från Uppsala län (03*)`);
          } else {
            toast.info("Inga källor hittades för Uppsala län");
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
          fill: new Fill({ color: "rgba(168, 85, 247, 0.8)" }), // purple
          stroke: new Stroke({
            color: "rgba(255, 255, 255, 0.8)",
            width: 2,
          }),
        }),
      }),
    });
    sourcesLayerRef.current = sourcesLayer;

    // Create map
    const map = new Map({
      target: mapRef.current,
      layers: [osmLayer, wmsLayer, ogcLayer, sourcesLayer],
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
        layerFilter: (layer) => layer === ogcLayer || layer === sourcesLayer,
      });
      map.getTargetElement().style.cursor = hit ? "pointer" : "";
    });

    // Handle feature clicks
    map.on("click", (evt) => {
      const features = map.getFeaturesAtPixel(evt.pixel, {
        layerFilter: (layer) => layer === ogcLayer || layer === sourcesLayer,
      });
      
      if (features && features.length > 0) {
        const feature = features[0];
        const properties = feature.getProperties();
        setSelectedWell(properties);
      }
    });

    toast.success("Karta laddad! WMS-lager från SGU är aktivt");

    return () => {
      map.setTarget(undefined);
    };
  }, []);

  // Update WMS opacity
  useEffect(() => {
    if (wmsLayerRef.current) {
      wmsLayerRef.current.setOpacity(wmsOpacity);
    }
  }, [wmsOpacity]);

  // Update WMS visibility
  useEffect(() => {
    if (wmsLayerRef.current) {
      wmsLayerRef.current.setVisible(wmsVisible);
    }
  }, [wmsVisible]);

  // Update OGC visibility and load data when enabled
  useEffect(() => {
    if (ogcLayerRef.current) {
      // Trigger data load when first enabled
      if (ogcVisible && ogcLayerRef.current.getSource()?.getFeatures().length === 0) {
        ogcLayerRef.current.getSource()?.loadFeatures(
          ogcLayerRef.current.getSource()!.getExtent(),
          1,
          ogcLayerRef.current.getSource()!.getProjection()
        );
      }
      // Always set visibility after triggering load to ensure layer stays visible
      ogcLayerRef.current.setVisible(ogcVisible);
    }
  }, [ogcVisible]);

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

  return (
    <div className="relative w-full h-screen">
      <div ref={mapRef} className="absolute inset-0" />
      
      <LayerPanel
        wmsVisible={wmsVisible}
        wmsOpacity={wmsOpacity}
        ogcVisible={ogcVisible}
        sourcesVisible={sourcesVisible}
        onWmsVisibleChange={setWmsVisible}
        onWmsOpacityChange={setWmsOpacity}
        onOgcVisibleChange={setOgcVisible}
        onSourcesVisibleChange={setSourcesVisible}
      />
      
      <CoordinateDisplay coordinates={coordinates} />
      
      {loadingWells && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-background/95 backdrop-blur-sm p-4 rounded-lg shadow-lg border z-10 min-w-[300px]">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Laddar brunnar...</span>
              <span className="text-muted-foreground">{wellsLoaded} brunnar</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 rounded-full animate-pulse"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      )}
      
      {loadingSources && (
        <div className="absolute top-36 left-1/2 transform -translate-x-1/2 bg-background/95 backdrop-blur-sm p-4 rounded-lg shadow-lg border z-10 min-w-[300px]">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Laddar källor...</span>
              <span className="text-muted-foreground">{sourcesLoaded} källor</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 rounded-full animate-pulse"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      )}
      
      {selectedWell && (
        <WellPopup
          properties={selectedWell}
          onClose={() => setSelectedWell(null)}
        />
      )}
    </div>
  );
};
