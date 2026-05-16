import mapboxgl from '../../services/mapbox';
import { MILITARY_TYPE_CONFIG } from '../../services/militaryService';

const SRC       = 'military-source';
const LAYER_DOT = 'military-dots';
const LAYER_ICO = 'military-icons';
const LAYER_LBL = 'military-labels';

const EMPTY = { type: 'FeatureCollection', features: [] };

let popup = null;

function typeMatchExpr(prop, fallback, mapFn) {
  const expr = ['match', ['get', prop]];
  for (const [type, cfg] of Object.entries(MILITARY_TYPE_CONFIG)) {
    expr.push(type, mapFn(cfg));
  }
  expr.push(fallback);
  return expr;
}

export function addMilitaryLayers(map) {
  if (map.getSource(SRC)) return;

  map.addSource(SRC, { type: 'geojson', data: EMPTY });

  // Outer ring — slightly larger, semi-transparent, for visual weight
  map.addLayer({
    id: `${LAYER_DOT}-ring`,
    type: 'circle',
    source: SRC,
    paint: {
      'circle-color': typeMatchExpr('_type', '#4b5563', (c) => c.color),
      'circle-radius': 14,
      'circle-opacity': 0.2,
      'circle-stroke-width': 0,
    },
  });

  // Main dot
  map.addLayer({
    id: LAYER_DOT,
    type: 'circle',
    source: SRC,
    paint: {
      'circle-color': typeMatchExpr('_type', '#4b5563', (c) => c.color),
      'circle-radius': 10,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.95,
    },
  });

  // Icon letter inside dot
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

  // Name label at zoom 12+
  map.addLayer({
    id: LAYER_LBL,
    type: 'symbol',
    source: SRC,
    minzoom: 12,
    layout: {
      'text-field': ['coalesce', ['get', 'name'], ['get', '_label']],
      'text-size': 10,
      'text-offset': [0, 1.7],
      'text-anchor': 'top',
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
    },
    paint: {
      'text-color': typeMatchExpr('_type', '#4b5563', (c) => c.color),
      'text-halo-color': '#000000',
      'text-halo-width': 1.5,
    },
  });

  map.on('click', LAYER_DOT, (e) => {
    const feat = e.features?.[0];
    if (!feat) return;
    const p = feat.properties;
    const cfg = MILITARY_TYPE_CONFIG[p._type] ?? { label: p._type, color: '#4b5563' };

    const rows = [];
    if (p.name)        rows.push(['Name',        p.name]);
    if (p.operator)    rows.push(['Operator',    p.operator]);
    if (p.country)     rows.push(['Country',     p.country]);
    if (p.access)      rows.push(['Access',      p.access]);
    if (p.surface)     rows.push(['Surface',     p.surface]);
    if (p.start_date)  rows.push(['Established', p.start_date]);
    if (p.description) rows.push(['Notes',       p.description]);

    const tableRows = rows
      .map(([k, v]) => `<tr>
        <td style="color:#9ca3af;padding:2px 10px 2px 0;white-space:nowrap;vertical-align:top">${k}</td>
        <td style="font-weight:600;color:#f3f4f6">${v}</td>
      </tr>`)
      .join('');

    const html = `
      <div style="font-family:Arial;font-size:12px;color:#e5e7eb;min-width:170px">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">
          <span style="
            display:inline-flex;align-items:center;justify-content:center;
            width:20px;height:20px;border-radius:50%;font-size:10px;font-weight:700;
            background:${cfg.color};color:#fff;flex-shrink:0
          ">${cfg.icon}</span>
          <span style="font-size:13px;font-weight:700;color:${cfg.color}">${cfg.label}</span>
        </div>
        ${tableRows ? `<table style="border-collapse:collapse;width:100%">${tableRows}</table>` : '<span style="color:#6b7280;font-size:11px">No additional data</span>'}
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

export function removeMilitaryLayers(map) {
  if (popup) { popup.remove(); popup = null; }
  for (const id of [LAYER_LBL, LAYER_ICO, LAYER_DOT, `${LAYER_DOT}-ring`]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SRC)) map.removeSource(SRC);
}

export function updateMilitaryData(map, geojson) {
  map.getSource(SRC)?.setData(geojson ?? EMPTY);
}

export function updateMilitaryVisibility(map, enabled) {
  const v = enabled ? 'visible' : 'none';
  for (const id of [`${LAYER_DOT}-ring`, LAYER_DOT, LAYER_ICO, LAYER_LBL]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v);
  }
}
