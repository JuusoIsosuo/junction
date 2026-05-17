import { API_BASE } from "./apiBase";

export async function fetchOsm({ bbox, signal }) {
  const { minLat, minLng, maxLat, maxLng } = bbox;
  const b = `${minLat},${minLng},${maxLat},${maxLng}`;

  const query = `
[out:json][timeout:60];
(
  way["building"](${b});
  relation["building"](${b});
  way["natural"](${b});
  relation["natural"](${b});
  node["natural"](${b});
  way["landuse"](${b});
  relation["landuse"](${b});
  way["leisure"~"^(park|garden|nature_reserve|playground|golf_course|pitch)$"](${b});
  node["leisure"~"^(park|garden|nature_reserve|playground|golf_course|pitch)$"](${b});
  way["waterway"~"^(river|stream|canal|drain|ditch)$"](${b});
);
out geom tags;
`.trim();

  const response = await fetch(`${API_BASE}/api/overpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });

  if (!response.ok) throw new Error(`Overpass error: ${response.status}`);
  const data = await response.json();
  return data.elements || [];
}
