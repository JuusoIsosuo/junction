import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { API_BASE } from "../../services/apiBase";
import { useDraggable } from "../../hooks/useDraggable";

function buildAreaSummary(elements, bbox, towerData, roadsData) {
  const waterways = new Set();
  const naturalCounts = {};
  const buildingCounts = {};
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
  }

  const lngFactor = 111.32 * Math.cos(((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180));
  const widthKm  = Math.abs(bbox.maxLng - bbox.minLng) * lngFactor;
  const heightKm = Math.abs(bbox.maxLat - bbox.minLat) * 111.32;
  const fmt = (obj) => Object.entries(obj).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`  ${k}: ${v}`).join("\n");

  let roadSection = "ROADS: no data";
  if (roadsData?.counts) {
    const total = Object.values(roadsData.counts).reduce((a, b) => a + b, 0);
    roadSection = `ROADS (${total} segments):\n${fmt(roadsData.counts) || "  none"}`;
  }

  let towerSection = "CELL TOWERS: no data";
  if (towerData) {
    const radioBreakdown = {};
    for (const t of towerData.towers ?? []) {
      radioBreakdown[t.radio] = (radioBreakdown[t.radio] ?? 0) + 1;
    }
    towerSection = `CELL TOWERS: ${towerData.count} total\n${fmt(radioBreakdown) || "  none"}`;
  }

  return `
AREA: ${(widthKm * heightKm).toFixed(1)} km² (${widthKm.toFixed(1)} km × ${heightKm.toFixed(1)} km)
CENTER: ${((bbox.minLat+bbox.maxLat)/2).toFixed(4)}, ${((bbox.minLng+bbox.maxLng)/2).toFixed(4)}

${roadSection}


WATERWAYS: ${[...waterways].slice(0,10).join(", ") || "none"}

NATURAL LANDCOVER:
${fmt(naturalCounts) || "  none"}

BUILDINGS: ${buildingTotal} total
${fmt(buildingCounts) || "  none"}

${towerSection}
  `.trim();
}

export default function AnalysisPanel({ elements, bbox, towerData, roadsData, onClose }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const { pos, onMouseDown } = useDraggable(() => ({
    x: Math.max(20, (window.innerWidth - 480) / 2),
    y: 20,
  }));

  useEffect(() => {
    const controller = new AbortController();
    const summary = buildAreaSummary(elements, bbox, towerData, roadsData);

    fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary }),
      signal: controller.signal,
    })
      .then((r) => { if (!r.ok) return r.text().then((t) => { throw new Error(t || `HTTP ${r.status}`); }); return r.json(); })
      .then((data) => { setAnalysis(data.analysis); setLoading(false); })
      .catch((e) => { if (e.name === "AbortError") return; setError(e.message); setLoading(false); });

    return () => controller.abort();
  }, [elements, bbox]);

  return createPortal(
    <div style={{
      position: "fixed", top: pos.y, left: pos.x,
      width: 480, maxWidth: "calc(100vw - 40px)", maxHeight: "calc(100vh - 40px)",
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
            AI Terrain Analysis
          </span>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            ConfidentialMind · OSM data
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

      {!minimized && <div style={{ overflowY: "auto", padding: "16px", flex: 1, minHeight: 0 }}>
        {loading && (
          <div style={{ textAlign: "center", color: "#64748b", padding: "32px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
            <div style={{ fontSize: 13 }}>Analyzing terrain...</div>
            <div style={{ fontSize: 11, color: "#334155", marginTop: 6 }}>Processing area data</div>
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
                return <div key={i} style={{ color: "#a78bfa", fontWeight: "bold", marginTop: 14, marginBottom: 4 }}>{line.replace(/\*\*/g, "").replace(/^#+\s*/, "")}</div>;
              }
              if (line.includes("**")) {
                const parts = line.split(/\*\*(.*?)\*\*/g);
                return <div key={i} style={{ marginBottom: 4 }}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: "#c4b5fd" }}>{p}</strong> : p)}</div>;
              }
              if (line.startsWith("- ") || line.startsWith("* ")) {
                return <div key={i} style={{ paddingLeft: 12, marginBottom: 3, color: "#cbd5e1" }}>· {line.slice(2)}</div>;
              }
              if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;
              return <div key={i} style={{ marginBottom: 4 }}>{line}</div>;
            })}
          </div>
        )}
      </div>}
    </div>,
    document.body
  );
}
