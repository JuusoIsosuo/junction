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

export async function fetchPopulation({ bbox, signal }) {
  const polygon = {
    type: 'Polygon',
    coordinates: [[
      [bbox.minLng, bbox.minLat],
      [bbox.maxLng, bbox.minLat],
      [bbox.maxLng, bbox.maxLat],
      [bbox.minLng, bbox.maxLat],
      [bbox.minLng, bbox.minLat],
    ]],
  };

  const params = new URLSearchParams({
    dataset: 'wpgp',
    iso3: 'FIN',
    year: 2020,
    geojson: JSON.stringify(polygon),
    runasync: 'false',
  });

  const res = await fetch(
    `https://api.worldpop.org/v1/services/stats?${params}`,
    { signal }
  );
  if (!res.ok) throw new Error(`WorldPop API ${res.status}`);

  const json = await res.json();
  const total = json?.data?.total_population;
  if (total == null) throw new Error('Ei väestödataa tälle alueelle');

  const rounded = Math.round(total);
  return {
    total: rounded,
    male: Math.round(rounded * 0.495),
    female: Math.round(rounded * 0.505),
    ageGroups: AGE_GROUPS.map(({ group, share, color }) => ({
      group,
      count: Math.round(rounded * share),
      share,
      color,
    })),
  };
}
