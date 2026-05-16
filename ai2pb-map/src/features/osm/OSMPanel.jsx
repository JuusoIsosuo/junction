import { useEffect, useState } from "react";
import { fetchOsm } from "../../services/osmClient";
import AnalysisPanel from "../analysis/AnalysisPanel";
import { useDraggable } from "../../hooks/useDraggable";

const CATEGORIES = [
  {
    key: "buildings",
    label: "Buildings",
    icon: "🏗️",
    color: "#a78bfa",
    subtypes: [
      { tag: "yes", label: "General" },
      { tag: "residential", label: "Residential" },
      { tag: "apartments", label: "Apartments" },
      { tag: "house", label: "House" },
      { tag: "commercial", label: "Commercial" },
      { tag: "industrial", label: "Industrial" },
      { tag: "retail", label: "Retail" },
      { tag: "office", label: "Office" },
      { tag: "school", label: "School" },
      { tag: "church", label: "Church" },
    ],
  },
  {
    key: "natural",
    label: "Natural (landcover)",
    icon: "🌿",
    color: "#34d399",
    subtypes: [
      { tag: "wood", label: "Forest / Wood" },
      { tag: "water", label: "Water body" },
      { tag: "wetland", label: "Wetland" },
      { tag: "heath", label: "Heath" },
      { tag: "grassland", label: "Grassland" },
      { tag: "scrub", label: "Scrub" },
      { tag: "bare_rock", label: "Bare Rock" },
      { tag: "beach", label: "Beach" },
    ],
  },
  {
    key: "landuse",
    label: "Land Use",
    icon: "🗾",
    color: "#6ee7b7",
    subtypes: [
      { tag: "forest", label: "Forest" },
      { tag: "meadow", label: "Meadow" },
      { tag: "farmland", label: "Farmland" },
      { tag: "grass", label: "Grass" },
      { tag: "recreation_ground", label: "Recreation" },
      { tag: "reservoir", label: "Reservoir" },
      { tag: "basin", label: "Basin" },
    ],
  },
  {
    key: "leisure",
    label: "Parks & Green Space",
    icon: "🌳",
    color: "#86efac",
    subtypes: [
      { tag: "park", label: "Park" },
      { tag: "garden", label: "Garden" },
      { tag: "nature_reserve", label: "Nature Reserve" },
      { tag: "playground", label: "Playground" },
      { tag: "golf_course", label: "Golf Course" },
      { tag: "pitch", label: "Sports Pitch" },
    ],
  },
  {
    key: "waterway",
    label: "Waterways",
    icon: "💧",
    color: "#38bdf8",
    subtypes: [
      { tag: "river", label: "River" },
      { tag: "stream", label: "Stream" },
      { tag: "canal", label: "Canal" },
      { tag: "drain", label: "Drain" },
      { tag: "ditch", label: "Ditch" },
    ],
  },
  {
    key: "roads",
    label: "Roads & Paths",
    icon: "🛣️",
    color: "#f97316",
    subtypes: [
      { tag: "motorway",     label: "Motorway" },
      { tag: "trunk",        label: "Trunk" },
      { tag: "primary",      label: "Primary" },
      { tag: "secondary",    label: "Secondary" },
      { tag: "tertiary",     label: "Tertiary" },
      { tag: "residential",  label: "Residential" },
      { tag: "service",      label: "Service" },
      { tag: "unclassified", label: "Unclassified" },
      { tag: "footway",      label: "Footway" },
      { tag: "cycleway",     label: "Cycleway" },
      { tag: "path",         label: "Path" },
      { tag: "track",        label: "Track" },
    ],
  },
];

// Color per feature type for map rendering
const FEATURE_COLORS = {
  buildings: "#a78bfa",
  natural_wood: "#166534",
  natural_water: "#0ea5e9",
  natural_wetland: "#065f46",
  natural_grassland: "#84cc16",
  natural_scrub: "#4d7c0f",
  natural_other: "#34d399",
  landuse_forest: "#15803d",
  landuse_meadow: "#a3e635",
  landuse_farmland: "#ca8a04",
  landuse_grass: "#86efac",
  landuse_other: "#6ee7b7",
  leisure: "#86efac",
  waterway: "#38bdf8",
  road_motorway:   "#fbbf24",
  road_trunk:      "#f59e0b",
  road_primary:    "#f97316",
  road_secondary:  "#fb923c",
  road_tertiary:   "#fdba74",
  road_residential:"#e2e8f0",
  road_service:    "#94a3b8",
  road_path:       "#7dd3fc",
  road_other:      "#cbd5e1",
};

// Convert Overpass elements (with geom) to GeoJSON features
function toGeoJSON(elements) {
  const features = [];

  for (const el of elements) {
    const tags = el.tags || {};
    let geometry = null;
    let featureType = "unknown";

    // Determine category color key
    if (tags.building) featureType = "buildings";
    else if (tags.natural === "wood") featureType = "natural_wood";
    else if (tags.natural === "water") featureType = "natural_water";
    else if (tags.natural === "wetland") featureType = "natural_wetland";
    else if (tags.natural === "grassland") featureType = "natural_grassland";
    else if (tags.natural === "scrub") featureType = "natural_scrub";
    else if (tags.natural) featureType = "natural_other";
    else if (tags.landuse === "forest") featureType = "landuse_forest";
    else if (tags.landuse === "meadow") featureType = "landuse_meadow";
    else if (tags.landuse === "farmland") featureType = "landuse_farmland";
    else if (tags.landuse === "grass") featureType = "landuse_grass";
    else if (tags.landuse) featureType = "landuse_other";
    else if (tags.leisure) featureType = "leisure";
    else if (tags.waterway) featureType = "waterway";
    else if (tags.highway === "motorway" || tags.highway === "trunk") featureType = "road_motorway";
    else if (tags.highway === "primary") featureType = "road_primary";
    else if (tags.highway === "secondary") featureType = "road_secondary";
    else if (tags.highway === "tertiary") featureType = "road_tertiary";
    else if (tags.highway === "residential" || tags.highway === "unclassified" || tags.highway === "living_street") featureType = "road_residential";
    else if (tags.highway === "service") featureType = "road_service";
    else if (tags.highway === "footway" || tags.highway === "cycleway" || tags.highway === "path") featureType = "road_path";
    else if (tags.highway) featureType = "road_other";

    const color = FEATURE_COLORS[featureType] || "#ffffff";

    // Way with geometry (array of {lat, lon})
    if (el.type === "way" && el.geometry && el.geometry.length > 0) {
      const coords = el.geometry.map(({ lon, lat }) => [lon, lat]);
      const isClosedArea = (tags.building || tags.natural || tags.landuse || tags.leisure) && !tags.highway;

      if (isClosedArea && coords.length > 2) {
        // Close the ring if needed
        const ring = [...coords];
        if (
          ring[0][0] !== ring[ring.length - 1][0] ||
          ring[0][1] !== ring[ring.length - 1][1]
        ) {
          ring.push(ring[0]);
        }
        geometry = { type: "Polygon", coordinates: [ring] };
      } else {
        geometry = { type: "LineString", coordinates: coords };
      }
    }

    // Node with lat/lon
    if (el.type === "node" && el.lat !== undefined) {
      geometry = { type: "Point", coordinates: [el.lon, el.lat] };
    }

    if (geometry) {
      features.push({
        type: "Feature",
        geometry,
        properties: {
          ...tags,
          _featureType: featureType,
          _color: color,
          _name:
            tags.name ||
            tags.building ||
            tags.natural ||
            tags.landuse ||
            tags.leisure ||
            tags.waterway ||
            "",
          _highwayType: tags.highway || "",
        },
      });
    }
  }

  return { type: "FeatureCollection", features };
}

function parseResults(elements) {
  const counts = { buildings: {}, natural: {}, landuse: {}, leisure: {}, waterway: {}, roads: {} };
  for (const el of elements) {
    const tags = el.tags || {};
    if (tags.building) counts.buildings[tags.building] = (counts.buildings[tags.building] || 0) + 1;
    if (tags.natural) counts.natural[tags.natural] = (counts.natural[tags.natural] || 0) + 1;
    if (tags.landuse) counts.landuse[tags.landuse] = (counts.landuse[tags.landuse] || 0) + 1;
    if (tags.leisure) counts.leisure[tags.leisure] = (counts.leisure[tags.leisure] || 0) + 1;
    if (tags.waterway) counts.waterway[tags.waterway] = (counts.waterway[tags.waterway] || 0) + 1;
    if (tags.highway)  counts.roads[tags.highway]     = (counts.roads[tags.highway]     || 0) + 1;
  }
  return counts;
}

// Add/remove OSM layers on the Mapbox map
const OSM_SOURCE        = "osm-features";
const LAYER_FILLS       = "osm-fills";
const LAYER_ROAD_CASING = "osm-road-casing";
const LAYER_ROADS       = "osm-roads";
const LAYER_LINES       = "osm-lines";
const LAYER_POINTS      = "osm-points";
const LAYER_LABELS      = "osm-labels";

function addOSMLayers(map, geojson) {
  removeOSMLayers(map);

  map.addSource(OSM_SOURCE, { type: "geojson", data: geojson });

  // Filled polygons (buildings, landcover)
  map.addLayer({
    id: LAYER_FILLS,
    type: "fill",
    source: OSM_SOURCE,
    filter: ["==", "$type", "Polygon"],
    paint: {
      "fill-color": ["get", "_color"],
      "fill-opacity": ["case", ["==", ["get", "_featureType"], "buildings"], 0.75, 0.35],
      "fill-outline-color": ["get", "_color"],
    },
  });

  // Road casing (outline) layer — rendered below road fill for depth
  map.addLayer({
    id: LAYER_ROAD_CASING,
    type: "line",
    source: OSM_SOURCE,
    filter: ["in", ["get", "_featureType"], ["literal", [
      "road_motorway","road_trunk","road_primary","road_secondary",
      "road_tertiary","road_residential","road_service","road_path","road_other",
    ]]],
    paint: {
      "line-color": "#000000",
      "line-opacity": 0.4,
      "line-width": ["match", ["get", "_featureType"],
        "road_motorway",   9,
        "road_trunk",      8,
        "road_primary",    7,
        "road_secondary",  6,
        "road_tertiary",   5,
        "road_residential",4,
        "road_service",    3,
        "road_path",       2,
        3,
      ],
      "line-cap": "round",
      "line-join": "round",
    },
  });

  // Road fill layer
  map.addLayer({
    id: LAYER_ROADS,
    type: "line",
    source: OSM_SOURCE,
    filter: ["in", ["get", "_featureType"], ["literal", [
      "road_motorway","road_trunk","road_primary","road_secondary",
      "road_tertiary","road_residential","road_service","road_path","road_other",
    ]]],
    paint: {
      "line-color": ["get", "_color"],
      "line-opacity": 0.95,
      "line-width": ["match", ["get", "_featureType"],
        "road_motorway",   7,
        "road_trunk",      6,
        "road_primary",    5,
        "road_secondary",  4,
        "road_tertiary",   3,
        "road_residential",2.5,
        "road_service",    1.8,
        "road_path",       1.2,
        2,
      ],
      "line-cap": "round",
      "line-join": "round",
    },
  });

  // Polygon outlines + waterways (non-road lines)
  map.addLayer({
    id: LAYER_LINES,
    type: "line",
    source: OSM_SOURCE,
    filter: ["!", ["in", ["get", "_featureType"], ["literal", [
      "road_motorway","road_trunk","road_primary","road_secondary",
      "road_tertiary","road_residential","road_service","road_path","road_other",
    ]]]],
    paint: {
      "line-color": ["get", "_color"],
      "line-width": ["match", ["get", "_featureType"],
        "buildings", 1.5,
        "waterway",  2,
        0.8,
      ],
      "line-opacity": 0.9,
    },
  });

  // Point nodes
  map.addLayer({
    id: LAYER_POINTS,
    type: "circle",
    source: OSM_SOURCE,
    filter: ["==", "$type", "Point"],
    paint: {
      "circle-color": ["get", "_color"],
      "circle-radius": 5,
      "circle-stroke-color": "#000",
      "circle-stroke-width": 1,
      "circle-opacity": 0.85,
    },
  });

  // Labels for named features
  map.addLayer({
    id: LAYER_LABELS,
    type: "symbol",
    source: OSM_SOURCE,
    filter: ["!=", ["get", "_name"], ""],
    layout: {
      "text-field": ["get", "_name"],
      "text-size": 10,
      "text-anchor": "center",
      "text-max-width": 8,
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": "#000000",
      "text-halo-width": 1.5,
    },
  });
}

function removeOSMLayers(map) {
  [LAYER_LABELS, LAYER_POINTS, LAYER_LINES, LAYER_ROADS, LAYER_ROAD_CASING, LAYER_FILLS].forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource(OSM_SOURCE)) map.removeSource(OSM_SOURCE);
}

function CategoryBlock({ cat, counts }) {
  const [open, setOpen] = useState(true);
  const subtypeCounts = counts[cat.key] || {};
  const total = Object.values(subtypeCounts).reduce((a, b) => a + b, 0);
  const maxCount = Math.max(...cat.subtypes.map((s) => subtypeCounts[s.tag] || 0), 1);

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 7,
          padding: "8px 10px",
          cursor: "pointer",
          color: "white",
          fontFamily: "Arial",
        }}
      >
        <span style={{ fontSize: 13 }}>
          <span style={{ marginRight: 7 }}>{cat.icon}</span>
          {cat.label}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              background: total > 0 ? cat.color : "rgba(255,255,255,0.1)",
              color: total > 0 ? "#000" : "#475569",
              fontSize: 10,
              fontWeight: "bold",
              padding: "2px 7px",
              borderRadius: 10,
            }}
          >
            {total}
          </span>
          <span style={{ fontSize: 11, color: "#475569" }}>{open ? "▲" : "▼"}</span>
        </span>
      </button>

      {open && (
        <div style={{ padding: "6px 4px 0" }}>
          {cat.subtypes.map((sub) => {
            const count = subtypeCounts[sub.tag] || 0;
            const barPct = Math.round((count / maxCount) * 100);
            return (
              <div
                key={sub.tag}
                style={{
                  display: "grid",
                  gridTemplateColumns: "130px 1fr 40px",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 6px",
                  borderRadius: 4,
                  marginBottom: 2,
                  opacity: count === 0 ? 0.3 : 1,
                }}
              >
                <span style={{ fontSize: 11, color: "#94a3b8" }}>{sub.label}</span>
                <div
                  style={{
                    height: 5,
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${barPct}%`,
                      background: cat.color,
                      borderRadius: 3,
                      transition: "width 0.4s",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 11,
                    textAlign: "right",
                    fontWeight: count > 0 ? "bold" : "normal",
                    color: count > 0 ? cat.color : "#334155",
                  }}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function OSMPanel({
  bbox, map, onClose,
  fetchOsmData = true,
  towerData, towerLoading, towerError,
  roadsData, roadsLoading, roadsError,
}) {
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(fetchOsmData);
  const [error, setError] = useState(null);
  const [rawCount, setRawCount] = useState(0);
  const [elements, setElements] = useState([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const { pos, onMouseDown } = useDraggable(() => ({ x: Math.max(20, window.innerWidth - 380), y: 20 }));

  useEffect(() => {
    if (!fetchOsmData) {
      setLoading(false);
      setCounts(null);
      setElements([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setCounts(null);
    setElements([]);
    setShowAnalysis(false);

    fetchOsm({ bbox, signal: controller.signal })
      .then((els) => {
        setElements(els);
        setRawCount(els.length);
        setCounts(parseResults(els));

        const geojson = toGeoJSON(els);
        if (map && map.isStyleLoaded()) {
          addOSMLayers(map, geojson);
        } else if (map) {
          map.once("styledata", () => addOSMLayers(map, geojson));
        }

        setLoading(false);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e.message);
        setLoading(false);
      });

    return () => {
      controller.abort();
      if (map) removeOSMLayers(map);
    };
  }, [bbox, map, fetchOsmData]);

  const areaKm2 = (() => {
    if (!bbox) return 0;
    const latFactor = 111.32;
    const lngFactor = 111.32 * Math.cos(((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180));
    const widthKm = Math.abs(bbox.maxLng - bbox.minLng) * lngFactor;
    const heightKm = Math.abs(bbox.maxLat - bbox.minLat) * latFactor;
    return Math.max(0.01, widthKm * heightKm).toFixed(2);
  })();

  return (
    <div
      style={{
        position: "absolute",
        top: pos.y,
        left: pos.x,
        width: 360,
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(10px)",
        color: "white",
        borderRadius: 12,
        zIndex: 2,
        fontFamily: "Arial",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        onMouseDown={onMouseDown}
        style={{
          padding: "14px 16px",
          borderBottom: minimized ? "none" : "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          cursor: "grab",
          userSelect: "none",
        }}
      >
        <div>
          <span style={{ fontSize: 13, fontWeight: "bold", color: "#f97316" }}>
            Area Intel
          </span>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {fetchOsmData ? `${rawCount} OSM elements · ` : ""}{areaKm2} km²
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => setMinimized((m) => !m)} title={minimized ? "Expand" : "Minimize"}
            style={{ background: "none", border: "none", color: "#64748b", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>
            {minimized ? "▢" : "—"}
          </button>
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: "#64748b", fontSize: 18, cursor: "pointer" }}>
            ✕
          </button>
        </div>
      </div>

      {!minimized && <>
      {/* Map legend */}
      {!loading && counts && (
        <div style={{
          padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0,
        }}>
          {[
            { color: "#a78bfa", label: "Buildings" },
            { color: "#166534", label: "Forest" },
            { color: "#0ea5e9", label: "Water" },
            { color: "#ca8a04", label: "Farmland" },
            { color: "#86efac", label: "Parks" },
            { color: "#38bdf8", label: "Waterways" },
            { color: "#fbbf24", label: "Motorway" },
            { color: "#f97316", label: "Primary" },
            { color: "#e2e8f0", label: "Streets" },
            { color: "#7dd3fc", label: "Paths" },
          ].map(({ color, label }) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#94a3b8" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
              {label}
            </span>
          ))}
        </div>
      )}

      <div style={{ overflowY: "auto", padding: "12px 14px", flex: 1 }}>
        {loading && (
          <div style={{ textAlign: "center", color: "#64748b", padding: "24px 0" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
            Fetching OSM data...
          </div>
        )}

        {error && <div style={{ color: "#f87171", fontSize: 13 }}>Error: {error}</div>}

        {!loading && counts && (
          <div>
            {CATEGORIES.map((cat) => (
              <CategoryBlock key={cat.key} cat={cat} counts={counts} />
            ))}
          </div>
        )}

        {/* Cell towers section */}
        {(towerLoading || towerError || towerData) && (
          <div style={{ marginBottom: 10 }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 7, padding: "8px 10px",
            }}>
              <span style={{ fontSize: 13, color: "white" }}>
                <span style={{ marginRight: 7 }}>📡</span>Cell Towers
              </span>
              {towerData && (
                <span style={{
                  background: "#60a5fa", color: "#000", fontSize: 10,
                  fontWeight: "bold", padding: "2px 7px", borderRadius: 10,
                }}>
                  {towerData.count}
                </span>
              )}
            </div>
            {towerLoading && (
              <div style={{ fontSize: 12, color: "#64748b", padding: "6px 10px" }}>Loading…</div>
            )}
            {towerError && (
              <div style={{ fontSize: 12, color: "#f87171", padding: "6px 10px" }}>Error: {towerError}</div>
            )}
            {towerData && (() => {
              const radioBreakdown = {};
              for (const t of towerData.towers ?? []) {
                radioBreakdown[t.radio] = (radioBreakdown[t.radio] ?? 0) + 1;
              }
              const max = Math.max(...Object.values(radioBreakdown), 1);
              return (
                <div style={{ padding: "6px 4px 0" }}>
                  {Object.entries(radioBreakdown).sort((a, b) => b[1] - a[1]).map(([radio, count]) => (
                    <div key={radio} style={{
                      display: "grid", gridTemplateColumns: "80px 1fr 40px",
                      alignItems: "center", gap: 8, padding: "4px 6px", borderRadius: 4, marginBottom: 2,
                    }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{radio}</span>
                      <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.round((count / max) * 100)}%`, background: "#60a5fa", borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, textAlign: "right", fontWeight: "bold", color: "#60a5fa" }}>{count}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Roads section */}
        {(roadsLoading || roadsError || roadsData) && (
          <div style={{ marginBottom: 10 }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 7, padding: "8px 10px",
            }}>
              <span style={{ fontSize: 13, color: "white" }}>
                <span style={{ marginRight: 7 }}>🛣️</span>Roads
              </span>
              {roadsData && (
                <span style={{
                  background: "#fb923c", color: "#000", fontSize: 10,
                  fontWeight: "bold", padding: "2px 7px", borderRadius: 10,
                }}>
                  {Object.values(roadsData.counts ?? {}).reduce((a, b) => a + b, 0)}
                </span>
              )}
            </div>
            {roadsLoading && (
              <div style={{ fontSize: 12, color: "#64748b", padding: "6px 10px" }}>Loading…</div>
            )}
            {roadsError && (
              <div style={{ fontSize: 12, color: "#f87171", padding: "6px 10px" }}>Error: {roadsError}</div>
            )}
            {roadsData && (() => {
              const entries = Object.entries(roadsData.counts ?? {}).sort((a, b) => b[1] - a[1]);
              const max = Math.max(...entries.map(([, v]) => v), 1);
              return (
                <div style={{ padding: "6px 4px 0" }}>
                  {entries.map(([type, count]) => (
                    <div key={type} style={{
                      display: "grid", gridTemplateColumns: "100px 1fr 40px",
                      alignItems: "center", gap: 8, padding: "4px 6px", borderRadius: 4, marginBottom: 2,
                    }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{type}</span>
                      <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.round((count / max) * 100)}%`, background: "#fb923c", borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, textAlign: "right", fontWeight: "bold", color: "#fb923c" }}>{count}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 10, color: "#334155", textAlign: "right" }}>
          Data: openstreetmap.org via Overpass
        </div>
      </div>

      {(!loading) && (counts || towerData || roadsData) && (
        <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <button
            onClick={() => setShowAnalysis(true)}
            style={{
              width: "100%", padding: "10px", borderRadius: 7,
              border: "1.5px solid #a78bfa",
              background: "rgba(167,139,250,0.12)",
              color: "#a78bfa", fontFamily: "Arial", fontSize: 13,
              fontWeight: "bold", cursor: "pointer",
            }}
          >
            🧠 Analyze with AI
          </button>
        </div>
      )}

      {showAnalysis && (
        <AnalysisPanel
          elements={elements}
          bbox={bbox}
          towerData={towerData}
          roadsData={roadsData}
          onClose={() => setShowAnalysis(false)}
        />
      )}
      </>}
    </div>
  );
}
