import { useEffect, useRef, useState, useCallback } from "react";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import mapboxgl from "../services/mapbox";
import WeatherPanel from "../features/weather/WeatherPanel";
import OSMPanel from "../features/osm/OSMPanel";
import ElevationPanel from "../features/elevation/ElevationPanel";
import { IntelPanel } from "../features/intel/IntelPanel";
import { LayerPanel } from "../features/layers/LayerPanel";
import { fetchCellTowers } from "../services/cellTowerService";
import { fetchRoads } from "../services/roadsService";
import {
  addCellTowerLayers, removeCellTowerLayers,
  updateCellTowerData, updateCellTowerVisibility,
} from "../features/cellTowers/cellTowerLayer";
import {
  addRoadsLayers, removeRoadsLayers,
  updateRoadsData, updateRoadsVisibility,
} from "../features/roads/roadsLayer";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);

  const [mapInstance, setMapInstance] = useState(null);
  const [bbox, setBbox] = useState(null);
  const [isPainting, setIsPainting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [showOSM, setShowOSM] = useState(false);
  const [showElevation, setShowElevation] = useState(false);

  const [enabledLayers, setEnabledLayers] = useState({ cellTowers: true, roads: true });
  const [queriedBbox, setQueriedBbox] = useState(null);

  const [towerData, setTowerData] = useState(null);
  const [towerLoading, setTowerLoading] = useState(false);
  const [towerError, setTowerError] = useState(null);

  const [roadsData, setRoadsData] = useState(null);
  const [roadsLoading, setRoadsLoading] = useState(false);
  const [roadsError, setRoadsError] = useState(null);

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

    function updateArea() {
      const data = draw.current.getAll();
      if (data.features.length > 0) {
        const coords = data.features[0].geometry.coordinates[0];
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        coords.forEach(([lng, lat]) => {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        });
        setBbox({ minLng, minLat, maxLng, maxLat });
        setIsPainting(false);
      }
    }

    map.current.on("draw.create", updateArea);
    map.current.on("draw.update", updateArea);
    map.current.on("draw.delete", () => {
      setBbox(null);
      setIsPainting(false);
      setShowWeather(false);
      setShowOSM(false);
      setShowElevation(false);
      setQueriedBbox(null);
      setTowerData(null);
      setRoadsData(null);
    });

    map.current.on("load", () => setMapInstance(map.current));

    return () => {
      map.current.remove();
      map.current = null;
      draw.current = null;
    };
  }, []);

  // ── Map layers (ordered: add → data → visibility) ─────────────────
  useEffect(() => {
    if (!mapInstance) return;
    addCellTowerLayers(mapInstance);
    addRoadsLayers(mapInstance);
    return () => {
      removeCellTowerLayers(mapInstance);
      removeRoadsLayers(mapInstance);
    };
  }, [mapInstance]);

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
    updateCellTowerVisibility(mapInstance, enabledLayers.cellTowers);
    updateRoadsVisibility(mapInstance, enabledLayers.roads);
  }, [mapInstance, enabledLayers]);

  // ── Data fetching ─────────────────────────────────────────────────
  useEffect(() => {
    if (!queriedBbox) return;
    const controller = new AbortController();
    setTowerData(null);
    setTowerLoading(true);
    setTowerError(null);
    fetchCellTowers({ bbox: queriedBbox, signal: controller.signal })
      .then((data) => { setTowerData(data); setTowerLoading(false); })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setTowerError(err.message);
        setTowerLoading(false);
      });
    return () => controller.abort();
  }, [queriedBbox]);

  useEffect(() => {
    if (!queriedBbox) return;
    const controller = new AbortController();
    setRoadsData(null);
    setRoadsLoading(true);
    setRoadsError(null);
    fetchRoads({ bbox: queriedBbox, signal: controller.signal })
      .then((data) => { setRoadsData(data); setRoadsLoading(false); })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setRoadsError(err.message);
        setRoadsLoading(false);
      });
    return () => controller.abort();
  }, [queriedBbox]);

  // ── Callbacks ─────────────────────────────────────────────────────
  const activatePaint = useCallback(() => {
    if (!draw.current) return;
    draw.current.deleteAll();
    setBbox(null);
    setShowWeather(false);
    setShowOSM(false);
    setShowElevation(false);
    draw.current.changeMode("draw_polygon");
    setIsPainting(true);
  }, []);

  const clearArea = useCallback(() => {
    if (!draw.current) return;
    draw.current.deleteAll();
    setBbox(null);
    setShowWeather(false);
    setShowOSM(false);
    setShowElevation(false);
    setQueriedBbox(null);
    setTowerData(null);
    setRoadsData(null);
    draw.current.changeMode("simple_select");
    setIsPainting(false);
  }, []);

  const copyBbox = useCallback(() => {
    if (!bbox) return;
    const json = JSON.stringify(
      {
        bbox: [
          parseFloat(bbox.minLng.toFixed(6)),
          parseFloat(bbox.minLat.toFixed(6)),
          parseFloat(bbox.maxLng.toFixed(6)),
          parseFloat(bbox.maxLat.toFixed(6)),
        ],
        minLng: parseFloat(bbox.minLng.toFixed(6)),
        minLat: parseFloat(bbox.minLat.toFixed(6)),
        maxLng: parseFloat(bbox.maxLng.toFixed(6)),
        maxLat: parseFloat(bbox.maxLat.toFixed(6)),
      },
      null,
      2
    );
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

  const fmt = (n) => n?.toFixed(5);
  const centerLat = bbox ? (bbox.minLat + bbox.maxLat) / 2 : null;
  const centerLng = bbox ? (bbox.minLng + bbox.maxLng) / 2 : null;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      {/* Left panel */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: "rgba(0,0,0,0.85)",
          color: "white",
          padding: "16px",
          borderRadius: "10px",
          zIndex: 1,
          width: "300px",
          fontFamily: "Arial",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16 }}>Area Inspector</h3>

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

            <button onClick={() => setShowWeather(true)} style={{
              width: "100%", padding: "10px", borderRadius: "7px",
              border: "1.5px solid #34d399", background: "rgba(52,211,153,0.12)",
              color: "#34d399", fontFamily: "Arial", fontSize: 13, fontWeight: "bold", cursor: "pointer",
            }}>
              ☁  Fetch Weather Data
            </button>

            <button onClick={() => setShowOSM(true)} style={{
              width: "100%", padding: "10px", borderRadius: "7px",
              border: "1.5px solid #f97316", background: "rgba(249,115,22,0.12)",
              color: "#f97316", fontFamily: "Arial", fontSize: 13, fontWeight: "bold", cursor: "pointer",
            }}>
              🌿 Fetch Nature &amp; Buildings
            </button>

            <button onClick={() => setShowElevation(true)} style={{
              width: "100%", padding: "10px", borderRadius: "7px",
              border: "1.5px solid #facc15", background: "rgba(250,204,21,0.10)",
              color: "#facc15", fontFamily: "Arial", fontSize: 13, fontWeight: "bold", cursor: "pointer",
            }}>
              ▲ Fetch Elevation Data
            </button>
          </>
        )}

        <LayerPanel enabledLayers={enabledLayers} onToggle={toggleLayer} />
      </div>

      {/* Right sidebar */}
      {queriedBbox && (
        <IntelPanel
          towers={towerData}
          towersLoading={towerLoading}
          towersError={towerError}
          roads={roadsData}
          roadsLoading={roadsLoading}
          roadsError={roadsError}
          enabledLayers={enabledLayers}
        />
      )}

      {showWeather && centerLat && centerLng && (
        <WeatherPanel lat={centerLat} lng={centerLng} onClose={() => setShowWeather(false)} />
      )}

      {showOSM && bbox && (
        <OSMPanel bbox={bbox} map={map.current} onClose={() => setShowOSM(false)} />
      )}

      {showElevation && bbox && (
        <ElevationPanel bbox={bbox} map={map.current} onClose={() => setShowElevation(false)} />
      )}
    </div>
  );
}

export default App;
