import { RADIO_COLORS } from "../cellTowers/cellTowerLayer";

const ROAD_COLORS = {
  motorway:     '#f97316',
  trunk:        '#ef4444',
  primary:      '#f59e0b',
  secondary:    '#facc15',
  tertiary:     '#a3e635',
  residential:  '#94a3b8',
  unclassified: '#6b7280',
  track:        '#78716c',
  other:        '#57534e',
};

function SectionHeader({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'monospace',
      fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: '#9ca3af', textTransform: 'uppercase' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: color }} />
      {label}
    </div>
  );
}

function StatusRow({ loading, error }) {
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#9ca3af' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', flexShrink: 0,
        animation: 'pulse 1.2s ease-in-out infinite' }} />
      Querying…
    </div>
  );
  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#f87171', lineHeight: 1.4 }}>
      <span style={{ flexShrink: 0, width: 16, height: 16, borderRadius: '50%',
        background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#f87171',
        fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>!</span>
      {error}
    </div>
  );
  return null;
}

function BreakdownRow({ color, label, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#d1d5db' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: color }} />
      <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 11 }}>{label}</span>
      <span style={{ color: '#9ca3af', fontSize: 11 }}>{count}</span>
    </div>
  );
}

export function IntelPanel({ towers, towersLoading, towersError, roads, roadsLoading, roadsError, enabledLayers }) {
  const hasContent = enabledLayers.cellTowers || enabledLayers.roads;
  if (!hasContent) return null;

  const radioCounts = {};
  towers?.towers.forEach((t) => {
    radioCounts[t.radio] = (radioCounts[t.radio] ?? 0) + 1;
  });

  const sectionStyle = {
    display: 'flex', flexDirection: 'column', gap: 8,
    padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
  };

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      right: 20,
      background: 'rgba(0,0,0,0.88)',
      backdropFilter: 'blur(4px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      zIndex: 1,
      width: 220,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Arial',
    }}>

      {/* Cell Towers */}
      {enabledLayers.cellTowers && (
        <div style={sectionStyle}>
          <SectionHeader color="#10b981" label="Cell Towers" />
          <StatusRow loading={towersLoading} error={towersError} />
          {towers && !towersLoading && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#f3f4f6', fontFamily: 'monospace' }}>
                  {towers.count.toLocaleString()}
                </span>
                <span style={{ fontSize: 11, color: '#6b7280' }}>masts</span>
              </div>
              {Object.entries(radioCounts).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Object.entries(radioCounts).map(([radio, count]) => (
                    <BreakdownRow key={radio} color={RADIO_COLORS[radio] ?? '#6b7280'} label={radio} count={count} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Roads */}
      {enabledLayers.roads && (
        <div style={{ ...sectionStyle, borderBottom: 'none' }}>
          <SectionHeader color="#3b82f6" label="Roads" />
          <StatusRow loading={roadsLoading} error={roadsError} />
          {roads && !roadsLoading && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#f3f4f6', fontFamily: 'monospace' }}>
                  {roads.geojson.features.length.toLocaleString()}
                </span>
                <span style={{ fontSize: 11, color: '#6b7280' }}>segments</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(roads.counts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([type, count]) => (
                    <BreakdownRow key={type} color={ROAD_COLORS[type] ?? '#6b7280'} label={type} count={count} />
                  ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
