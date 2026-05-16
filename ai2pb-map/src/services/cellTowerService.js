const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

function estimateRange(radio) {
  switch (radio) {
    case 'NR':   return 800;
    case 'LTE':  return 3000;
    case 'UMTS': return 4000;
    case 'GSM':  return 8000;
    default:     return 3000;
  }
}

function detectRadio(tags) {
  if (tags['communication:NR'] === 'yes')   return 'NR';
  if (tags['communication:LTE'] === 'yes')  return 'LTE';
  if (tags['communication:UMTS'] === 'yes') return 'UMTS';
  if (tags['communication:GSM'] === 'yes')  return 'GSM';
  return 'unknown';
}

export async function fetchCellTowers({ bbox, signal }) {
  const { minLat, minLng, maxLat, maxLng } = bbox;
  const b = `${minLat},${minLng},${maxLat},${maxLng}`;

  const query = `
[out:json][timeout:30];
(
  node["man_made"="mast"]["tower:type"="communication"](${b});
  node["man_made"="mast"]["communication:mobile_phone"="yes"](${b});
  node["man_made"="mast"]["communication:LTE"="yes"](${b});
  node["man_made"="mast"]["communication:GSM"="yes"](${b});
  node["man_made"="mast"]["communication:UMTS"="yes"](${b});
  node["man_made"="mast"]["communication:NR"="yes"](${b});
  node["man_made"="communications_tower"](${b});
  node["telecom"="mast"](${b});
);
out body;
`.trim();

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal,
  });

  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  const raw = await res.json();

  const seen = new Set();
  const towers = [];

  for (const el of raw.elements ?? []) {
    if (seen.has(el.id)) continue;
    seen.add(el.id);
    const tags = el.tags ?? {};
    const radio = detectRadio(tags);
    const networks = [];
    if (tags['communication:NR']    === 'yes') networks.push('NR');
    if (tags['communication:LTE']   === 'yes') networks.push('LTE');
    if (tags['communication:UMTS']  === 'yes') networks.push('UMTS');
    if (tags['communication:GSM']   === 'yes') networks.push('GSM');

    towers.push({
      id: el.id,
      lat: el.lat,
      lon: el.lon,
      radio,
      range: estimateRange(radio),
      operator: tags['operator'] ?? null,
      name: tags['name'] ?? null,
      height: tags['height'] ?? null,
      material: tags['material'] ?? null,
      networks: networks.length ? networks.join(', ') : null,
      ref: tags['ref'] ?? null,
    });
  }

  return { count: towers.length, towers };
}
