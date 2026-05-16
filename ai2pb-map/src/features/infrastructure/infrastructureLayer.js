import mapboxgl from '../../services/mapbox';
import { INFRA_TYPE_CONFIG } from '../../services/infrastructureService';

const SRC       = 'infrastructure-source';
const LAYER_DOT = 'infrastructure-dots';
const LAYER_ICO = 'infrastructure-icons';
const LAYER_LBL = 'infrastructure-labels';

const EMPTY = { type: 'FeatureCollection', features: [] };

let popup = null;

// Build a Mapbox match expression mapping _type -> color
function typeMatchExpr(prop, fallback, mapFn) {
  const expr = ['match', ['get', prop]];
  for (const [type, cfg] of Object.entries(INFRA_TYPE_CONFIG)) {
    expr.push(type, mapFn(cfg));
  }
  expr.push(fallback);
  return expr;
}

export function addInfrastructureLayers(map) {
  if (map.getSource(SRC)) return;

  map.addSource(SRC, { type: 'geojson', data: EMPTY });

  // Background circle — color driven by type
  map.addLayer({
    id: LAYER_DOT,
    type: 'circle',
    source: SRC,
    paint: {
      'circle-color': typeMatchExpr('_type', '#6b7280', (c) => c.color),
      'circle-radius': 10,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.92,
    },
  });

  // Short text icon rendered inside the circle
  map.addLayer({
    id: LAYER_ICO,
    type: 'symbol',
    source: SRC,
    layout: {
      'text-field': ['get', '_icon'],
      'text-size': 9,
      'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': '#ffffff',
    },
  });

  // Name label at higher zoom
  map.addLayer({
    id: LAYER_LBL,
    type: 'symbol',
    source: SRC,
    minzoom: 12,
    layout: {
      'text-field': ['coalesce', ['get', 'name'], ['get', '_label']],
      'text-size': 10,
      'text-offset': [0, 1.6],
      'text-anchor': 'top',
      'text-font': ['DIN Pro Regular', 'Arial Unicode MS Regular'],
    },
    paint: {
      'text-color': typeMatchExpr('_type', '#6b7280', (c) => c.color),
      'text-halo-color': '#000000',
      'text-halo-width': 1.5,
    },
  });

  map.on('click', LAYER_DOT, (e) => {
    const feat = e.features?.[0];
    if (!feat) return;
    const p = feat.properties;
    const cfg = INFRA_TYPE_CONFIG[p._type] ?? { label: p._type, color: '#6b7280' };

    const rows = [];
    if (p.name)       rows.push(['Name',       p.name]);
    if (p.operator)   rows.push(['Operator',   p.operator]);
    if (p.capacity)   rows.push(['Output',     p.capacity]);
    if (p.voltage)    rows.push(['Voltage',    `${p.voltage} V`]);
    if (p.start_date) rows.push(['Built',      p.start_date]);

    const tableRows = rows
      .map(([k, v]) => `<tr><td style="color:#9ca3af;padding:2px 8px 2px 0;white-space:nowrap">${k}</td><td style="font-weight:bold">${v}</td></tr>`)
      .join('');

    const html = `
      <div style="font-family:Arial;font-size:12px;color:#e5e7eb;min-width:160px">
        <div style="font-size:13px;font-weight:bold;color:${cfg.color};margin-bottom:6px">&#9632; ${cfg.label}</div>
        ${tableRows ? `<table style="border-collapse:collapse">${tableRows}</table>` : ''}
      </div>`;

    if (popup) popup.remove();
    popup = new mapboxgl.Popup({ closeButton: true, maxWidth: '300px' })
      .setLngLat(e.lngLat)
      .setHTML(html)
      .addTo(map);
  });

  map.on('mouseenter', LAYER_DOT, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', LAYER_DOT, () => { map.getCanvas().style.cursor = ''; });
}

export function removeInfrastructureLayers(map) {
  if (popup) { popup.remove(); popup = null; }
  for (const id of [LAYER_LBL, LAYER_ICO, LAYER_DOT]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SRC)) map.removeSource(SRC);
}

export function updateInfrastructureData(map, geojson) {
  map.getSource(SRC)?.setData(geojson ?? EMPTY);
}

export function updateInfrastructureVisibility(map, enabled) {
  const v = enabled ? 'visible' : 'none';
  for (const id of [LAYER_DOT, LAYER_ICO, LAYER_LBL]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v);
  }
}
