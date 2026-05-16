import { useEffect, useState } from "react";
import { fetchWeather } from "../../services/weatherClient";
import { useDraggable } from "../../hooks/useDraggable";

// ── Drone definitions ───────────────────────────────────────────────
const DRONE_TYPES = [
  {
    id: "micro",
    name: "Micro",
    example: "DJI Mini 4 Pro",
    icon: "🔹",
    maxWind: 8,
    maxGust: 10,
    minTemp: -10,
    maxTemp: 40,
    rainTolerance: 0,
    waterproof: false,
    maxHumidity: 85,
    minVisibility: 1000,
    weight: "<250g",
  },
  {
    id: "consumer",
    name: "Consumer",
    example: "DJI Mavic 3",
    icon: "🔷",
    maxWind: 12,
    maxGust: 14,
    minTemp: -10,
    maxTemp: 40,
    rainTolerance: 0,
    waterproof: false,
    maxHumidity: 85,
    minVisibility: 1000,
    weight: "~900g",
  },
  {
    id: "professional",
    name: "Professional",
    example: "DJI Matrice 30T",
    icon: "🟦",
    maxWind: 15,
    maxGust: 18,
    minTemp: -20,
    maxTemp: 50,
    rainTolerance: 1,
    waterproof: true,
    maxHumidity: 95,
    minVisibility: 500,
    weight: "~3.5kg",
  },
  {
    id: "military",
    name: "Military UAV",
    example: "Tactical fixed-rotor",
    icon: "⬛",
    maxWind: 20,
    maxGust: 25,
    minTemp: -30,
    maxTemp: 55,
    rainTolerance: 2,
    waterproof: true,
    maxHumidity: 100,
    minVisibility: 200,
    weight: "5–25kg",
  },
  {
    id: "fixedwing",
    name: "Fixed Wing",
    example: "Long-range ISR UAV",
    icon: "✈️",
    maxWind: 18,
    maxGust: 22,
    minTemp: -20,
    maxTemp: 50,
    rainTolerance: 1,
    waterproof: false,
    maxHumidity: 90,
    minVisibility: 500,
    weight: "1–15kg",
    note: "Needs runway/catapult",
  },
];

// ── Weather code helpers ────────────────────────────────────────────
function getPrecipLevel(code) {
  if (code >= 95) return 3;
  if (code >= 71 && code <= 77) return 2;
  if (code === 65 || code === 82 || code === 86) return 3;
  if (code >= 61 || code >= 80) return 2;
  if (code >= 51) return 1;
  return 0;
}

function getVisibilityM(rawVis) {
  return rawVis ?? 10000;
}

function weatherCodeIcon(code) {
  if (code == null) return "—";
  if (code >= 95) return "⛈";
  if (code >= 80) return "🌧";
  if (code >= 71) return "❄";
  if (code >= 61) return "🌧";
  if (code >= 51) return "🌦";
  if (code >= 45) return "🌫";
  if (code >= 3)  return "☁";
  if (code >= 1)  return "⛅";
  return "☀";
}

// ── Assessment logic ────────────────────────────────────────────────
function assessDrone(drone, c) {
  const issues = [];
  const cautions = [];
  let status = "GO";

  const fail = (msg) => { issues.push(msg); status = "NOGO"; };
  const warn = (msg) => { cautions.push(msg); if (status === "GO") status = "CAUTION"; };

  if (c.wind_speed_10m > drone.maxWind) fail(`Wind ${c.wind_speed_10m} m/s > limit ${drone.maxWind} m/s`);
  else if (c.wind_speed_10m > drone.maxWind * 0.75) warn(`Wind ${c.wind_speed_10m} m/s approaching limit`);

  if (c.wind_gusts_10m != null) {
    if (c.wind_gusts_10m > drone.maxGust) fail(`Gusts ${c.wind_gusts_10m} m/s > limit ${drone.maxGust} m/s`);
    else if (c.wind_gusts_10m > drone.maxGust * 0.8) warn(`Gusts ${c.wind_gusts_10m} m/s near limit`);
  }

  if (c.temperature_2m < drone.minTemp) fail(`Temp ${c.temperature_2m}°C below minimum ${drone.minTemp}°C`);
  else if (c.temperature_2m < drone.minTemp + 5) warn(`Cold — battery performance reduced`);
  else if (c.temperature_2m > drone.maxTemp) fail(`Temp ${c.temperature_2m}°C above maximum ${drone.maxTemp}°C`);
  else if (c.temperature_2m > drone.maxTemp - 5) warn(`High temp — motor/battery stress`);

  if (c.temperature_2m < 5 && c.temperature_2m >= drone.minTemp) warn("Pre-warm battery before flight");

  const precipLevel = getPrecipLevel(c.weather_code);
  if (precipLevel > drone.rainTolerance) {
    if (precipLevel === 3) fail("Thunderstorm / heavy precipitation");
    else if (!drone.waterproof) fail("Precipitation — not waterproof");
    else warn("Flying in precipitation");
  } else if (precipLevel === 1 && !drone.waterproof) {
    warn("Light drizzle possible");
  }

  const humidity = c.relative_humidity_2m;
  if (humidity > drone.maxHumidity) warn(`Humidity ${humidity}% — condensation risk`);
  if (c.dew_point_2m != null) {
    const dewGap = c.temperature_2m - c.dew_point_2m;
    if (dewGap < 2) fail("Near dew point — fog / condensation on electronics");
    else if (dewGap < 4) warn(`Dew point gap only ${dewGap.toFixed(1)}°C — moisture risk`);
  }

  const vis = getVisibilityM(c.visibility);
  if (vis < drone.minVisibility) fail(`Visibility ${Math.round(vis)}m below minimum`);
  else if (vis < drone.minVisibility * 2) warn(`Low visibility ${Math.round(vis / 1000 * 10) / 10}km`);

  if (c.surface_pressure != null) {
    if (c.surface_pressure < 900) warn("Low pressure — reduced lift (high-altitude effect)");
    else if (c.surface_pressure < 950) warn("Below-average pressure — slightly reduced performance");
  }

  if (c.cloud_cover != null && c.cloud_cover > 95 && vis < 3000) warn("Overcast — GPS signal may degrade");

  return { status, issues, cautions };
}

// ── Forecast helpers ────────────────────────────────────────────────
function parseHourlySlots(hourly) {
  if (!hourly?.time) return [];
  const now = new Date();
  return hourly.time
    .map((t, i) => ({
      time: t,
      temperature_2m: hourly.temperature_2m?.[i] ?? 15,
      wind_speed_10m: hourly.wind_speed_10m?.[i] ?? 0,
      wind_gusts_10m: hourly.wind_gusts_10m?.[i] ?? null,
      relative_humidity_2m: hourly.relative_humidity_2m?.[i] ?? 70,
      dew_point_2m: hourly.dew_point_2m?.[i] ?? null,
      visibility: hourly.visibility?.[i] ?? 10000,
      cloud_cover: hourly.cloud_cover?.[i] ?? null,
      weather_code: hourly.weather_code?.[i] ?? 0,
      precipitation: hourly.precipitation?.[i] ?? 0,
      apparent_temperature: hourly.temperature_2m?.[i] ?? 15,
      surface_pressure: null,
    }))
    .filter((h) => new Date(h.time) >= now);
}

function worstStatus(statuses) {
  if (statuses.includes("NOGO")) return "NOGO";
  if (statuses.includes("CAUTION")) return "CAUTION";
  return "GO";
}

function groupByDay(slots) {
  const map = {};
  for (const s of slots) {
    const day = s.time.slice(0, 10);
    if (!map[day]) map[day] = [];
    map[day].push(s);
  }
  return Object.entries(map).map(([date, daySlots]) => ({ date, slots: daySlots }));
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ── UI helpers ──────────────────────────────────────────────────────
const STATUS_CONFIG = {
  GO:      { color: "#22c55e", bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.3)",  label: "GO" },
  CAUTION: { color: "#eab308", bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.3)",  label: "CAUTION" },
  NOGO:    { color: "#ef4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)",  label: "NO-GO" },
};

const STATUS_DOT = {
  GO:      "#22c55e",
  CAUTION: "#eab308",
  NOGO:    "#ef4444",
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
      fontFamily: "monospace", letterSpacing: "0.1em",
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  );
}

function WeatherStat({ label, value, sub }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "7px 10px" }}>
      <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: "bold", color: "#f3f4f6", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#6b7280" }}>{sub}</div>}
    </div>
  );
}

// ── Forecast: Hourly matrix ─────────────────────────────────────────
function HourlyForecast({ slots }) {
  // Show next 24 hours in a horizontal scrollable matrix
  const hours = slots.slice(0, 24);
  if (!hours.length) return <div style={{ color: "#475569", fontSize: 12 }}>No forecast data</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "inline-flex", flexDirection: "column", gap: 0, minWidth: "max-content" }}>
        {/* Header row: times */}
        <div style={{ display: "flex", gap: 0 }}>
          <div style={{ width: 90, flexShrink: 0, fontSize: 9, color: "#475569", padding: "4px 6px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Drone
          </div>
          {hours.map((h) => {
            const t = new Date(h.time);
            const hhmm = t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
            const isNewDay = t.getHours() === 0;
            return (
              <div key={h.time} style={{ width: 44, flexShrink: 0, textAlign: "center", padding: "4px 2px" }}>
                {isNewDay && (
                  <div style={{ fontSize: 8, color: "#38bdf8", marginBottom: 1 }}>
                    {t.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                )}
                <div style={{ fontSize: 9, color: "#64748b" }}>{hhmm}</div>
                <div style={{ fontSize: 10 }}>{weatherCodeIcon(h.weather_code)}</div>
                <div style={{ fontSize: 9, color: "#94a3b8" }}>{h.wind_speed_10m?.toFixed(0)}m/s</div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />

        {/* Drone rows */}
        {DRONE_TYPES.map((drone) => (
          <div key={drone.id} style={{ display: "flex", gap: 0, alignItems: "center" }}>
            <div style={{ width: 90, flexShrink: 0, fontSize: 10, color: "#94a3b8", padding: "3px 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {drone.icon} {drone.name}
            </div>
            {hours.map((h) => {
              const { status } = assessDrone(drone, h);
              return (
                <div key={h.time} style={{ width: 44, flexShrink: 0, display: "flex", justifyContent: "center", alignItems: "center", padding: "3px 2px" }}>
                  <div style={{
                    width: 28, height: 16, borderRadius: 3,
                    background: STATUS_DOT[status] + "33",
                    border: `1px solid ${STATUS_DOT[status]}66`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_DOT[status] }} />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Forecast: Daily summary ─────────────────────────────────────────
function DailyForecast({ slots }) {
  const days = groupByDay(slots).slice(0, 3);
  if (!days.length) return <div style={{ color: "#475569", fontSize: 12 }}>No forecast data</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {days.map(({ date, slots: daySlots }) => {
        const winds = daySlots.map((s) => s.wind_speed_10m).filter((v) => v != null);
        const gusts = daySlots.map((s) => s.wind_gusts_10m).filter((v) => v != null);
        const codes = daySlots.map((s) => s.weather_code).filter((v) => v != null);
        const maxCode = codes.length ? Math.max(...codes) : 0;
        const maxWind = winds.length ? Math.max(...winds) : 0;
        const maxGust = gusts.length ? Math.max(...gusts) : null;
        const minWind = winds.length ? Math.min(...winds) : 0;

        // Per-drone worst-of-day status
        const droneStatuses = DRONE_TYPES.map((drone) => ({
          drone,
          status: worstStatus(daySlots.map((s) => assessDrone(drone, s).status)),
        }));

        return (
          <div key={date} style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 8, padding: "10px 12px",
          }}>
            {/* Day header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: "bold", color: "#e2e8f0" }}>{formatDayLabel(date)}</span>
                <span style={{ fontSize: 10, color: "#475569", marginLeft: 6 }}>{date}</span>
              </div>
              <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#64748b", alignItems: "center" }}>
                <span>{weatherCodeIcon(maxCode)}</span>
                <span>💨 {minWind.toFixed(0)}–{maxWind.toFixed(0)} m/s</span>
                {maxGust != null && <span>gust {maxGust.toFixed(0)} m/s</span>}
              </div>
            </div>

            {/* Per-drone status grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
              {droneStatuses.map(({ drone, status }) => {
                const cfg = STATUS_CONFIG[status];
                return (
                  <div key={drone.id} style={{
                    background: cfg.bg, border: `1px solid ${cfg.border}`,
                    borderRadius: 5, padding: "5px 4px", textAlign: "center",
                  }}>
                    <div style={{ fontSize: 13 }}>{drone.icon}</div>
                    <div style={{ fontSize: 8, color: "#64748b", marginBottom: 2 }}>{drone.name}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: cfg.color, fontFamily: "monospace" }}>
                      {cfg.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Best window hint */}
            {(() => {
              // Find longest consecutive GO window for Consumer drone
              const consumerSlots = daySlots.map((s) => assessDrone(DRONE_TYPES[1], s).status);
              let best = null, run = 0, runStart = null;
              consumerSlots.forEach((s, i) => {
                if (s === "GO") {
                  if (run === 0) runStart = i;
                  run++;
                  if (!best || run > best.len) best = { len: run, start: runStart };
                } else { run = 0; }
              });
              if (!best || best.len < 2) return null;
              const startH = new Date(daySlots[best.start].time);
              const endH = new Date(daySlots[Math.min(best.start + best.len - 1, daySlots.length - 1)].time);
              const fmt = (d) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
              return (
                <div style={{ marginTop: 6, fontSize: 10, color: "#22c55e" }}>
                  ✓ Consumer best window: {fmt(startH)}–{fmt(endH)} ({best.len}h)
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────
export default function DronePanel({ lat, lng, onClose }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [minimized, setMinimized] = useState(false);
const { pos, onMouseDown } = useDraggable(() => ({ x: Math.max(20, window.innerWidth - 400), y: 80 }));

  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true); setError(null); setWeather(null);
    fetchWeather({ lat, lng, signal: ctl.signal })
      .then((d) => { setWeather(d); setLoading(false); })
      .catch((e) => { if (e.name !== "AbortError") { setError(e.message); setLoading(false); } });
    return () => ctl.abort();
  }, [lat, lng]);

  const c = weather?.current;
  const assessments = c ? DRONE_TYPES.map((d) => ({ drone: d, ...assessDrone(d, c) })) : [];
  const overallStatus = assessments.length
    ? assessments.some((a) => a.status === "GO") ? "GO"
    : assessments.some((a) => a.status === "CAUTION") ? "CAUTION" : "NOGO"
    : null;

  const hourlySlots = weather?.hourly ? parseHourlySlots(weather.hourly) : [];
  const windDir = (deg) => ["N","NE","E","SE","S","SW","W","NW"][Math.round((deg ?? 0) / 45) % 8];

  return (
    <div style={{
      position: "absolute", top: pos.y, left: pos.x, width: 420,
      background: "rgba(0,0,0,0.90)", backdropFilter: "blur(10px)",
      color: "white", borderRadius: 12, zIndex: 2,
      fontFamily: "Arial", boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      border: "1px solid rgba(255,255,255,0.08)",
      maxHeight: "90vh", display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div onMouseDown={onMouseDown} style={{
        padding: "14px 16px", cursor: "grab", userSelect: "none",
        borderBottom: minimized ? "none" : "1px solid rgba(255,255,255,0.08)",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
      }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: "bold", color: "#fb923c" }}>
            🚁 Drone Flight Assessment
          </span>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {overallStatus && <StatusBadge status={overallStatus} />}
          <button onClick={() => setMinimized((m) => !m)}
            style={{ background: "none", border: "none", color: "#64748b", fontSize: 16, cursor: "pointer" }}>
            {minimized ? "▢" : "—"}
          </button>
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: "#64748b", fontSize: 18, cursor: "pointer" }}>
            ✕
          </button>
        </div>
      </div>

      {!minimized && (
        <div style={{ overflowY: "auto", flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {loading && (
            <div style={{ textAlign: "center", color: "#64748b", padding: "24px 0" }}>
              Fetching weather data…
            </div>
          )}
          {error && <div style={{ color: "#f87171", fontSize: 13 }}>Error: {error}</div>}

          {c && (
            <>
              {/* Current conditions summary */}
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Current Conditions
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                <WeatherStat label="Wind" value={`${c.wind_speed_10m} m/s`} sub={windDir(c.wind_direction_10m)} />
                <WeatherStat label="Gusts" value={c.wind_gusts_10m != null ? `${c.wind_gusts_10m} m/s` : "—"} />
                <WeatherStat label="Temp" value={`${Math.round(c.temperature_2m)}°C`} sub={`Feels ${Math.round(c.apparent_temperature)}°C`} />
                <WeatherStat label="Humidity" value={`${c.relative_humidity_2m}%`} />
                <WeatherStat label="Dew Point" value={c.dew_point_2m != null ? `${Math.round(c.dew_point_2m)}°C` : "—"} sub={c.dew_point_2m != null ? `Gap ${(c.temperature_2m - c.dew_point_2m).toFixed(1)}°C` : null} />
                <WeatherStat label="Visibility" value={c.visibility != null ? `${(c.visibility / 1000).toFixed(1)} km` : "—"} />
                <WeatherStat label="Pressure" value={c.surface_pressure != null ? `${Math.round(c.surface_pressure)} hPa` : "—"} />
                <WeatherStat label="Cloud Cover" value={c.cloud_cover != null ? `${c.cloud_cover}%` : "—"} />
                <WeatherStat label="Precip." value={`${c.precipitation} mm`} />
              </div>

              {/* Drone assessments */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 12 }}>
                <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
                  Flight Capability — Now
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {assessments.map(({ drone, status, issues, cautions }) => {
                    const cfg = STATUS_CONFIG[status];
                    return (
                      <div key={drone.id} style={{
                        background: cfg.bg, border: `1px solid ${cfg.border}`,
                        borderRadius: 8, padding: "10px 12px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: "bold", color: "#f3f4f6" }}>
                              {drone.icon} {drone.name}
                            </span>
                            <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 6 }}>
                              {drone.example} · {drone.weight}
                            </span>
                          </div>
                          <StatusBadge status={status} />
                        </div>
                        <div style={{ display: "flex", gap: 10, fontSize: 10, color: "#475569", marginBottom: 4 }}>
                          <span>Wind ≤{drone.maxWind} m/s</span>
                          <span>Gust ≤{drone.maxGust} m/s</span>
                          <span>{drone.minTemp}→{drone.maxTemp}°C</span>
                          {drone.note && <span style={{ color: "#f59e0b" }}>{drone.note}</span>}
                        </div>
                        {issues.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {issues.map((msg, i) => (
                              <div key={i} style={{ fontSize: 11, color: "#f87171" }}>✕ {msg}</div>
                            ))}
                          </div>
                        )}
                        {cautions.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {cautions.map((msg, i) => (
                              <div key={i} style={{ fontSize: 11, color: "#fbbf24" }}>⚠ {msg}</div>
                            ))}
                          </div>
                        )}
                        {issues.length === 0 && cautions.length === 0 && (
                          <div style={{ fontSize: 11, color: "#22c55e" }}>✓ All conditions within limits</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Forecast section */}
              {hourlySlots.length > 0 && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 12 }}>
                  <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
                    Forecast
                  </div>

                  {/* Legend */}
                  <div style={{ display: "flex", gap: 12, fontSize: 10, color: "#475569", marginBottom: 8 }}>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color }} />
                        <span>{cfg.label}</span>
                      </div>
                    ))}
                  </div>

                  <HourlyForecast slots={hourlySlots} />
                </div>
              )}

              <div style={{ fontSize: 10, color: "#334155", textAlign: "right" }}>
                Weather: open-meteo.com · Always verify local regulations before flight
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
