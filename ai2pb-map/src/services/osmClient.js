import { API_BASE } from "./apiBase";

export async function fetchOsm({ bbox, signal }) {
  const response = await fetch(`${API_BASE}/api/osm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bbox }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.elements || [];
}
