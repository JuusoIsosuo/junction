import { API_BASE } from "./apiBase";

export async function fetchWeather({ lat, lng, signal }) {
  const url = `${API_BASE}/api/weather?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}
