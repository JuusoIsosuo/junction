import { API_BASE } from "./apiBase";

export async function fetchWeather({ lat, lng, signal }) {
  const url = new URL(`${API_BASE}/api/weather`);
  url.searchParams.set("lat", lat.toFixed(4));
  url.searchParams.set("lng", lng.toFixed(4));

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}
