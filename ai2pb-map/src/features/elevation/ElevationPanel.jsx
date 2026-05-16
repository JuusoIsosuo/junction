import { useEffect, useState, useRef } from "react";

// Open-Meteo elevation API — free, no key, Copernicus DEM 90m, very reliable
// Max 100 locations per request, so keep GRID_N ≤ 10 (10×10 = 100 pts)
const GRID_N = 10;

// ─── Mapbox layer IDs ─────────────────────────────────────────────────────────
const ELEV_SOURCE       = "elevation-grid";
const ELEV_HEAT_LAYER   = "elevation-heatmap";
const ELEV_CONTOUR_SRC  = "elevation-contours";
const ELEV_CONTOUR_LINE = "elevation-contour-lines";
const ELEV_CONTOUR_LBL  = "elevation-contour-labels";
const TERRAIN_SOURCE    = "mapbox-dem";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildGrid(bbox) {
  const pts = [];
  for (let r = 0; r < GRID_N; r++) {
    for (let c = 0; c < GRID_N; c++) {
      const lat = bbox.minLat + (bbox.maxLat - bbox.minLat) * (r / (GRID_N - 1));
      const lng = bbox.minLng + (bbox.maxLng - bbox.minLng) * (c / (GRID_N - 1));
      pts.push({ latitude: lat, longitude: lng });
    }
  }
  return pts;
}

// Map elevation value → colour stops (green→yellow→orange→red→white)
const COLOR_STOPS = [
  [0,    "#0ea5e9"], // sea-level / below → blue
  [50,   "#34d399"], // low → green
  [200,  "#a3e635"], // mid-low → lime
  [500,  "#facc15"], // mid → yellow
  [1000, "#f97316"], // high → orange
  [2000, "#ef4444"], // very high → red
  [4000, "#f1f5f9"], // extreme → near-white
];

function elevToColor(elev, minE, maxE) {
  // Normalise into the colour stops
  const stops = COLOR_STOPS;
  if (elev <= stops[0][0]) return stops[0][1];
  if (elev >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 1; i < stops.length; i++) {
    if (elev <= stops[i][0]) {
      const t = (elev - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return lerpColor(stops[i - 1][1], stops[i][1], t);
    }
  }
  return "#ffffff";
}

function lerpColor(hex1, hex2, t) {
  const p = (h) => parseInt(h.slice(1), 16);
  const a = p(hex1), b = p(hex2);
  const r = Math.round(((a >> 16) & 0xff) * (1 - t) + ((b >> 16) & 0xff) * t);
  const g = Math.round(((a >> 8)  & 0xff) * (1 - t) + ((b >> 8)  & 0xff) * t);
  const bl= Math.round(( a        & 0xff) * (1 - t) + ( b        & 0xff) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

// Build a GeoJSON FeatureCollection of grid-cell polygons with elevation properties
function buildHeatmapGeoJSON(results, bbox) {
  const cellW = (bbox.maxLng - bbox.minLng) / (GRID_N - 1);
  const cellH = (bbox.maxLat - bbox.minLat) / (GRID_N - 1);
  const elevs = results.map((r) => r.elevation);
  const minE = Math.min(...elevs);
  const maxE = Math.max(...elevs);

  const features = results.map((pt, idx) => {
    const row = Math.floor(idx / GRID_N);
    const col = idx % GRID_N;
    const lat = pt.latitude;
    const lng = pt.longitude;
    const hw = cellW / 2, hh = cellH / 2;
    const ring = [
      [lng - hw, lat - hh],
      [lng + hw, lat - hh],
      [lng + hw, lat + hh],
      [lng - hw, lat + hh],
      [lng - hw, lat - hh],
    ];
    return {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring] },
      properties: {
        elevation: pt.elevation,
        color: elevToColor(pt.elevation, minE, maxE),
        normalised: maxE > minE ? (pt.elevation - minE) / (maxE - minE) : 0,
      },
    };
  });
  return { type: "FeatureCollection", features };
}

// Very simple marching-squares-inspired contour extraction
// Returns array of {elevation, coords[]} line segments
function extractContours(results, bbox, levels) {
  const grid = [];
  for (let r = 0; r < GRID_N; r++) {
    grid[r] = [];
    for (let c = 0; c < GRID_N; c++) {
      grid[r][c] = results[r * GRID_N + c];
    }
  }

  const contourFeatures = [];

  for (const level of levels) {
    // Collect line segments where elevation crosses `level`
    const segments = [];
    for (let r = 0; r < GRID_N - 1; r++) {
      for (let c = 0; c < GRID_N - 1; c++) {
        const corners = [
          grid[r][c], grid[r][c + 1],
          grid[r + 1][c + 1], grid[r + 1][c],
        ];
        const lats = [
          corners[0].latitude, corners[1].latitude,
          corners[2].latitude, corners[3].latitude,
        ];
        const lngs = [
          corners[0].longitude, corners[1].longitude,
          corners[2].longitude, corners[3].longitude,
        ];
        const elevs = corners.map((p) => p.elevation);
        const above = elevs.map((e) => e >= level);

        // Edge interpolation helper
        const interp = (i, j) => {
          const t = (level - elevs[i]) / (elevs[j] - elevs[i]);
          return [
            lngs[i] + t * (lngs[j] - lngs[i]),
            lats[i] + t * (lats[j] - lats[i]),
          ];
        };

        // Check each of the 4 edges of the cell
        const pts = [];
        const edges = [[0,1],[1,2],[2,3],[3,0]];
        for (const [a, b] of edges) {
          if (above[a] !== above[b]) pts.push(interp(a, b));
        }
        if (pts.length === 2) segments.push(pts);
      }
    }

    if (segments.length > 0) {
      // Emit each segment as its own LineString for simplicity
      for (const seg of segments) {
        contourFeatures.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: seg },
          properties: { elevation: level, label: `${level}m` },
        });
      }
    }
  }

  return { type: "FeatureCollection", features: contourFeatures };
}

// ─── Map layer management ─────────────────────────────────────────────────────
function addElevationLayers(map, heatGeoJSON, contourGeoJSON, show3D) {
  removeElevationLayers(map);

  // Heatmap cells
  map.addSource(ELEV_SOURCE, { type: "geojson", data: heatGeoJSON });
  map.addLayer({
    id: ELEV_HEAT_LAYER,
    type: "fill",
    source: ELEV_SOURCE,
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": 0.52,
      "fill-outline-color": "rgba(0,0,0,0)",
    },
  });

  // Contour lines
  map.addSource(ELEV_CONTOUR_SRC, { type: "geojson", data: contourGeoJSON });
  map.addLayer({
    id: ELEV_CONTOUR_LINE,
    type: "line",
    source: ELEV_CONTOUR_SRC,
    paint: {
      "line-color": [
        "interpolate", ["linear"], ["get", "elevation"],
        0,    "#0ea5e9",
        500,  "#facc15",
        2000, "#ef4444",
      ],
      "line-width": [
        "interpolate", ["linear"], ["get", "elevation"],
        0, 1, 1000, 1.8, 3000, 2.5,
      ],
      "line-opacity": 0.85,
    },
  });

  map.addLayer({
    id: ELEV_CONTOUR_LBL,
    type: "symbol",
    source: ELEV_CONTOUR_SRC,
    layout: {
      "text-field": ["get", "label"],
      "text-size": 9,
      "symbol-placement": "line",
      "text-max-angle": 30,
    },
    paint: {
      "text-color": "#facc15",
      "text-halo-color": "#000",
      "text-halo-width": 1.2,
    },
  });

  // 3D terrain
  if (show3D) {
    if (!map.getSource(TERRAIN_SOURCE)) {
      map.addSource(TERRAIN_SOURCE, {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
    }
    map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: 1.8 });
    map.easeTo({ pitch: 55, duration: 900 });
  }
}

function removeElevationLayers(map) {
  [ELEV_CONTOUR_LBL, ELEV_CONTOUR_LINE, ELEV_HEAT_LAYER].forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  [ELEV_SOURCE, ELEV_CONTOUR_SRC].forEach((id) => {
    if (map.getSource(id)) map.removeSource(id);
  });
  // Reset 3D terrain
  try { map.setTerrain(null); } catch (_) {}
  try { map.easeTo({ pitch: 0, duration: 600 }); } catch (_) {}
}

// ─── Stats helpers ────────────────────────────────────────────────────────────
function calcStats(elevs) {
  const min = Math.min(...elevs);
  const max = Math.max(...elevs);
  const mean = elevs.reduce((a, b) => a + b, 0) / elevs.length;
  const sorted = [...elevs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const variance = elevs.reduce((a, b) => a + (b - mean) ** 2, 0) / elevs.length;
  const stddev = Math.sqrt(variance);
  return { min, max, mean, median, stddev, range: max - min };
}

function pickContourLevels(min, max) {
  const range = max - min;
  // Pick a sensible interval
  const intervals = [10, 25, 50, 100, 200, 500, 1000];
  const interval = intervals.find((i) => range / i <= 12) ?? 1000;
  const start = Math.ceil(min / interval) * interval;
  const levels = [];
  for (let l = start; l <= max; l += interval) levels.push(l);
  return levels;
}

// ─── Mini elevation profile bar chart ────────────────────────────────────────
function ElevProfile({ results }) {
  // Sample one row from the middle of the grid
  const midRow = Math.floor(GRID_N / 2);
  const slice = results.slice(midRow * GRID_N, (midRow + 1) * GRID_N);
  const elevs = slice.map((p) => p.elevation);
  const min = Math.min(...elevs);
  const max = Math.max(...elevs);
  const BAR_H = 50;

  return (
    <div>
      <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.06em", marginBottom: 6 }}>
        W→E ELEVATION PROFILE (MID-SLICE)
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: BAR_H + 14 }}>
        {elevs.map((e, i) => {
          const pct = max > min ? ((e - min) / (max - min)) * BAR_H : BAR_H / 2;
          const col = elevToColor(e, min, max);
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                title={`${e}m`}
                style={{
                  width: "100%", height: Math.max(3, pct),
                  background: col, borderRadius: "2px 2px 0 0",
                  transition: "height 0.4s",
                }}
              />
              {i === 0 || i === GRID_N - 1 ? (
                <span style={{ fontSize: 8, color: "#475569", marginTop: 2 }}>
                  {Math.round(e)}m
                </span>
              ) : <span style={{ fontSize: 8, color: "transparent" }}>.</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ElevationPanel({ bbox, map, onClose }) {
  const [results, setResults]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [show3D, setShow3D]     = useState(false);
  const [showHeat, setShowHeat] = useState(true);
  const [showContour, setShowContour] = useState(true);
  const layersRef = useRef(false);

  const areaKm2 = (() => {
    const lat = (bbox.maxLat + bbox.minLat) / 2;
    const h = (bbox.maxLat - bbox.minLat) * 111.32;
    const w = (bbox.maxLng - bbox.minLng) * 111.32 * Math.cos((lat * Math.PI) / 180);
    return (h * w).toFixed(1);
  })();

  // ── Fetch elevation grid ──────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    setResults(null);
    layersRef.current = false;

    const pts = buildGrid(bbox);
    const latStr = pts.map((p) => p.latitude.toFixed(6)).join(",");
    const lngStr = pts.map((p) => p.longitude.toFixed(6)).join(",");
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${latStr}&longitude=${lngStr}`;

    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => {
        const elevations = data.elevation || [];
        if (elevations.length === 0) throw new Error("No elevation data returned");
        const res = pts.map((p, i) => ({ ...p, elevation: elevations[i] ?? 0 }));
        setResults(res);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });

    return () => {
      if (map) removeElevationLayers(map);
      layersRef.current = false;
    };
  }, [bbox]);

  // ── Sync map layers when data / toggles change ────────────────────────────
  useEffect(() => {
    if (!results || !map) return;

    const elevs = results.map((r) => r.elevation);
    const levels = pickContourLevels(Math.min(...elevs), Math.max(...elevs));

    const heatGeo    = buildHeatmapGeoJSON(results, bbox);
    const contourGeo = extractContours(results, bbox, levels);

    // Mask layers based on toggles
    if (!showHeat) heatGeo.features = [];
    if (!showContour) contourGeo.features = [];

    const applyLayers = () => {
      addElevationLayers(map, heatGeo, contourGeo, show3D);
      layersRef.current = true;
    };

    if (map.isStyleLoaded()) applyLayers();
    else map.once("styledata", applyLayers);
  }, [results, show3D, showHeat, showContour]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const stats = results ? calcStats(results.map((r) => r.elevation)) : null;

  return (
    <div style={{
      position: "absolute", top: 20, right: showHeat || show3D ? 360 : 20,
      width: 320, maxHeight: "88vh",
      background: "rgba(10,12,18,0.93)", backdropFilter: "blur(12px)",
      color: "white", borderRadius: 14, zIndex: 2,
      fontFamily: "'Courier New', monospace",
      boxShadow: "0 4px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(250,204,21,0.12)",
      border: "1px solid rgba(250,204,21,0.15)",
      display: "flex", flexDirection: "column", overflow: "hidden",
      transition: "right 0.3s",
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: "13px 16px", flexShrink: 0,
        borderBottom: "1px solid rgba(250,204,21,0.1)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "rgba(250,204,21,0.04)",
      }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: "bold", color: "#facc15", letterSpacing: "0.04em" }}>
            ▲ ELEVATION · SRTM
          </span>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 3, letterSpacing: "0.03em" }}>
            {GRID_N}×{GRID_N} grid · ~{areaKm2} km² · open-meteo.com
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#475569", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      <div style={{ overflowY: "auto", padding: "14px 16px", flex: 1 }}>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ textAlign: "center", color: "#64748b", padding: "28px 0" }}>
            <div style={{
              fontSize: 32, marginBottom: 10,
              animation: "spin 1.5s linear infinite",
            }}>⛰</div>
            <div style={{ fontSize: 13, color: "#475569" }}>Sampling elevation grid…</div>
            <div style={{ fontSize: 10, color: "#334155", marginTop: 6 }}>
              {GRID_N * GRID_N} points via Copernicus DEM
            </div>
            <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div style={{ color: "#f87171", fontSize: 12 }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>⚠</div>
            Error: {error}
            <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>
              Open-Elevation may be temporarily unavailable. Try again or reduce the painted area.
            </div>
          </div>
        )}

        {/* ── Data loaded ── */}
        {stats && !loading && (
          <>
            {/* Stats grid */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: 7, marginBottom: 14,
            }}>
              {[
                { label: "MIN", value: `${Math.round(stats.min)}m`, color: "#0ea5e9" },
                { label: "MAX", value: `${Math.round(stats.max)}m`, color: "#ef4444" },
                { label: "RANGE", value: `${Math.round(stats.range)}m`, color: "#facc15" },
                { label: "MEAN", value: `${Math.round(stats.mean)}m`, color: "#34d399" },
                { label: "MEDIAN", value: `${Math.round(stats.median)}m`, color: "#a78bfa" },
                { label: "STD DEV", value: `±${Math.round(stats.stddev)}m`, color: "#f97316" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: "rgba(255,255,255,0.04)", borderRadius: 8,
                  padding: "9px 8px", textAlign: "center",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: "bold", color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Colour scale legend */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.06em", marginBottom: 6 }}>
                ELEVATION COLOUR SCALE
              </div>
              <div style={{
                height: 10, borderRadius: 5,
                background: `linear-gradient(to right, ${COLOR_STOPS.map(([,c]) => c).join(",")})`,
                marginBottom: 4,
              }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                {COLOR_STOPS.filter((_, i) => i % 2 === 0).map(([elev, color]) => (
                  <span key={elev} style={{ fontSize: 9, color: "#475569" }}>{elev}m</span>
                ))}
              </div>
            </div>

            {/* Elevation profile */}
            <div style={{
              background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 10px 6px",
              border: "1px solid rgba(255,255,255,0.05)", marginBottom: 14,
            }}>
              <ElevProfile results={results} />
            </div>

            {/* Layer toggles */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.06em", marginBottom: 8 }}>
                MAP LAYERS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  {
                    label: "Colour Heatmap",
                    icon: "🎨",
                    state: showHeat,
                    toggle: () => setShowHeat((v) => !v),
                    color: "#34d399",
                  },
                  {
                    label: "Contour Lines",
                    icon: "〰",
                    state: showContour,
                    toggle: () => setShowContour((v) => !v),
                    color: "#facc15",
                  },
                  {
                    label: "3D Terrain",
                    icon: "⛰",
                    state: show3D,
                    toggle: () => setShow3D((v) => !v),
                    color: "#f97316",
                    note: "pitches map to 55°",
                  },
                ].map(({ label, icon, state, toggle, color, note }) => (
                  <button
                    key={label}
                    onClick={toggle}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 12px", borderRadius: 8, cursor: "pointer",
                      border: state
                        ? `1px solid ${color}55`
                        : "1px solid rgba(255,255,255,0.06)",
                      background: state
                        ? `${color}15`
                        : "rgba(255,255,255,0.03)",
                      color: "white", fontFamily: "'Courier New', monospace",
                      transition: "all 0.2s",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14 }}>{icon}</span>
                      <span style={{ fontSize: 12 }}>{label}</span>
                      {note && (
                        <span style={{ fontSize: 9, color: "#475569" }}>{note}</span>
                      )}
                    </span>
                    <span style={{
                      width: 28, height: 16, borderRadius: 8,
                      background: state ? color : "rgba(255,255,255,0.1)",
                      display: "flex", alignItems: "center",
                      padding: "0 2px",
                      transition: "background 0.2s",
                    }}>
                      <span style={{
                        width: 12, height: 12, borderRadius: "50%",
                        background: "white",
                        transform: state ? "translateX(12px)" : "translateX(0)",
                        transition: "transform 0.2s",
                        display: "block",
                      }} />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Terrain classification */}
            <div style={{
              background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px",
              border: "1px solid rgba(255,255,255,0.05)", marginBottom: 12,
            }}>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.06em", marginBottom: 8 }}>
                TERRAIN CLASSIFICATION
              </div>
              {(() => {
                const elevs = results.map((r) => r.elevation);
                const total = elevs.length;
                const bands = [
                  { label: "Below sea level", max: 0,    color: "#0ea5e9" },
                  { label: "Lowland (0–200m)",  max: 200,  color: "#34d399" },
                  { label: "Hills (200–500m)",  max: 500,  color: "#facc15" },
                  { label: "Highland (500–1km)",max: 1000, color: "#f97316" },
                  { label: "Mountain (>1km)",   max: Infinity, color: "#ef4444" },
                ];
                const counts = bands.map((b, i) => {
                  const prev = i === 0 ? -Infinity : bands[i - 1].max;
                  return elevs.filter((e) => e >= prev && e < b.max).length;
                });
                const maxC = Math.max(...counts, 1);
                return bands.map((b, i) => {
                  const pct = Math.round((counts[i] / maxC) * 100);
                  const share = ((counts[i] / total) * 100).toFixed(0);
                  return (
                    <div key={b.label} style={{
                      display: "grid", gridTemplateColumns: "130px 1fr 36px",
                      alignItems: "center", gap: 7, marginBottom: 5,
                      opacity: counts[i] === 0 ? 0.25 : 1,
                    }}>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>{b.label}</span>
                      <div style={{
                        height: 5, background: "rgba(255,255,255,0.06)",
                        borderRadius: 3, overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%", width: `${pct}%`,
                          background: b.color, borderRadius: 3, transition: "width 0.5s",
                        }} />
                      </div>
                      <span style={{
                        fontSize: 10, textAlign: "right",
                        color: counts[i] > 0 ? b.color : "#334155",
                        fontWeight: "bold",
                      }}>
                        {share}%
                      </span>
                    </div>
                  );
                });
              })()}
            </div>

            <div style={{ fontSize: 10, color: "#334155", textAlign: "right" }}>
              © Copernicus DEM · open-meteo.com · CC0
            </div>
          </>
        )}
      </div>
    </div>
  );
}
