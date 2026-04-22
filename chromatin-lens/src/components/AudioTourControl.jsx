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
  // Active utterance — we flag it cancelled on cleanup so its onend handler
  // doesn't auto-advance to the next step when the cancellation itself fires
  // an "end" event.
  const utteranceRef = useRef(null);
  // Timers for in-step focus shifts — cleared on step change or stop.
  const focusShiftTimersRef = useRef([]);
  // Char-index that SpeechSynthesis last reported as the start of a word.
  // Used to highlight the current word in the transcript caption.
  const [spokenCharIndex, setSpokenCharIndex] = useState(-1);
  const currentWordRef = useRef(null);
  const captionScrollRef = useRef(null);

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
    // Tag the active utterance as cancelled BEFORE calling cancel() so its
    // onend handler (fired by the cancellation) doesn't advance the tour.
    if (utteranceRef.current) {
      utteranceRef.current._cancelled = true;
      utteranceRef.current = null;
    }
    try { window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    focusShiftTimersRef.current.forEach((t) => clearTimeout(t));
    focusShiftTimersRef.current = [];
  };

  const speakStep = (idx) => {
    const step = stepList[idx];
    if (!step) return;
    // Already speaking this exact step? Don't restart from the top just
    // because something else triggered a re-render of the parent. This
    // protects against mid-tour user interactions (clicking an element,
    // opening/closing the info card, sidebar toggles, etc.) accidentally
    // re-speaking the current step.
    if (
      currentStepRef.current === step &&
      utteranceRef.current &&
      !utteranceRef.current._cancelled &&
      (window.speechSynthesis.speaking || window.speechSynthesis.pending)
    ) {
      return;
    }
    currentStepRef.current = step;
    if (step.state) applyState(step.state);

    cleanup();

    // Schedule mid-step focus shifts so the scene pans to each element as
    // the narration names it (e.g. "the pink blob is the nucleolus"...).
    if (Array.isArray(step.focusShifts)) {
      for (const shift of step.focusShifts) {
        const timer = setTimeout(() => {
          if (currentStepRef.current !== step) return;
          if (shift.focus !== undefined) applyState({ focus: shift.focus });
        }, Math.max(0, shift.atMs || 0));
        focusShiftTimersRef.current.push(timer);
      }
    }

    // Reset the word-highlight state for this step.
    setSpokenCharIndex(-1);

    const u = new SpeechSynthesisUtterance(step.narration);
    u._cancelled = false;
    utteranceRef.current = u;
    u.onboundary = (evt) => {
      if (currentStepRef.current !== step) return;
      if (!evt.name || evt.name === 'word') {
        setSpokenCharIndex(evt.charIndex);
      }
    };
    u.rate = 1.0;
    u.pitch = 1.0;
    u.volume = 1.0;
    if (voiceURI) {
      const v = voices.find(x => x.voiceURI === voiceURI);
      if (v) u.voice = v;
    }
    u.onend = () => {
      // Ignore end events that fire because we cancelled speech — otherwise
      // the tour "auto-advances" (or re-speaks) on every cancel.
      if (u._cancelled) return;
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

  // ----- Hoisted word-range / current-word computation -----
  // Must live above any conditional early-return so the scrollIntoView
  // useEffect below runs in the same order on every render (hooks rule).
  const step = stepList[stepIdx] ?? null;

  const wordRanges = (() => {
    const ranges = [];
    if (!step?.narration) return ranges;
    const re = /\S+/g;
    let m;
    while ((m = re.exec(step.narration)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
    return ranges;
  })();

  let currentWordIdx = -1;
  if (spokenCharIndex >= 0) {
    for (let i = 0; i < wordRanges.length; i++) {
      if (wordRanges[i].start <= spokenCharIndex) currentWordIdx = i;
      else break;
    }
  }

  // Scroll the highlighted word into view. No-ops when ref is null.
  useEffect(() => {
    const el = currentWordRef.current;
    if (!el) return;
    try {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    } catch { /* older browsers */ }
  }, [currentWordIdx]);

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

  // --------------- Active: compact mobile bar / full desktop bar -----------
  if (!step) return null;

  // Renders the narration as a list of spans, highlighting the current word.
  const renderTranscript = () => (
    <>
      {wordRanges.map((r, idx) => {
        const isCurrent = idx === currentWordIdx;
        return (
          <React.Fragment key={idx}>
            {idx > 0 && ' '}
            <span
              ref={isCurrent ? currentWordRef : null}
              style={{
                background: isCurrent ? 'rgba(253, 224, 71, 0.30)' : 'transparent',
                color: isCurrent ? '#fef3c7' : 'inherit',
                borderRadius: 3,
                padding: isCurrent ? '1px 3px' : 0,
                margin: isCurrent ? '0 -3px' : 0,
                transition: 'background 120ms ease, color 120ms ease',
                fontWeight: isCurrent ? 600 : 'normal'
              }}
            >
              {r.text}
            </span>
          </React.Fragment>
        );
      })}
    </>
  );

  const commonBar = {
    background: 'rgba(12, 18, 32, 0.95)',
    border: '1px solid rgba(255, 217, 61, 0.45)',
    borderRadius: 12,
    color: '#e5e7eb',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backdropFilter: 'blur(6px)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
    zIndex: 3,
    userSelect: 'none'
  };

  if (isMobile) {
    // Compact layout:
    //   row 1: [play/pause 40×40] · 2-line caption · [× 30×30]
    //   row 2: [prev 30×22] · progress dots · step counter · [next 30×22]
    return (
      <div style={{
        ...commonBar,
        position: 'absolute',
        bottom: 'calc(10px + env(safe-area-inset-bottom))',
        left: 10,
        right: 10,
        padding: '10px 12px',
        fontSize: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={togglePause}
            title={paused ? 'Resume' : 'Pause'}
            aria-label={paused ? 'Resume' : 'Pause'}
            style={{
              width: 40, height: 40, borderRadius: 8,
              background: 'rgba(255, 217, 61, 0.18)',
              border: '1px solid rgba(255, 217, 61, 0.55)',
              color: '#fde68a',
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              padding: 0
            }}
          >
            {paused ? <IconPlay size={15} /> : <IconPause size={15} />}
          </button>
          <div
            ref={captionScrollRef}
            style={{
              flex: 1,
              fontSize: 12,
              lineHeight: 1.4,
              color: '#e5e7eb',
              maxHeight: '2.8em',
              minHeight: '2.8em',
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {renderTranscript()}
          </div>
          <button
            onClick={stop}
            title="End tour"
            aria-label="End tour"
            style={{
              width: 30, height: 30, borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.04)',
              color: '#cbd5e1',
              cursor: 'pointer',
              fontSize: 16, padding: 0, lineHeight: 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}
          >×</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <button
            onClick={goPrev}
            disabled={stepIdx === 0}
            aria-label="Previous"
            style={{
              width: 30, height: 22, borderRadius: 4,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: stepIdx === 0 ? '#4b5563' : '#cbd5e1',
              cursor: stepIdx === 0 ? 'not-allowed' : 'pointer',
              padding: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}
          ><IconPrev size={11} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, flexWrap: 'nowrap', overflow: 'hidden' }}>
            {stepList.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStepIdx(i)}
                title={s.id}
                style={{
                  flex: 1,
                  minWidth: 6,
                  height: 3,
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
          <span style={{ fontSize: 10, color: '#9ca3af', fontVariantNumeric: 'tabular-nums', letterSpacing: 0.3, minWidth: 34, textAlign: 'center' }}>
            {stepIdx + 1}/{stepList.length}
          </span>
          <button
            onClick={goNext}
            disabled={stepIdx >= stepList.length - 1}
            aria-label="Next"
            style={{
              width: 30, height: 22, borderRadius: 4,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: stepIdx >= stepList.length - 1 ? '#4b5563' : '#cbd5e1',
              cursor: stepIdx >= stepList.length - 1 ? 'not-allowed' : 'pointer',
              padding: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}
          ><IconNext size={11} /></button>
        </div>
      </div>
    );
  }

  // --------------- Desktop: compact caption bar (mirrors mobile) ----------
  // Previous desktop bar had a dedicated narration area + separate controls
  // row + header row = ~200 px tall. That's unnecessary. New layout:
  //   row 1: [play/pause 44×44]  [2-line transcript]  [voice ▾] [×]
  //   row 2: [prev]  [progress dots]  [step N/M]  [next]
  // Roughly 100 px total.
  return (
    <div style={{
      ...commonBar,
      position: 'absolute',
      bottom: 20,
      left: 20,
      right: 360,
      maxWidth: 740,
      padding: '10px 14px',
      fontSize: 13
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={togglePause}
          title={paused ? 'Resume' : 'Pause'}
          aria-label={paused ? 'Resume' : 'Pause'}
          style={{
            width: 44, height: 44, borderRadius: 8,
            background: 'rgba(255, 217, 61, 0.18)',
            border: '1px solid rgba(255, 217, 61, 0.55)',
            color: '#fde68a',
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, padding: 0
          }}
        >
          {paused ? <IconPlay size={16} /> : <IconPause size={16} />}
        </button>

        <div
          ref={captionScrollRef}
          style={{
            flex: 1,
            fontSize: 13,
            lineHeight: 1.45,
            color: '#e5e7eb',
            maxHeight: '2.9em',
            minHeight: '2.9em',
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {renderTranscript()}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignItems: 'flex-end' }}>
          <button
            onClick={stop}
            title="End tour"
            aria-label="End tour"
            style={{
              width: 26, height: 26,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.04)',
              color: '#cbd5e1',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 14, padding: 0, lineHeight: 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
            }}
          >×</button>
          {voices.length > 0 && (
            <select
              value={voiceURI || ''}
              onChange={(e) => setVoiceURI(e.target.value)}
              style={{
                fontSize: 9,
                background: 'rgba(255,255,255,0.04)',
                color: '#cbd5e1',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 4,
                padding: '2px 4px',
                maxWidth: 120,
                fontFamily: 'inherit'
              }}
              title="Voice"
            >
              {voices.map(v => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name.substring(0, 14)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#fde68a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <IconHeadphones size={10} />
          {label}
        </span>
        <button
          onClick={goPrev}
          disabled={stepIdx === 0}
          aria-label="Previous step"
          style={{
            width: 30, height: 22, borderRadius: 4,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: stepIdx === 0 ? '#4b5563' : '#cbd5e1',
            cursor: stepIdx === 0 ? 'not-allowed' : 'pointer',
            padding: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}
        ><IconPrev size={11} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, flexWrap: 'nowrap', overflow: 'hidden' }}>
          {stepList.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStepIdx(i)}
              title={s.id}
              style={{
                flex: 1,
                minWidth: 8,
                height: 3,
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
        <span style={{ fontSize: 10, color: '#9ca3af', fontVariantNumeric: 'tabular-nums', letterSpacing: 0.3, minWidth: 34, textAlign: 'center' }}>
          {stepIdx + 1}/{stepList.length}
        </span>
        <button
          onClick={goNext}
          disabled={stepIdx >= stepList.length - 1}
          aria-label="Next step"
          style={{
            width: 30, height: 22, borderRadius: 4,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: stepIdx >= stepList.length - 1 ? '#4b5563' : '#cbd5e1',
            cursor: stepIdx >= stepList.length - 1 ? 'not-allowed' : 'pointer',
            padding: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}
        ><IconNext size={11} /></button>
      </div>
    </div>
  );
}
