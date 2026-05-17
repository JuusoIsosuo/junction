import { useEffect, useRef, useState, useCallback } from "react";
import { useDraggable } from "../hooks/useDraggable";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import mapboxgl from "../services/mapbox";
import WeatherPanel from "../features/weather/WeatherPanel";
import DronePanel from "../features/drone/DronePanel";
import { IntelPanel } from "../features/intel/IntelPanel";
import AnalysisPanel from "../features/analysis/AnalysisPanel";
import { LayerPanel } from "../features/layers/LayerPanel";
import {
  T, Panel, PanelHeader, TacButton, CoordRow,
  Divider, StatusBadge, Led, fmtCoord,
} from "../ui/tactical";
import { fetchCellTowers } from "../services/cellTowerService";
import { fetchRoads } from "../services/roadsService";
import { fetchBridges } from "../services/bridgeService";
import { fetchInfrastructure } from "../services/infrastructureService";
import { fetchMilitary } from "../services/militaryService";
import { fetchOsm } from "../services/osmClient";
import { fetchPopulation } from "../services/populationService";
import {
  addCellTowerLayers, removeCellTowerLayers,
  updateCellTowerData, updateCellTowerVisibility,
} from "../features/cellTowers/cellTowerLayer";
import {
  addRoadsLayers, removeRoadsLayers,
  updateRoadsData, updateRoadsVisibility,
} from "../features/roads/roadsLayer";
import {
  addBridgeLayers, removeBridgeLayers,
  updateBridgeData, updateBridgeVisibility,
} from "../features/bridges/bridgeLayer";
import {
  addInfrastructureLayers, removeInfrastructureLayers,
  updateInfrastructureData, updateInfrastructureVisibility,
} from "../features/infrastructure/infrastructureLayer";
import {
  addMilitaryLayers, removeMilitaryLayers,
  updateMilitaryData, updateMilitaryVisibility,
} from "../features/military/militaryLayer";
import {
  addOSMLayers, removeOSMLayers,
  updateOSMData, updateBuildingsVisibility, updateNatureVisibility,
  toGeoJSON as osmToGeoJSON, parseOSMCounts,
} from "../features/osm/osmLayer";
import {
  addElevationLayers, removeElevationLayers,
  updateElevationData, updateElevationVisibility,
  buildGrid, buildHeatmapGeoJSON, extractContours, pickContourLevels, calcStats,
} from "../features/elevation/elevationLayer";
import {
  addLosLayers, removeLosLayers, updateLosData,
} from "../features/lineOfSight/losLayer";
import {
  addPopulationLayers, removePopulationLayers,
  updatePopulationData, updatePopulationVisibility,
} from "../features/population/populationLayer";
import {
  extractObstacles, computeLoS, losResultsToCanvas,
} from "../features/lineOfSight/losCalculator";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);
  const drawAdded = useRef(false);

  const [mapInstance, setMapInstance] = useState(null);
  const [leftMinimized, setLeftMinimized] = useState(false);
  const { pos: leftPos, onMouseDown: leftDrag } = useDraggable({ x: 20, y: 20 });

  const [bbox, setBbox] = useState(null);
  const [isPainting, setIsPainting] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [showDrone, setShowDrone] = useState(false);

  const [enabledLayers, setEnabledLayers] = useState({
    cellTowers: true, roads: true, bridges: true, infrastructure: true, military: true, buildings: true, nature: true, elevation: true, population: true,
  });
  const [queriedBbox, setQueriedBbox] = useState(null);

  const [towerData, setTowerData]       = useState(null);
  const [towerLoading, setTowerLoading] = useState(false);
  const [towerError, setTowerError]     = useState(null);

  const [roadsData, setRoadsData]       = useState(null);
  const [roadsLoading, setRoadsLoading] = useState(false);
  const [roadsError, setRoadsError]     = useState(null);

  const [bridgesData, setBridgesData]     = useState(null);
  const [bridgesLoading, setBridgesLoading] = useState(false);
  const [bridgesError, setBridgesError]   = useState(null);

  const [infraData, setInfraData]       = useState(null);
  const [infraLoading, setInfraLoading] = useState(false);
  const [infraError, setInfraError]     = useState(null);

  const [militaryData, setMilitaryData]       = useState(null);
  const [militaryLoading, setMilitaryLoading] = useState(false);
  const [militaryError, setMilitaryError]     = useState(null);

  const [osmData, setOsmData]           = useState(null);
  const [osmElements, setOsmElements]   = useState([]);
  const [osmLoading, setOsmLoading]     = useState(false);
  const [osmError, setOsmError]         = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const [elevData, setElevData]       = useState(null);
  const [elevLoading, setElevLoading] = useState(false);
  const [elevError, setElevError]     = useState(null);

  const [popData, setPopData]       = useState(null);
  const [popLoading, setPopLoading] = useState(false);
  const [popError, setPopError]     = useState(null);

  const [losMode, setLosMode]         = useState(false);
  const [losObserver, setLosObserver] = useState(null);
  const [losResult, setLosResult]     = useState(null);
  const [losComputing, setLosComputing] = useState(false);

  // ── Map initialisation ────────────────────────────────────────────
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [25.7482, 62.2415],
      zoom: 5,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      defaultMode: "simple_select",
    });

    map.current.addControl(draw.current);
    drawAdded.current = true;

    function updateArea() {
      const data = draw.current.getAll();
      if (data.features.length > 0) {
        const feature = data.features[0];
        const coords = feature.geometry.coordinates[0];
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        coords.forEach(([lng, lat]) => {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        });
        setBbox({ minLng, minLat, maxLng, maxLat });
        setIsPainting(false);

        const src = map.current.getSource("drawn-area");
        if (src) src.setData(feature);
        draw.current.deleteAll();
        map.current.removeControl(draw.current);
        drawAdded.current = false;
      }
    }

    map.current.on("draw.create", updateArea);
    map.current.on("draw.update", updateArea);
    map.current.on("draw.delete", () => {
      setBbox(null);
      setIsPainting(false);
      setQueriedBbox(null);
      setTowerData(null);
      setRoadsData(null);
      setBridgesData(null);
      setInfraData(null);
      setMilitaryData(null);
      setOsmData(null);
      setOsmElements([]);
      setElevData(null);
      setPopData(null);
      setShowWeather(false);
      setShowAnalysis(false);
      const src = map.current.getSource("drawn-area");
      if (src) src.setData({ type: "FeatureCollection", features: [] });
    });

    map.current.on("load", () => {
      map.current.addSource("drawn-area", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.current.addLayer({
        id: "drawn-area-fill",
        type: "fill",
        source: "drawn-area",
        paint: {
          "fill-color": "#7fd99a",
          "fill-opacity": 0.05,
        },
      });
      map.current.addLayer({
        id: "drawn-area-outline",
        type: "line",
        source: "drawn-area",
        paint: {
          "line-color": "#7fd99a",
          "line-width": 1.8,
          "line-dasharray": [4, 2],
          "line-opacity": 0.95,
        },
      });
      setMapInstance(map.current);
    });

    return () => {
      map.current.remove();
      map.current = null;
      draw.current = null;
    };
  }, []);

  // ── Add map layers once map is ready ─────────────────────────────
  useEffect(() => {
    if (!mapInstance) return;
    addCellTowerLayers(mapInstance);
    addRoadsLayers(mapInstance);
    addBridgeLayers(mapInstance);
    addInfrastructureLayers(mapInstance);
    addMilitaryLayers(mapInstance);
    addOSMLayers(mapInstance);
    addElevationLayers(mapInstance);
    addLosLayers(mapInstance);
    addPopulationLayers(mapInstance);
    return () => {
      removeCellTowerLayers(mapInstance);
      removeRoadsLayers(mapInstance);
      removeBridgeLayers(mapInstance);
      removeInfrastructureLayers(mapInstance);
      removeMilitaryLayers(mapInstance);
      removeOSMLayers(mapInstance);
      removeElevationLayers(mapInstance);
      removeLosLayers(mapInstance);
      removePopulationLayers(mapInstance);
    };
  }, [mapInstance]);

  // ── Push data into layers ─────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance) return;
    updateCellTowerData(mapInstance, towerData?.towers ?? []);
  }, [mapInstance, towerData]);

  useEffect(() => {
    if (!mapInstance) return;
    updateRoadsData(mapInstance, roadsData?.geojson ?? null);
  }, [mapInstance, roadsData]);

  useEffect(() => {
    if (!mapInstance) return;
    updateBridgeData(mapInstance, bridgesData?.geojson ?? null);
  }, [mapInstance, bridgesData]);

  useEffect(() => {
    if (!mapInstance) return;
    updateInfrastructureData(mapInstance, infraData?.geojson ?? null);
  }, [mapInstance, infraData]);

  useEffect(() => {
    if (!mapInstance) return;
    updateMilitaryData(mapInstance, militaryData?.geojson ?? null);
  }, [mapInstance, militaryData]);

  useEffect(() => {
    if (!mapInstance) return;
    updateOSMData(mapInstance, osmData?.geojson ?? null);
  }, [mapInstance, osmData]);

  useEffect(() => {
    if (!mapInstance) return;
    updatePopulationData(mapInstance, popData?.geojson ?? null);
  }, [mapInstance, popData]);

  useEffect(() => {
    if (!mapInstance || !elevData) return;
    const { results, bbox: b } = elevData;
    const elevs = results.map((r) => r.elevation);
    const levels = pickContourLevels(Math.min(...elevs), Math.max(...elevs));
    updateElevationData(mapInstance, buildHeatmapGeoJSON(results, b), extractContours(results, b, levels));
  }, [mapInstance, elevData]);

  // ── Visibility ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance) return;
    updateCellTowerVisibility(mapInstance, enabledLayers.cellTowers);
    updateRoadsVisibility(mapInstance, enabledLayers.roads);
    updateBridgeVisibility(mapInstance, enabledLayers.bridges);
    updateInfrastructureVisibility(mapInstance, enabledLayers.infrastructure);
    updateMilitaryVisibility(mapInstance, enabledLayers.military);
    updateBuildingsVisibility(mapInstance, enabledLayers.buildings);
    updateNatureVisibility(mapInstance, enabledLayers.nature);
    updateElevationVisibility(mapInstance, enabledLayers.elevation);
    updatePopulationVisibility(mapInstance, enabledLayers.population);
  }, [mapInstance, enabledLayers]);

  // ── Data fetching ─────────────────────────────────────────────────
  useEffect(() => {
    if (!queriedBbox) return;
    const ctl = new AbortController();
    setTowerData(null); setTowerLoading(true); setTowerError(null);
    fetchCellTowers({ bbox: queriedBbox, signal: ctl.signal })
      .then((d) => { setTowerData(d); setTowerLoading(false); })
      .catch((e) => { if (e.name !== "AbortError") { setTowerError(e.message); setTowerLoading(false); } });
    return () => ctl.abort();
  }, [queriedBbox]);

  useEffect(() => {
    if (!queriedBbox) return;
    const ctl = new AbortController();
    setRoadsData(null); setRoadsLoading(true); setRoadsError(null);
    fetchRoads({ bbox: queriedBbox, signal: ctl.signal })
      .then((d) => { setRoadsData(d); setRoadsLoading(false); })
      .catch((e) => { if (e.name !== "AbortError") { setRoadsError(e.message); setRoadsLoading(false); } });
    return () => ctl.abort();
  }, [queriedBbox]);

  useEffect(() => {
    if (!queriedBbox) return;
    const ctl = new AbortController();
    setBridgesData(null); setBridgesLoading(true); setBridgesError(null);
    fetchBridges({ bbox: queriedBbox, signal: ctl.signal })
      .then((d) => { setBridgesData(d); setBridgesLoading(false); })
      .catch((e) => { if (e.name !== "AbortError") { setBridgesError(e.message); setBridgesLoading(false); } });
    return () => ctl.abort();
  }, [queriedBbox]);

  useEffect(() => {
    if (!queriedBbox) return;
    const ctl = new AbortController();
    setInfraData(null); setInfraLoading(true); setInfraError(null);
    fetchInfrastructure({ bbox: queriedBbox, signal: ctl.signal })
      .then((d) => { setInfraData(d); setInfraLoading(false); })
      .catch((e) => { if (e.name !== 'AbortError') { setInfraError(e.message); setInfraLoading(false); } });
    return () => ctl.abort();
  }, [queriedBbox]);

  useEffect(() => {
    if (!queriedBbox) return;
    const ctl = new AbortController();
    setMilitaryData(null); setMilitaryLoading(true); setMilitaryError(null);
    fetchMilitary({ bbox: queriedBbox, signal: ctl.signal })
      .then((d) => { setMilitaryData(d); setMilitaryLoading(false); })
      .catch((e) => { if (e.name !== 'AbortError') { setMilitaryError(e.message); setMilitaryLoading(false); } });
    return () => ctl.abort();
  }, [queriedBbox]);

  useEffect(() => {
    if (!queriedBbox) return;
    const ctl = new AbortController();
    setOsmData(null); setOsmLoading(true); setOsmError(null);
    fetchOsm({ bbox: queriedBbox, signal: ctl.signal })
      .then((elements) => {
        setOsmElements(elements);
        setOsmData({ geojson: osmToGeoJSON(elements), counts: parseOSMCounts(elements), total: elements.length });
        setOsmLoading(false);
      })
      .catch((e) => { if (e.name !== "AbortError") { setOsmError(e.message); setOsmLoading(false); } });
    return () => ctl.abort();
  }, [queriedBbox]);

  useEffect(() => {
    if (!queriedBbox) return;
    const ctl = new AbortController();
    setPopData(null); setPopLoading(true); setPopError(null);
    fetchPopulation({ bbox: queriedBbox, signal: ctl.signal })
      .then((d) => { setPopData(d); setPopLoading(false); })
      .catch((e) => { if (e.name !== 'AbortError') { setPopError(e.message); setPopLoading(false); } });
    return () => ctl.abort();
  }, [queriedBbox]);

  useEffect(() => {
    if (!queriedBbox) return;
    setElevData(null); setElevLoading(true); setElevError(null);
    const pts = buildGrid(queriedBbox);
    const latStr = pts.map((p) => p.latitude.toFixed(6)).join(",");
    const lngStr = pts.map((p) => p.longitude.toFixed(6)).join(",");
    fetch(`https://api.open-meteo.com/v1/elevation?latitude=${latStr}&longitude=${lngStr}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => {
        const elevations = data.elevation ?? [];
        if (!elevations.length) throw new Error("No elevation data");
        const results = pts.map((p, i) => ({ ...p, elevation: elevations[i] ?? 0 }));
        setElevData({ results, bbox: queriedBbox, stats: calcStats(results.map((r) => r.elevation)) });
        setElevLoading(false);
      })
      .catch((e) => { setElevError(e.message); setElevLoading(false); });
  }, [queriedBbox]);

  // ── Line of Sight ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance) return;
    mapInstance.getCanvas().style.cursor = losMode ? 'crosshair' : '';
  }, [mapInstance, losMode]);

  useEffect(() => {
    if (!mapInstance || !losMode) return;
    const handleClick = (e) => {
      setLosObserver({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      setLosMode(false);
    };
    mapInstance.on('click', handleClick);
    return () => mapInstance.off('click', handleClick);
  }, [mapInstance, losMode]);

  useEffect(() => {
    if (!losObserver || !elevData || !osmData || !queriedBbox) return;
    setLosComputing(true);
    setTimeout(() => {
      const { buildings, forests } = extractObstacles(osmData.geojson);
      const result = computeLoS({
        observerLng: losObserver.lng,
        observerLat: losObserver.lat,
        bbox: queriedBbox,
        elevResults: elevData.results,
        buildings,
        forests,
      });
      setLosResult(result);
      setLosComputing(false);
    }, 0);
  }, [losObserver, elevData, osmData, queriedBbox]);

  useEffect(() => {
    if (!mapInstance) return;
    if (!losResult || !losObserver) {
      updateLosData(mapInstance, null, null, null, null);
      return;
    }
    const canvas = losResultsToCanvas(losResult.results, losResult.gridCols, losResult.gridRows);
    updateLosData(mapInstance, canvas, queriedBbox, losObserver.lng, losObserver.lat);
  }, [mapInstance, losResult, losObserver, queriedBbox]);

  // ── Callbacks ─────────────────────────────────────────────────────
  const activatePaint = useCallback(() => {
    if (!draw.current || !map.current) return;
    if (!drawAdded.current) {
      map.current.addControl(draw.current);
      drawAdded.current = true;
    }
    draw.current.deleteAll();
    setBbox(null);
    const src = map.current.getSource("drawn-area");
    if (src) src.setData({ type: "FeatureCollection", features: [] });
    draw.current.changeMode("draw_polygon");
    setIsPainting(true);
  }, []);

  const clearArea = useCallback(() => {
    if (!draw.current || !map.current) return;
    if (drawAdded.current) {
      draw.current.deleteAll();
      map.current.removeControl(draw.current);
      drawAdded.current = false;
    }
    setBbox(null);
    setQueriedBbox(null);
    setTowerData(null); setRoadsData(null); setBridgesData(null);
    setInfraData(null); setMilitaryData(null); setOsmData(null); setOsmElements([]); setElevData(null); setPopData(null);
    setLosObserver(null); setLosResult(null); setLosMode(false);
    setShowWeather(false); setShowAnalysis(false); setShowDrone(false);
    const src = map.current.getSource("drawn-area");
    if (src) src.setData({ type: "FeatureCollection", features: [] });
    setIsPainting(false);
  }, []);

  const gatherIntel = useCallback(() => {
    if (bbox) setQueriedBbox(bbox);
  }, [bbox]);

  const toggleLayer = useCallback((id) => {
    setEnabledLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleAllLayers = useCallback(() => {
    setEnabledLayers((prev) => {
      const allOn = Object.values(prev).every(Boolean);
      const next = {};
      for (const k of Object.keys(prev)) next[k] = !allOn;
      return next;
    });
  }, []);

  const centerLat = bbox ? (bbox.minLat + bbox.maxLat) / 2 : null;
  const centerLng = bbox ? (bbox.minLng + bbox.maxLng) / 2 : null;

  // Approximate area size in km² for the AO read-out
  let areaKm2 = null;
  if (bbox) {
    const lngFactor = 111.32 * Math.cos(((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180));
    const widthKm  = Math.abs(bbox.maxLng - bbox.minLng) * lngFactor;
    const heightKm = Math.abs(bbox.maxLat - bbox.minLat) * 111.32;
    areaKm2 = widthKm * heightKm;
  }

  const anyLoading = towerLoading || roadsLoading || bridgesLoading || infraLoading || militaryLoading || osmLoading || elevLoading || popLoading;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="tac-panel" style={{ width: "100vw", height: "100vh", position: "relative", background: "#05080a" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      {/* Map decorations — scanlines + vignette overlay (above map, below panels) */}
      <div className="tac-vignette" />
      <div className="tac-scanlines" />

      {/* Left command panel */}
      <Panel
        glow
        style={{
          position: "absolute",
          top: leftPos.y,
          left: leftPos.x,
          zIndex: 5,
          width: 320,
          maxHeight: "calc(100vh - 80px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <PanelHeader
          title="Area Inspector"
          badge={anyLoading ? <Led color={T.warn} pulse /> : <Led color={T.ok} />}
          onMouseDown={leftDrag}
          onMinimize={() => setLeftMinimized((m) => !m)}
          minimized={leftMinimized}
        />

        {!leftMinimized && (
          <div style={{
            padding: "10px 12px 12px",
            display: "flex", flexDirection: "column", gap: 8,
            overflowY: "auto",
          }}>
            <TacButton
              variant={isPainting ? "danger" : "primary"}
              onClick={isPainting ? clearArea : activatePaint}
            >
              {isPainting ? "Cancel Painting" : "Paint Area"}
            </TacButton>

            {isPainting && (
              <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.5 }}>
                Click to place points. Double-click to finish.
              </div>
            )}

            {!isPainting && !bbox && (
              <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.5 }}>
                Press <span style={{ color: T.accent }}>Paint Area</span> then draw a shape on the map.
              </div>
            )}

            {bbox && (
              <>
                <Divider label="Coordinates" />
                <div>
                  <CoordRow label="North" value={fmtCoord(bbox.maxLat, "lat")} />
                  <CoordRow label="South" value={fmtCoord(bbox.minLat, "lat")} />
                  <CoordRow label="East"  value={fmtCoord(bbox.maxLng, "lng")} />
                  <CoordRow label="West"  value={fmtCoord(bbox.minLng, "lng")} />
                  {areaKm2 !== null && (
                    <CoordRow label="Area" value={`${areaKm2.toFixed(1)} km²`} />
                  )}
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <TacButton variant="ghost" onClick={clearArea} style={{ flex: 1 }}>
                    Clear
                  </TacButton>
                </div>

                <Divider label="Actions" />

                <TacButton variant="primary" onClick={gatherIntel}>
                  Gather Intel
                </TacButton>

                {queriedBbox && (
                  <TacButton variant="violet" onClick={() => setShowAnalysis(true)}>
                    Analyze with AI
                  </TacButton>
                )}

                <TacButton variant="cool" onClick={() => setShowWeather(true)}>
                  Fetch Weather Data
                </TacButton>

                <TacButton variant="hot" onClick={() => setShowDrone(true)}>
                  Drone Assessment
                </TacButton>

                {queriedBbox && elevData && osmData && (
                  <>
                    <TacButton
                      variant="hot"
                      active={losMode}
                      onClick={() => {
                        if (losMode) { setLosMode(false); return; }
                        setLosObserver(null); setLosResult(null);
                        setLosMode(true);
                      }}
                    >
                      {losMode ? "Cancel Selection" : "Line of Sight"}
                    </TacButton>
                    {losMode && (
                      <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.5 }}>
                        Click a point on the map to inspect visibility.
                      </div>
                    )}
                    {losComputing && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.accentHot }}>
                        <Led color={T.accentHot} pulse />
                        <span>Computing line of sight…</span>
                      </div>
                    )}
                    {losObserver && !losMode && !losComputing && (
                      <TacButton variant="ghost" onClick={() => { setLosObserver(null); setLosResult(null); }}>
                        Clear LoS
                      </TacButton>
                    )}
                  </>
                )}
              </>
            )}

            <Divider label="Layers" />

            <LayerPanel
              enabledLayers={enabledLayers}
              onToggle={toggleLayer}
              onToggleAll={toggleAllLayers}
            />
          </div>
        )}
      </Panel>

      {/* Right sidebar — S2 SITREP */}
      {queriedBbox && (
        <IntelPanel
          towers={towerData}           towersLoading={towerLoading}   towersError={towerError}
          roads={roadsData}            roadsLoading={roadsLoading}     roadsError={roadsError}
          bridges={bridgesData}        bridgesLoading={bridgesLoading} bridgesError={bridgesError}
          infrastructure={infraData}   infraLoading={infraLoading}       infraError={infraError}
          military={militaryData}      militaryLoading={militaryLoading} militaryError={militaryError}
          osm={osmData}                osmLoading={osmLoading}         osmError={osmError}
          elevation={elevData}         elevLoading={elevLoading}       elevError={elevError}
          population={popData}         popLoading={popLoading}         popError={popError}
          enabledLayers={enabledLayers}
        />
      )}

      {showWeather && centerLat && centerLng && (
        <WeatherPanel lat={centerLat} lng={centerLng} onClose={() => setShowWeather(false)} />
      )}

      {showDrone && centerLat && centerLng && (
        <DronePanel lat={centerLat} lng={centerLng} onClose={() => setShowDrone(false)} />
      )}

      {showAnalysis && bbox && (
        <AnalysisPanel
          elements={osmElements}
          bbox={bbox}
          towerData={towerData}
          roadsData={roadsData}
          elevData={elevData}
          bridgesData={bridgesData}
          onClose={() => setShowAnalysis(false)}
        />
      )}
    </div>
  );
}

export default App;
