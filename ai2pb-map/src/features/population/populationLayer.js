import mapboxgl from '../../services/mapbox';

const SRC          = 'population-grid';
const LAYER_FILL   = 'population-grid-fill';
const LAYER_LINE   = 'population-grid-line';
const LAYER_CIRCLE = 'population-circle';
const LAYER_LABEL  = 'population-label';

const EMPTY = { type: 'FeatureCollection', features: [] };

let popup = null;

export function addPopulationLayers(map) {
  if (map.getSource(SRC)) return;

  map.addSource(SRC, { type: 'geojson', data: EMPTY });

  // Finland: choropleth fill of grid cells, color relative to area's own maximum
  map.addLayer({
    id: LAYER_FILL,
    type: 'fill',
    source: SRC,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'fill-color': [
        'step', ['get', 'norm'],
        'rgba(0,0,0,0)',
        0.02, '#fef08a',
        0.15, '#fbbf24',
        0.35, '#f97316',
        0.60, '#ef4444',
        0.85, '#991b1b',
      ],
      'fill-opacity': 0.60,
    },
  });

  map.addLayer({
    id: LAYER_LINE,
    type: 'line',
    source: SRC,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'line-color': '#f97316',
      'line-width': 0.3,
      'line-opacity': 0.25,
    },
  });

  // Non-Finland: proportional circles for OSM place nodes
  map.addLayer({
    id: LAYER_CIRCLE,
    type: 'circle',
    source: SRC,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-color': '#f97316',
      'circle-opacity': 0.75,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.5,
      'circle-radius': [
        'step', ['get', 'pop'],
        5,
        1000,   8,
        10000,  11,
        50000,  15,
        200000, 20,
      ],
    },
  });

  map.addLayer({
    id: LAYER_LABEL,
    type: 'symbol',
    source: SRC,
    filter: ['==', ['geometry-type'], 'Point'],
    minzoom: 9,
    layout: {
      'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'pop']]],
      'text-size': 10,
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
    },
    paint: {
      'text-color': '#f97316',
      'text-halo-color': '#000',
      'text-halo-width': 1,
    },
  });

  map.on('click', LAYER_FILL, (e) => {
    const feat = e.features?.[0];
    if (!feat) return;
    const pop = feat.properties?.pop ?? 0;
    const html = `
      <div style="font-family:Arial;font-size:12px;color:#e5e7eb">
        <div style="font-size:13px;font-weight:bold;color:#fb923c;margin-bottom:4px">👥 Population Cell</div>
        <div>~${pop.toLocaleString()} residents</div>
        <div style="font-size:10px;color:#6b7280;margin-top:2px">1km² grid · Tilastokeskus 2022</div>
      </div>`;
    if (popup) popup.remove();
    popup = new mapboxgl.Popup({ closeButton: true, maxWidth: '200px' })
      .setLngLat(e.lngLat)
      .setHTML(html)
      .addTo(map);
  });

  map.on('mouseenter', LAYER_FILL, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', LAYER_FILL, () => { map.getCanvas().style.cursor = ''; });
}

export function removePopulationLayers(map) {
  if (popup) { popup.remove(); popup = null; }
  for (const id of [LAYER_LABEL, LAYER_CIRCLE, LAYER_LINE, LAYER_FILL]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SRC)) map.removeSource(SRC);
}

export function updatePopulationData(map, geojson) {
  map.getSource(SRC)?.setData(geojson ?? EMPTY);
}

export function updatePopulationVisibility(map, enabled) {
  const v = enabled ? 'visible' : 'none';
  for (const id of [LAYER_FILL, LAYER_LINE, LAYER_CIRCLE, LAYER_LABEL]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v);
  }
}
