/**
 * All OpenLayers layer refs + their visibility/opacity/loading state.
 * Extracted from MapView to keep that component focused on interactions
 * and rendering rather than layer bookkeeping.
 *
 * The consolidated useEffect at the bottom syncs all simple setVisible /
 * setOpacity calls in one pass — idempotent, so firing on any state change
 * is harmless and avoids 22 separate one-liner effects.
 */
import { useRef, useState, useEffect } from "react";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import VectorLayer from "ol/layer/Vector";
import VectorImageLayer from "ol/layer/VectorImage";
import OSM from "ol/source/OSM";
import ImageWMS from "ol/source/ImageWMS";
import VectorSource from "ol/source/Vector";

export function useMapLayers() {
  // ── Layer refs (assigned by the map init effect in MapView) ─────────────────
  const osmLayerRef = useRef<TileLayer<OSM> | null>(null);
  const topoWebbLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const ortofotoLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const terrangskuggningLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const fjallkartanLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const norgeTopoLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const sguBerggrund1MLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const sguBerggrund50kLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const sguJordarter1MLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const sguJordarter25kLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const sguGvTillgangLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const sguJorddjupLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const clcLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const waterWetnessLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);

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

  const hypoAreasSourceRef = useRef<VectorSource | null>(null);
  const hypoFyllnadSmaLayerRef = useRef<VectorImageLayer<VectorSource> | null>(null);
  const hypoFyllnadStoraLayerRef = useRef<VectorImageLayer<VectorSource> | null>(null);
  const hypoSitSmaLayerRef = useRef<VectorImageLayer<VectorSource> | null>(null);
  const hypoSitStoraLayerRef = useRef<VectorImageLayer<VectorSource> | null>(null);

  const geolocationLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const searchPinSourceRef = useRef<VectorSource | null>(null);

  // ── Base map ────────────────────────────────────────────────────────────────
  const [osmVisible, setOsmVisible] = useState(true);
  const [topoWebbVisible, setTopoWebbVisible] = useState(true);
  const [ortofotoVisible, setOrtofotoVisible] = useState(false);
  const [terrangskuggningVisible, setTerrangskuggningVisible] = useState(false);
  const [terrangskuggningOpacity, setTerrangskuggningOpacity] = useState(0.5);
  const [fjallkartanVisible, setFjallkartanVisible] = useState(false);
  const [norgeTopoVisible, setNorgeTopoVisible] = useState(false);

  // ── SGU WMS ─────────────────────────────────────────────────────────────────
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

  // ── Copernicus ──────────────────────────────────────────────────────────────
  const [clcVisible, setClcVisible] = useState(false);
  const [clcOpacity, setClcOpacity] = useState(0.7);
  const [waterWetnessVisible, setWaterWetnessVisible] = useState(false);
  const [waterWetnessOpacity, setWaterWetnessOpacity] = useState(0.7);

  // ── Vector layers ───────────────────────────────────────────────────────────
  const [sourcesVisible, setSourcesVisible] = useState(false);
  const [wellsVisible, setWellsVisible] = useState(false);
  const [aquifersVisible, setAquifersVisible] = useState(false);
  const [aquifersOpacity, setAquifersOpacity] = useState(0.5);
  const [soilTypesVisible, setSoilTypesVisible] = useState(false);
  const [soilTypesOpacity, setSoilTypesOpacity] = useState(0.7);
  const [waterBodiesVisible, setWaterBodiesVisible] = useState(false);
  const [gwLevelsObservedVisible, setGwLevelsObservedVisible] = useState(false);
  const [gwQualityVisible, setGwQualityVisible] = useState(false);
  const [observationsVisible, setObservationsVisible] = useState(false);

  // ── Loading + loaded counts ─────────────────────────────────────────────────
  const [loadingSources, setLoadingSources] = useState(false);
  const [loadingWells, setLoadingWells] = useState(false);
  const [loadingAquifers, setLoadingAquifers] = useState(false);
  const [loadingSoilTypes, setLoadingSoilTypes] = useState(false);
  const [loadingWaterBodies, setLoadingWaterBodies] = useState(false);
  const [loadingGwLevelsObserved, setLoadingGwLevelsObserved] = useState(false);
  const [loadingGwQuality, setLoadingGwQuality] = useState(false);
  const [loadingObservations, setLoadingObservations] = useState(false);
  const [sourcesLoaded, setSourcesLoaded] = useState(0);
  const [wellsLoaded, setWellsLoaded] = useState(0);
  const [aquifersLoaded, setAquifersLoaded] = useState(0);
  const [soilTypesLoaded, setSoilTypesLoaded] = useState(0);
  const [waterBodiesLoaded, setWaterBodiesLoaded] = useState(0);
  const [gwLevelsObservedLoaded, setGwLevelsObservedLoaded] = useState(0);
  const [gwQualityLoaded, setGwQualityLoaded] = useState(0);
  const [observationsLoaded, setObservationsLoaded] = useState(0);

  // ── Jorddjup ────────────────────────────────────────────────────────────────
  const [jorddjupObsVisible, setJorddjupObsVisible] = useState(false);
  const [jorddjupKartorVisible, setJorddjupKartorVisible] = useState(false);
  const [jorddjupSprickVisible, setJorddjupSprickVisible] = useState(false);
  const [loadingJorddjupObs, setLoadingJorddjupObs] = useState(false);
  const [loadingJorddjupKartor, setLoadingJorddjupKartor] = useState(false);
  const [loadingJorddjupSprick, setLoadingJorddjupSprick] = useState(false);
  const [jorddjupObsLoaded, setJorddjupObsLoaded] = useState(0);
  const [jorddjupKartorLoaded, setJorddjupKartorLoaded] = useState(0);
  const [jorddjupSprickLoaded, setJorddjupSprickLoaded] = useState(0);

  // ── HYPE ────────────────────────────────────────────────────────────────────
  const [hypoFyllnadSmaVisible, setHypoFyllnadSmaVisible] = useState(false);
  const [hypoFyllnadStoraVisible, setHypoFyllnadStoraVisible] = useState(false);
  const [hypoSitSmaVisible, setHypoSitSmaVisible] = useState(false);
  const [hypoSitStoraVisible, setHypoSitStoraVisible] = useState(false);
  const [loadingHypoAreas, setLoadingHypoAreas] = useState(false);
  const [hypoAreasLoaded, setHypoAreasLoaded] = useState(0);
  const [hypoAreasOpacity, setHypoAreasOpacity] = useState(0.7);
  const [hypoAreasDate, setHypoAreasDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay()); // most recent Sunday, local time
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // ── Consolidated layer sync ─────────────────────────────────────────────────
  // All simple setVisible / setOpacity calls in a single effect — replaces 22
  // separate one-liner effects. Calls are idempotent so syncing all on any
  // state change is correct and cheap.
  useEffect(() => {
    osmLayerRef.current?.setVisible(osmVisible);
    topoWebbLayerRef.current?.setVisible(topoWebbVisible);
    ortofotoLayerRef.current?.setVisible(ortofotoVisible);
    terrangskuggningLayerRef.current?.setVisible(terrangskuggningVisible);
    terrangskuggningLayerRef.current?.setOpacity(terrangskuggningOpacity);
    sguBerggrund1MLayerRef.current?.setVisible(sguBerggrund1MVisible);
    sguBerggrund1MLayerRef.current?.setOpacity(sguBerggrund1MOpacity);
    sguBerggrund50kLayerRef.current?.setVisible(sguBerggrund50kVisible);
    sguBerggrund50kLayerRef.current?.setOpacity(sguBerggrund50kOpacity);
    sguJordarter1MLayerRef.current?.setVisible(sguJordarter1MVisible);
    sguJordarter1MLayerRef.current?.setOpacity(sguJordarter1MOpacity);
    sguJordarter25kLayerRef.current?.setVisible(sguJordarter25kVisible);
    sguJordarter25kLayerRef.current?.setOpacity(sguJordarter25kOpacity);
    sguGvTillgangLayerRef.current?.setVisible(sguGvTillgangVisible);
    sguGvTillgangLayerRef.current?.setOpacity(sguGvTillgangOpacity);
    sguJorddjupLayerRef.current?.setVisible(sguJorddjupVisible);
    sguJorddjupLayerRef.current?.setOpacity(sguJorddjupOpacity);
    clcLayerRef.current?.setVisible(clcVisible);
    clcLayerRef.current?.setOpacity(clcOpacity);
    waterWetnessLayerRef.current?.setVisible(waterWetnessVisible);
    waterWetnessLayerRef.current?.setOpacity(waterWetnessOpacity);
    aquifersLayerRef.current?.setOpacity(aquifersOpacity);
    soilTypesLayerRef.current?.setOpacity(soilTypesOpacity);
    hypoFyllnadSmaLayerRef.current?.setVisible(hypoFyllnadSmaVisible);
    hypoFyllnadStoraLayerRef.current?.setVisible(hypoFyllnadStoraVisible);
    hypoSitSmaLayerRef.current?.setVisible(hypoSitSmaVisible);
    hypoSitStoraLayerRef.current?.setVisible(hypoSitStoraVisible);
    hypoFyllnadSmaLayerRef.current?.setOpacity(hypoAreasOpacity);
    hypoFyllnadStoraLayerRef.current?.setOpacity(hypoAreasOpacity);
    hypoSitSmaLayerRef.current?.setOpacity(hypoAreasOpacity);
    hypoSitStoraLayerRef.current?.setOpacity(hypoAreasOpacity);
  }, [
    osmVisible,
    topoWebbVisible, ortofotoVisible,
    terrangskuggningVisible, terrangskuggningOpacity,
    sguBerggrund1MVisible, sguBerggrund1MOpacity,
    sguBerggrund50kVisible, sguBerggrund50kOpacity,
    sguJordarter1MVisible, sguJordarter1MOpacity,
    sguJordarter25kVisible, sguJordarter25kOpacity,
    sguGvTillgangVisible, sguGvTillgangOpacity,
    sguJorddjupVisible, sguJorddjupOpacity,
    clcVisible, clcOpacity,
    waterWetnessVisible, waterWetnessOpacity,
    aquifersOpacity, soilTypesOpacity,
    hypoFyllnadSmaVisible, hypoFyllnadStoraVisible,
    hypoSitSmaVisible, hypoSitStoraVisible, hypoAreasOpacity,
  ]);

  return {
    // WMS layer refs
    osmLayerRef, topoWebbLayerRef, ortofotoLayerRef, terrangskuggningLayerRef,
    sguBerggrund1MLayerRef, sguBerggrund50kLayerRef,
    sguJordarter1MLayerRef, sguJordarter25kLayerRef,
    sguGvTillgangLayerRef, sguJorddjupLayerRef,
    clcLayerRef, waterWetnessLayerRef,
    // Vector layer refs
    sourcesLayerRef, wellsLayerRef,
    aquifersLayerRef, soilTypesLayerRef, waterBodiesLayerRef,
    gwLevelsObservedLayerRef, gwQualityLayerRef, observationsLayerRef,
    jorddjupObsLayerRef, jorddjupKartorLayerRef, jorddjupSprickLayerRef,
    // HYPE refs
    hypoAreasSourceRef,
    hypoFyllnadSmaLayerRef, hypoFyllnadStoraLayerRef,
    hypoSitSmaLayerRef, hypoSitStoraLayerRef,
    // Misc refs
    geolocationLayerRef, searchPinSourceRef,
    // Base map state
    osmVisible, setOsmVisible,
    topoWebbVisible, setTopoWebbVisible,
    ortofotoVisible, setOrtofotoVisible,
    terrangskuggningVisible, setTerrangskuggningVisible,
    terrangskuggningOpacity, setTerrangskuggningOpacity,
    // SGU WMS state
    sguBerggrund1MVisible, setSguBerggrund1MVisible,
    sguBerggrund1MOpacity, setSguBerggrund1MOpacity,
    sguBerggrund50kVisible, setSguBerggrund50kVisible,
    sguBerggrund50kOpacity, setSguBerggrund50kOpacity,
    sguJordarter1MVisible, setSguJordarter1MVisible,
    sguJordarter1MOpacity, setSguJordarter1MOpacity,
    sguJordarter25kVisible, setSguJordarter25kVisible,
    sguJordarter25kOpacity, setSguJordarter25kOpacity,
    sguGvTillgangVisible, setSguGvTillgangVisible,
    sguGvTillgangOpacity, setSguGvTillgangOpacity,
    sguJorddjupVisible, setSguJorddjupVisible,
    sguJorddjupOpacity, setSguJorddjupOpacity,
    // Copernicus state
    clcVisible, setClcVisible,
    clcOpacity, setClcOpacity,
    waterWetnessVisible, setWaterWetnessVisible,
    waterWetnessOpacity, setWaterWetnessOpacity,
    // Vector layer state
    sourcesVisible, setSourcesVisible,
    wellsVisible, setWellsVisible,
    aquifersVisible, setAquifersVisible,
    aquifersOpacity, setAquifersOpacity,
    soilTypesVisible, setSoilTypesVisible,
    soilTypesOpacity, setSoilTypesOpacity,
    waterBodiesVisible, setWaterBodiesVisible,
    gwLevelsObservedVisible, setGwLevelsObservedVisible,
    gwQualityVisible, setGwQualityVisible,
    observationsVisible, setObservationsVisible,
    // Loading + loaded counts
    loadingSources, setLoadingSources,
    loadingWells, setLoadingWells,
    loadingAquifers, setLoadingAquifers,
    loadingSoilTypes, setLoadingSoilTypes,
    loadingWaterBodies, setLoadingWaterBodies,
    loadingGwLevelsObserved, setLoadingGwLevelsObserved,
    loadingGwQuality, setLoadingGwQuality,
    loadingObservations, setLoadingObservations,
    sourcesLoaded, setSourcesLoaded,
    wellsLoaded, setWellsLoaded,
    aquifersLoaded, setAquifersLoaded,
    soilTypesLoaded, setSoilTypesLoaded,
    waterBodiesLoaded, setWaterBodiesLoaded,
    gwLevelsObservedLoaded, setGwLevelsObservedLoaded,
    gwQualityLoaded, setGwQualityLoaded,
    observationsLoaded, setObservationsLoaded,
    // Jorddjup state
    jorddjupObsVisible, setJorddjupObsVisible,
    jorddjupKartorVisible, setJorddjupKartorVisible,
    jorddjupSprickVisible, setJorddjupSprickVisible,
    loadingJorddjupObs, setLoadingJorddjupObs,
    loadingJorddjupKartor, setLoadingJorddjupKartor,
    loadingJorddjupSprick, setLoadingJorddjupSprick,
    jorddjupObsLoaded, setJorddjupObsLoaded,
    jorddjupKartorLoaded, setJorddjupKartorLoaded,
    jorddjupSprickLoaded, setJorddjupSprickLoaded,
    // HYPE state
    hypoFyllnadSmaVisible, setHypoFyllnadSmaVisible,
    hypoFyllnadStoraVisible, setHypoFyllnadStoraVisible,
    hypoSitSmaVisible, setHypoSitSmaVisible,
    hypoSitStoraVisible, setHypoSitStoraVisible,
    loadingHypoAreas, setLoadingHypoAreas,
    hypoAreasLoaded, setHypoAreasLoaded,
    hypoAreasOpacity, setHypoAreasOpacity,
    hypoAreasDate, setHypoAreasDate,
  };
}
