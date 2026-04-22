import React from 'react';
import { getActiveScale } from '../scenes/ScaleController';

function PlayIcon({ playing, size = 12 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor' };
  return playing ? (
    <svg {...props}><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
  ) : (
    <svg {...props}><polygon points="7,5 7,19 19,12" /></svg>
  );
}

// Appears only on the Loop level. Two independent dynamic stories:
//   - Cohesin loop extrusion (play/scrub)
//   - Transcription burst at HBB (toggle)
export default function LoopDynamicsControl({
  zoom,
  extrusionProgress,
  extrusionPlaying,
  onExtrusionPlayToggle,
  onExtrusionChange,
  transcribing,
  onTranscribeToggle,
  isMobile,
  topOffsetDesktop = 170
}) {
  const active = getActiveScale(zoom);
  if (active.id !== 'loop') return null;

  const containerStyle = isMobile
    ? {
        position: 'absolute',
        top: 'calc(210px + env(safe-area-inset-top))',
        left: 10,
        right: 10,
        padding: '10px 12px'
      }
    : {
        position: 'absolute',
        top: topOffsetDesktop,
        left: 20,
        right: 360,
        maxWidth: 560,
        padding: '10px 14px'
      };

  const fullyExtruded = extrusionProgress >= 0.999;

  return (
    <div style={{
      ...containerStyle,
      background: 'rgba(12, 18, 32, 0.88)',
      borderRadius: 10,
      border: '1px solid rgba(192, 132, 252, 0.30)',
      color: '#e5e7eb',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 12,
      backdropFilter: 'blur(4px)',
      userSelect: 'none',
      zIndex: 1
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#d8b4fe', fontWeight: 600 }}>
          Loop dynamics
        </span>
        <span style={{ color: '#6b7280' }}>· extrusion & transcription</span>
      </div>

      {/* Cohesin extrusion */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => {
            // If at the end, restart
            if (fullyExtruded) onExtrusionChange(0);
            onExtrusionPlayToggle();
          }}
          title={extrusionPlaying ? 'Pause extrusion' : (fullyExtruded ? 'Replay extrusion from scratch' : 'Play cohesin extrusion')}
          style={{
            width: isMobile ? 36 : 30,
            height: isMobile ? 36 : 30,
            borderRadius: 6,
            border: '1px solid rgba(192, 132, 252, 0.55)',
            background: 'rgba(192, 132, 252, 0.14)',
            color: '#d8b4fe',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <PlayIcon playing={extrusionPlaying} size={isMobile ? 15 : 12} />
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, color: '#d8b4fe', fontWeight: 500, minWidth: 70 }}>
            Loop extrusion
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={extrusionProgress}
            onChange={(e) => onExtrusionChange(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#c084fc' }}
            aria-label="Extrusion progress"
          />
          <span style={{ fontSize: 10, color: '#9ca3af', fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'right' }}>
            {Math.round(extrusionProgress * 100)}%
          </span>
        </div>
      </div>

      {/* Transcription toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onTranscribeToggle}
          style={{
            padding: isMobile ? '8px 12px' : '6px 12px',
            minHeight: isMobile ? 40 : 'auto',
            borderRadius: 6,
            border: `1px solid ${transcribing ? 'rgba(244, 114, 182, 0.55)' : 'rgba(255,255,255,0.12)'}`,
            background: transcribing ? 'rgba(244, 114, 182, 0.14)' : 'rgba(255,255,255,0.04)',
            color: transcribing ? '#f9a8d4' : '#cbd5e1',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.3,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
          aria-pressed={transcribing}
        >
          <span style={{ fontSize: 13 }}>{transcribing ? '⏸' : '⚡'}</span>
          {transcribing ? 'Transcribing' : 'Transcribe HBB'}
        </button>
        <div style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.35, flex: 1 }}>
          {transcribing
            ? 'Pol II loads at HBB, traverses the gene, emits nascent mRNA, repeats.'
            : 'Toggle to watch RNA polymerase II transcribe the HBB gene.'}
        </div>
      </div>
    </div>
  );
}
