import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);

  const [bbox, setBbox] = useState(null);
  const [isPainting, setIsPainting] = useState(false);
  const [copied, setCopied] = useState(false);

  const activatePaint = useCallback(() => {
    if (!draw.current) return;
    draw.current.deleteAll();
    setBbox(null);
    draw.current.changeMode("draw_polygon");
    setIsPainting(true);
  }, []);

  const clearArea = useCallback(() => {
    if (!draw.current) return;
    draw.current.deleteAll();
    setBbox(null);
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
    });
  }, []);

  const fmt = (n) => n?.toFixed(5);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

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
        }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Area Inspector</h3>

        {/* Paint Button */}
        <button
          onClick={isPainting ? clearArea : activatePaint}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "7px",
            border: isPainting ? "1.5px solid #f87171" : "1.5px solid #38bdf8",
            background: isPainting ? "rgba(248,113,113,0.15)" : "rgba(56,189,248,0.15)",
            color: isPainting ? "#f87171" : "#38bdf8",
            fontFamily: "Arial",
            fontSize: 13,
            fontWeight: "bold",
            cursor: "pointer",
            marginBottom: "12px",
          }}
        >
          {isPainting ? "✕  Cancel Painting" : "⬚  Paint Area"}
        </button>

        {isPainting && (
          <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
            Click on the map to place points. Double-click to finish the shape.
          </p>
        )}

        {!isPainting && !bbox && (
          <p style={{ fontSize: 13, color: "#94a3b8" }}>
            Press <span style={{ color: "#38bdf8" }}>Paint Area</span> then draw a shape on the map.
          </p>
        )}

        {bbox && (
          <>
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: 6,
                padding: "10px 12px",
                fontSize: 13,
                marginBottom: 10,
              }}
            >
              {[
                ["Min Longitude", fmt(bbox.minLng)],
                ["Min Latitude",  fmt(bbox.minLat)],
                ["Max Longitude", fmt(bbox.maxLng)],
                ["Max Latitude",  fmt(bbox.maxLat)],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ color: "#94a3b8" }}>{label}</span>
                  <span style={{ fontWeight: "bold" }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: "#7dd3fc", background: "rgba(56,189,248,0.07)", borderRadius: 6, padding: "7px 10px", marginBottom: 10, wordBreak: "break-all" }}>
              [{fmt(bbox.minLng)}, {fmt(bbox.minLat)}, {fmt(bbox.maxLng)}, {fmt(bbox.maxLat)}]
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={copyBbox}
                style={{
                  flex: 1, padding: "8px", borderRadius: 6,
                  border: "1px solid rgba(56,189,248,0.4)",
                  background: copied ? "rgba(56,189,248,0.2)" : "rgba(56,189,248,0.08)",
                  color: "#38bdf8", fontFamily: "Arial", fontSize: 12,
                  fontWeight: "bold", cursor: "pointer",
                }}
              >
                {copied ? "✓ Copied!" : "Copy JSON"}
              </button>
              <button
                onClick={clearArea}
                style={{
                  flex: 1, padding: "8px", borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#64748b", fontFamily: "Arial", fontSize: 12,
                  fontWeight: "bold", cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>

            <p style={{ fontSize: 11, color: "#475569", margin: "12px 0 4px" }}>USE WITH →</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {["Weather API", "Overpass OSM", "Terrain", "Population", "Land cover"].map((tag) => (
                <span key={tag} style={{ padding: "3px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, fontSize: 11, color: "#475569" }}>
                  {tag}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;