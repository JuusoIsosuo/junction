import { useEffect, useState } from "react";
import { fetchWeather } from "../../services/weatherClient";
import { useDraggable } from "../../hooks/useDraggable";
import {
  T, Panel, PanelHeader, SectionHeader, StatusRow,
  Stat, Led, StatusBadge, sectionStyle,
} from "../../ui/tactical";

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
  if (code >= 3) return "☁";
  if (code >= 1) return "⛅";
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

const STATUS_KEY = { GO: "go", CAUTION: "warn", NOGO: "nogo" };

// ── Forecast: Hourly matrix ─────────────────────────────────────────
function HourlyForecast({ slots }) {
  const hours = slots.slice(0, 24);
  if (!hours.length) {
    return <div style={{ color: T.textMute, fontSize: 11, fontFamily: T.mono }}>NO DATA</div>;
  }

  const labelW = 96;
  const cellW = 44;
  const totalW = labelW + hours.length * cellW;

  return (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <div style={{ width: totalW }}>
        <div style={{ display: "flex", width: totalW }}>
          <div style={{
            width: labelW, flexShrink: 0,
            fontFamily: T.mono, fontSize: 9, color: T.textMute,
            padding: "4px 6px", fontWeight: 700, letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}>
            DRONE
          </div>
          {hours.map((h, idx) => {
            const t = new Date(h.time);
            const hhmm = t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
            const isNewDay = t.getHours() === 0;
            return (
              <div key={`hdr-${idx}`} style={{
                width: cellW, flexShrink: 0, textAlign: "center",
                padding: "4px 2px",
              }}>
                {isNewDay && (
                  <div style={{
                    fontFamily: T.mono, fontSize: 8, color: T.accentCool,
                    marginBottom: 1, letterSpacing: "0.08em",
                  }}>
                    {t.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
                  </div>
                )}
                <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim }}>{hhmm}</div>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.text }}>{weatherCodeIcon(h.weather_code)}</div>
                <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textMute }}>{h.wind_speed_10m?.toFixed(0)}m/s</div>
              </div>
            );
          })}
        </div>

        <div style={{ height: 1, background: T.borderDim, margin: "2px 0", width: totalW }} />

        {DRONE_TYPES.map((drone) => (
          <div key={drone.id} style={{ display: "flex", width: totalW, alignItems: "center", minHeight: 22 }}>
            <div style={{
              width: labelW, flexShrink: 0,
              fontFamily: T.mono, fontSize: 10, color: T.text,
              padding: "3px 6px", whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis",
              letterSpacing: "0.06em",
            }}>
              <span style={{ color: T.accent, marginRight: 6 }}>{drone.icon}</span>
              {drone.name.toUpperCase()}
            </div>
            {hours.map((h, idx) => {
              const { status } = assessDrone(drone, h);
              const cfg = T.status[STATUS_KEY[status]];
              return (
                <div key={`${drone.id}-${idx}`} style={{
                  width: cellW, flexShrink: 0, display: "flex",
                  justifyContent: "center", alignItems: "center",
                  padding: "3px 2px",
                }}>
                  <div style={{
                    width: 28, height: 14,
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    borderRadius: 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: cfg.fg, boxShadow: `0 0 4px ${cfg.fg}`,
                    }} />
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
  const windDir = (deg) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round((deg ?? 0) / 45) % 8];

  return (
    <Panel
      glow
      style={{
        position: "absolute", top: pos.y, left: pos.x,
        width: 440, zIndex: 6,
        maxHeight: "calc(100vh - 80px)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <PanelHeader
        title="UAS · FLIGHT GO/NO-GO"
        callsign={`${lat.toFixed(3)}°N ${lng.toFixed(3)}°E`}
        badge={overallStatus && <StatusBadge status={STATUS_KEY[overallStatus]} />}
        onMouseDown={onMouseDown}
        onMinimize={() => setMinimized((m) => !m)}
        onClose={onClose}
        minimized={minimized}
      />

      {!minimized && (
        <div style={{ overflowY: "auto", flex: 1 }}>
          <div style={sectionStyle}>
            <SectionHeader color={T.accentCool} label="ATMOSPHERIC · NOW" />
            <StatusRow loading={loading} error={error} />
            {c && !loading && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                <Stat label="WIND" value={`${c.wind_speed_10m} m/s`} sub={windDir(c.wind_direction_10m)} />
                <Stat label="GUSTS" value={c.wind_gusts_10m != null ? `${c.wind_gusts_10m} m/s` : "—"} />
                <Stat label="TEMP" value={`${Math.round(c.temperature_2m)}°C`} sub={`FEELS ${Math.round(c.apparent_temperature)}°C`} />
                <Stat label="HUMID" value={`${c.relative_humidity_2m}%`} />
                <Stat label="DEW PT" value={c.dew_point_2m != null ? `${Math.round(c.dew_point_2m)}°C` : "—"} sub={c.dew_point_2m != null ? `GAP ${(c.temperature_2m - c.dew_point_2m).toFixed(1)}°C` : null} />
                <Stat label="VIS" value={c.visibility != null ? `${(c.visibility / 1000).toFixed(1)} km` : "—"} />
                <Stat label="PRESS" value={c.surface_pressure != null ? `${Math.round(c.surface_pressure)} hPa` : "—"} />
                <Stat label="CLOUD" value={c.cloud_cover != null ? `${c.cloud_cover}%` : "—"} />
                <Stat label="PRECIP" value={`${c.precipitation} mm`} />
              </div>
            )}
          </div>

          {c && (
            <div style={sectionStyle}>
              <SectionHeader color={T.accent} label="FLIGHT CAPABILITY · LIVE" />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {assessments.map(({ drone, status, issues, cautions }) => {
                  const cfg = T.status[STATUS_KEY[status]];
                  return (
                    <div key={drone.id} style={{
                      background: cfg.bg,
                      border: `1px solid ${cfg.border}`,
                      borderRadius: T.radius,
                      padding: "8px 10px",
                    }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center", marginBottom: 4,
                      }}>
                        <div>
                          <span style={{
                            fontFamily: T.mono, fontSize: 12, fontWeight: 700,
                            color: T.textBright, letterSpacing: "0.10em",
                          }}>
                            <span style={{ color: cfg.fg, marginRight: 8 }}>{drone.icon}</span>
                            {drone.name.toUpperCase()}
                          </span>
                          <div style={{
                            fontFamily: T.mono, fontSize: 9, color: T.textMute,
                            marginTop: 2, letterSpacing: "0.06em",
                          }}>
                            {drone.example.toUpperCase()} · {drone.weight}
                          </div>
                        </div>
                        <StatusBadge status={STATUS_KEY[status]} />
                      </div>
                      <div style={{
                        display: "flex", gap: 12,
                        fontFamily: T.mono, fontSize: 9, color: T.textMute,
                        marginBottom: 4, letterSpacing: "0.05em",
                      }}>
                        <span>WND ≤{drone.maxWind}m/s</span>
                        <span>GST ≤{drone.maxGust}m/s</span>
                        <span>{drone.minTemp}→{drone.maxTemp}°C</span>
                        {drone.note && <span style={{ color: T.warn }}>{drone.note.toUpperCase()}</span>}
                      </div>
                      {issues.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {issues.map((msg, i) => (
                            <div key={i} style={{ fontFamily: T.mono, fontSize: 10, color: T.hostile }}>
                              · {msg}
                            </div>
                          ))}
                        </div>
                      )}
                      {cautions.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {cautions.map((msg, i) => (
                            <div key={i} style={{ fontFamily: T.mono, fontSize: 10, color: T.warn }}>
                              · {msg}
                            </div>
                          ))}
                        </div>
                      )}
                      {issues.length === 0 && cautions.length === 0 && (
                        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ok }}>
                          ALL PARAMETERS WITHIN ENVELOPE
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hourlySlots.length > 0 && (
            <div style={sectionStyle}>
              <SectionHeader color={T.accentHot} label="FORECAST · 24H" />
              <div style={{
                display: "flex", gap: 14, alignItems: "center",
                fontFamily: T.mono, fontSize: 9, color: T.textMute,
                marginBottom: 4, letterSpacing: "0.10em",
              }}>
                {[["GO", T.status.go.fg], ["CAUTION", T.warn], ["NO-GO", T.hostile]].map(([label, color]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Led color={color} size={6} />
                    <span>{label}</span>
                  </div>
                ))}
                <div style={{ marginLeft: "auto", color: T.textMute }}>
                  WND in m/s
                </div>
              </div>
              <HourlyForecast slots={hourlySlots} />
              <div style={{
                fontFamily: T.mono, fontSize: 9, color: T.textMute,
                textAlign: "right", letterSpacing: "0.10em",
              }}>
                SRC · OPEN-METEO.COM · VERIFY LOCAL REGS PRE-FLIGHT
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
