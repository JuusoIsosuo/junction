import { geoCircle } from "../../utils/geo";

export const RADIO_COLORS = {
  GSM:     '#ef4444',
  UMTS:    '#ef4444',
  LTE:     '#ef4444',
  NR:      '#ef4444',
  CDMA:    '#ef4444',
  unknown: '#ef4444',
};

const COVERAGE_COLOR = '#ef4444';

const SRC_COVERAGE       = 'cell-coverage';
const SRC_TOWERS         = 'cell-towers';
const LAYER_COV_FILL     = 'cell-coverage-fill';
const LAYER_COV_LINE     = 'cell-coverage-line';
const LAYER_TOWERS       = 'cell-towers-dots';
const LAYER_TOWERS_LABEL = 'cell-towers-label';

const EMPTY = { type: 'FeatureCollection', features: [] };

function buildCoverageCollection(towers) {
  return {
    type: 'FeatureCollection',
    features: towers.map((t) => {
      const feat = geoCircle(t.lon, t.lat, Math.max(t.range, 100));
      feat.properties = { radio: t.radio, color: RADIO_COLORS[t.radio] ?? '#6b7280' };
      return feat;
    }),
  };
}

function buildTowerCollection(towers) {
  return {
    type: 'FeatureCollection',
    features: towers.map((t) => ({
      type: 'Feature',
      properties: {
        radio: t.radio,
        color: RADIO_COLORS[t.radio] ?? '#6b7280',
        label: t.operator ? `${t.radio} · ${t.operator}` : t.radio,
      },
      geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
    })),
  };
}

export function addCellTowerLayers(map) {
  if (!map.getSource(SRC_COVERAGE)) {
    map.addSource(SRC_COVERAGE, { type: 'geojson', data: EMPTY });
    map.addLayer({ id: LAYER_COV_FILL, type: 'fill', source: SRC_COVERAGE,
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.08 } });
    map.addLayer({ id: LAYER_COV_LINE, type: 'line', source: SRC_COVERAGE,
      paint: { 'line-color': ['get', 'color'], 'line-width': 1, 'line-opacity': 0.5 } });
  }
  if (!map.getSource(SRC_TOWERS)) {
    map.addSource(SRC_TOWERS, { type: 'geojson', data: EMPTY });
    map.addLayer({ id: LAYER_TOWERS, type: 'circle', source: SRC_TOWERS,
      paint: { 'circle-color': ['get', 'color'], 'circle-radius': 5,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.9 } });
    map.addLayer({ id: LAYER_TOWERS_LABEL, type: 'symbol', source: SRC_TOWERS, minzoom: 11,
      layout: { 'text-field': ['get', 'radio'], 'text-size': 9, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
      paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#000', 'text-halo-width': 1 } });
  }
}

export function removeCellTowerLayers(map) {
  for (const id of [LAYER_TOWERS_LABEL, LAYER_TOWERS, LAYER_COV_LINE, LAYER_COV_FILL]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of [SRC_COVERAGE, SRC_TOWERS]) {
    if (map.getSource(id)) map.removeSource(id);
  }
}

export function updateCellTowerData(map, towers) {
  const coverageData = buildCoverageCollection(towers);
  const towerData = buildTowerCollection(towers);
  map.getSource(SRC_COVERAGE)?.setData(coverageData);
  map.getSource(SRC_TOWERS)?.setData(towerData);
}

export function updateCellTowerVisibility(map, enabled) {
  const v = enabled ? 'visible' : 'none';
  for (const id of [LAYER_COV_FILL, LAYER_COV_LINE, LAYER_TOWERS, LAYER_TOWERS_LABEL]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v);
  }
}
