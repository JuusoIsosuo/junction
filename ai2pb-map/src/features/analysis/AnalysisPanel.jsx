import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { API_BASE } from "../../services/apiBase";
import { useDraggable } from "../../hooks/useDraggable";

const WMO = {
  0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",
  45:"Fog",48:"Icy fog",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",
  61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",75:"Heavy snow",
  80:"Showers",81:"Heavy showers",95:"Thunderstorm",96:"Thunderstorm+hail",
};

async function fetchWeatherSummary(bbox, signal) {
  const lat = ((bbox.minLat + bbox.maxLat) / 2).toFixed(4);
  const lng = ((bbox.minLng + bbox.maxLng) / 2).toFixed(4);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,precipitation,relative_humidity_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,snowfall_sum` +
    `&forecast_days=5&wind_speed_unit=ms&timezone=auto`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("weather fetch failed");
  const d = await res.json();
  const c = d.current;
  const dl = d.daily;
  const cur = `Current: ${c.temperature_2m}°C, ${WMO[c.weather_code] ?? "?"}, wind ${c.wind_speed_10m}m/s, precip ${c.precipitation}mm, humidity ${c.relative_humidity_2m}%`;
  const days = dl.time.map((date, i) => {
    const snow = dl.snowfall_sum?.[i] ?? 0;
    return `  ${date}: ${WMO[dl.weather_code[i]] ?? "?"}, ${dl.temperature_2m_min[i]}–${dl.temperature_2m_max[i]}°C, wind ${dl.wind_speed_10m_max[i]}m/s, rain ${dl.precipitation_sum[i]}mm${snow > 0 ? `, snow ${snow}cm` : ""}`;
  }).join("\n");
  return `${cur}\n5-day forecast:\n${days}`;
}

function midCoord(coords) {
  if (!coords?.length) return null;
  const m = coords[Math.floor(coords.length / 2)];
  return `${m[1].toFixed(4)}°N ${m[0].toFixed(4)}°E`;
}

function buildAreaSummary(elements, bbox, towerData, roadsData, elevData, bridgesData, weatherSummary) {
  const waterways = new Set();
  const naturalCounts = {};
  const buildingCounts = {};
  const places = {};
  let buildingTotal = 0;

  for (const el of elements) {
    const tags = el.tags || {};
    if (tags.waterway)
      waterways.add(tags.name ? `${tags.waterway} "${tags.name}"` : tags.waterway);
    if (tags.natural)
      naturalCounts[tags.natural] = (naturalCounts[tags.natural] || 0) + 1;
    if (tags.building) {
      buildingTotal++;
      buildingCounts[tags.building] = (buildingCounts[tags.building] || 0) + 1;
    }
    if (tags.place && tags.name) {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      const loc = (lat && lng) ? ` (${Number(lat).toFixed(4)}°N ${Number(lng).toFixed(4)}°E)` : "";
      if (!places[tags.place]) places[tags.place] = [];
      places[tags.place].push(`${tags.name}${loc}`);
    }
  }

  const lngFactor = 111.32 * Math.cos(((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180));
  const widthKm  = Math.abs(bbox.maxLng - bbox.minLng) * lngFactor;
  const heightKm = Math.abs(bbox.maxLat - bbox.minLat) * 111.32;
  const fmtCounts = (obj) => Object.entries(obj).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`  ${k}: ${v}`).join("\n");

  // Named roads with representative coordinates
  let roadSection = "ROADS: no data";
  if (roadsData?.counts) {
    const total = Object.values(roadsData.counts).reduce((a, b) => a + b, 0);
    const namedRoads = [];
    const seen = new Set();
    for (const f of roadsData.geojson?.features ?? []) {
      const name = f.properties?.name;
      if (name && !seen.has(name)) {
        seen.add(name);
        const loc = midCoord(f.geometry?.coordinates);
        namedRoads.push(`  ${f.properties.highway} "${name}"${loc ? ` @ ${loc}` : ""}`);
      }
    }
    roadSection = `ROADS (${total} segments):\n${fmtCounts(roadsData.counts) || "  none"}` +
      (namedRoads.length ? `\nNamed roads:\n${namedRoads.slice(0, 25).join("\n")}` : "");
  }

  // Bridges with coordinates and load limits
  let bridgeSection = "BRIDGES: no data";
  if (bridgesData?.geojson?.features?.length) {
    const lines = bridgesData.geojson.features.map((f) => {
      const p = f.properties ?? {};
      const loc = midCoord(f.geometry?.coordinates);
      const label = p.name ? `"${p.name}"` : `id:${p.id}`;
      const hw = p.highway ? ` [${p.highway}]` : "";
      const wt = p.maxweight ? `, max ${p.maxweight}t` : "";
      const ref = p.ref ? ` (${p.ref})` : "";
      return `  ${label}${ref}${hw}${wt}${loc ? ` @ ${loc}` : ""}`;
    });
    bridgeSection = `BRIDGES: ${bridgesData.geojson.features.length} detected\n${lines.slice(0, 20).join("\n")}`;
  }

  // Cell towers with radio type breakdown
  let towerSection = "CELL TOWERS: no data";
  if (towerData) {
    const radioBreakdown = {};
    for (const t of towerData.towers ?? []) {
      radioBreakdown[t.radio] = (radioBreakdown[t.radio] ?? 0) + 1;
    }
    towerSection = `CELL TOWERS: ${towerData.count} total\n${fmtCounts(radioBreakdown) || "  none"}`;
  }

  // Elevation with highest/lowest named points
  let elevSection = "ELEVATION: no data";
  if (elevData?.stats) {
    const s = elevData.stats;
    const results = elevData.results ?? [];
    const sorted = [...results].sort((a, b) => b.elevation - a.elevation);
    const hi = sorted.slice(0, 3).map(r => `${Math.round(r.elevation)}m @ ${r.latitude.toFixed(4)}°N ${r.longitude.toFixed(4)}°E`);
    const lo = sorted.slice(-3).reverse().map(r => `${Math.round(r.elevation)}m @ ${r.latitude.toFixed(4)}°N ${r.longitude.toFixed(4)}°E`);
    elevSection = `ELEVATION: min ${Math.round(s.min)}m, max ${Math.round(s.max)}m, mean ${Math.round(s.mean)}m, range ${Math.round(s.range)}m, std dev ±${Math.round(s.stddev)}m\nHighest points: ${hi.join("; ")}\nLowest points: ${lo.join("; ")}`;
  }

  // Settlements
  const settlementLines = Object.entries(places)
    .sort((a, b) => ["city","town","village","hamlet"].indexOf(a[0]) - ["city","town","village","hamlet"].indexOf(b[0]))
    .flatMap(([type, names]) => names.map(n => `  ${type}: ${n}`))
    .slice(0, 30);
  const settlementSection = settlementLines.length
    ? `SETTLEMENTS:\n${settlementLines.join("\n")}`
    : "SETTLEMENTS: none detected";

  return `
AREA: ${(widthKm * heightKm).toFixed(1)} km² (${widthKm.toFixed(1)} km × ${heightKm.toFixed(1)} km)
CENTER: ${((bbox.minLat+bbox.maxLat)/2).toFixed(4)}°N, ${((bbox.minLng+bbox.maxLng)/2).toFixed(4)}°E

${elevSection}

${roadSection}

${bridgeSection}

WATERWAYS: ${[...waterways].slice(0, 20).join(", ") || "none"}

${settlementSection}

NATURAL LANDCOVER:
${fmtCounts(naturalCounts) || "  none"}

BUILDINGS: ${buildingTotal} total
${fmtCounts(buildingCounts) || "  none"}

${towerSection}

WEATHER:
${weatherSummary}
`.trim();
}

export default function AnalysisPanel({ elements, bbox, towerData, roadsData, elevData, bridgesData, onClose }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const { pos, onMouseDown } = useDraggable(() => ({
    x: Math.max(20, (window.innerWidth - 520) / 2),
    y: 20,
  }));

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      let weatherSummary = "Weather data unavailable.";
      try {
        weatherSummary = await fetchWeatherSummary(bbox, controller.signal);
      } catch (_) {}

      const summary = buildAreaSummary(elements, bbox, towerData, roadsData, elevData, bridgesData, weatherSummary);

      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
      const data = await res.json();
      setAnalysis(data.analysis);
      setLoading(false);
    }

    run().catch((e) => {
      if (e.name === "AbortError") return;
      setError(e.message);
      setLoading(false);
    });

    return () => controller.abort();
  }, [elements, bbox]);

  return createPortal(
    <div style={{
      position: "fixed", top: pos.y, left: pos.x,
      width: 520, maxWidth: "calc(100vw - 40px)", maxHeight: "calc(100vh - 40px)",
      background: "rgba(0,0,0,0.92)", backdropFilter: "blur(12px)",
      color: "white", borderRadius: 12, zIndex: 100, fontFamily: "Arial",
      boxShadow: "0 4px 32px rgba(0,0,0,0.6)",
      border: "1px solid rgba(139,92,246,0.3)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div
        onMouseDown={onMouseDown}
        style={{
          padding: "14px 16px", flexShrink: 0,
          borderBottom: minimized ? "none" : "1px solid rgba(255,255,255,0.08)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "grab", userSelect: "none",
        }}
      >
        <div>
          <span style={{ fontSize: 13, fontWeight: "bold", color: "#a78bfa" }}>
            AI Tactical Terrain Analysis
          </span>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            ConfidentialMind · terrain + weather + infrastructure
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

      {!minimized && (
        <div style={{ overflowY: "auto", padding: "16px", flex: 1, minHeight: 0 }}>
          {loading && (
            <div style={{ textAlign: "center", color: "#64748b", padding: "32px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
              <div style={{ fontSize: 13 }}>Analyzing terrain & weather...</div>
              <div style={{ fontSize: 11, color: "#334155", marginTop: 6 }}>Fetching live forecast · processing area data</div>
            </div>
          )}

          {error && (
            <div style={{ color: "#f87171", fontSize: 13 }}>
              Error: {error}
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                Make sure CONFIDENTIAL_MIND_BASE_URL and CONFIDENTIAL_MIND_API_KEY are set on the server.
              </div>
            </div>
          )}

          {analysis && (
            <div style={{ fontSize: 13, lineHeight: 1.7, color: "#e2e8f0", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>
              {analysis.split("\n").map((line, i) => {
                if (line.startsWith("## ") || (line.startsWith("**") && line.endsWith("**"))) {
                  return <div key={i} style={{ color: "#a78bfa", fontWeight: "bold", marginTop: 16, marginBottom: 6, fontSize: 14 }}>{line.replace(/\*\*/g, "").replace(/^#+\s*/, "")}</div>;
                }
                if (line.includes("**")) {
                  const parts = line.split(/\*\*(.*?)\*\*/g);
                  return <div key={i} style={{ marginBottom: 4 }}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: "#c4b5fd" }}>{p}</strong> : p)}</div>;
                }
                if (line.startsWith("- ") || line.startsWith("* ")) {
                  return <div key={i} style={{ paddingLeft: 12, marginBottom: 5, color: "#cbd5e1" }}>· {line.slice(2)}</div>;
                }
                if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;
                return <div key={i} style={{ marginBottom: 4 }}>{line}</div>;
              })}
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}
