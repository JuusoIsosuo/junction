import { API_BASE } from "./apiBase";

export const MILITARY_TYPE_CONFIG = {
  base:           { label: 'Military Base',      icon: 'B', color: '#6b7c3e' },
  barracks:       { label: 'Barracks',           icon: 'R', color: '#4a5e2a' },
  bunker:         { label: 'Bunker',             icon: 'K', color: '#8b7355' },
  checkpoint:     { label: 'Checkpoint',         icon: 'C', color: '#dc2626' },
  airfield:       { label: 'Airfield',           icon: 'A', color: '#60a5fa' },
  naval_base:     { label: 'Naval Base',         icon: 'N', color: '#1d4ed8' },
  ammunition:     { label: 'Ammo Depot',         icon: 'X', color: '#ea580c' },
  fortification:  { label: 'Fortification',      icon: 'F', color: '#92400e' },
  training_area:  { label: 'Training Area',      icon: 'T', color: '#ca8a04' },
  range:          { label: 'Firing Range',       icon: 'G', color: '#b91c1c' },
  guardhouse:     { label: 'Guard Post',         icon: 'P', color: '#d97706' },
  danger_area:    { label: 'Danger Area',        icon: 'D', color: '#ef4444' },
  trench:         { label: 'Trench',             icon: 'V', color: '#78716c' },
  obstacle_course:{ label: 'Obstacle Course',    icon: 'O', color: '#a16207' },
  other:          { label: 'Military (other)',   icon: 'M', color: '#4b5563' },
};

const KNOWN_TYPES = new Set(Object.keys(MILITARY_TYPE_CONFIG));

function classifyMilitary(tags) {
  const mil = tags['military'];
  const landuse = tags['landuse'];

  if (mil && KNOWN_TYPES.has(mil)) return mil;
  if (mil) return 'other';
  if (landuse === 'military') return 'base';
  return null;
}

export async function fetchMilitary({ bbox, signal }) {
  const { minLat, minLng, maxLat, maxLng } = bbox;
  const b = `${minLat},${minLng},${maxLat},${maxLng}`;

  const query = `
[out:json][timeout:60];
(
  node["military"](${b});
  way["military"](${b});
  relation["military"](${b});
  node["landuse"="military"](${b});
  way["landuse"="military"](${b});
);
out center;
`.trim();

  const res = await fetch(`${API_BASE}/api/overpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  });

  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  const raw = await res.json();

  const typeCounts = {};
  const features = [];
  const seen = new Set();

  for (const el of raw.elements ?? []) {
    if (seen.has(el.id)) continue;
    seen.add(el.id);

    const tags = el.tags ?? {};
    const type = classifyMilitary(tags);
    if (!type) continue;

    let lon, lat;
    if (el.type === 'node') {
      lon = el.lon; lat = el.lat;
    } else if (el.center) {
      lon = el.center.lon; lat = el.center.lat;
    } else {
      continue;
    }

    const cfg = MILITARY_TYPE_CONFIG[type];
    typeCounts[type] = (typeCounts[type] ?? 0) + 1;

    features.push({
      type: 'Feature',
      properties: {
        id: el.id,
        _type: type,
        _color: cfg.color,
        _icon: cfg.icon,
        _label: cfg.label,
        name: tags.name ?? tags['name:en'] ?? null,
        operator: tags.operator ?? null,
        country: tags['country'] ?? tags['addr:country'] ?? null,
        access: tags.access ?? null,
        surface: tags.surface ?? null,
        start_date: tags.start_date ?? null,
        description: tags.description ?? null,
        wikipedia: tags.wikipedia ?? null,
        wikidata: tags.wikidata ?? null,
      },
      geometry: { type: 'Point', coordinates: [lon, lat] },
    });
  }

  return {
    count: features.length,
    typeCounts,
    geojson: { type: 'FeatureCollection', features },
  };
}
