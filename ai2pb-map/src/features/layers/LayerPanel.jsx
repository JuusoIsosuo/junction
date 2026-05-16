const LAYERS = [
  { id: 'cellTowers', label: 'Cell Towers', color: '#10b981', description: 'Mobile masts (OSM)' },
  { id: 'roads',      label: 'Roads',       color: '#3b82f6', description: 'Road network (OSM)' },
];

export function LayerPanel({ enabledLayers, onToggle }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.82)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8,
      padding: '10px 12px',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
      minWidth: 180,
    }}>
      <div style={{
        fontFamily: 'monospace',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.15em',
        color: '#4b5563',
        textTransform: 'uppercase',
        marginBottom: 3,
      }}>
        Layers
      </div>
      {LAYERS.map((layer) => {
        const enabled = enabledLayers[layer.id];
        return (
          <button
            key={layer.id}
            onClick={() => onToggle(layer.id)}
            title={layer.description}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 8px',
              borderRadius: 3,
              border: `1px solid ${enabled ? 'rgba(255,255,255,0.08)' : 'transparent'}`,
              background: enabled ? 'rgba(255,255,255,0.04)' : 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              opacity: enabled ? 1 : 0.45,
              transition: 'all 0.15s',
            }}
          >
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              flexShrink: 0,
              background: enabled ? layer.color : '#374151',
              transition: 'background 0.15s',
            }} />
            <span style={{ flex: 1, fontSize: 12, color: '#d1d5db', fontFamily: 'Arial' }}>
              {layer.label}
            </span>
            <span style={{
              fontFamily: 'monospace',
              fontSize: 9,
              letterSpacing: '0.1em',
              color: enabled ? '#6b7280' : '#4b5563',
            }}>
              {enabled ? 'ON' : 'OFF'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
