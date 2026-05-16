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

function bboxAreaKm2(bbox) {
  const latRad = ((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180);
  const widthKm = (bbox.maxLng - bbox.minLng) * Math.cos(latRad) * 111.32;
  const heightKm = (bbox.maxLat - bbox.minLat) * 110.574;
  return Math.abs(widthKm * heightKm);
}

function buildResult(total, source) {
  const rounded = Math.round(total);
  return {
    total: rounded,
    male: Math.round(rounded * 0.495),
    female: Math.round(rounded * 0.505),
    source,
    ageGroups: AGE_GROUPS.map(({ group, share, color }) => ({
      group,
      count: Math.round(rounded * share),
      share,
      color,
    })),
  };
}

async function fetchFromWorldPop(bbox, signal) {
  // WorldPop expects a GeoJSON Feature, not a bare geometry
  const geojson = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [bbox.minLng, bbox.minLat],
        [bbox.maxLng, bbox.minLat],
        [bbox.maxLng, bbox.maxLat],
        [bbox.minLng, bbox.maxLat],
        [bbox.minLng, bbox.minLat],
      ]],
    },
  };

  const params = new URLSearchParams({
    dataset: 'wpgp',
    iso3: 'FIN',
    year: 2020,
    geojson: JSON.stringify(geojson),
    runasync: 'false',
  });

  const res = await fetch(
    `https://api.worldpop.org/v1/services/stats?${params}`,
    { signal }
  );
  if (!res.ok) throw new Error(`WorldPop ${res.status}`);

  const json = await res.json();
  const total = json?.data?.total_population;
  if (total == null || total === 0) throw new Error('no data');

  return buildResult(total, 'WorldPop 2020');
}

export async function fetchPopulation({ bbox, signal }) {
  try {
    return await fetchFromWorldPop(bbox, signal);
  } catch (err) {
    if (err.name === 'AbortError') throw err;

    // Fallback: estimate from area × Finland average density (18/km²)
    const area = bboxAreaKm2(bbox);
    const estimated = area * 18;
    return { ...buildResult(estimated, 'arvio (18 hlö/km²)'), estimated: true };
  }
}
