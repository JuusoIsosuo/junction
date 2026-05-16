import { useEffect, useRef, useState, useCallback } from "react";
import { useDraggable } from "../hooks/useDraggable";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import mapboxgl from "../services/mapbox";
import WeatherPanel from "../features/weather/WeatherPanel";
import { IntelPanel } from "../features/intel/IntelPanel";
import AnalysisPanel from "../features/analysis/AnalysisPanel";
import { LayerPanel } from "../features/layers/LayerPanel";
import { fetchCellTowers } from "../services/cellTowerService";
import { fetchRoads } from "../services/roadsService";
import { fetchBridges } from "../services/bridgeService";
import { fetchInfrastructure } from "../services/infrastructureService";
import { fetchOsm } from "../services/osmClient";
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
  addOSMLayers, removeOSMLayers,
  updateOSMData, updateBuildingsVisibility, updateNatureVisibility,
  toGeoJSON as osmToGeoJSON, parseOSMCounts,
} from "../features/osm/osmLayer";
import {
  addElevationLayers, removeElevationLayers,
  updateElevationData, updateElevationVisibility,
  buildGrid, buildHeatmapGeoJSON, extractContours, pickContourLevels, calcStats,
} from "../features/elevation/elevationLayer";

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
  const [copied, setCopied] = useState(false);
  const [showWeather, setShowWeather] = useState(false);

  const [enabledLayers, setEnabledLayers] = useState({
    cellTowers: true, roads: true, bridges: true, infrastructure: true, buildings: true, nature: true, elevation: true,
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

  const [osmData, setOsmData]           = useState(null);
  const [osmElements, setOsmElements]   = useState([]);
  const [osmLoading, setOsmLoading]     = useState(false);
  const [osmError, setOsmError]         = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const [elevData, setElevData]       = useState(null);
  const [elevLoading, setElevLoading] = useState(false);
  const [elevError, setElevError]     = useState(null);

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

        // Store polygon in static source, then remove Draw so it can't intercept map panning
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
      setOsmData(null);
      setOsmElements([]);
      setElevData(null);
      setShowWeather(false);
      setShowAnalysis(false);
      const src = map.current.getSource("drawn-area");
      if (src) src.setData({ type: "FeatureCollection", features: [] });
    });

    map.current.on("load", () => {
      // Static outline layer for the drawn polygon (prevents Draw from making it draggable)
      map.current.addSource("drawn-area", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.current.addLayer({
        id: "drawn-area-outline",
        type: "line",
        source: "drawn-area",
        paint: {
          "line-color": "#38bdf8",
          "line-width": 2.5,
          "line-dasharray": [3, 2],
          "line-opacity": 0.9,
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
    addOSMLayers(mapInstance);
    addElevationLayers(mapInstance);
    return () => {
      removeCellTowerLayers(mapInstance);
      removeRoadsLayers(mapInstance);
      removeBridgeLayers(mapInstance);
      removeInfrastructureLayers(mapInstance);
      removeOSMLayers(mapInstance);
      removeElevationLayers(mapInstance);
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
    updateOSMData(mapInstance, osmData?.geojson ?? null);
  }, [mapInstance, osmData]);

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
    updateBuildingsVisibility(mapInstance, enabledLayers.buildings);
    updateNatureVisibility(mapInstance, enabledLayers.nature);
    updateElevationVisibility(mapInstance, enabledLayers.elevation);
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
    setInfraData(null); setOsmData(null); setOsmElements([]); setElevData(null);
    setShowWeather(false); setShowAnalysis(false);
    const src = map.current.getSource("drawn-area");
    if (src) src.setData({ type: "FeatureCollection", features: [] });
    setIsPainting(false);
  }, []);

  const copyBbox = useCallback(() => {
    if (!bbox) return;
    const json = JSON.stringify({
      bbox: [
        parseFloat(bbox.minLng.toFixed(6)), parseFloat(bbox.minLat.toFixed(6)),
        parseFloat(bbox.maxLng.toFixed(6)), parseFloat(bbox.maxLat.toFixed(6)),
      ],
      minLng: parseFloat(bbox.minLng.toFixed(6)),
      minLat: parseFloat(bbox.minLat.toFixed(6)),
      maxLng: parseFloat(bbox.maxLng.toFixed(6)),
      maxLat: parseFloat(bbox.maxLat.toFixed(6)),
    }, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [bbox]);

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

  const fmt = (n) => n?.toFixed(5);
  const centerLat = bbox ? (bbox.minLat + bbox.maxLat) / 2 : null;
  const centerLng = bbox ? (bbox.minLng + bbox.maxLng) / 2 : null;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      {/* Left panel */}
      <div style={{
        position: "absolute",
        top: leftPos.y,
        left: leftPos.x,
        background: "rgba(0,0,0,0.85)",
        color: "white",
        borderRadius: "10px",
        zIndex: 1,
        width: "300px",
        fontFamily: "Arial",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Draggable header */}
        <div
          onMouseDown={leftDrag}
          style={{
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "grab",
            userSelect: "none",
            borderBottom: leftMinimized ? "none" : "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16 }}>Area Inspector</h3>
          <button
            onClick={() => setLeftMinimized((m) => !m)}
            title={leftMinimized ? "Expand" : "Minimize"}
            style={{
              background: "none", border: "none", color: "#64748b",
              fontSize: 16, cursor: "pointer", lineHeight: 1, padding: "0 2px",
            }}
          >
            {leftMinimized ? "▢" : "—"}
          </button>
        </div>

        {!leftMinimized && (
          <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={isPainting ? clearArea : activatePaint}
              style={{
                width: "100%", padding: "10px", borderRadius: "7px",
                border: isPainting ? "1.5px solid #f87171" : "1.5px solid #38bdf8",
                background: isPainting ? "rgba(248,113,113,0.15)" : "rgba(56,189,248,0.15)",
                color: isPainting ? "#f87171" : "#38bdf8",
                fontFamily: "Arial", fontSize: 13, fontWeight: "bold", cursor: "pointer",
              }}
            >
              {isPainting ? "✕  Cancel Painting" : "⬚  Paint Area"}
            </button>

            {isPainting && (
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                Click to place points. Double-click to finish.
              </p>
            )}

            {!isPainting && !bbox && (
              <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
                Press <span style={{ color: "#38bdf8" }}>Paint Area</span> then draw a shape on the map.
              </p>
            )}

            {bbox && (
              <>
                <div style={{
                  background: "rgba(255,255,255,0.05)", borderRadius: 6,
                  padding: "10px 12px", fontSize: 13,
                }}>
                  {[
                    ["Min Longitude", fmt(bbox.minLng)],
                    ["Min Latitude",  fmt(bbox.minLat)],
                    ["Max Longitude", fmt(bbox.maxLng)],
                    ["Max Latitude",  fmt(bbox.maxLat)],
                  ].map(([label, val]) => (
                    <div key={label} style={{
                      display: "flex", justifyContent: "space-between",
                      padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}>
                      <span style={{ color: "#94a3b8" }}>{label}</span>
                      <span style={{ fontWeight: "bold" }}>{val}</span>
                    </div>
                  ))}
                </div>

                <div style={{
                  fontSize: 11, color: "#7dd3fc",
                  background: "rgba(56,189,248,0.07)",
                  borderRadius: 6, padding: "7px 10px", wordBreak: "break-all",
                }}>
                  [{fmt(bbox.minLng)}, {fmt(bbox.minLat)}, {fmt(bbox.maxLng)}, {fmt(bbox.maxLat)}]
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={copyBbox} style={{
                    flex: 1, padding: "8px", borderRadius: 6,
                    border: "1px solid rgba(56,189,248,0.4)",
                    background: copied ? "rgba(56,189,248,0.2)" : "rgba(56,189,248,0.08)",
                    color: "#38bdf8", fontFamily: "Arial", fontSize: 12, fontWeight: "bold", cursor: "pointer",
                  }}>
                    {copied ? "✔ Copied!" : "Copy JSON"}
                  </button>
                  <button onClick={clearArea} style={{
                    flex: 1, padding: "8px", borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#64748b", fontFamily: "Arial", fontSize: 12, fontWeight: "bold", cursor: "pointer",
                  }}>
                    Clear
                  </button>
                </div>

                <button onClick={gatherIntel} style={{
                  width: "100%", padding: "10px", borderRadius: "7px",
                  border: "1.5px solid #10b981", background: "rgba(16,185,129,0.12)",
                  color: "#10b981", fontFamily: "Arial", fontSize: 13, fontWeight: "bold", cursor: "pointer",
                }}>
                  ⬡  Gather Intel
                </button>

                {queriedBbox && (
                  <button onClick={() => setShowAnalysis(true)} style={{
                    width: "100%", padding: "10px", borderRadius: "7px",
                    border: "1.5px solid #a78bfa", background: "rgba(167,139,250,0.12)",
                    color: "#a78bfa", fontFamily: "Arial", fontSize: 13, fontWeight: "bold", cursor: "pointer",
                  }}>
                    🧠  Analyze with AI
                  </button>
                )}

                <button onClick={() => setShowWeather(true)} style={{
                  width: "100%", padding: "10px", borderRadius: "7px",
                  border: "1.5px solid #34d399", background: "rgba(52,211,153,0.12)",
                  color: "#34d399", fontFamily: "Arial", fontSize: 13, fontWeight: "bold", cursor: "pointer",
                }}>
                  ☁  Fetch Weather Data
                </button>
              </>
            )}

            <LayerPanel
              enabledLayers={enabledLayers}
              onToggle={toggleLayer}
              onToggleAll={toggleAllLayers}
            />
          </div>
        )}
      </div>

      {/* Right sidebar */}
      {queriedBbox && (
        <IntelPanel
          towers={towerData}           towersLoading={towerLoading}   towersError={towerError}
          roads={roadsData}            roadsLoading={roadsLoading}     roadsError={roadsError}
          bridges={bridgesData}        bridgesLoading={bridgesLoading} bridgesError={bridgesError}
          infrastructure={infraData}   infraLoading={infraLoading}     infraError={infraError}
          osm={osmData}                osmLoading={osmLoading}         osmError={osmError}
          elevation={elevData}         elevLoading={elevLoading}       elevError={elevError}
          enabledLayers={enabledLayers}
        />
      )}

      {showWeather && centerLat && centerLng && (
        <WeatherPanel lat={centerLat} lng={centerLng} onClose={() => setShowWeather(false)} />
      )}

      {showAnalysis && bbox && (
        <AnalysisPanel
          elements={osmElements}
          bbox={bbox}
          towerData={towerData}
          roadsData={roadsData}
          onClose={() => setShowAnalysis(false)}
        />
      )}
    </div>
  );
}

export default App;
