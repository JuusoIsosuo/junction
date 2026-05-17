import { API_BASE } from "./apiBase";

const HIGHWAY_TYPES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'track'];

function classifyHighway(tag) {
  return HIGHWAY_TYPES.includes(tag) ? tag : 'other';
}

export async function fetchRoads({ bbox, signal }) {
  const { minLat, minLng, maxLat, maxLng } = bbox;
  const b = `${minLat},${minLng},${maxLat},${maxLng}`;

  const query = `
[out:json][timeout:30];
(
  way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|track"](${b});
);
out geom;
`.trim();

  const res = await fetch(`${API_BASE}/api/overpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  });

  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  const raw = await res.json();

  const counts = {};
  const features = [];

  for (const el of raw.elements ?? []) {
    if (!el.geometry?.length) continue;
    const hw = classifyHighway(el.tags?.highway ?? '');
    counts[hw] = (counts[hw] ?? 0) + 1;
    features.push({
      type: 'Feature',
      properties: { highway: hw, name: el.tags?.name ?? null },
      geometry: {
        type: 'LineString',
        coordinates: el.geometry.map((p) => [p.lon, p.lat]),
      },
    });
  }

  return { geojson: { type: 'FeatureCollection', features }, counts };
}
