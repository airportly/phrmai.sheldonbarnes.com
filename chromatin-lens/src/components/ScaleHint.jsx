import React from 'react';
import { SCALES } from '../data/locus';
import { getActiveScale } from '../scenes/ScaleController';
import ScaleIcon, { LockIcon } from './ScaleIcon';

export default function ScaleHint({ zoom, onJump, lockedScaleId, onToggleLock, onTourLevel, isMobile }) {
  const active = getActiveScale(zoom);
  const idx = SCALES.findIndex(s => s.id === active.id);
  const isLocked = !!lockedScaleId;

  // Mobile: full-width bar at the bottom, no sidebar inset.
  const containerStyle = isMobile
    ? {
        position: 'absolute',
        bottom: 'calc(10px + env(safe-area-inset-bottom))',
        left: 10,
        right: 10,
        padding: '10px 12px'
      }
    : {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 360,
        maxWidth: 740,
        padding: '10px 14px'
      };

  return (
    <div style={{
      ...containerStyle,
      background: 'rgba(12, 18, 32, 0.88)',
      borderRadius: 10,
      border: `1px solid ${isLocked ? 'rgba(255, 217, 61, 0.35)' : 'rgba(255,255,255,0.08)'}`,
      color: '#e5e7eb',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 12,
      backdropFilter: 'blur(4px)',
      userSelect: 'none',
      zIndex: 1
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <ScaleIcon id={active.id} size={isMobile ? 20 : 22} />
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af' }}>
          {idx + 1} / {SCALES.length}
        </span>
        <span style={{
          color: '#ffd93d',
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: isMobile ? 1 : undefined,
          minWidth: 0
        }}>
          {active.name}
        </span>
        {!isMobile && <span style={{ color: '#6b7280' }}>· {active.sizeLabel}</span>}
        {active.disputed && (
          <span style={{
            padding: '1px 6px',
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            color: '#fca5a5',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(248, 113, 113, 0.45)',
            borderRadius: 3,
            fontWeight: 600
          }}>
            Disputed
          </span>
        )}

        {!isMobile && <div style={{ flex: 1 }} />}

        {onTourLevel && (
          <button
            onClick={onTourLevel}
            title="Play a narrated tour of this level"
            aria-label="Tour this level"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              width: isMobile ? 44 : 30,
              height: isMobile ? 44 : 26,
              color: '#fde68a',
              background: 'rgba(255, 217, 61, 0.14)',
              border: '1px solid rgba(255, 217, 61, 0.45)',
              borderRadius: 5,
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <svg width={isMobile ? 17 : 13} height={isMobile ? 17 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
          </button>
        )}

        <button
          onClick={onToggleLock}
          title={isLocked ? 'Unlock (L)' : 'Lock level (L)'}
          aria-label={isLocked ? 'Unlock level' : 'Lock level'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: isMobile ? '6px 9px' : '4px 9px',
            minWidth: isMobile ? 44 : undefined,
            minHeight: isMobile ? 44 : undefined,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: isLocked ? '#fde68a' : '#cbd5e1',
            background: isLocked ? 'rgba(255, 217, 61, 0.16)' : 'rgba(255, 255, 255, 0.06)',
            border: `1px solid ${isLocked ? 'rgba(255, 217, 61, 0.55)' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: 5,
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <LockIcon locked={isLocked} size={13} />
          {!isMobile && (isLocked ? 'Locked' : 'Lock level')}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {SCALES.map((s, i) => {
          const isActive = i === idx;
          const isBefore = i < idx;
          const lockedHere = isLocked && s.id === lockedScaleId;
          return (
            <button
              key={s.id}
              onClick={() => onJump(s)}
              style={{
                position: 'relative',
                height: isMobile ? 16 : 10,
                flex: 1,
                minWidth: 20,
                border: s.disputed ? '1px dashed rgba(248, 113, 113, 0.6)' : 'none',
                borderRadius: 3,
                cursor: 'pointer',
                background: isActive
                  ? (lockedHere ? '#fde68a' : s.disputed ? '#f87171' : '#7aa2ff')
                  : isBefore ? 'rgba(122,162,255,0.4)' : 'rgba(255,255,255,0.12)',
                outline: lockedHere ? '2px solid rgba(253, 224, 71, 0.5)' : 'none',
                outlineOffset: lockedHere ? 2 : 0,
                padding: 0
              }}
              title={`${i + 1}. ${s.name}${s.disputed ? ' (disputed)' : ''}`}
              aria-label={`Jump to level ${i + 1}: ${s.name}`}
            />
          );
        })}
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: '#9ca3af', lineHeight: 1.4 }}>
        {isMobile
          ? (isLocked
              ? 'Pinch for fine zoom within this level'
              : 'Pinch to zoom · tap a segment to jump · tap element for info')
          : (isLocked
              ? 'Locked · wheel gives fine control inside this level · unlock or pick another level to zoom across'
              : 'Scroll to zoom across levels · click a segment to jump · lock to fine-tune within one level')}
      </div>
    </div>
  );
}
