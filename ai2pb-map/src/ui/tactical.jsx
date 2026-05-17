// Shared tactical / battlefield-intelligence UI primitives and tokens.
// All panels in the app should compose from these to keep one consistent HUD look.

export const T = {
  // Backgrounds
  bgPanel:      "rgba(8, 12, 10, 0.92)",
  bgPanelSolid: "rgba(6, 10, 8, 0.96)",
  bgInset:      "rgba(140, 200, 160, 0.04)",
  bgInsetStrong:"rgba(140, 200, 160, 0.07)",
  bgScan:       "rgba(140, 200, 160, 0.02)",

  // Borders
  border:       "rgba(120, 180, 140, 0.22)",
  borderStrong: "rgba(140, 200, 160, 0.45)",
  borderDim:    "rgba(120, 180, 140, 0.10)",

  // Text
  text:      "#c8d4c0",
  textDim:   "#7a8f7a",
  textMute:  "#516a55",
  textBright:"#e8f0e0",

  // NATO-ish accents
  accent:    "#7fd99a",   // primary phosphor green
  accentHot: "#ffb454",   // amber
  accentCool:"#5db8ff",   // friendly blue
  hostile:   "#ff5a5a",
  warn:      "#fbbf24",
  ok:        "#4ade80",
  violet:    "#b794f4",

  // Status palettes (status badges, LEDs) — keyed under `status` so they
  // don't collide with the scalar color tokens above.
  status: {
    go:   { fg: "#4ade80", bg: "rgba(74,222,128,0.10)", border: "rgba(74,222,128,0.45)", label: "GO" },
    warn: { fg: "#fbbf24", bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.45)", label: "CAUTION" },
    nogo: { fg: "#ff5a5a", bg: "rgba(255,90,90,0.10)",   border: "rgba(255,90,90,0.55)", label: "NO-GO" },
  },

  // Type
  mono:    '"JetBrains Mono", "IBM Plex Mono", "Roboto Mono", ui-monospace, Menlo, Consolas, monospace',
  display: '"JetBrains Mono", "IBM Plex Mono", "Roboto Mono", ui-monospace, Menlo, Consolas, monospace',

  // Spacing / shape
  radius: 2,
  radiusOuter: 3,
  shadow: "0 0 0 1px rgba(140,200,160,0.06), 0 12px 32px rgba(0,0,0,0.7)",
};

// ── HUD Panel with corner brackets ───────────────────────────────────
export function Panel({ children, style = {}, glow = false }) {
  return (
    <div
      style={{
        position: "relative",
        background: T.bgPanel,
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusOuter,
        boxShadow: glow
          ? `${T.shadow}, 0 0 24px rgba(127,217,154,0.08)`
          : T.shadow,
        color: T.text,
        fontFamily: T.mono,
        backdropFilter: "blur(6px)",
        ...style,
      }}
    >
      <CornerBrackets />
      {children}
    </div>
  );
}

// Four ASCII-ish corner brackets that hint at HUD framing.
function CornerBrackets() {
  const sz = 10;
  const c = T.borderStrong;
  const base = {
    position: "absolute",
    width: sz, height: sz,
    pointerEvents: "none",
  };
  return (
    <>
      <div style={{ ...base, top: -1, left: -1,    borderTop: `1px solid ${c}`, borderLeft:  `1px solid ${c}` }} />
      <div style={{ ...base, top: -1, right: -1,   borderTop: `1px solid ${c}`, borderRight: `1px solid ${c}` }} />
      <div style={{ ...base, bottom: -1, left: -1, borderBottom:`1px solid ${c}`,borderLeft:  `1px solid ${c}` }} />
      <div style={{ ...base, bottom: -1, right: -1,borderBottom:`1px solid ${c}`,borderRight: `1px solid ${c}` }} />
    </>
  );
}

// Panel header: ASCII bracket label, drag handle, optional badge/close/min.
export function PanelHeader({
  title, callsign, badge,
  onMouseDown, onMinimize, onClose,
  minimized = false,
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 12px",
        borderBottom: minimized ? "none" : `1px solid ${T.borderDim}`,
        cursor: onMouseDown ? "grab" : "default",
        userSelect: "none",
        background: "linear-gradient(180deg, rgba(140,200,160,0.05), transparent)",
      }}
    >
      <span style={{
        fontFamily: T.mono, fontSize: 10, fontWeight: 700,
        letterSpacing: "0.18em", color: T.accent,
      }}>
        ▌
      </span>
      <span style={{
        fontFamily: T.mono, fontSize: 11, fontWeight: 700,
        letterSpacing: "0.22em", color: T.textBright,
        textTransform: "uppercase", flex: 1, whiteSpace: "nowrap",
        overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {title}
      </span>
      {callsign && (
        <span style={{
          fontFamily: T.mono, fontSize: 9, color: T.textMute,
          letterSpacing: "0.12em",
        }}>
          {callsign}
        </span>
      )}
      {badge}
      {onMinimize && (
        <button onClick={onMinimize} title={minimized ? "Expand" : "Collapse"}
          style={hdrBtn}>{minimized ? "[ + ]" : "[ — ]"}</button>
      )}
      {onClose && (
        <button onClick={onClose} title="Close"
          style={{ ...hdrBtn, color: T.hostile }}>{"[ X ]"}</button>
      )}
    </div>
  );
}

const hdrBtn = {
  background: "transparent", border: "none", color: T.textDim,
  fontFamily: T.mono, fontSize: 10, letterSpacing: "0.08em",
  cursor: "pointer", padding: "2px 4px", lineHeight: 1,
};

// Section header used inside panels (S2 SITREP style)
export function SectionHeader({ color = T.accent, label, badge }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      paddingBottom: 6,
      borderBottom: `1px dashed ${T.borderDim}`,
      marginBottom: 8,
    }}>
      <Led color={color} pulse={false} />
      <span style={{
        fontFamily: T.mono, fontSize: 10, fontWeight: 700,
        letterSpacing: "0.22em", color: T.textBright,
        textTransform: "uppercase",
        flex: 1,
      }}>
        {label}
      </span>
      {badge}
    </div>
  );
}

// Status LED
export function Led({ color = T.accent, pulse = false, size = 7 }) {
  return (
    <span style={{
      display: "inline-block",
      width: size, height: size,
      background: color,
      boxShadow: `0 0 6px ${color}`,
      borderRadius: "50%",
      flexShrink: 0,
      animation: pulse ? "tac-pulse 1.4s ease-in-out infinite" : "none",
    }} />
  );
}

// NATO status badge: GO / CAUTION / NO-GO / custom
export function StatusBadge({ status = "go", label }) {
  const cfg = T.status[status?.toLowerCase?.()] ?? T.status.go;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 7px", borderRadius: T.radius,
      fontFamily: T.mono, fontSize: 10, fontWeight: 700,
      letterSpacing: "0.16em",
      color: cfg.fg,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      textTransform: "uppercase",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.fg, boxShadow: `0 0 4px ${cfg.fg}` }} />
      {label ?? cfg.label}
    </span>
  );
}

// Tactical action button: square, mono, all-caps
export function TacButton({
  children, onClick, variant = "neutral", style = {}, title,
  active = false, disabled = false,
}) {
  const palettes = {
    neutral: { fg: T.text, border: T.border, bg: "rgba(120,180,140,0.05)" },
    primary: { fg: T.accent, border: "rgba(127,217,154,0.55)", bg: "rgba(127,217,154,0.10)" },
    hot:     { fg: T.accentHot, border: "rgba(255,180,84,0.55)", bg: "rgba(255,180,84,0.10)" },
    danger:  { fg: T.hostile, border: "rgba(255,90,90,0.55)", bg: "rgba(255,90,90,0.10)" },
    cool:    { fg: T.accentCool, border: "rgba(93,184,255,0.55)", bg: "rgba(93,184,255,0.10)" },
    violet:  { fg: T.violet, border: "rgba(183,148,244,0.55)", bg: "rgba(183,148,244,0.10)" },
    ghost:   { fg: T.textDim, border: T.borderDim, bg: "transparent" },
  };
  const p = palettes[variant] ?? palettes.neutral;
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        width: "100%", padding: "9px 12px",
        background: active ? p.fg + "22" : p.bg,
        color: p.fg,
        border: `1px solid ${active ? p.fg : p.border}`,
        borderRadius: T.radius,
        fontFamily: T.mono, fontSize: 11, fontWeight: 700,
        letterSpacing: "0.16em", textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "background 120ms, border-color 120ms",
        ...style,
      }}
    >
      <span style={{ color: p.fg, opacity: 0.7 }}>▶</span>
      <span style={{ flex: 1, textAlign: "left" }}>{children}</span>
    </button>
  );
}

// Stat box: label on top, value below — for telemetry grids
export function Stat({ label, value, sub, color = T.text, span = 1 }) {
  return (
    <div style={{
      background: T.bgInset,
      border: `1px solid ${T.borderDim}`,
      borderRadius: T.radius,
      padding: "7px 9px",
      gridColumn: `span ${span}`,
    }}>
      <div style={{
        fontFamily: T.mono, fontSize: 9,
        letterSpacing: "0.18em", color: T.textMute,
        textTransform: "uppercase", marginBottom: 3,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: T.mono, fontSize: 14, fontWeight: 700,
        color, whiteSpace: "pre-line", lineHeight: 1.15,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontFamily: T.mono, fontSize: 9,
          color: T.textMute, marginTop: 2,
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// "Big number" telemetry value
export function BigNum({ value, unit, color = T.textBright }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
      <span style={{
        fontFamily: T.mono, fontSize: 24, fontWeight: 700, color, lineHeight: 1,
      }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span style={{
        fontFamily: T.mono, fontSize: 10,
        color: T.textMute, letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}>
        {unit}
      </span>
    </div>
  );
}

// Breakdown row for category counts
export function BreakdownRow({ color, label, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: T.mono, fontSize: 11 }}>
      <Led color={color} size={6} />
      <span style={{ flex: 1, color: T.text }}>{label}</span>
      <span style={{ color: T.textDim }}>{count.toLocaleString?.() ?? count}</span>
    </div>
  );
}

// Inline status row (loading / error) for sitrep sections
export function StatusRow({ loading, error }) {
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: T.mono, fontSize: 11, color: T.textDim }}>
        <Led color={T.warn} pulse size={7} />
        <span style={{ letterSpacing: "0.12em" }}>QUERYING…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        fontFamily: T.mono, fontSize: 11, color: T.hostile,
        padding: "5px 7px",
        background: "rgba(255,90,90,0.08)",
        border: `1px solid rgba(255,90,90,0.35)`,
        borderRadius: T.radius,
      }}>
        <span style={{ fontWeight: 700, letterSpacing: "0.18em" }}>! ERR</span>
        <span style={{ flex: 1 }}>{error}</span>
      </div>
    );
  }
  return null;
}

// Hairline divider with optional label
export function Divider({ label }) {
  if (!label) {
    return <div style={{ height: 1, background: T.borderDim, margin: "8px 0" }} />;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 6px" }}>
      <div style={{ flex: 1, height: 1, background: T.borderDim }} />
      <span style={{
        fontFamily: T.mono, fontSize: 9, color: T.textMute,
        letterSpacing: "0.22em", textTransform: "uppercase",
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: T.borderDim }} />
    </div>
  );
}

// Coordinate display (DMS-ish formatting)
export function CoordRow({ label, value }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 1fr",
      gap: 12, padding: "5px 0",
      borderBottom: `1px dashed ${T.borderDim}`,
    }}>
      <span style={{
        fontFamily: T.mono, fontSize: 10, color: T.textMute,
        letterSpacing: "0.18em", textTransform: "uppercase",
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: T.mono, fontSize: 11, color: T.textBright,
        textAlign: "right", letterSpacing: "0.04em",
      }}>
        {value}
      </span>
    </div>
  );
}

// Section padding consistent across panels
export const sectionStyle = {
  display: "flex", flexDirection: "column", gap: 8,
  padding: "12px 14px",
  borderBottom: `1px solid ${T.borderDim}`,
};

// Format coordinate as DD.DDDDD°N
export function fmtCoord(value, type) {
  if (value === null || value === undefined) return "—";
  const dir = value >= 0 ? (type === "lat" ? "N" : "E") : (type === "lat" ? "S" : "W");
  return `${Math.abs(value).toFixed(5)}°${dir}`;
}
