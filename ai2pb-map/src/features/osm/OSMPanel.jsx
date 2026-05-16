import { useEffect, useState } from "react";
import { fetchOsm } from "../../services/osmClient";

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

    const color = FEATURE_COLORS[featureType] || "#ffffff";

    // Way with geometry (array of {lat, lon})
    if (el.type === "way" && el.geometry && el.geometry.length > 0) {
      const coords = el.geometry.map(({ lon, lat }) => [lon, lat]);
      const isClosedArea = tags.building || tags.natural || tags.landuse || tags.leisure;

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
        },
      });
    }
  }

  return { type: "FeatureCollection", features };
}

function parseResults(elements) {
  const counts = { buildings: {}, natural: {}, landuse: {}, leisure: {}, waterway: {} };
  for (const el of elements) {
    const tags = el.tags || {};
    if (tags.building) counts.buildings[tags.building] = (counts.buildings[tags.building] || 0) + 1;
    if (tags.natural) counts.natural[tags.natural] = (counts.natural[tags.natural] || 0) + 1;
    if (tags.landuse) counts.landuse[tags.landuse] = (counts.landuse[tags.landuse] || 0) + 1;
    if (tags.leisure) counts.leisure[tags.leisure] = (counts.leisure[tags.leisure] || 0) + 1;
    if (tags.waterway) counts.waterway[tags.waterway] = (counts.waterway[tags.waterway] || 0) + 1;
  }
  return counts;
}

// Add/remove OSM layers on the Mapbox map
const OSM_SOURCE = "osm-features";
const LAYER_FILLS = "osm-fills";
const LAYER_LINES = "osm-lines";
const LAYER_POINTS = "osm-points";
const LAYER_LABELS = "osm-labels";

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

  // Polygon outlines
  map.addLayer({
    id: LAYER_LINES,
    type: "line",
    source: OSM_SOURCE,
    paint: {
      "line-color": ["get", "_color"],
      "line-width": [
        "case",
        ["==", ["get", "_featureType"], "buildings"],
        1.5,
        ["==", ["get", "_featureType"], "waterway"],
        2,
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
  [LAYER_LABELS, LAYER_POINTS, LAYER_LINES, LAYER_FILLS].forEach((id) => {
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

export default function OSMPanel({ bbox, map, onClose }) {
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rawCount, setRawCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);
    setCounts(null);

    fetchOsm({ bbox, signal: controller.signal })
      .then((elements) => {
        setRawCount(elements.length);
        setCounts(parseResults(elements));

        // Render on map
        const geojson = toGeoJSON(elements);
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

    // Cleanup layers when panel unmounts
    return () => {
      controller.abort();
      if (map) removeOSMLayers(map);
    };
  }, [bbox, map]);

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
        top: 20,
        right: 20,
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
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div>
          <span style={{ fontSize: 13, fontWeight: "bold", color: "#f97316" }}>
            🌿 Nature & Buildings
          </span>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {rawCount} elements · {areaKm2} km²
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            fontSize: 18,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: "14px 16px", overflowY: "auto", flex: 1 }}>
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

        <div style={{ marginTop: 10, fontSize: 10, color: "#334155", textAlign: "right" }}>
          Data: openstreetmap.org via Overpass
        </div>
      </div>
    </div>
  );
}
