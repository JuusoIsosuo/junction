import { API_BASE } from "./apiBase";

export async function fetchBridges({ bbox, signal }) {
  const { minLat, minLng, maxLat, maxLng } = bbox;
  const b = `${minLat},${minLng},${maxLat},${maxLng}`;

  const query = `
[out:json][timeout:30];
(
  way["bridge"="yes"](${b});
  way["bridge"="viaduct"](${b});
  way["bridge"="aqueduct"](${b});
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

  const features = (raw.elements ?? [])
    .filter((el) => el.geometry?.length)
    .map((el) => {
      const tags = el.tags ?? {};
      return {
        type: 'Feature',
        properties: {
          id: el.id,
          name: tags['bridge:name'] ?? tags['name'] ?? null,
          maxweight: tags['maxweight'] ?? null,
          maxheight: tags['maxheight'] ?? null,
          maxlength: tags['maxlength'] ?? null,
          highway: tags['highway'] ?? null,
          bridge: tags['bridge'] ?? 'yes',
          ref: tags['ref'] ?? null,
        },
        geometry: {
          type: 'LineString',
          coordinates: el.geometry.map((pt) => [pt.lon, pt.lat]),
        },
      };
    });

  return {
    count: features.length,
    geojson: { type: 'FeatureCollection', features },
  };
}
