import { RADIO_COLORS } from "../cellTowers/cellTowerLayer";
import { INFRA_TYPE_CONFIG } from "../../services/infrastructureService";

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
        background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444',
        fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>!</span>
      {error}
    </div>
  );
  return null;
}

function BigNum({ value, unit }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: '#f3f4f6', fontFamily: 'monospace' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span style={{ fontSize: 11, color: '#6b7280' }}>{unit}</span>
    </div>
  );
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

const sec = {
  display: 'flex', flexDirection: 'column', gap: 8,
  padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
};

export function IntelPanel({
  towers, towersLoading, towersError,
  roads, roadsLoading, roadsError,
  bridges, bridgesLoading, bridgesError,
  infrastructure, infraLoading, infraError,
  osm, osmLoading, osmError,
  elevation, elevLoading, elevError,
  enabledLayers,
}) {
  const anyEnabled = Object.values(enabledLayers).some(Boolean);
  if (!anyEnabled) return null;

  const radioCounts = {};
  towers?.towers.forEach((t) => { radioCounts[t.radio] = (radioCounts[t.radio] ?? 0) + 1; });

  return (
    <div style={{
      position: 'absolute', top: 20, right: 20,
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(4px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, zIndex: 1, width: 240,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Arial', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
    }}>

      {/* Cell Towers */}
      {enabledLayers.cellTowers && (
        <div style={sec}>
          <SectionHeader color="#10b981" label="Cell Towers" />
          <StatusRow loading={towersLoading} error={towersError} />
          {towers && !towersLoading && (
            <>
              <BigNum value={towers.count} unit="masts" />
              {Object.keys(radioCounts).length > 0 && (
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
        <div style={sec}>
          <SectionHeader color="#3b82f6" label="Roads" />
          <StatusRow loading={roadsLoading} error={roadsError} />
          {roads && !roadsLoading && (
            <>
              <BigNum value={roads.geojson.features.length} unit="segments" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(roads.counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([type, count]) => (
                  <BreakdownRow key={type} color={ROAD_COLORS[type] ?? '#6b7280'} label={type} count={count} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Bridges */}
      {enabledLayers.bridges && (
        <div style={sec}>
          <SectionHeader color="#f59e0b" label="Bridges" />
          <StatusRow loading={bridgesLoading} error={bridgesError} />
          {bridges && !bridgesLoading && (
            <>
              <BigNum value={bridges.count} unit="bridges" />
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                Click a bridge on the map to see max weight &amp; details.
              </div>
            </>
          )}
        </div>
      )}

      {/* Infrastructure */}
      {enabledLayers.infrastructure && (
        <div style={sec}>
          <SectionHeader color="#fbbf24" label="Infrastructure" />
          <StatusRow loading={infraLoading} error={infraError} />
          {infrastructure && !infraLoading && (
            <>
              <BigNum value={infrastructure.count} unit="sites" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(infrastructure.typeCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => {
                    const cfg = INFRA_TYPE_CONFIG[type];
                    return (
                      <BreakdownRow
                        key={type}
                        color={cfg?.color ?? '#6b7280'}
                        label={cfg?.label ?? type}
                        count={count}
                      />
                    );
                  })}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                Click a site on the map for details.
              </div>
            </>
          )}
        </div>
      )}

      {/* Buildings */}
      {enabledLayers.buildings && (
        <div style={sec}>
          <SectionHeader color="#a78bfa" label="Buildings" />
          <StatusRow loading={osmLoading} error={osmError} />
          {osm && !osmLoading && (
            <>
              <BigNum value={osm.counts.buildings} unit="buildings" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(osm.counts.buildingTypes ?? {})
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([type, count]) => (
                    <BreakdownRow key={type} color="#a78bfa" label={type} count={count} />
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Nature */}
      {enabledLayers.nature && (
        <div style={sec}>
          <SectionHeader color="#34d399" label="Nature" />
          <StatusRow loading={osmLoading} error={osmError} />
          {osm && !osmLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { label: 'Natural',   color: '#34d399', count: osm.counts.natural },
                { label: 'Land use',  color: '#6ee7b7', count: osm.counts.landuse },
                { label: 'Leisure',   color: '#86efac', count: osm.counts.leisure },
                { label: 'Waterways', color: '#38bdf8', count: osm.counts.waterway },
                { label: 'Roads',     color: '#f97316', count: osm.counts.roads },
              ].filter((r) => r.count > 0).map((r) => (
                <BreakdownRow key={r.label} color={r.color} label={r.label} count={r.count} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Elevation */}
      {enabledLayers.elevation && (
        <div style={sec}>
          <SectionHeader color="#facc15" label="Elevation" />
          <StatusRow loading={elevLoading} error={elevError} />
          {elevation && !elevLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                { label: 'Min',   value: `${Math.round(elevation.stats.min)}m`,   color: '#0ea5e9' },
                { label: 'Max',   value: `${Math.round(elevation.stats.max)}m`,   color: '#ef4444' },
                { label: 'Mean',  value: `${Math.round(elevation.stats.mean)}m`,  color: '#34d399' },
                { label: 'Range', value: `${Math.round(elevation.stats.range)}m`, color: '#facc15' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '7px 8px', textAlign: 'center',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ fontSize: 9, color: '#475569', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 'bold', color, fontFamily: 'monospace' }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
