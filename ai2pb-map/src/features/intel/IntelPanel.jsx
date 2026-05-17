import { RADIO_COLORS } from "../cellTowers/cellTowerLayer";
import { INFRA_TYPE_CONFIG } from "../../services/infrastructureService";
import { MILITARY_TYPE_CONFIG } from "../../services/militaryService";
import { AGE_GROUPS } from "../../services/populationService";
import {
  T, Panel, PanelHeader, SectionHeader, StatusRow,
  BigNum, BreakdownRow, sectionStyle, Stat, Led,
} from "../../ui/tactical";

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

function GenderBar({ male, female }) {
  const total = male + female;
  const malePct = total > 0 ? (male / total) * 100 : 50;
  const femalePct = 100 - malePct;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {[
        { label: 'MALE',   count: male,   pct: malePct,   color: T.accentCool },
        { label: 'FEMALE', count: female, pct: femalePct, color: '#f472b6' },
      ].map(({ label, count, pct, color }) => (
        <div key={label}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: T.mono, fontSize: 10, color: T.textDim, marginBottom: 2,
            letterSpacing: '0.10em',
          }}>
            <span>{label}</span>
            <span>{count.toLocaleString()} <span style={{ color: T.textMute }}>({pct.toFixed(1)}%)</span></span>
          </div>
          <div style={{ height: 4, background: 'rgba(140,200,160,0.08)', overflow: 'hidden', borderRadius: 1 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.4s' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AgeBar({ group, count, share, color, maxShare }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{
        fontFamily: T.mono, fontSize: 10, color: T.textMute,
        width: 40, flexShrink: 0, letterSpacing: '0.05em',
      }}>
        {group}
      </span>
      <div style={{ flex: 1, height: 4, background: 'rgba(140,200,160,0.08)', overflow: 'hidden', borderRadius: 1 }}>
        <div style={{
          height: '100%', background: color,
          width: `${(share / maxShare) * 100}%`,
          transition: 'width 0.4s',
        }} />
      </div>
      <span style={{
        fontFamily: T.mono, fontSize: 10, color: T.textDim,
        width: 44, textAlign: 'right', flexShrink: 0,
      }}>
        {count.toLocaleString()}
      </span>
    </div>
  );
}

export function IntelPanel({
  towers, towersLoading, towersError,
  roads, roadsLoading, roadsError,
  bridges, bridgesLoading, bridgesError,
  infrastructure, infraLoading, infraError,
  military, militaryLoading, militaryError,
  osm, osmLoading, osmError,
  elevation, elevLoading, elevError,
  population, popLoading, popError,
  enabledLayers,
}) {
  const anyEnabled = Object.values(enabledLayers).some(Boolean);
  if (!anyEnabled && !population && !popLoading && !popError) return null;

  const radioCounts = {};
  towers?.towers.forEach((t) => { radioCounts[t.radio] = (radioCounts[t.radio] ?? 0) + 1; });

  return (
    <Panel
      style={{
        position: 'absolute', top: 20, right: 20,
        width: 280, zIndex: 5,
        maxHeight: 'calc(100vh - 80px)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <PanelHeader
        title="S2 · INT SITREP"
        callsign="MULTI-INT"
        badge={<Led color={T.accent} pulse={false} />}
      />

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {/* Population — HUMINT */}
        {(popLoading || popError || population) && (
          <div style={sectionStyle}>
            <SectionHeader color="#e879f9" label="HUMINT · POPULATION" />
            <StatusRow loading={popLoading} error={popError} />
            {population && !popLoading && (
              <>
                <BigNum value={population.total} unit="CIVILIANS" color="#f3d4ff" />
                <GenderBar male={population.male} female={population.female} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  <div style={{
                    fontFamily: T.mono, fontSize: 9, color: T.textMute,
                    letterSpacing: '0.18em', textTransform: 'uppercase',
                  }}>
                    AGE COHORTS
                  </div>
                  {(() => {
                    const maxShare = Math.max(...AGE_GROUPS.map((g) => g.share));
                    return population.ageGroups.map(({ group, count, share, color }) => (
                      <AgeBar key={group} group={group} count={count} share={share} color={color} maxShare={maxShare} />
                    ));
                  })()}
                </div>
                <div style={{
                  fontFamily: T.mono, fontSize: 9, color: T.textMute,
                  letterSpacing: '0.08em',
                }}>
                  SRC · {population.source} · TILASTOKESKUS 2023
                </div>
              </>
            )}
          </div>
        )}

        {/* Cell Towers — SIGINT */}
        {enabledLayers.cellTowers && (
          <div style={sectionStyle}>
            <SectionHeader color="#10b981" label="SIGINT · COMMS RELAY" />
            <StatusRow loading={towersLoading} error={towersError} />
            {towers && !towersLoading && (
              <>
                <BigNum value={towers.count} unit="MASTS" color={T.ok} />
                {Object.keys(radioCounts).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {Object.entries(radioCounts).map(([radio, count]) => (
                      <BreakdownRow key={radio} color={RADIO_COLORS[radio] ?? T.textMute} label={radio.toUpperCase()} count={count} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Roads — MSR / LOC */}
        {enabledLayers.roads && (
          <div style={sectionStyle}>
            <SectionHeader color="#5db8ff" label="MSR · ROUTES" />
            <StatusRow loading={roadsLoading} error={roadsError} />
            {roads && !roadsLoading && (
              <>
                <BigNum value={roads.geojson.features.length} unit="SEGMENTS" color={T.accentCool} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Object.entries(roads.counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([type, count]) => (
                    <BreakdownRow key={type} color={ROAD_COLORS[type] ?? T.textMute} label={type.toUpperCase()} count={count} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Bridges — Choke points */}
        {enabledLayers.bridges && (
          <div style={sectionStyle}>
            <SectionHeader color="#f59e0b" label="CHOKE-PTS · BRIDGES" />
            <StatusRow loading={bridgesLoading} error={bridgesError} />
            {bridges && !bridgesLoading && (
              <>
                <BigNum value={bridges.count} unit="CROSSINGS" color={T.accentHot} />
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, letterSpacing: '0.04em', lineHeight: 1.5 }}>
                  // SELECT ASSET ON DISPLAY FOR LOAD-LIMITS &amp; DETAILS
                </div>
              </>
            )}
          </div>
        )}

        {/* Infrastructure — HVT */}
        {enabledLayers.infrastructure && (
          <div style={sectionStyle}>
            <SectionHeader color="#fbbf24" label="INFRA · HVT" />
            <StatusRow loading={infraLoading} error={infraError} />
            {infrastructure && !infraLoading && (
              <>
                <BigNum value={infrastructure.count} unit="SITES" color={T.warn} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Object.entries(infrastructure.typeCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => {
                      const cfg = INFRA_TYPE_CONFIG[type];
                      return (
                        <BreakdownRow
                          key={type}
                          color={cfg?.color ?? T.textMute}
                          label={(cfg?.label ?? type).toUpperCase()}
                          count={count}
                        />
                      );
                    })}
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, letterSpacing: '0.04em' }}>
                  // SELECT SITE ON DISPLAY FOR DETAILS
                </div>
              </>
            )}
          </div>
        )}

        {/* Military — MIL OBJ */}
        {enabledLayers.military && (
          <div style={sectionStyle}>
            <SectionHeader color="#6b7c3e" label="MIL · OBJECTIVES" />
            <StatusRow loading={militaryLoading} error={militaryError} />
            {military && !militaryLoading && (
              <>
                <BigNum value={military.count} unit="MIL SITES" color="#a3b870" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Object.entries(military.typeCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => {
                      const cfg = MILITARY_TYPE_CONFIG[type];
                      return (
                        <BreakdownRow
                          key={type}
                          color={cfg?.color ?? T.textMute}
                          label={(cfg?.label ?? type).toUpperCase()}
                          count={count}
                        />
                      );
                    })}
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, letterSpacing: '0.04em' }}>
                  // SELECT SITE ON DISPLAY FOR DETAILS
                </div>
              </>
            )}
          </div>
        )}

        {/* Buildings — STRUCT */}
        {enabledLayers.buildings && (
          <div style={sectionStyle}>
            <SectionHeader color="#a78bfa" label="STRUCT · BUILDINGS" />
            <StatusRow loading={osmLoading} error={osmError} />
            {osm && !osmLoading && (
              <>
                <BigNum value={osm.counts.buildings} unit="FOOTPRINTS" color={T.violet} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Object.entries(osm.counts.buildingTypes ?? {})
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([type, count]) => (
                      <BreakdownRow key={type} color={T.violet} label={type.toUpperCase()} count={count} />
                    ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Nature — TERRAIN COVER */}
        {enabledLayers.nature && (
          <div style={sectionStyle}>
            <SectionHeader color="#34d399" label="TERRAIN · COVER" />
            <StatusRow loading={osmLoading} error={osmError} />
            {osm && !osmLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { label: 'NATURAL',   color: '#34d399', count: osm.counts.natural },
                  { label: 'LANDUSE',   color: '#6ee7b7', count: osm.counts.landuse },
                  { label: 'LEISURE',   color: '#86efac', count: osm.counts.leisure },
                  { label: 'WATERWAYS', color: '#38bdf8', count: osm.counts.waterway },
                  { label: 'ROAD-NET',  color: '#f97316', count: osm.counts.roads },
                ].filter((r) => r.count > 0).map((r) => (
                  <BreakdownRow key={r.label} color={r.color} label={r.label} count={r.count} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Elevation — TOPO */}
        {enabledLayers.elevation && (
          <div style={sectionStyle}>
            <SectionHeader color="#facc15" label="TOPO · ELEVATION" />
            <StatusRow loading={elevLoading} error={elevError} />
            {elevation && !elevLoading && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <Stat label="MIN"   value={`${Math.round(elevation.stats.min)}M`}   color="#0ea5e9" />
                <Stat label="MAX"   value={`${Math.round(elevation.stats.max)}M`}   color={T.hostile} />
                <Stat label="MEAN"  value={`${Math.round(elevation.stats.mean)}M`}  color={T.ok} />
                <Stat label="RANGE" value={`${Math.round(elevation.stats.range)}M`} color={T.warn} />
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
