// Finnish demographic distributions (Statistics Finland 2023)
const AGE_GROUPS = [
  { group: '0–14',  share: 0.154, color: '#34d399' },
  { group: '15–29', share: 0.183, color: '#38bdf8' },
  { group: '30–44', share: 0.201, color: '#818cf8' },
  { group: '45–59', share: 0.192, color: '#f59e0b' },
  { group: '60–74', share: 0.175, color: '#f97316' },
  { group: '75+',   share: 0.095, color: '#ef4444' },
];

export { AGE_GROUPS };

// Suomen bbox
const FINLAND_BBOX = { minLng: 19.0, minLat: 59.4, maxLng: 31.6, maxLat: 70.1 };

function isInsideFinland(bbox) {
  const centerLat = (bbox.minLat + bbox.maxLat) / 2;
  const centerLng = (bbox.minLng + bbox.maxLng) / 2;
  return (
    centerLat >= FINLAND_BBOX.minLat && centerLat <= FINLAND_BBOX.maxLat &&
    centerLng >= FINLAND_BBOX.minLng && centerLng <= FINLAND_BBOX.maxLng
  );
}

function bboxAreaKm2(bbox) {
  const latRad = ((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180);
  const widthKm = (bbox.maxLng - bbox.minLng) * Math.cos(latRad) * 111.32;
  const heightKm = (bbox.maxLat - bbox.minLat) * 110.574;
  return Math.abs(widthKm * heightKm);
}

function buildResult(total, source, estimated = false) {
  const rounded = Math.round(total);
  return {
    total: rounded,
    male: Math.round(rounded * 0.495),
    female: Math.round(rounded * 0.505),
    source,
    estimated,
    ageGroups: AGE_GROUPS.map(({ group, share, color }) => ({
      group,
      count: Math.round(rounded * share),
      share,
      color,
    })),
  };
}

// Tilastokeskus väestöruututilasto — 1km² tarkkuus, koko Suomi
async function fetchStatsFiGrid(typeName, bbox, signal) {
  const url = new URL('https://geo.stat.fi/geoserver/vaestoruutu/wfs');
  url.searchParams.set('service', 'WFS');
  url.searchParams.set('version', '2.0.0');
  url.searchParams.set('request', 'GetFeature');
  url.searchParams.set('typeName', typeName);
  url.searchParams.set('bbox', `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat},EPSG:4326`);
  url.searchParams.set('outputFormat', 'application/json');
  url.searchParams.set('srsName', 'EPSG:4326');
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`StatsFi ${res.status}`);
  const json = await res.json();
  if (!json.features?.length) throw new Error('no features');
  return json.features;
}

async function fetchStatsFiPopulation(bbox, signal) {
  // Try 250m grid first for finer detail; fall back to 1km
  let features;
  let resolution = '250m';
  try {
    features = await fetchStatsFiGrid('vaestoruutu:vaki2022_250m', bbox, signal);
  } catch {
    features = await fetchStatsFiGrid('vaestoruutu:vaki2022_1km', bbox, signal);
    resolution = '1km';
  }

  let total = 0;
  for (const f of features) {
    const pop = f.properties?.vaesto ?? 0;
    if (pop > 0) total += pop;
  }
  if (total === 0) throw new Error('no population data');

  const populated = features.filter((f) => (f.properties?.vaesto ?? 0) > 0);
  const maxPop = Math.max(...populated.map((f) => f.properties.vaesto));

  const geojson = {
    type: 'FeatureCollection',
    features: populated.map((f) => ({
      ...f,
      properties: { pop: f.properties.vaesto, norm: f.properties.vaesto / maxPop },
    })),
  };

  return { ...buildResult(total, `Tilastokeskus 2022 (${resolution})`), geojson };
}

// OSM place-nodet muille alueille
async function fetchOsmPopulation(bbox, signal) {
  const query = `
    [out:json][timeout:20];
    (
      node["place"~"city|town|village|hamlet"]["population"](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng});
    );
    out body;
  `;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
    signal,
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = await res.json();

  let total = 0;
  for (const el of json.elements ?? []) {
    const pop = parseInt(el.tags?.population ?? '0', 10);
    if (!isNaN(pop)) total += pop;
  }
  if (total === 0) throw new Error('no population data');

  const geojson = {
    type: 'FeatureCollection',
    features: (json.elements ?? [])
      .filter((el) => parseInt(el.tags?.population ?? '0', 10) > 0)
      .map((el) => ({
        type: 'Feature',
        properties: { pop: parseInt(el.tags.population, 10), name: el.tags.name ?? '' },
        geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
      })),
  };

  return { ...buildResult(total, 'OSM (taajama-arvot)'), geojson };
}

export async function fetchPopulation({ bbox, signal }) {
  if (isInsideFinland(bbox)) {
    try {
      return await fetchStatsFiPopulation(bbox, signal);
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      // fall through to density estimate
    }
  } else {
    try {
      return await fetchOsmPopulation(bbox, signal);
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      // fall through to density estimate
    }
  }

  // Viimeinen varasuunnitelma: pinta-ala × tiheys
  const area = bboxAreaKm2(bbox);
  return buildResult(area * 18, 'arvio (18 hlö/km²)', true);
}
