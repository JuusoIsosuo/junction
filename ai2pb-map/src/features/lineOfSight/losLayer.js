const EMPTY_FC = { type: 'FeatureCollection', features: [] };

const LOS_SOURCE   = 'los-raster';
const LOS_LAYER    = 'los-raster-layer';
const LOS_OBS_SRC  = 'los-observer';
const LOS_OBS_RING = 'los-observer-ring';
const LOS_OBS_DOT  = 'los-observer-dot';

const BLANK_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export function addLosLayers(map) {
  if (map.getSource(LOS_SOURCE)) return;

  map.addSource(LOS_SOURCE, {
    type: 'image',
    url: BLANK_PNG,
    coordinates: [[0, 1], [1, 1], [1, 0], [0, 0]],
  });
  map.addLayer({
    id: LOS_LAYER,
    type: 'raster',
    source: LOS_SOURCE,
    paint: { 'raster-opacity': 0, 'raster-fade-duration': 200 },
  });

  map.addSource(LOS_OBS_SRC, { type: 'geojson', data: EMPTY_FC });
  map.addLayer({
    id: LOS_OBS_RING,
    type: 'circle',
    source: LOS_OBS_SRC,
    paint: {
      'circle-radius': 16,
      'circle-color': 'rgba(249,115,22,0.2)',
      'circle-stroke-color': '#f97316',
      'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: LOS_OBS_DOT,
    type: 'circle',
    source: LOS_OBS_SRC,
    paint: {
      'circle-radius': 5,
      'circle-color': '#fff',
      'circle-stroke-color': '#f97316',
      'circle-stroke-width': 2,
    },
  });
}

export function updateLosData(map, canvas, bbox, observerLng, observerLat) {
  const src = map.getSource(LOS_SOURCE);
  if (!src) return;

  if (!canvas || !bbox) {
    src.updateImage({ url: BLANK_PNG, coordinates: [[0, 1], [1, 1], [1, 0], [0, 0]] });
    map.setPaintProperty(LOS_LAYER, 'raster-opacity', 0);
  } else {
    const { minLng, maxLng, minLat, maxLat } = bbox;
    src.updateImage({
      url: canvas.toDataURL(),
      coordinates: [
        [minLng, maxLat],
        [maxLng, maxLat],
        [maxLng, minLat],
        [minLng, minLat],
      ],
    });
    map.setPaintProperty(LOS_LAYER, 'raster-opacity', 1);
  }

  map.getSource(LOS_OBS_SRC)?.setData(
    observerLng != null
      ? {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [observerLng, observerLat] }, properties: {} }],
        }
      : EMPTY_FC
  );
}

export function removeLosLayers(map) {
  for (const id of [LOS_OBS_DOT, LOS_OBS_RING, LOS_LAYER]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of [LOS_OBS_SRC, LOS_SOURCE]) {
    if (map.getSource(id)) map.removeSource(id);
  }
}
