import React, { useState, useEffect, useRef } from 'react';
import { TOUR_STEPS } from '../data/tour';

// Browser-native TTS via Web Speech API. Free, no hosting, no external deps.
// iOS Safari: the first speak() needs a user gesture — satisfied by the Start button.

function useVoices() {
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);
  return voices;
}

function pickDefaultVoice(voices) {
  if (!voices.length) return null;
  const byName = (needle) => voices.find(v => v.name && v.name.toLowerCase().includes(needle));
  return (
    byName('samantha') ||
    byName('karen') ||
    byName('google us english') ||
    voices.find(v => v.lang === 'en-US' && v.default) ||
    voices.find(v => v.lang === 'en-US') ||
    voices.find(v => v.lang && v.lang.startsWith('en')) ||
    voices[0]
  );
}

function IconPlay({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="7,5 7,19 19,12" /></svg>;
}
function IconPause({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>;
}
function IconPrev({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="17,5 9,12 17,19" /><rect x="5" y="5" width="2" height="14" /></svg>;
}
function IconNext({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="7,5 15,12 7,19" /><rect x="17" y="5" width="2" height="14" /></svg>;
}
function IconHeadphones({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}

export default function AudioTourControl({
  applyState,
  active,
  onActiveChange,
  isMobile,
  // Which steps to play. Defaults to the full TOUR_STEPS; callers can pass a
  // filtered list to run a subset (e.g. just the current level).
  steps,
  // Short label shown in the active bar header (e.g. "Audio tour" or "Tour · Loop").
  label = 'Audio tour'
}) {
  const stepList = steps && steps.length > 0 ? steps : TOUR_STEPS;
  const [stepIdx, setStepIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const voices = useVoices();
  const [voiceURI, setVoiceURI] = useState(null);
  const advanceTimerRef = useRef(null);
  const currentStepRef = useRef(null);

  useEffect(() => {
    if (voices.length && !voiceURI) {
      const d = pickDefaultVoice(voices);
      if (d) setVoiceURI(d.voiceURI);
    }
  }, [voices, voiceURI]);

  // If the list of steps we're driving changes (e.g. full → level tour),
  // reset the step index so we start at the top of the new list.
  useEffect(() => {
    setStepIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepList]);

  const cleanup = () => {
    try { window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  const speakStep = (idx) => {
    const step = stepList[idx];
    if (!step) return;
    currentStepRef.current = step;
    if (step.state) applyState(step.state);

    cleanup();

    const u = new SpeechSynthesisUtterance(step.narration);
    u.rate = 1.0;
    u.pitch = 1.0;
    u.volume = 1.0;
    if (voiceURI) {
      const v = voices.find(x => x.voiceURI === voiceURI);
      if (v) u.voice = v;
    }
    u.onend = () => {
      if (currentStepRef.current !== step) return;
      const wait = step.pauseAfterMs || 0;
      advanceTimerRef.current = setTimeout(() => {
        setStepIdx((cur) => {
          if (cur >= stepList.length - 1) {
            onActiveChange(false);
            return 0;
          }
          return cur + 1;
        });
      }, wait);
    };
    u.onerror = () => { /* swallow — user may have cancelled */ };
    window.speechSynthesis.speak(u);
  };

  useEffect(() => {
    if (!active) return;
    setPaused(false);
    speakStep(stepIdx);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIdx, stepList]);

  useEffect(() => {
    if (!active) cleanup();
  }, [active]);

  const start = () => {
    setStepIdx(0);
    onActiveChange(true);
  };
  const stop = () => {
    onActiveChange(false);
    setStepIdx(0);
    cleanup();
  };
  const togglePause = () => {
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  };
  const goPrev = () => setStepIdx((i) => Math.max(0, i - 1));
  const goNext = () => setStepIdx((i) => Math.min(stepList.length - 1, i + 1));

  // --------------- Inactive: small "Take tour" button --------------------
  // Icon-only on mobile so the voice toggle and other top-right controls
  // don't run into it.
  if (!active) {
    const inactiveStyle = {
      position: 'absolute',
      top: isMobile ? 'calc(10px + env(safe-area-inset-top))' : 20,
      right: isMobile ? 10 : 360,
      zIndex: 3,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: isMobile ? 0 : 6,
      padding: isMobile ? 0 : '7px 12px',
      width: isMobile ? 40 : 'auto',
      height: isMobile ? 40 : 'auto',
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: 0.4,
      color: '#fde68a',
      background: 'rgba(255, 217, 61, 0.14)',
      border: '1px solid rgba(255, 217, 61, 0.45)',
      borderRadius: 6,
      cursor: 'pointer',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backdropFilter: 'blur(4px)'
    };
    return (
      <button onClick={start} style={inactiveStyle} title="Play a narrated tour of the app" aria-label="Take the tour">
        <IconHeadphones size={isMobile ? 18 : 14} />
        {!isMobile && 'Take the tour'}
      </button>
    );
  }

  // --------------- Active: bottom bar with narration + controls ----------
  const step = stepList[stepIdx];
  if (!step) return null;
  const activeBarStyle = isMobile
    ? {
        position: 'absolute',
        bottom: 'calc(10px + env(safe-area-inset-bottom))',
        left: 10,
        right: 10,
        padding: '12px 14px',
      }
    : {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 360,
        maxWidth: 740,
        padding: '12px 16px',
      };

  return (
    <div style={{
      ...activeBarStyle,
      background: 'rgba(12, 18, 32, 0.95)',
      border: '1px solid rgba(255, 217, 61, 0.45)',
      borderRadius: 12,
      color: '#e5e7eb',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 13,
      backdropFilter: 'blur(6px)',
      boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
      zIndex: 3,
      userSelect: 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#fde68a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconHeadphones size={11} />
          {label}
        </span>
        <span style={{ color: '#6b7280', fontSize: 11 }}>
          Step {stepIdx + 1} of {stepList.length}
        </span>
        <div style={{ flex: 1 }} />
        {voices.length > 0 && (
          <select
            value={voiceURI || ''}
            onChange={(e) => setVoiceURI(e.target.value)}
            style={{
              fontSize: 10,
              background: 'rgba(255,255,255,0.04)',
              color: '#cbd5e1',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 4,
              padding: '2px 4px',
              maxWidth: 140,
              fontFamily: 'inherit'
            }}
            title="Voice"
          >
            {voices.map(v => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} {v.lang ? `(${v.lang})` : ''}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={stop}
          title="End tour"
          style={{
            width: 26,
            height: 26,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.04)',
            color: '#cbd5e1',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="End tour"
        >×</button>
      </div>

      <div style={{
        fontSize: 13,
        color: '#e5e7eb',
        lineHeight: 1.55,
        minHeight: isMobile ? 72 : 50,
        maxHeight: isMobile ? 140 : 120,
        overflow: 'auto',
        marginBottom: 10
      }}>
        {step.narration}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={goPrev}
          disabled={stepIdx === 0}
          title="Previous step"
          style={{
            width: 36, height: 36, borderRadius: 6,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: stepIdx === 0 ? '#4b5563' : '#cbd5e1',
            cursor: stepIdx === 0 ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <IconPrev size={14} />
        </button>
        <button
          onClick={togglePause}
          title={paused ? 'Resume' : 'Pause'}
          style={{
            width: 42, height: 36, borderRadius: 6,
            background: 'rgba(255, 217, 61, 0.18)',
            border: '1px solid rgba(255, 217, 61, 0.55)',
            color: '#fde68a',
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          {paused ? <IconPlay size={16} /> : <IconPause size={16} />}
        </button>
        <button
          onClick={goNext}
          disabled={stepIdx >= stepList.length - 1}
          title="Next step"
          style={{
            width: 36, height: 36, borderRadius: 6,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: stepIdx >= stepList.length - 1 ? '#4b5563' : '#cbd5e1',
            cursor: stepIdx >= stepList.length - 1 ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <IconNext size={14} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, marginLeft: 8, flexWrap: 'nowrap', overflow: 'hidden' }}>
          {stepList.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStepIdx(i)}
              title={s.id}
              style={{
                flex: 1,
                minWidth: 8,
                height: 4,
                borderRadius: 2,
                border: 'none',
                cursor: 'pointer',
                background: i === stepIdx
                  ? '#fde68a'
                  : i < stepIdx ? 'rgba(253, 224, 71, 0.35)' : 'rgba(255,255,255,0.10)',
                padding: 0
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
