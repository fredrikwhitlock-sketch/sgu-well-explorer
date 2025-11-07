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
import "ol/ol.css";
import { LayerPanel } from "./LayerPanel";
import { CoordinateDisplay } from "./CoordinateDisplay";
import { toast } from "sonner";

// Define SWEREF99 TM projection
proj4.defs("EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
register(proj4);

export const MapView = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const [wmsOpacity, setWmsOpacity] = useState(0.7);
  const [wmsVisible, setWmsVisible] = useState(true);
  const [ogcVisible, setOgcVisible] = useState(false);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
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

    // OGC API Features layer for Uppsala
    const ogcSource = new VectorSource({
      format: new GeoJSON(),
      loader: async () => {
        try {
          // Fetch features from OGC API for Uppsala kommun
          const response = await fetch(
            "https://api.sgu.se/oppnadata/brunnar/ogc/features/v1/collections/brunnar/items?limit=1000&f=json&kommun=Uppsala"
          );
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.features && data.features.length > 0) {
            const features = new GeoJSON().readFeatures(data, {
              dataProjection: "EPSG:4326",
              featureProjection: "EPSG:3857",
            });
            ogcSource.addFeatures(features);
            toast.success(`Laddade ${features.length} brunnar från Uppsala kommun`);
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
      style: {
        "circle-radius": 5,
        "circle-fill-color": "rgba(34, 197, 94, 0.8)",
        "circle-stroke-color": "rgba(22, 163, 74, 1)",
        "circle-stroke-width": 2,
      },
    });
    ogcLayerRef.current = ogcLayer;

    // Create map
    const map = new Map({
      target: mapRef.current,
      layers: [osmLayer, wmsLayer, ogcLayer],
      view: new View({
        center: [1634500, 8377000], // Uppsala in SWEREF99 TM
        zoom: 8,
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
    </div>
  );
};
