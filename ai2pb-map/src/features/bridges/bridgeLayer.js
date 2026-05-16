import mapboxgl from '../../services/mapbox';

const SRC        = 'bridges-source';
const LAYER_DOT  = 'bridges-dots';
const LAYER_LBL  = 'bridges-label';

const EMPTY = { type: 'FeatureCollection', features: [] };
const COLOR = '#f97316';

let popup = null;

function midpoint(coordinates) {
  const mid = Math.floor(coordinates.length / 2);
  return coordinates[mid];
}

function linesToPoints(geojson) {
  return {
    type: 'FeatureCollection',
    features: (geojson?.features ?? []).map((f) => ({
      ...f,
      geometry: {
        type: 'Point',
        coordinates: midpoint(f.geometry.coordinates),
      },
    })),
  };
}

export function addBridgeLayers(map) {
  if (map.getSource(SRC)) return;

  map.addSource(SRC, { type: 'geojson', data: EMPTY });

  map.addLayer({
    id: LAYER_DOT,
    type: 'circle',
    source: SRC,
    paint: {
      'circle-color': COLOR,
      'circle-radius': 7,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.9,
    },
  });

  map.addLayer({
    id: LAYER_LBL,
    type: 'symbol',
    source: SRC,
    minzoom: 13,
    layout: {
      'text-field': ['coalesce', ['get', 'name'], 'Bridge'],
      'text-size': 10,
      'text-offset': [0, 1.4],
      'text-anchor': 'top',
    },
    paint: {
      'text-color': COLOR,
      'text-halo-color': '#000',
      'text-halo-width': 1.5,
    },
  });

  map.on('click', LAYER_DOT, (e) => {
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
        <div style="font-size:13px;font-weight:bold;color:${COLOR};margin-bottom:6px">&#9651; Bridge</div>
        <table style="border-collapse:collapse">${tableRows}</table>
      </div>`;

    if (popup) popup.remove();
    popup = new mapboxgl.Popup({ closeButton: true, maxWidth: '280px' })
      .setLngLat(e.lngLat)
      .setHTML(html)
      .addTo(map);
  });

  map.on('mouseenter', LAYER_DOT, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', LAYER_DOT, () => { map.getCanvas().style.cursor = ''; });
}

export function removeBridgeLayers(map) {
  if (popup) { popup.remove(); popup = null; }
  for (const id of [LAYER_LBL, LAYER_DOT]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SRC)) map.removeSource(SRC);
}

export function updateBridgeData(map, geojson) {
  map.getSource(SRC)?.setData(linesToPoints(geojson));
}

export function updateBridgeVisibility(map, enabled) {
  const v = enabled ? 'visible' : 'none';
  for (const id of [LAYER_DOT, LAYER_LBL]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v);
  }
}
