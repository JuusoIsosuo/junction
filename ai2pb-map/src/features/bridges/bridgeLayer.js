import mapboxgl from '../../services/mapbox';

const SRC       = 'bridges-source';
const LAYER_BG  = 'bridges-casing';
const LAYER_FG  = 'bridges-line';
const LAYER_LBL = 'bridges-label';

const EMPTY = { type: 'FeatureCollection', features: [] };

let popup = null;

export function addBridgeLayers(map) {
  if (map.getSource(SRC)) return;

  map.addSource(SRC, { type: 'geojson', data: EMPTY });

  map.addLayer({
    id: LAYER_BG,
    type: 'line',
    source: SRC,
    paint: {
      'line-color': '#000000',
      'line-width': 6,
      'line-opacity': 0.6,
    },
  });

  map.addLayer({
    id: LAYER_FG,
    type: 'line',
    source: SRC,
    paint: {
      'line-color': '#f59e0b',
      'line-width': 3,
      'line-opacity': 0.95,
    },
  });

  map.addLayer({
    id: LAYER_LBL,
    type: 'symbol',
    source: SRC,
    minzoom: 12,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['coalesce', ['get', 'name'], 'Bridge'],
      'text-size': 10,
      'text-offset': [0, -1],
    },
    paint: {
      'text-color': '#f59e0b',
      'text-halo-color': '#000',
      'text-halo-width': 1.5,
    },
  });

  map.on('click', LAYER_FG, (e) => {
    const feat = e.features?.[0];
    if (!feat) return;
    const p = feat.properties;

    const rows = [];
    if (p.name)      rows.push(['Name',       p.name]);
    if (p.ref)       rows.push(['Ref',        p.ref]);
    if (p.highway)   rows.push(['Road type',  p.highway]);
    if (p.bridge !== 'yes') rows.push(['Bridge type', p.bridge]);
    rows.push(['Max weight', p.maxweight ? `${p.maxweight} t` : 'unknown']);
    if (p.maxheight) rows.push(['Max height', `${p.maxheight} m`]);
    if (p.maxlength) rows.push(['Max length', `${p.maxlength} m`]);

    const tableRows = rows
      .map(([k, v]) => `<tr><td style="color:#9ca3af;padding:2px 8px 2px 0">${k}</td><td style="font-weight:bold">${v}</td></tr>`)
      .join('');

    const html = `
      <div style="font-family:Arial;font-size:12px;color:#e5e7eb;min-width:160px">
        <div style="font-size:13px;font-weight:bold;color:#f59e0b;margin-bottom:6px">&#9651; Bridge</div>
        <table style="border-collapse:collapse">${tableRows}</table>
      </div>`;

    if (popup) popup.remove();
    popup = new mapboxgl.Popup({ closeButton: true, maxWidth: '280px' })
      .setLngLat(e.lngLat)
      .setHTML(html)
      .addTo(map);
  });

  map.on('mouseenter', LAYER_FG, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', LAYER_FG, () => { map.getCanvas().style.cursor = ''; });
}

export function removeBridgeLayers(map) {
  if (popup) { popup.remove(); popup = null; }
  for (const id of [LAYER_LBL, LAYER_FG, LAYER_BG]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SRC)) map.removeSource(SRC);
}

export function updateBridgeData(map, geojson) {
  map.getSource(SRC)?.setData(geojson ?? EMPTY);
}

export function updateBridgeVisibility(map, enabled) {
  const v = enabled ? 'visible' : 'none';
  for (const id of [LAYER_BG, LAYER_FG, LAYER_LBL]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v);
  }
}
