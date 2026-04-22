import React from 'react';
import { ALT_FORMS } from '../data/locus';
import { getActiveScale } from '../scenes/ScaleController';

function PlayIcon({ playing, size = 12 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor' };
  return playing ? (
    <svg {...props}><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
  ) : (
    <svg {...props}><polygon points="7,5 7,19 19,12" /></svg>
  );
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// Visible only on Helix level. Two stories:
//   - DNA replication (play/scrub a fork moving along the helix)
//   - Alternative DNA forms (B / Z / G-quadruplex / R-loop)
export default function DnaDynamicsControl({
  zoom,
  replicationProgress,
  replicationPlaying,
  onReplicationPlayToggle,
  onReplicationChange,
  altFormId,
  onAltFormChange,
  isMobile
}) {
  const active = getActiveScale(zoom);
  if (active.id !== 'helix') return null;

  const containerStyle = isMobile
    ? {
        position: 'absolute',
        top: 'calc(70px + env(safe-area-inset-top))',
        left: 10,
        right: 10,
        padding: '10px 12px'
      }
    : {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 360,
        maxWidth: 560,
        padding: '10px 14px'
      };

  const fullyReplicated = replicationProgress >= 0.999;
  const currentForm = ALT_FORMS.find(f => f.id === altFormId) || ALT_FORMS[0];

  return (
    <div style={{
      ...containerStyle,
      background: 'rgba(12, 18, 32, 0.88)',
      borderRadius: 10,
      border: '1px solid rgba(251, 146, 60, 0.30)',
      color: '#e5e7eb',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 12,
      backdropFilter: 'blur(4px)',
      userSelect: 'none',
      zIndex: 1
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#fdba74', fontWeight: 600 }}>
          DNA dynamics
        </span>
        <span style={{ color: '#6b7280' }}>· replication & folding</span>
      </div>

      {/* Replication fork — play + scrub */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => {
            if (fullyReplicated) onReplicationChange(0);
            onReplicationPlayToggle();
          }}
          title={replicationPlaying ? 'Pause replication' : (fullyReplicated ? 'Replay from origin' : 'Play replication')}
          style={{
            width: isMobile ? 36 : 30,
            height: isMobile ? 36 : 30,
            borderRadius: 6,
            border: '1px solid rgba(251, 146, 60, 0.55)',
            background: 'rgba(251, 146, 60, 0.14)',
            color: '#fdba74',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <PlayIcon playing={replicationPlaying} size={isMobile ? 15 : 12} />
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, color: '#fdba74', fontWeight: 500, minWidth: 90 }}>
            Replication fork
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={replicationProgress}
            onChange={(e) => onReplicationChange(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#fb923c' }}
            aria-label="Replication progress"
          />
          <span style={{ fontSize: 10, color: '#9ca3af', fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'right' }}>
            {Math.round(replicationProgress * 100)}%
          </span>
        </div>
      </div>

      {/* Alt-form picker */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {ALT_FORMS.map((f) => {
          const isActive = f.id === altFormId;
          return (
            <button
              key={f.id}
              onClick={() => onAltFormChange(f.id)}
              title={f.label}
              style={{
                flex: isMobile ? '1 1 calc(50% - 4px)' : '1 0 auto',
                minHeight: isMobile ? 40 : 'auto',
                padding: '6px 10px',
                borderRadius: 5,
                background: isActive
                  ? `rgba(${hexToRgb(f.color)}, 0.18)`
                  : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isActive ? f.color : 'rgba(255,255,255,0.1)'}`,
                color: isActive ? f.color : '#cbd5e1',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                letterSpacing: 0.3,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
              aria-pressed={isActive}
            >
              <span style={{
                display: 'inline-block',
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: f.color,
                boxShadow: isActive ? `0 0 4px ${f.color}` : 'none'
              }} />
              {f.label}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: '#d1d5db', lineHeight: 1.45 }}>
        {currentForm.description}
      </div>
    </div>
  );
}
