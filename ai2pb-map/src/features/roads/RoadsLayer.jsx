import { useEffect, useRef } from "react";

const SRC        = 'roads-source';
const LAYER_LINE  = 'roads-line';
const LAYER_LABEL = 'roads-label';

const HIGHWAY_COLOR = [
  'match', ['get', 'highway'],
  'motorway',     '#f97316',
  'trunk',        '#ef4444',
  'primary',      '#f59e0b',
  'secondary',    '#facc15',
  'tertiary',     '#a3e635',
  'residential',  '#94a3b8',
  'unclassified', '#6b7280',
  '#57534e',
];

const HIGHWAY_WIDTH = [
  'match', ['get', 'highway'],
  'motorway',  4.5,
  'trunk',     4,
  'primary',   3,
  'secondary', 2.5,
  'tertiary',  2,
  1.5,
];

const EMPTY = { type: 'FeatureCollection', features: [] };

function addLayers(map) {
  if (!map.getSource(SRC)) {
    map.addSource(SRC, { type: 'geojson', data: EMPTY });
    map.addLayer({
      id: LAYER_LINE, type: 'line', source: SRC,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': HIGHWAY_COLOR, 'line-width': HIGHWAY_WIDTH, 'line-opacity': 0.85 },
    });
    map.addLayer({
      id: LAYER_LABEL, type: 'symbol', source: SRC, minzoom: 12,
      layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-size': 10, 'text-max-angle': 30 },
      paint: { 'text-color': '#e5e7eb', 'text-halo-color': '#1f2937', 'text-halo-width': 1.5 },
    });
  }
}

function removeLayers(map) {
  if (map.getLayer(LAYER_LABEL)) map.removeLayer(LAYER_LABEL);
  if (map.getLayer(LAYER_LINE))  map.removeLayer(LAYER_LINE);
  if (map.getSource(SRC))        map.removeSource(SRC);
}

function pushData(map, geojson) {
  map.getSource(SRC)?.setData(geojson ?? EMPTY);
}

function pushVisibility(map, enabled) {
  const v = enabled ? 'visible' : 'none';
  if (map.getLayer(LAYER_LINE))  map.setLayoutProperty(LAYER_LINE,  'visibility', v);
  if (map.getLayer(LAYER_LABEL)) map.setLayoutProperty(LAYER_LABEL, 'visibility', v);
}

export function RoadsLayer({ map, data, enabled }) {
  const pendingData = useRef(null);
  const pendingEnabled = useRef(enabled);

  useEffect(() => {
    if (!map) return;

    function setup() {
      addLayers(map);
      pushData(map, pendingData.current?.geojson);
      pushVisibility(map, pendingEnabled.current);
    }

    if (map.isStyleLoaded()) {
      setup();
    } else {
      map.once('load', setup);
    }

    return () => {
      map.off('load', setup);
      removeLayers(map);
    };
  }, [map]);

  useEffect(() => {
    pendingData.current = data;
    if (!map || !map.getSource(SRC)) return;
    pushData(map, data?.geojson);
  }, [map, data]);

  useEffect(() => {
    pendingEnabled.current = enabled;
    if (!map || !map.getLayer(LAYER_LINE)) return;
    pushVisibility(map, enabled);
  }, [map, enabled]);

  return null;
}
