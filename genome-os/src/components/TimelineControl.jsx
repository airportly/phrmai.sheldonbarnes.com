import React from 'react';
import { getActiveScale } from '../scenes/ScaleController';

// Small play / pause SVG glyphs
function PlayIcon({ playing, size = 14 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor' };
  return playing ? (
    <svg {...props}><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
  ) : (
    <svg {...props}><polygon points="7,5 7,19 19,12" /></svg>
  );
}

// A generic scale-scoped timeline scrubber.
// Also supports optional playback UI (play/pause + progress scrubber + detail toggle).
export default function TimelineControl({
  zoom,
  visibleOnScaleId,
  stages,
  stageId,
  onStageChange,
  label = 'Timeline',
  sublabel,
  accentColor = '#fde68a',
  accentBorder = 'rgba(255, 217, 61, 0.28)',
  accentHighlight = 'rgba(255, 217, 61, 0.55)',
  accentHighlightBg = 'rgba(255, 217, 61, 0.16)',
  topOffsetDesktop = 20,
  isMobile,
  // Optional playback API
  playable,
  playing,
  onPlayToggle,
  progress,
  onProgressChange,
  progressMax = 3,
  detailLevel,
  onDetailChange,
}) {
  const active = getActiveScale(zoom);
  if (active.id !== visibleOnScaleId) return null;

  const stage = stages.find(s => s.id === stageId) || stages[0];

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
        top: topOffsetDesktop,
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
      border: `1px solid ${accentBorder}`,
      color: '#e5e7eb',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 12,
      backdropFilter: 'blur(4px)',
      userSelect: 'none',
      zIndex: 1
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: accentColor, fontWeight: 600 }}>
          {label}
        </span>
        {sublabel && <span style={{ color: '#6b7280' }}>· {sublabel}</span>}

        {playable && (
          <>
            <div style={{ flex: 1 }} />
            {onDetailChange && (
              <div style={{
                display: 'inline-flex',
                gap: 0,
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.12)',
                overflow: 'hidden'
              }}>
                {['instant', 'mid', 'full'].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => onDetailChange(lvl)}
                    title={lvl === 'instant' ? 'Hard stage jumps' : lvl === 'mid' ? 'Cross-fade transitions' : 'Continuous interpolation'}
                    style={{
                      padding: '3px 8px',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      fontWeight: 600,
                      background: detailLevel === lvl ? accentHighlightBg : 'transparent',
                      color: detailLevel === lvl ? accentColor : '#94a3b8',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {stages.map((s) => {
          const isActive = s.id === stageId;
          return (
            <button
              key={s.id}
              onClick={() => onStageChange?.(s.id)}
              style={{
                flex: 1,
                minHeight: isMobile ? 44 : 'auto',
                padding: isMobile ? '8px 6px' : '7px 8px',
                borderRadius: 6,
                background: isActive ? accentHighlightBg : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isActive ? accentHighlight : 'rgba(255,255,255,0.08)'}`,
                color: isActive ? accentColor : '#cbd5e1',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                letterSpacing: 0.3,
                textAlign: 'center',
                lineHeight: 1.25
              }}
              aria-pressed={isActive}
            >
              <div>{s.label}</div>
              <div style={{
                fontSize: 9,
                marginTop: 2,
                color: isActive ? accentColor : '#6b7280',
                opacity: isActive ? 0.85 : 1,
                fontWeight: 500,
                letterSpacing: 0.2
              }}>
                {s.timeframe}
              </div>
            </button>
          );
        })}
      </div>

      {playable && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 8,
          padding: '4px 2px'
        }}>
          <button
            onClick={onPlayToggle}
            aria-label={playing ? 'Pause' : 'Play'}
            title={playing ? 'Pause' : (progress >= progressMax ? 'Replay from start' : 'Play')}
            style={{
              width: isMobile ? 36 : 30,
              height: isMobile ? 36 : 30,
              borderRadius: 6,
              border: `1px solid ${accentHighlight}`,
              background: accentHighlightBg,
              color: accentColor,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <PlayIcon playing={playing} size={isMobile ? 16 : 14} />
          </button>
          <input
            type="range"
            min={0}
            max={progressMax}
            step={0.001}
            value={progress}
            onChange={(e) => onProgressChange?.(parseFloat(e.target.value))}
            style={{
              flex: 1,
              accentColor
            }}
            aria-label="Mitosis progress"
          />
          <span style={{ fontSize: 10, color: '#9ca3af', fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'right' }}>
            {(progress / progressMax * 100).toFixed(0)}%
          </span>
        </div>
      )}

      <div style={{
        marginTop: 8,
        fontSize: 11,
        color: '#d1d5db',
        lineHeight: 1.45
      }}>
        {stage.summary}
      </div>
    </div>
  );
}
