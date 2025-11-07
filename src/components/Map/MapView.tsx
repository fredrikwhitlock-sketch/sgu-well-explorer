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
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [selectedWell, setSelectedWell] = useState<Record<string, any> | null>(null);
  const wmsLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const ogcLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

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

    // OGC API Features layer for Uppsala kommun (kommunkod 0380)
    const ogcSource = new VectorSource({
      format: new GeoJSON(),
      loader: async () => {
        try {
          console.log("Loading ALL features from OGC API for Uppsala kommun (0380)...");
          
          let allFeatures: any[] = [];
          let offset = 0;
          const limit = 1000; // Fetch in batches of 1000
          let hasMore = true;
          
          // Fetch all pages using pagination
          while (hasMore) {
            const url = `https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items?limit=${limit}&offset=${offset}&f=json&kommunkod=0380`;
            console.log(`Fetching batch at offset ${offset}...`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Received ${data.features?.length || 0} features in this batch`);
            
            if (data.features && data.features.length > 0) {
              // Filter to ensure we only have Uppsala kommun
              const uppsalaFeatures = data.features.filter(
                (f: any) => f.properties?.kommunkod === "0380"
              );
              
              allFeatures = allFeatures.concat(uppsalaFeatures);
              
              // Check if there are more features
              if (data.features.length < limit) {
                hasMore = false;
              } else {
                offset += limit;
              }
            } else {
              hasMore = false;
            }
          }
          
          console.log(`Total features loaded: ${allFeatures.length}`);
          
          if (allFeatures.length > 0) {
            const features = new GeoJSON().readFeatures(
              { type: "FeatureCollection", features: allFeatures },
              {
                dataProjection: "EPSG:4326",
                featureProjection: "EPSG:3857",
              }
            );
            
            ogcSource.addFeatures(features);
            toast.success(`Laddade ${features.length} brunnar från Uppsala kommun (0380)`);
          } else {
            toast.info("Inga brunnar hittades för Uppsala kommun");
          }
        } catch (error) {
          console.error("Error loading OGC features:", error);
          toast.error("Kunde inte ladda data från OGC API");
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

    // Create map
    const map = new Map({
      target: mapRef.current,
      layers: [osmLayer, wmsLayer, ogcLayer],
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
        layerFilter: (layer) => layer === ogcLayer,
      });
      map.getTargetElement().style.cursor = hit ? "pointer" : "";
    });

    // Handle feature clicks
    map.on("click", (evt) => {
      const features = map.getFeaturesAtPixel(evt.pixel, {
        layerFilter: (layer) => layer === ogcLayer,
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
      ogcLayerRef.current.setVisible(ogcVisible);
      // Trigger data load when first enabled
      if (ogcVisible && ogcLayerRef.current.getSource()?.getFeatures().length === 0) {
        ogcLayerRef.current.getSource()?.loadFeatures(
          ogcLayerRef.current.getSource()!.getExtent(),
          1,
          ogcLayerRef.current.getSource()!.getProjection()
        );
      }
    }
  }, [ogcVisible]);

  return (
    <div className="relative w-full h-screen">
      <div ref={mapRef} className="absolute inset-0" />
      
      <LayerPanel
        wmsVisible={wmsVisible}
        wmsOpacity={wmsOpacity}
        ogcVisible={ogcVisible}
        onWmsVisibleChange={setWmsVisible}
        onWmsOpacityChange={setWmsOpacity}
        onOgcVisibleChange={setOgcVisible}
      />
      
      <CoordinateDisplay coordinates={coordinates} />
      
      {selectedWell && (
        <WellPopup
          properties={selectedWell}
          onClose={() => setSelectedWell(null)}
        />
      )}
    </div>
  );
};
