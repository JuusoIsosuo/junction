import { API_BASE } from "./apiBase";

export const INFRA_TYPE_CONFIG = {
  dam:          { label: 'Dam',           icon: 'D', color: '#0ea5e9' },
  hydro:        { label: 'Hydro Power',   icon: 'H', color: '#38bdf8' },
  wind:         { label: 'Wind Turbine',  icon: 'W', color: '#86efac' },
  nuclear:      { label: 'Nuclear',       icon: 'N', color: '#fb923c' },
  solar:        { label: 'Solar',         icon: 'S', color: '#fde68a' },
  power_plant:  { label: 'Power Plant',   icon: 'P', color: '#fbbf24' },
  hospital:     { label: 'Hospital',      icon: '+', color: '#f87171' },
  factory:      { label: 'Factory',       icon: 'F', color: '#94a3b8' },
  water_supply: { label: 'Water Supply',  icon: 'W', color: '#60a5fa' },
  wastewater:   { label: 'Wastewater',    icon: 'U', color: '#6b7280' },
};

function classifyInfra(tags) {
  const { waterway, natural, power, amenity, man_made, building } = tags;
  const genSource = tags['generator:source'];
  const plantSource = tags['plant:source'];

  if (waterway === 'dam' || natural === 'dam') return 'dam';

  if (power === 'plant' || power === 'generator') {
    const src = plantSource || genSource || '';
    if (src === 'nuclear') return 'nuclear';
    if (src === 'wind') return 'wind';
    if (src === 'water' || src === 'hydro') return 'hydro';
    if (src === 'solar') return 'solar';
    return 'power_plant';
  }

  if (amenity === 'hospital') return 'hospital';
  if (man_made === 'works' || building === 'factory' || building === 'industrial') return 'factory';
  if (man_made === 'water_works' || man_made === 'pumping_station') return 'water_supply';
  if (man_made === 'wastewater_plant') return 'wastewater';

  return null;
}

export async function fetchInfrastructure({ bbox, signal }) {
  const { minLat, minLng, maxLat, maxLng } = bbox;
  const b = `${minLat},${minLng},${maxLat},${maxLng}`;

  const query = `
[out:json][timeout:60];
(
  node["waterway"="dam"](${b});
  way["waterway"="dam"](${b});
  node["natural"="dam"](${b});
  way["natural"="dam"](${b});
  node["power"="plant"](${b});
  way["power"="plant"](${b});
  node["power"="generator"]["generator:source"](${b});
  way["power"="generator"]["generator:source"](${b});
  node["amenity"="hospital"](${b});
  way["amenity"="hospital"](${b});
  node["man_made"="works"](${b});
  way["man_made"="works"](${b});
  node["building"="factory"](${b});
  way["building"="factory"](${b});
  node["building"="industrial"](${b});
  way["building"="industrial"](${b});
  node["man_made"="water_works"](${b});
  way["man_made"="water_works"](${b});
  node["man_made"="pumping_station"](${b});
  way["man_made"="pumping_station"](${b});
  node["man_made"="wastewater_plant"](${b});
  way["man_made"="wastewater_plant"](${b});
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

  for (const el of raw.elements ?? []) {
    const tags = el.tags ?? {};
    const type = classifyInfra(tags);
    if (!type) continue;

    let lon, lat;
    if (el.type === 'node') {
      lon = el.lon; lat = el.lat;
    } else if (el.center) {
      lon = el.center.lon; lat = el.center.lat;
    } else {
      continue;
    }

    const cfg = INFRA_TYPE_CONFIG[type];
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
        capacity: tags['plant:output:electricity'] ?? tags['generator:output:electricity'] ?? null,
        voltage: tags.voltage ?? null,
        start_date: tags.start_date ?? null,
        website: tags.website ?? null,
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
