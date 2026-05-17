import { T, Led } from "../../ui/tactical";

const LAYERS = [
  { id: 'cellTowers',     label: 'Cell Towers',    color: '#ef4444', description: 'Mobile masts (OSM)' },
  { id: 'roads',          label: 'Roads',           color: '#3b82f6', description: 'Road network (OSM)' },
  { id: 'bridges',        label: 'Bridges',         color: '#f97316', description: 'Bridges with max weight (OSM)' },
  { id: 'infrastructure', label: 'Infrastructure',  color: '#fbbf24', description: 'Dams, power plants, hospitals, factories, water supply (OSM)' },
  { id: 'military',       label: 'Military',        color: '#6b7c3e', description: 'Bases, bunkers, airfields, checkpoints, ammo depots (OSM)' },
  { id: 'buildings',      label: 'Buildings',       color: '#a78bfa', description: 'Building footprints (OSM)' },
  { id: 'nature',         label: 'Nature',          color: '#34d399', description: 'Landcover, waterways, parks (OSM)' },
  { id: 'elevation',      label: 'Elevation',       color: '#facc15', description: 'Elevation heatmap & contours' },
  { id: 'population',    label: 'Population',      color: '#f97316', description: 'Population density grid (Tilastokeskus 2022 / OSM)' },
];

export function LayerPanel({ enabledLayers, onToggle, onToggleAll }) {
  const allOn = LAYERS.every((l) => enabledLayers[l.id]);
  const enabledCount = LAYERS.filter((l) => enabledLayers[l.id]).length;

  return (
    <div style={{
      background: T.bgInset,
      border: `1px solid ${T.borderDim}`,
      borderRadius: T.radius,
      padding: '8px 9px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <span style={{
          fontFamily: T.mono, fontSize: 9, fontWeight: 700,
          letterSpacing: '0.20em', color: T.textDim,
          textTransform: 'uppercase',
        }}>
          OVERLAYS · {enabledCount}/{LAYERS.length}
        </span>
        <button
          onClick={onToggleAll}
          style={{
            fontFamily: T.mono, fontSize: 9, letterSpacing: '0.14em',
            padding: '2px 8px', borderRadius: T.radius,
            border: `1px solid ${T.borderDim}`,
            background: 'transparent',
            color: T.textDim, cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          {allOn ? 'ALL OFF' : 'ALL ON'}
        </button>
      </div>

      {LAYERS.map((layer) => {
        const enabled = enabledLayers[layer.id];
        return (
          <button
            key={layer.id}
            onClick={() => onToggle(layer.id)}
            title={layer.description}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 7px',
              border: `1px solid ${enabled ? T.borderDim : 'transparent'}`,
              background: enabled ? T.bgInset : 'transparent',
              cursor: 'pointer', textAlign: 'left',
              opacity: enabled ? 1 : 0.5,
              transition: 'all 0.12s',
              borderRadius: T.radius,
            }}
          >
            <Led color={enabled ? layer.color : "#2a3a2a"} size={6} />
            <span style={{
              flex: 1, fontFamily: T.mono, fontSize: 11,
              color: enabled ? T.text : T.textMute,
              letterSpacing: '0.04em',
            }}>
              {layer.label}
            </span>
            <span style={{
              fontFamily: T.mono, fontSize: 9,
              letterSpacing: '0.16em',
              color: enabled ? T.accent : T.textMute,
            }}>
              {enabled ? '◉' : '◯'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
