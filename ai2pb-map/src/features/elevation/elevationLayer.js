const EMPTY = { type: 'FeatureCollection', features: [] };
const GRID_N = 10;

const ELEV_SOURCE       = 'elevation-grid';
const ELEV_HEAT_LAYER   = 'elevation-heatmap';
const ELEV_CONTOUR_SRC  = 'elevation-contours';
const ELEV_CONTOUR_LINE = 'elevation-contour-lines';
const ELEV_CONTOUR_LBL  = 'elevation-contour-labels';
const TERRAIN_SOURCE    = 'junction-terrain-dem';

const COLOR_STOPS = [
  [0,    '#0ea5e9'],
  [50,   '#34d399'],
  [200,  '#a3e635'],
  [500,  '#facc15'],
  [1000, '#f97316'],
  [2000, '#ef4444'],
  [4000, '#f1f5f9'],
];

function lerpColor(hex1, hex2, t) {
  const p = (h) => parseInt(h.slice(1), 16);
  const a = p(hex1), b = p(hex2);
  const r = Math.round(((a >> 16) & 0xff) * (1 - t) + ((b >> 16) & 0xff) * t);
  const g = Math.round(((a >> 8)  & 0xff) * (1 - t) + ((b >> 8)  & 0xff) * t);
  const bl= Math.round(( a        & 0xff) * (1 - t) + ( b        & 0xff) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

function elevToColor(elev) {
  if (elev <= COLOR_STOPS[0][0]) return COLOR_STOPS[0][1];
  if (elev >= COLOR_STOPS[COLOR_STOPS.length - 1][0]) return COLOR_STOPS[COLOR_STOPS.length - 1][1];
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    if (elev <= COLOR_STOPS[i][0]) {
      const t = (elev - COLOR_STOPS[i - 1][0]) / (COLOR_STOPS[i][0] - COLOR_STOPS[i - 1][0]);
      return lerpColor(COLOR_STOPS[i - 1][1], COLOR_STOPS[i][1], t);
    }
  }
  return '#ffffff';
}

export function buildGrid(bbox) {
  const pts = [];
  for (let r = 0; r < GRID_N; r++) {
    for (let c = 0; c < GRID_N; c++) {
      pts.push({
        latitude:  bbox.minLat + (bbox.maxLat - bbox.minLat) * (r / (GRID_N - 1)),
        longitude: bbox.minLng + (bbox.maxLng - bbox.minLng) * (c / (GRID_N - 1)),
      });
    }
  }
  return pts;
}

export function buildHeatmapGeoJSON(results, bbox) {
  const cellW = (bbox.maxLng - bbox.minLng) / (GRID_N - 1);
  const cellH = (bbox.maxLat - bbox.minLat) / (GRID_N - 1);
  const features = results.map((pt) => {
    const { latitude: lat, longitude: lng, elevation } = pt;
    const hw = cellW / 2, hh = cellH / 2;
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[
        [lng - hw, lat - hh], [lng + hw, lat - hh],
        [lng + hw, lat + hh], [lng - hw, lat + hh],
        [lng - hw, lat - hh],
      ]] },
      properties: { elevation, color: elevToColor(elevation) },
    };
  });
  return { type: 'FeatureCollection', features };
}

export function extractContours(results, bbox, levels) {
  const grid = [];
  for (let r = 0; r < GRID_N; r++) {
    grid[r] = [];
    for (let c = 0; c < GRID_N; c++) grid[r][c] = results[r * GRID_N + c];
  }
  const contourFeatures = [];
  for (const level of levels) {
    const segments = [];
    for (let r = 0; r < GRID_N - 1; r++) {
      for (let c = 0; c < GRID_N - 1; c++) {
        const corners = [grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]];
        const lats  = corners.map((p) => p.latitude);
        const lngs  = corners.map((p) => p.longitude);
        const elevs = corners.map((p) => p.elevation);
        const above = elevs.map((e) => e >= level);
        const interp = (i, j) => {
          const t = (level - elevs[i]) / (elevs[j] - elevs[i]);
          return [lngs[i] + t * (lngs[j] - lngs[i]), lats[i] + t * (lats[j] - lats[i])];
        };
        const pts = [];
        for (const [a, b] of [[0,1],[1,2],[2,3],[3,0]]) {
          if (above[a] !== above[b]) pts.push(interp(a, b));
        }
        if (pts.length === 2) segments.push(pts);
      }
    }
    for (const seg of segments) {
      contourFeatures.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: seg },
        properties: { elevation: level, label: `${level}m` },
      });
    }
  }
  return { type: 'FeatureCollection', features: contourFeatures };
}

export function calcStats(elevs) {
  const min = Math.min(...elevs);
  const max = Math.max(...elevs);
  const mean = elevs.reduce((a, b) => a + b, 0) / elevs.length;
  const sorted = [...elevs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const stddev = Math.sqrt(elevs.reduce((a, b) => a + (b - mean) ** 2, 0) / elevs.length);
  return { min, max, mean, median, stddev, range: max - min };
}

export function pickContourLevels(min, max) {
  const range = max - min;
  const intervals = [10, 25, 50, 100, 200, 500, 1000];
  const interval = intervals.find((i) => range / i <= 12) ?? 1000;
  const start = Math.ceil(min / interval) * interval;
  const levels = [];
  for (let l = start; l <= max; l += interval) levels.push(l);
  return levels;
}

export function addElevationLayers(map) {
  if (map.getSource(ELEV_SOURCE)) return;

  map.addSource(ELEV_SOURCE, { type: 'geojson', data: EMPTY });
  map.addLayer({ id: ELEV_HEAT_LAYER, type: 'fill', source: ELEV_SOURCE,
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.52, 'fill-outline-color': 'rgba(0,0,0,0)' } });

  map.addSource(ELEV_CONTOUR_SRC, { type: 'geojson', data: EMPTY });
  map.addLayer({ id: ELEV_CONTOUR_LINE, type: 'line', source: ELEV_CONTOUR_SRC,
    paint: {
      'line-color': ['interpolate', ['linear'], ['get', 'elevation'], 0, '#0ea5e9', 500, '#facc15', 2000, '#ef4444'],
      'line-width': ['interpolate', ['linear'], ['get', 'elevation'], 0, 1, 1000, 1.8, 3000, 2.5],
      'line-opacity': 0.85,
    } });
  map.addLayer({ id: ELEV_CONTOUR_LBL, type: 'symbol', source: ELEV_CONTOUR_SRC,
    layout: { 'text-field': ['get', 'label'], 'text-size': 9, 'symbol-placement': 'line', 'text-max-angle': 30 },
    paint: { 'text-color': '#facc15', 'text-halo-color': '#000', 'text-halo-width': 1.2 } });
}

export function updateElevationData(map, heatGeoJSON, contourGeoJSON) {
  map.getSource(ELEV_SOURCE)?.setData(heatGeoJSON ?? EMPTY);
  map.getSource(ELEV_CONTOUR_SRC)?.setData(contourGeoJSON ?? EMPTY);
}

export function removeElevationLayers(map) {
  for (const id of [ELEV_CONTOUR_LBL, ELEV_CONTOUR_LINE, ELEV_HEAT_LAYER]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of [ELEV_SOURCE, ELEV_CONTOUR_SRC]) {
    if (map.getSource(id)) map.removeSource(id);
  }
  try { map.setTerrain(null); } catch (_) {}
}

export function updateElevationVisibility(map, enabled) {
  const v = enabled ? 'visible' : 'none';
  for (const id of [ELEV_HEAT_LAYER, ELEV_CONTOUR_LINE, ELEV_CONTOUR_LBL]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v);
  }
}

export function enable3DTerrain(map, enabled) {
  if (!enabled) {
    map.setTerrain(null);
    map.easeTo({ pitch: 0, duration: 600 });
    return;
  }

  const apply = () => {
    if (!map.getSource(TERRAIN_SOURCE)) {
      map.addSource(TERRAIN_SOURCE, {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
    }
    map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: 2.5 });
    map.easeTo({ pitch: 60, duration: 900 });
  };

  if (map.isStyleLoaded()) {
    apply();
  } else {
    map.once('style.load', apply);
  }
}
