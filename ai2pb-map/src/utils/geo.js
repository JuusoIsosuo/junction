const R = 6371000;

export function geoCircle(lon, lat, radiusMeters, steps = 48) {
  const latR = (lat * Math.PI) / 180;
  const coords = [];

  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const d = radiusMeters / R;
    const pLat = Math.asin(
      Math.sin(latR) * Math.cos(d) + Math.cos(latR) * Math.sin(d) * Math.cos(bearing)
    );
    const pLon =
      (lon * Math.PI) / 180 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(latR),
        Math.cos(d) - Math.sin(latR) * Math.sin(pLat)
      );
    coords.push([(pLon * 180) / Math.PI, (pLat * 180) / Math.PI]);
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}
