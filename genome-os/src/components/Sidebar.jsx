import React from 'react';
import { LOCUS, SCALES, PROVENANCE, INFO } from '../data/locus';
import { getActiveScale } from '../scenes/ScaleController';
import ScaleIcon, { LockIcon } from './ScaleIcon';
import ImagingPanel from './ImagingPanel';

function InfoCard({ info, onClose }) {
  return (
    <div style={{
      padding: '16px 18px',
      background: 'rgba(255, 217, 61, 0.06)',
      border: '1px solid rgba(255, 217, 61, 0.25)',
      borderRadius: 10,
      marginBottom: 20
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#ffd93d' }}>
            Selected
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4, color: '#fef3c7' }}>
            {info.title}
          </div>
          {info.subtitle && (
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              {info.subtitle}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#9ca3af',
            width: 32,
            height: 32,
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: 0,
            flexShrink: 0
          }}
          aria-label="Close details"
          title="Close (Esc)"
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 13, color: '#d1d5db', marginTop: 10, lineHeight: 1.6 }}>
        {info.body}
      </div>
    </div>
  );
}

// The shared body: all sections rendered the same on desktop and mobile.
function SidebarBody({ activeScale, scaleIndex, info, onCloseInfo, lockedScaleId, onJump, hideIntro }) {
  return (
    <>
      {!hideIntro && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: '#7aa2ff' }}>
            GenomeOS
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 6 }}>
            {LOCUS.name}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            {LOCUS.chromosome}:{LOCUS.start.toLocaleString()}–{LOCUS.end.toLocaleString()}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', marginBottom: 6 }}>
          Current view
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#ffd93d', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>{activeScale.name}</span>
          {activeScale.disputed && (
            <span style={{
              padding: '1px 7px',
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
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>
          {activeScale.sizeLabel} · {activeScale.bpRange}
        </div>
      </div>

      {info ? (
        <InfoCard info={info} onClose={onCloseInfo} />
      ) : (
        <div style={{ marginBottom: 24, padding: '14px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, borderLeft: '3px solid #7aa2ff' }}>
          <div style={{ fontSize: 13, color: '#d1d5db' }}>
            {activeScale.description}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 10, fontStyle: 'italic' }}>
            Tap any labeled element to learn more.
          </div>
        </div>
      )}

      <ImagingPanel scaleId={activeScale.id} />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', marginBottom: 10 }}>
          Scale progress
        </div>
        {SCALES.map((scale, i) => {
          const isActive = i === scaleIndex;
          const isLockedHere = lockedScaleId === scale.id;
          const borderColor = isLockedHere ? '#fde68a' : isActive ? '#7aa2ff' : 'transparent';
          const bg = isLockedHere
            ? 'rgba(253, 224, 71, 0.10)'
            : isActive ? 'rgba(122, 162, 255, 0.15)' : 'transparent';
          return (
            <button
              key={scale.id}
              onClick={() => onJump?.(scale)}
              title={`Jump to ${scale.name}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 10px',
                marginBottom: 4,
                width: '100%',
                minHeight: 48,
                borderRadius: 6,
                background: bg,
                borderLeft: `2px solid ${borderColor}`,
                borderRight: 'none',
                borderTop: 'none',
                borderBottom: 'none',
                color: isActive ? '#e5e7eb' : '#94a3b8',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                transition: 'background 0.15s ease'
              }}
            >
              <ScaleIcon id={scale.id} size={26} dim={!isActive} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: isActive ? 600 : 500 }}>
                  <span style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{i + 1}.</span>
                  <span style={{ color: isActive ? '#fef3c7' : '#cbd5e1' }}>{scale.name}</span>
                  {scale.disputed && (
                    <span style={{
                      padding: '0 5px',
                      fontSize: 8,
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      color: '#fca5a5',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(248, 113, 113, 0.4)',
                      borderRadius: 2,
                      fontWeight: 700
                    }}>
                      ?
                    </span>
                  )}
                  {isLockedHere && (
                    <span style={{ color: '#fde68a', display: 'inline-flex', alignItems: 'center' }}>
                      <LockIcon locked size={11} />
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>
                  {scale.sizeLabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', marginBottom: 8 }}>
          Data provenance
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          {PROVENANCE.map((p) => (
            <div key={p.key} style={{ marginBottom: 4 }}>
              <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{p.label}:</span>{' '}
              {p.url ? (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#93c5fd',
                    textDecoration: 'none',
                    borderBottom: '1px dotted rgba(147, 197, 253, 0.35)'
                  }}
                >
                  {p.text}
                </a>
              ) : (
                p.text
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 28, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        Prototype v0.1 · Pedagogical tool · Data representative of published sources
      </div>
    </>
  );
}

export default function Sidebar({
  zoom, selectedInfo, onCloseInfo, lockedScaleId, onJump,
  isMobile, open, onOpen, onClose
}) {
  const activeScale = getActiveScale(zoom);
  const scaleIndex = SCALES.findIndex(s => s.id === activeScale.id);
  const info = selectedInfo ? INFO[selectedInfo] : null;

  // -------- Mobile: compact top bar + optional bottom-sheet drawer --------
  if (isMobile) {
    return (
      <>
        <button
          onClick={onOpen}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            paddingTop: 'calc(10px + env(safe-area-inset-top))',
            background: 'rgba(12, 18, 32, 0.92)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            color: '#e5e7eb',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            zIndex: 2,
            backdropFilter: 'blur(4px)'
          }}
        >
          <ScaleIcon id={activeScale.id} size={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#7aa2ff' }}>
              GenomeOS · Level {scaleIndex + 1} / {SCALES.length}
            </div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#fef3c7',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {activeScale.name}
              {activeScale.disputed && (
                <span style={{
                  marginLeft: 6,
                  padding: '0 5px',
                  fontSize: 8,
                  textTransform: 'uppercase',
                  color: '#fca5a5',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(248, 113, 113, 0.4)',
                  borderRadius: 2,
                  fontWeight: 700,
                  verticalAlign: 'middle'
                }}>?</span>
              )}
            </div>
          </div>
          {info && (
            <span style={{
              fontSize: 10,
              padding: '3px 8px',
              background: 'rgba(255,217,61,0.15)',
              color: '#fde68a',
              borderRadius: 4,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase'
            }}>
              Info
            </span>
          )}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#9ca3af' }}>
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>

        {open && (
          <>
            <div
              onClick={onClose}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.55)',
                zIndex: 3,
                backdropFilter: 'blur(2px)'
              }}
            />
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              maxHeight: '88dvh',
              background: 'rgba(12, 18, 32, 0.98)',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              boxShadow: '0 -8px 30px rgba(0,0,0,0.5)',
              zIndex: 4,
              display: 'flex',
              flexDirection: 'column',
              color: '#e5e7eb',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: 14,
              lineHeight: 1.55
            }}>
              <div style={{ padding: '10px 0 4px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: 42, height: 4, background: '#4b5563', borderRadius: 2 }} />
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  position: 'absolute',
                  top: 10, right: 14,
                  width: 36, height: 36,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#e5e7eb',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 20,
                  lineHeight: 1,
                  padding: 0,
                  zIndex: 1
                }}
              >
                ×
              </button>
              <div style={{
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                padding: '6px 18px 24px',
                paddingBottom: 'calc(24px + env(safe-area-inset-bottom))'
              }}>
                <SidebarBody
                  activeScale={activeScale}
                  scaleIndex={scaleIndex}
                  info={info}
                  onCloseInfo={onCloseInfo}
                  lockedScaleId={lockedScaleId}
                  onJump={(s) => { onJump?.(s); }}
                />
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  // -------- Desktop: fixed right-side panel --------
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: 340,
      height: '100dvh',
      background: 'rgba(12, 18, 32, 0.92)',
      color: '#e5e7eb',
      padding: '24px 22px',
      boxSizing: 'border-box',
      overflowY: 'auto',
      borderLeft: '1px solid rgba(255,255,255,0.08)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 14,
      lineHeight: 1.55
    }}>
      <SidebarBody
        activeScale={activeScale}
        scaleIndex={scaleIndex}
        info={info}
        onCloseInfo={onCloseInfo}
        lockedScaleId={lockedScaleId}
        onJump={onJump}
      />
    </div>
  );
}
