import mapboxgl from '../../services/mapbox';
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

let popup = null;

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
        radio:    t.radio,
        color:    RADIO_COLORS[t.radio] ?? '#6b7280',
        label:    t.operator ? `${t.radio} · ${t.operator}` : t.radio,
        name:     t.name,
        operator: t.operator,
        height:   t.height,
        material: t.material,
        networks: t.networks,
        ref:      t.ref,
        range:    t.range,
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

    map.on('click', LAYER_TOWERS, (e) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const p = feat.properties;
      const color = p.color ?? '#ef4444';

      const rows = [];
      if (p.name)     rows.push(['Name',      p.name]);
      if (p.operator) rows.push(['Operator',  p.operator]);
      if (p.ref)      rows.push(['Ref',       p.ref]);
      rows.push(['Radio',  p.radio]);
      if (p.networks) rows.push(['Networks',  p.networks]);
      rows.push(['Est. range', `${(p.range / 1000).toFixed(1)} km`]);
      if (p.height)   rows.push(['Height',    `${p.height} m`]);
      if (p.material) rows.push(['Material',  p.material]);

      const tableRows = rows
        .map(([k, v]) => `<tr><td style="color:#9ca3af;padding:2px 8px 2px 0;white-space:nowrap">${k}</td><td style="font-weight:bold">${v}</td></tr>`)
        .join('');

      const html = `
        <div style="font-family:Arial;font-size:12px;color:#e5e7eb;min-width:160px">
          <div style="font-size:13px;font-weight:bold;color:${color};margin-bottom:6px">&#9651; Cell Tower</div>
          <table style="border-collapse:collapse">${tableRows}</table>
        </div>`;

      if (popup) popup.remove();
      popup = new mapboxgl.Popup({ closeButton: true, maxWidth: '280px' })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
    });

    map.on('mouseenter', LAYER_TOWERS, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', LAYER_TOWERS, () => { map.getCanvas().style.cursor = ''; });
  }
}

export function removeCellTowerLayers(map) {
  if (popup) { popup.remove(); popup = null; }
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
