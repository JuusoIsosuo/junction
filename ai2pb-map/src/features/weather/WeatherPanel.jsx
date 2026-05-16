import { useEffect, useState } from "react";
import { fetchWeather } from "../../services/weatherClient";
import { useDraggable } from "../../hooks/useDraggable";

const WMO_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Icy fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ hail",
  99: "Heavy thunderstorm w/ hail",
};

const WMO_ICON = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌧️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  71: "❄️",
  73: "❄️",
  75: "❄️",
  80: "🌦️",
  81: "🌧️",
  82: "⛈️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

export default function WeatherPanel({ lat, lng, onClose }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hourOffset, setHourOffset] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const { pos, onMouseDown } = useDraggable(() => ({ x: Math.max(20, window.innerWidth - 360), y: 20 }));

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);
    setWeather(null);
    setHourOffset(0);

    fetchWeather({ lat, lng, signal: controller.signal })
      .then((data) => {
        setWeather(data);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [lat, lng]);

  const windDir = (deg) => {
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round(deg / 45) % 8];
  };

  // Find the current hour index in the hourly array
  const getCurrentHourIndex = (times) => {
    const now = new Date();
    return times.findIndex((t) => {
      const d = new Date(t);
      return d.getHours() === now.getHours() && d.toDateString() === now.toDateString();
    });
  };

  return (
    <div
      style={{
        position: "absolute",
        top: pos.y,
        left: pos.x,
        width: 340,
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(10px)",
        color: "white",
        borderRadius: 12,
        zIndex: 2,
        fontFamily: "Arial",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        onMouseDown={onMouseDown}
        style={{
          padding: "14px 16px",
          borderBottom: minimized ? "none" : "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          cursor: "grab",
          userSelect: "none",
        }}
      >
        <div>
          <span style={{ fontSize: 13, fontWeight: "bold", color: "#34d399" }}>
            ☁ Weather Data
          </span>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => setMinimized((m) => !m)} title={minimized ? "Expand" : "Minimize"}
            style={{ background: "none", border: "none", color: "#64748b", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>
            {minimized ? "▢" : "—"}
          </button>
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: "#64748b", fontSize: 18, cursor: "pointer" }}>
            ✕
          </button>
        </div>
      </div>

      {!minimized && <div style={{ padding: "14px 16px", overflowY: "auto", flex: 1 }}>
        {loading && (
          <div style={{ textAlign: "center", color: "#64748b", padding: "24px 0" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
            Fetching weather...
          </div>
        )}

        {error && <div style={{ color: "#f87171", fontSize: 13 }}>Error: {error}</div>}

        {weather && !loading && (() => {
          const c = weather.current;
          const h = weather.hourly;
          const code = c.weather_code;

          // Find current hour, then show a 12-hour window starting from hourOffset
          const currentIdx = Math.max(0, getCurrentHourIndex(h.time));
          const windowStart = currentIdx + hourOffset;
          const windowEnd = Math.min(windowStart + 12, h.time.length);
          const hourSlice = h.time.slice(windowStart, windowEnd);

          const maxPrecip = Math.max(...h.precipitation.slice(windowStart, windowEnd), 1);

          return (
            <>
              {/* Current conditions */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 48 }}>{WMO_ICON[code] ?? "🌡️"}</div>
                <div>
                  <div style={{ fontSize: 34, fontWeight: "bold", lineHeight: 1 }}>
                    {Math.round(c.temperature_2m)}°C
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    Feels like {Math.round(c.apparent_temperature)}°C
                  </div>
                  <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 4 }}>
                    {WMO_CODES[code] ?? "Unknown"}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 7,
                  marginBottom: 16,
                }}
              >
                {[
                  { label: "Humidity", value: `${c.relative_humidity_2m}%`, icon: "💧" },
                  {
                    label: "Wind",
                    value: `${c.wind_speed_10m} m/s\n${windDir(c.wind_direction_10m)}`,
                    icon: "💨",
                  },
                  { label: "Precip.", value: `${c.precipitation} mm`, icon: "🌧️" },
                ].map(({ label, value, icon }) => (
                  <div
                    key={label}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      borderRadius: 8,
                      padding: "8px 6px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 16 }}>{icon}</div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{label}</div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: "bold",
                        marginTop: 2,
                        whiteSpace: "pre-line",
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Hourly breakdown header + nav */}
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.07)",
                  paddingTop: 12,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 11, color: "#475569", letterSpacing: "0.06em" }}>
                    HOURLY BREAKDOWN
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => setHourOffset((o) => Math.max(0, o - 12))}
                      disabled={hourOffset === 0}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.05)",
                        color: hourOffset === 0 ? "#334155" : "#94a3b8",
                        cursor: hourOffset === 0 ? "default" : "pointer",
                      }}
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => setHourOffset((o) => (windowEnd < h.time.length ? o + 12 : o))}
                      disabled={windowEnd >= h.time.length}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.05)",
                        color: windowEnd >= h.time.length ? "#334155" : "#94a3b8",
                        cursor: windowEnd >= h.time.length ? "default" : "pointer",
                      }}
                    >
                      Next →
                    </button>
                  </div>
                </div>

                {/* Hourly rows */}
                {hourSlice.map((timeStr, i) => {
                  const idx = windowStart + i;
                  const hour = new Date(timeStr).getHours();
                  const isNow = idx === currentIdx;
                  const hCode = h.weather_code[idx];
                  const precip = h.precipitation[idx];
                  const precipPct = Math.round((precip / maxPrecip) * 100);

                  return (
                    <div
                      key={timeStr}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "38px 24px 44px 1fr 44px",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 6px",
                        borderRadius: 6,
                        marginBottom: 2,
                        background: isNow ? "rgba(52,211,153,0.08)" : "transparent",
                        border: isNow
                          ? "1px solid rgba(52,211,153,0.2)"
                          : "1px solid transparent",
                      }}
                    >
                      {/* Time */}
                      <span
                        style={{
                          fontSize: 11,
                          color: isNow ? "#34d399" : "#64748b",
                          fontWeight: isNow ? "bold" : "normal",
                        }}
                      >
                        {isNow ? "Now" : `${String(hour).padStart(2, "0")}:00`}
                      </span>

                      {/* Icon */}
                      <span style={{ fontSize: 15, textAlign: "center" }}>
                        {WMO_ICON[hCode] ?? "🌡️"}
                      </span>

                      {/* Temp */}
                      <span style={{ fontSize: 12, fontWeight: "bold", textAlign: "right" }}>
                        {Math.round(h.temperature_2m[idx])}°C
                      </span>

                      {/* Precip bar */}
                      <div
                        style={{
                          position: "relative",
                          height: 6,
                          background: "rgba(255,255,255,0.06)",
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${precipPct}%`,
                            background: precip > 0 ? "#38bdf8" : "transparent",
                            borderRadius: 3,
                            transition: "width 0.3s",
                          }}
                        />
                      </div>

                      {/* Precip mm */}
                      <span
                        style={{
                          fontSize: 10,
                          color: precip > 0 ? "#7dd3fc" : "#334155",
                          textAlign: "right",
                        }}
                      >
                        {precip > 0 ? `${precip}mm` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Wind detail for current window */}
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.07)",
                  paddingTop: 10,
                  marginTop: 4,
                }}
              >
                <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.06em", marginBottom: 8 }}>
                  WIND & HUMIDITY (HOURLY)
                </div>
                {hourSlice.map((timeStr, i) => {
                  const idx = windowStart + i;
                  const hour = new Date(timeStr).getHours();
                  const isNow = idx === currentIdx;
                  return (
                    <div
                      key={timeStr}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "38px 1fr 1fr",
                        gap: 6,
                        padding: "4px 6px",
                        borderRadius: 4,
                        marginBottom: 2,
                        background: isNow ? "rgba(52,211,153,0.06)" : "transparent",
                      }}
                    >
                      <span style={{ fontSize: 11, color: isNow ? "#34d399" : "#64748b" }}>
                        {isNow ? "Now" : `${String(hour).padStart(2, "0")}:00`}
                      </span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        💨 {h.wind_speed_10m[idx]} m/s
                      </span>
                      <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "right" }}>
                        💧 {h.relative_humidity_2m[idx]}%
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 12, fontSize: 10, color: "#334155", textAlign: "right" }}>
                Data: open-meteo.com · No API key required
              </div>
            </>
          );
        })()}
      </div>}
    </div>
  );
}
