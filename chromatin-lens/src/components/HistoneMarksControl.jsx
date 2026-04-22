import React from 'react';
import { HISTONE_MARKS } from '../data/locus';
import { getActiveScale } from '../scenes/ScaleController';

// Appears only on the Nucleosome level. Lets the user paint a histone-tail
// modification onto every nucleosome to see what that mark looks like.
export default function HistoneMarksControl({ zoom, markId, onMarkChange, isMobile }) {
  const active = getActiveScale(zoom);
  if (active.id !== 'nucleosomes') return null;

  const mark = HISTONE_MARKS.find(m => m.id === markId) || HISTONE_MARKS[0];

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

  return (
    <div style={{
      ...containerStyle,
      background: 'rgba(12, 18, 32, 0.88)',
      borderRadius: 10,
      border: '1px solid rgba(232, 121, 166, 0.30)',
      color: '#e5e7eb',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 12,
      backdropFilter: 'blur(4px)',
      userSelect: 'none',
      zIndex: 1
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#f9a8d4', fontWeight: 600 }}>
          Histone marks
        </span>
        <span style={{ color: '#6b7280' }}>· paint the tails</span>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {HISTONE_MARKS.map((m) => {
          const isActive = m.id === markId;
          return (
            <button
              key={m.id}
              onClick={() => onMarkChange(m.id)}
              title={m.label}
              style={{
                flex: isMobile ? '1 1 calc(33.333% - 4px)' : '1 0 auto',
                minHeight: isMobile ? 40 : 'auto',
                padding: '6px 10px',
                borderRadius: 5,
                background: isActive
                  ? `rgba(${hexToRgb(m.color)}, 0.18)`
                  : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isActive ? m.color : 'rgba(255,255,255,0.1)'}`,
                color: isActive ? m.color : '#cbd5e1',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                letterSpacing: 0.3,
                textAlign: 'center',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
              aria-pressed={isActive}
            >
              {m.id !== 'none' && (
                <span style={{
                  display: 'inline-block',
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: m.color,
                  boxShadow: isActive ? `0 0 4px ${m.color}` : 'none'
                }} />
              )}
              {m.label}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: '#d1d5db', lineHeight: 1.45 }}>
        {mark.description}
      </div>
    </div>
  );
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
