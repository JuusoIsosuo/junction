const EMPTY = { type: 'FeatureCollection', features: [] };

export const FEATURE_COLORS = {
  buildings:        '#a78bfa',
  natural_wood:     '#166534',
  natural_water:    '#0ea5e9',
  natural_wetland:  '#065f46',
  natural_grassland:'#84cc16',
  natural_scrub:    '#4d7c0f',
  natural_other:    '#34d399',
  landuse_forest:   '#15803d',
  landuse_meadow:   '#a3e635',
  landuse_farmland: '#ca8a04',
  landuse_grass:    '#86efac',
  landuse_other:    '#6ee7b7',
  leisure:          '#86efac',
  waterway:         '#38bdf8',
  road_motorway:    '#fbbf24',
  road_trunk:       '#f59e0b',
  road_primary:     '#f97316',
  road_secondary:   '#fb923c',
  road_tertiary:    '#fdba74',
  road_residential: '#e2e8f0',
  road_service:     '#94a3b8',
  road_path:        '#7dd3fc',
  road_other:       '#cbd5e1',
};

export function toGeoJSON(elements) {
  const features = [];
  for (const el of elements) {
    const tags = el.tags || {};
    let featureType = 'unknown';

    if (tags.building) featureType = 'buildings';
    else if (tags.natural === 'wood')      featureType = 'natural_wood';
    else if (tags.natural === 'water')     featureType = 'natural_water';
    else if (tags.natural === 'wetland')   featureType = 'natural_wetland';
    else if (tags.natural === 'grassland') featureType = 'natural_grassland';
    else if (tags.natural === 'scrub')     featureType = 'natural_scrub';
    else if (tags.natural)                 featureType = 'natural_other';
    else if (tags.landuse === 'forest')    featureType = 'landuse_forest';
    else if (tags.landuse === 'meadow')    featureType = 'landuse_meadow';
    else if (tags.landuse === 'farmland')  featureType = 'landuse_farmland';
    else if (tags.landuse === 'grass')     featureType = 'landuse_grass';
    else if (tags.landuse)                 featureType = 'landuse_other';
    else if (tags.leisure)                 featureType = 'leisure';
    else if (tags.waterway)                featureType = 'waterway';
    else if (tags.highway === 'motorway' || tags.highway === 'trunk') featureType = 'road_motorway';
    else if (tags.highway === 'primary')   featureType = 'road_primary';
    else if (tags.highway === 'secondary') featureType = 'road_secondary';
    else if (tags.highway === 'tertiary')  featureType = 'road_tertiary';
    else if (tags.highway === 'residential' || tags.highway === 'unclassified' || tags.highway === 'living_street') featureType = 'road_residential';
    else if (tags.highway === 'service')   featureType = 'road_service';
    else if (tags.highway === 'footway' || tags.highway === 'cycleway' || tags.highway === 'path') featureType = 'road_path';
    else if (tags.highway)                 featureType = 'road_other';

    const color = FEATURE_COLORS[featureType] ?? '#ffffff';
    let geometry = null;

    if (el.type === 'way' && el.geometry?.length > 0) {
      const coords = el.geometry.map(({ lon, lat }) => [lon, lat]);
      const isArea = (tags.building || tags.natural || tags.landuse || tags.leisure) && !tags.highway;
      if (isArea && coords.length > 2) {
        const ring = [...coords];
        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ring.push(ring[0]);
        geometry = { type: 'Polygon', coordinates: [ring] };
      } else {
        geometry = { type: 'LineString', coordinates: coords };
      }
    }
    if (el.type === 'node' && el.lat !== undefined) {
      geometry = { type: 'Point', coordinates: [el.lon, el.lat] };
    }

    if (geometry) {
      // For buildings tagged simply as "yes", suppress the tag as a label — use name only
      const buildingLabel = tags.building && tags.building !== 'yes' ? tags.building : '';
      features.push({
        type: 'Feature', geometry,
        properties: {
          ...tags,
          _featureType: featureType,
          _color: color,
          _name: tags.name || buildingLabel || tags.natural || tags.landuse || tags.leisure || tags.waterway || '',
          _highwayType: tags.highway || '',
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

export function parseOSMCounts(elements) {
  const buildingTypes = {};
  const counts = { buildings: 0, natural: 0, landuse: 0, leisure: 0, waterway: 0, roads: 0, buildingTypes };
  for (const el of elements) {
    const tags = el.tags || {};
    if (tags.building) {
      counts.buildings++;
      const type = tags.building === 'yes' ? 'unclassified' : tags.building;
      buildingTypes[type] = (buildingTypes[type] ?? 0) + 1;
    }
    if (tags.natural)  counts.natural++;
    if (tags.landuse)  counts.landuse++;
    if (tags.leisure)  counts.leisure++;
    if (tags.waterway) counts.waterway++;
    if (tags.highway)  counts.roads++;
  }
  return counts;
}

// ── Mapbox layer IDs ───────────────────────────────────────────────────────────
const OSM_SOURCE = 'osm-features';

// Buildings layers
const LAYER_BLDG_FILL  = 'osm-bldg-fill';
const LAYER_BLDG_LINE  = 'osm-bldg-line';
const LAYER_BLDG_LABEL = 'osm-bldg-label';
const BLDG_LAYERS = [LAYER_BLDG_LABEL, LAYER_BLDG_LINE, LAYER_BLDG_FILL];

// Nature layers
const LAYER_NAT_FILL    = 'osm-nat-fill';
const LAYER_NAT_RCASING = 'osm-nat-road-casing';
const LAYER_NAT_ROADS   = 'osm-nat-roads';
const LAYER_NAT_LINES   = 'osm-nat-lines';
const LAYER_NAT_POINTS  = 'osm-nat-points';
const LAYER_NAT_LABEL   = 'osm-nat-label';
const NAT_LAYERS = [LAYER_NAT_LABEL, LAYER_NAT_POINTS, LAYER_NAT_LINES, LAYER_NAT_ROADS, LAYER_NAT_RCASING, LAYER_NAT_FILL];

const ROAD_TYPES = ['road_motorway','road_trunk','road_primary','road_secondary','road_tertiary','road_residential','road_service','road_path','road_other'];
const IS_BUILDING = ['==', ['get', '_featureType'], 'buildings'];
const NOT_BUILDING = ['!=', ['get', '_featureType'], 'buildings'];

export function addOSMLayers(map) {
  if (map.getSource(OSM_SOURCE)) return;
  map.addSource(OSM_SOURCE, { type: 'geojson', data: EMPTY });

  // ── Buildings ──────────────────────────────────────────────────────
  map.addLayer({ id: LAYER_BLDG_FILL, type: 'fill', source: OSM_SOURCE,
    filter: ['all', ['==', '$type', 'Polygon'], IS_BUILDING],
    paint: { 'fill-color': ['get', '_color'], 'fill-opacity': 0.75, 'fill-outline-color': ['get', '_color'] } });

  map.addLayer({ id: LAYER_BLDG_LINE, type: 'line', source: OSM_SOURCE,
    filter: IS_BUILDING,
    paint: { 'line-color': ['get', '_color'], 'line-width': 1.5, 'line-opacity': 0.9 } });

  map.addLayer({ id: LAYER_BLDG_LABEL, type: 'symbol', source: OSM_SOURCE,
    filter: ['all', IS_BUILDING, ['!=', ['get', '_name'], '']],
    layout: { 'text-field': ['get', '_name'], 'text-size': 10, 'text-anchor': 'center', 'text-max-width': 8 },
    paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1.5 } });

  // ── Nature ────────────────────────────────────────────────────────
  map.addLayer({ id: LAYER_NAT_FILL, type: 'fill', source: OSM_SOURCE,
    filter: ['all', ['==', '$type', 'Polygon'], NOT_BUILDING],
    paint: { 'fill-color': ['get', '_color'], 'fill-opacity': 0.35, 'fill-outline-color': ['get', '_color'] } });

  map.addLayer({ id: LAYER_NAT_RCASING, type: 'line', source: OSM_SOURCE,
    filter: ['in', ['get', '_featureType'], ['literal', ROAD_TYPES]],
    paint: { 'line-color': '#000000', 'line-opacity': 0.4,
      'line-width': ['match', ['get', '_featureType'], 'road_motorway', 9, 'road_trunk', 8, 'road_primary', 7, 'road_secondary', 6, 'road_tertiary', 5, 'road_residential', 4, 'road_service', 3, 'road_path', 2, 3],
      'line-cap': 'round', 'line-join': 'round' } });

  map.addLayer({ id: LAYER_NAT_ROADS, type: 'line', source: OSM_SOURCE,
    filter: ['in', ['get', '_featureType'], ['literal', ROAD_TYPES]],
    paint: { 'line-color': ['get', '_color'], 'line-opacity': 0.95,
      'line-width': ['match', ['get', '_featureType'], 'road_motorway', 7, 'road_trunk', 6, 'road_primary', 5, 'road_secondary', 4, 'road_tertiary', 3, 'road_residential', 2.5, 'road_service', 1.8, 'road_path', 1.2, 2],
      'line-cap': 'round', 'line-join': 'round' } });

  map.addLayer({ id: LAYER_NAT_LINES, type: 'line', source: OSM_SOURCE,
    filter: ['all', NOT_BUILDING, ['!', ['in', ['get', '_featureType'], ['literal', ROAD_TYPES]]]],
    paint: { 'line-color': ['get', '_color'], 'line-width': ['match', ['get', '_featureType'], 'waterway', 2, 0.8], 'line-opacity': 0.9 } });

  map.addLayer({ id: LAYER_NAT_POINTS, type: 'circle', source: OSM_SOURCE,
    filter: ['==', '$type', 'Point'],
    paint: { 'circle-color': ['get', '_color'], 'circle-radius': 5, 'circle-stroke-color': '#000', 'circle-stroke-width': 1, 'circle-opacity': 0.85 } });

  map.addLayer({ id: LAYER_NAT_LABEL, type: 'symbol', source: OSM_SOURCE,
    filter: ['all', NOT_BUILDING, ['!=', ['get', '_name'], '']],
    layout: { 'text-field': ['get', '_name'], 'text-size': 10, 'text-anchor': 'center', 'text-max-width': 8 },
    paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1.5 } });
}

export function updateOSMData(map, geojson) {
  map.getSource(OSM_SOURCE)?.setData(geojson ?? EMPTY);
}

export function removeOSMLayers(map) {
  for (const id of [...BLDG_LAYERS, ...NAT_LAYERS]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(OSM_SOURCE)) map.removeSource(OSM_SOURCE);
}

export function updateBuildingsVisibility(map, enabled) {
  const v = enabled ? 'visible' : 'none';
  for (const id of BLDG_LAYERS) { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v); }
}

export function updateNatureVisibility(map, enabled) {
  const v = enabled ? 'visible' : 'none';
  for (const id of NAT_LAYERS) { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v); }
}
