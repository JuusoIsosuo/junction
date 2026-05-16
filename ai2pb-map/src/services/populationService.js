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
  return total;
}

export async function fetchPopulation({ bbox, signal }) {
  try {
    const osmTotal = await fetchOsmPopulation(bbox, signal);
    if (osmTotal > 0) {
      return buildResult(osmTotal, 'OSM (taajama-arvot)');
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    // fall through to density estimate
  }

  // Fallback: area × Finland average population density (18/km²)
  const area = bboxAreaKm2(bbox);
  return buildResult(area * 18, 'arvio (18 hlö/km²)', true);
}
