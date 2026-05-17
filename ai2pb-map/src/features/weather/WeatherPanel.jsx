import { useEffect, useState } from "react";
import { fetchWeather } from "../../services/weatherClient";
import { useDraggable } from "../../hooks/useDraggable";
import {
  T, Panel, PanelHeader, Stat, Divider, Led,
} from "../../ui/tactical";

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
  77: "❄️",
  80: "🌦️",
  81: "🌧️",
  82: "⛈️",
  85: "❄️",
  86: "❄️",
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

  const getCurrentHourIndex = (times) => {
    const now = new Date();
    return times.findIndex((t) => {
      const d = new Date(t);
      return d.getHours() === now.getHours() && d.toDateString() === now.toDateString();
    });
  };

  return (
    <Panel
      style={{
        position: "absolute",
        top: pos.y,
        left: pos.x,
        width: 340,
        zIndex: 6,
        maxHeight: "calc(100vh - 80px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <PanelHeader
        title="METOC · FORECAST"
        callsign={`${lat.toFixed(3)}°N ${lng.toFixed(3)}°E`}
        onMouseDown={onMouseDown}
        onMinimize={() => setMinimized((m) => !m)}
        onClose={onClose}
        minimized={minimized}
      />

      {!minimized && (
        <div style={{
          padding: "12px 14px", overflowY: "auto", flex: 1,
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.textDim,
              fontSize: 11, padding: "12px 0", letterSpacing: "0.12em",
            }}>
              <Led color={T.warn} pulse />
              ACQUIRING ATMOSPHERIC DATA…
            </div>
          )}

          {error && (
            <div style={{ color: T.hostile, fontSize: 11, fontFamily: T.mono }}>
              ERR · {error}
            </div>
          )}

          {weather && !loading && (() => {
            const c = weather.current;
            const h = weather.hourly;
            const code = c.weather_code;

            const currentIdx = Math.max(0, getCurrentHourIndex(h.time));
            const windowStart = currentIdx + hourOffset;
            const windowEnd = Math.min(windowStart + 12, h.time.length);
            const hourSlice = h.time.slice(windowStart, windowEnd);

            const maxPrecip = Math.max(...h.precipitation.slice(windowStart, windowEnd), 1);

            return (
              <>
                {/* Current conditions read-out */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "auto auto 1fr",
                  gap: 14, alignItems: "center",
                  padding: "8px 10px",
                  background: T.bgInsetStrong,
                  border: `1px solid ${T.borderDim}`,
                  borderRadius: T.radius,
                }}>
                  <div style={{ fontSize: 40, lineHeight: 1 }}>{WMO_ICON[code] ?? "🌡️"}</div>
                  <div style={{
                    fontFamily: T.mono, fontSize: 28, fontWeight: 700,
                    color: T.textBright, lineHeight: 1,
                  }}>
                    {Math.round(c.temperature_2m)}°C
                  </div>
                  <div>
                    <div style={{
                      fontFamily: T.mono, fontSize: 10, color: T.accent,
                      letterSpacing: "0.18em", fontWeight: 700,
                    }}>
                      {(WMO_CODES[code] ?? "UNKNOWN").toUpperCase()}
                    </div>
                    <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, marginTop: 4 }}>
                      FEELS · {Math.round(c.apparent_temperature)}°C
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  <Stat label="HUMIDITY" value={`${c.relative_humidity_2m}%`} />
                  <Stat
                    label="WIND"
                    value={`${c.wind_speed_10m} m/s`}
                    sub={windDir(c.wind_direction_10m)}
                  />
                  <Stat label="PRECIP" value={`${c.precipitation} mm`} />
                </div>

                <Divider label="HOURLY · +12H WINDOW" />

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <button
                    onClick={() => setHourOffset((o) => Math.max(0, o - 12))}
                    disabled={hourOffset === 0}
                    style={navBtn(hourOffset === 0)}
                  >
                    ◀ PREV
                  </button>
                  <span style={{
                    fontFamily: T.mono, fontSize: 9, color: T.textMute,
                    letterSpacing: "0.18em",
                  }}>
                    T+{hourOffset}H → T+{hourOffset + 12}H
                  </span>
                  <button
                    onClick={() => setHourOffset((o) => (windowEnd < h.time.length ? o + 12 : o))}
                    disabled={windowEnd >= h.time.length}
                    style={navBtn(windowEnd >= h.time.length)}
                  >
                    NEXT ▶
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
                          gridTemplateColumns: "44px 36px 38px 1fr 44px",
                          alignItems: "center",
                          gap: 6,
                          padding: "5px 8px",
                          borderRadius: T.radius,
                          background: isNow ? "rgba(127,217,154,0.10)" : "transparent",
                          border: `1px solid ${isNow ? "rgba(127,217,154,0.30)" : "transparent"}`,
                        }}
                      >
                        <span style={{
                          fontFamily: T.mono, fontSize: 10,
                          color: isNow ? T.accent : T.textDim,
                          fontWeight: isNow ? 700 : 500,
                          letterSpacing: "0.04em",
                        }}>
                          {isNow ? "NOW" : `${String(hour).padStart(2, "0")}00`}
                        </span>
                        <span style={{ fontSize: 16, textAlign: "center", lineHeight: 1 }}>
                          {WMO_ICON[hCode] ?? "🌡️"}
                        </span>
                        <span style={{
                          fontFamily: T.mono, fontSize: 11, fontWeight: 700,
                          color: T.text, textAlign: "right",
                        }}>
                          {Math.round(h.temperature_2m[idx])}°
                        </span>
                        <div style={{
                          position: "relative", height: 5,
                          background: "rgba(140,200,160,0.06)",
                          borderRadius: 1,
                          overflow: "hidden",
                        }}>
                          <div style={{
                            position: "absolute", left: 0, top: 0, bottom: 0,
                            width: `${precipPct}%`,
                            background: precip > 0 ? T.accentCool : "transparent",
                            transition: "width 0.3s",
                          }} />
                        </div>
                        <span style={{
                          fontFamily: T.mono, fontSize: 10,
                          color: precip > 0 ? T.accentCool : T.textMute,
                          textAlign: "right",
                        }}>
                          {precip > 0 ? `${precip}mm` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <Divider label="WIND · HUMIDITY" />

                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {hourSlice.map((timeStr, i) => {
                    const idx = windowStart + i;
                    const hour = new Date(timeStr).getHours();
                    const isNow = idx === currentIdx;
                    return (
                      <div
                        key={timeStr}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "44px 1fr 1fr",
                          gap: 6,
                          padding: "3px 8px",
                          background: isNow ? "rgba(127,217,154,0.07)" : "transparent",
                          borderRadius: T.radius,
                        }}
                      >
                        <span style={{
                          fontFamily: T.mono, fontSize: 10,
                          color: isNow ? T.accent : T.textDim,
                        }}>
                          {isNow ? "NOW" : `${String(hour).padStart(2, "0")}00`}
                        </span>
                        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.text }}>
                          WND {h.wind_speed_10m[idx]} m/s
                        </span>
                        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.text, textAlign: "right" }}>
                          RH {h.relative_humidity_2m[idx]}%
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div style={{
                  fontFamily: T.mono, fontSize: 9, color: T.textMute,
                  textAlign: "right", letterSpacing: "0.10em",
                  borderTop: `1px solid ${T.borderDim}`,
                  paddingTop: 8, marginTop: 4,
                }}>
                  SRC · OPEN-METEO.COM · NO KEY REQ
                </div>
              </>
            );
          })()}
        </div>
      )}
    </Panel>
  );
}

function navBtn(disabled) {
  return {
    padding: "3px 8px",
    borderRadius: T.radius,
    fontFamily: T.mono, fontSize: 10,
    letterSpacing: "0.14em",
    border: `1px solid ${T.borderDim}`,
    background: "transparent",
    color: disabled ? T.textMute : T.textDim,
    cursor: disabled ? "default" : "pointer",
  };
}
