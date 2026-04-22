import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import ScaleController, { getActiveScale, SCALE_FADE_WIDTH } from './scenes/ScaleController';
import Sidebar from './components/Sidebar';
import ScaleHint from './components/ScaleHint';
import TimelineControl from './components/TimelineControl';
import LoopDynamicsControl from './components/LoopDynamicsControl';
import HistoneMarksControl from './components/HistoneMarksControl';
import DnaDynamicsControl from './components/DnaDynamicsControl';
import AudioTourControl from './components/AudioTourControl';
import { SCALES, DEVELOPMENTAL_STAGES, CELL_CYCLE_STAGES, HISTONE_MARKS, ALT_FORMS, INFO } from './data/locus';
import { TOUR_STEPS, stepsForScale } from './data/tour';

// Short display name per scale — used for level-tour label text.
const SHORT_SCALE_NAME = {
  nucleus: 'Nucleus',
  compartment: 'Compartments',
  tad: 'TAD',
  loop: 'Loop',
  fiber: '30-nm fiber',
  nucleosomes: 'Nucleosomes',
  helix: 'Helix',
  atomic: 'Atomic'
};

function scaleMidpoint(scale) {
  return (scale.zoomMin + scale.zoomMax) / 2;
}

// Just past the scale's fade-in band so grow === 1 and the full scene is
// visible. Mobile defaults to this instead of midpoint so everything fits
// in the narrower viewport without the user having to pinch-zoom out.
function scaleStartZoom(scale) {
  return scale.zoomMin + SCALE_FADE_WIDTH + 0.002;
}

// Default zoom for a given device: midpoint on desktop (more dramatic,
// zoomed-in framing), scaleStart on mobile (full scene in view).
function defaultZoomFor(scale, isMobile) {
  return isMobile ? scaleStartZoom(scale) : scaleMidpoint(scale);
}

function stepScale(currentZoom, direction, isMobile) {
  const active = getActiveScale(currentZoom);
  const idx = SCALES.findIndex(s => s.id === active.id);
  const nextIdx = Math.max(0, Math.min(SCALES.length - 1, idx + direction));
  return defaultZoomFor(SCALES[nextIdx], isMobile);
}

// Is this device in mobile layout? Duplicated from useIsMobile to be usable
// synchronously in useState(lazy init) before the hook runs.
function isMobileNow(breakpoint = 820) {
  return typeof window !== 'undefined' && window.innerWidth < breakpoint;
}

// Breakpoint: below this, switch to mobile layout (phone + iPad portrait).
function useIsMobile(breakpoint = 820) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < breakpoint
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
}

export default function App() {
  const [zoom, setZoom] = useState(() => defaultZoomFor(SCALES[0], isMobileNow()));
  const [selectedInfo, setSelectedInfo] = useState(null);
  const [lockedScaleId, setLockedScaleId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer open
  // When set, ScaleController smoothly translates the scene so this point
  // ends up at world origin (in front of the camera). Stored in the scale's
  // local coords so it stays correct as the scene grows/shrinks with zoom.
  // Shape: { scaleId: string, localPoint: [x, y, z] }
  const [focus, setFocus] = useState(null);
  // Developmental stage — only meaningful on the Loop level (the globin switch story).
  // Default to 'adult' since that matches the locus description.
  const [stageId, setStageId] = useState('adult');
  const stage = DEVELOPMENTAL_STAGES.find(s => s.id === stageId);
  // Cell-cycle stage — only meaningful on the Nucleus level.
  // We track a continuous `mitosisProgress` in [0, 4]. Stage positions:
  //   0 = interphase, 1 = metaphase, 2 = anaphase, 3 = telophase, 4 = wraps to start.
  const [mitosisProgress, setMitosisProgress] = useState(0);
  const [mitosisPlaying, setMitosisPlaying] = useState(false);
  // Animation fidelity: 'instant' (hard stage jumps), 'mid' (cross-fade views),
  // 'full' (continuous position interpolation of every element).
  const [mitosisDetail, setMitosisDetail] = useState('mid');
  // Derived: which named stage is the current progress closest to (for highlighting in UI).
  const cellCycleStageId = (() => {
    const r = Math.round(mitosisProgress);
    return CELL_CYCLE_STAGES[Math.max(0, Math.min(CELL_CYCLE_STAGES.length - 1, r))].id;
  })();
  const cellCycleStage = CELL_CYCLE_STAGES.find(s => s.id === cellCycleStageId);

  // Play loop — advances mitosisProgress over time.
  useEffect(() => {
    if (!mitosisPlaying) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); // seconds, clamp dt for safety
      last = now;
      setMitosisProgress((p) => {
        // ~12 seconds for a full cycle (rate = 4 / 12 ≈ 0.333 units/sec)
        const next = p + dt * 0.333;
        if (next >= 3) {
          // Snap to telophase endpoint and stop at the end of the cycle.
          setMitosisPlaying(false);
          return 3;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mitosisPlaying]);

  // Cohesin loop extrusion — only meaningful on the Loop level.
  // extrusionProgress 0 = no loop (linear DNA), 1 = fully extruded stable loop.
  const [extrusionProgress, setExtrusionProgress] = useState(1);
  const [extrusionPlaying, setExtrusionPlaying] = useState(false);
  // Transcription burst — Pol II traverses HBB; simple on/off toggle.
  const [transcribing, setTranscribing] = useState(false);
  // Histone-mark overlay — only meaningful on the Nucleosome level.
  const [histoneMarkId, setHistoneMarkId] = useState('none');
  const histoneMark = HISTONE_MARKS.find(m => m.id === histoneMarkId);
  // DNA replication + alternative form — Helix level.
  const [replicationProgress, setReplicationProgress] = useState(0);
  const [replicationPlaying, setReplicationPlaying] = useState(false);
  const [altFormId, setAltFormId] = useState('b');
  const altForm = ALT_FORMS.find(f => f.id === altFormId);
  // Audio tour — driven by AudioTourControl; may set any of the above states.
  const [tourActive, setTourActive] = useState(false);
  // Snapshot of the user's lock state just before an "engagement" (tour or
  // animation) started — restored on exit so we don't overwrite their choice.
  const preEngagementLockRef = useRef(null);
  // Which steps the tour plays. Default is the full tour; a level tour swaps
  // in a filtered list via stepsForScale().
  const [tourSteps, setTourSteps] = useState(TOUR_STEPS);
  const [tourLabel, setTourLabel] = useState('Audio tour');

  // Speak the name of any element the user clicks (short TTS chirp with
  // just the title, not the full card body). User-toggleable and persisted.
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    try { return localStorage.getItem('cl-voice-names') !== 'off'; }
    catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('cl-voice-names', voiceEnabled ? 'on' : 'off'); } catch {}
  }, [voiceEnabled]);

  // Auto-hide during tour: reveal zones cover each panel's footprint, not
  // just a tiny edge strip, so moving the cursor INTO the panel doesn't
  // make it hide. Buffer added so there's no flicker at the boundary.
  const [inRightPanel, setInRightPanel] = useState(false);
  const [inTopPanel, setInTopPanel] = useState(false);
  useEffect(() => {
    if (!tourActive || isMobile) {
      setInRightPanel(false);
      setInTopPanel(false);
      return;
    }
    const handler = (e) => {
      // Right-panel zone: sidebar is 340 px wide; 20 px buffer = 360 px.
      setInRightPanel(e.clientX > window.innerWidth - 360);
      // Top-panel zone: stacked overlays are ~180–220 px tall; add buffer.
      setInTopPanel(e.clientY < 240);
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActive]);

  // Apply a partial state snapshot — used by the tour to advance through steps.
  const applyTourState = (s) => {
    if (s.zoom !== undefined) {
      if (isMobile) {
        // On mobile, every step snaps back to scaleStart of the target scale,
        // so the user always sees the full scene at the start of each chapter
        // — even if they pinch-zoomed in on a previous chapter.
        const scale = SCALES.find(
          (sc) => s.zoom >= sc.zoomMin - SCALE_FADE_WIDTH && s.zoom <= sc.zoomMax + SCALE_FADE_WIDTH
        );
        setZoom(scale ? scaleStartZoom(scale) : s.zoom);
      } else {
        setZoom(s.zoom);
      }
    }
    if (s.mitosisDetail !== undefined) setMitosisDetail(s.mitosisDetail);
    if (s.mitosisProgress !== undefined) setMitosisProgress(s.mitosisProgress);
    if (s.mitosisPlaying !== undefined) setMitosisPlaying(s.mitosisPlaying);
    if (s.stageId !== undefined) setStageId(s.stageId);
    if (s.extrusionProgress !== undefined) setExtrusionProgress(s.extrusionProgress);
    if (s.extrusionPlaying !== undefined) setExtrusionPlaying(s.extrusionPlaying);
    if (s.transcribing !== undefined) setTranscribing(s.transcribing);
    if (s.histoneMarkId !== undefined) setHistoneMarkId(s.histoneMarkId);
    if (s.replicationProgress !== undefined) setReplicationProgress(s.replicationProgress);
    if (s.replicationPlaying !== undefined) setReplicationPlaying(s.replicationPlaying);
    if (s.altFormId !== undefined) setAltFormId(s.altFormId);
    if (s.selectedInfo !== undefined) {
      setSelectedInfo(s.selectedInfo);
    }
    // Tour-driven focus target: defaults to null via RESET, so each step
    // can center the camera on a specific element or clear focus explicitly.
    if (s.focus !== undefined) setFocus(s.focus);
  };

  useEffect(() => {
    if (!replicationPlaying) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setReplicationProgress((p) => {
        const next = p + dt * 0.12; // ~8 seconds full
        if (next >= 1) {
          setReplicationPlaying(false);
          return 1;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [replicationPlaying]);

  useEffect(() => {
    if (!extrusionPlaying) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setExtrusionProgress((p) => {
        const next = p + dt * 0.15; // ~6.7 seconds to full
        if (next >= 1) {
          setExtrusionPlaying(false);
          return 1;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [extrusionPlaying]);

  const onMitosisStageSelect = (id) => {
    // Jump progress to the exact stage t-position
    const idx = CELL_CYCLE_STAGES.findIndex(s => s.id === id);
    if (idx < 0) return;
    setMitosisPlaying(false);
    setMitosisProgress(idx);
  };

  const lockedRef = useRef(null);
  useEffect(() => { lockedRef.current = lockedScaleId; }, [lockedScaleId]);

  const containerRef = useRef();
  const isMobile = useIsMobile();

  // "Engagement lock": any tour or playing animation force-locks the user to
  // the relevant level so they can't accidentally wheel/pinch out of the
  // scene that's being narrated or animated. Also snaps the zoom to that
  // level (and its default natural-size zoom on mobile) if the user isn't
  // already there. The pre-engagement lock is saved and restored on exit.
  useEffect(() => {
    // Figure out which scale the user should be locked to, if any:
    //   - Tour: whatever level the tour is currently on
    //   - Mitosis animation: nucleus level
    //   - Cohesin extrusion or transcription: loop level
    //   - Replication fork: helix level
    let engagementScale = null;
    if (tourActive) engagementScale = getActiveScale(zoom).id;
    else if (mitosisPlaying) engagementScale = 'nucleus';
    else if (extrusionPlaying || transcribing) engagementScale = 'loop';
    else if (replicationPlaying) engagementScale = 'helix';

    if (engagementScale) {
      // Snapshot the user's manual lock state on first engagement entry.
      if (preEngagementLockRef.current === null) {
        preEngagementLockRef.current = { prev: lockedScaleId };
      }
      const scale = SCALES.find((s) => s.id === engagementScale);
      if (!scale) return;
      if (lockedScaleId !== engagementScale) setLockedScaleId(engagementScale);
      // Push zoom past the fade band so neighbors can't bleed in.
      const pad = SCALE_FADE_WIDTH + 0.002;
      const lo = scale.zoomMin + pad;
      const hi = scale.zoomMax - pad;
      if (zoom < lo || zoom > hi) {
        // Out of range entirely (different level) → snap to the default
        // zoom for this device. Still within the level but inside the fade
        // band → just clamp.
        const target = (zoom < scale.zoomMin || zoom > scale.zoomMax)
          ? defaultZoomFor(scale, isMobile)
          : Math.max(lo, Math.min(hi, zoom));
        setZoom(target);
      }
    } else if (preEngagementLockRef.current) {
      // Nothing running → restore the user's pre-engagement lock (or null).
      setLockedScaleId(preEngagementLockRef.current.prev ?? null);
      preEngagementLockRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActive, mitosisPlaying, extrusionPlaying, transcribing, replicationPlaying, zoom]);

  // Clamp zoom to the locked scale, or [0,1] otherwise. When locked, pad
  // the clamp by the full fade-out width so adjacent scenes can't bleed in
  // at the edges — the locked zone renders cleanly and exclusively.
  const clampZoom = (next) => {
    const lockedId = lockedRef.current;
    const lockedScale = lockedId ? SCALES.find(s => s.id === lockedId) : null;
    if (lockedScale) {
      const pad = SCALE_FADE_WIDTH + 0.002;
      return Math.max(lockedScale.zoomMin + pad, Math.min(lockedScale.zoomMax - pad, next));
    }
    return Math.max(0, Math.min(1, next));
  };

  // Speak just the title of a clicked element (e.g. "HBB — β-globin").
  // Suppressed while the audio tour is running (would collide with narration).
  const speakElementName = (id) => {
    if (tourActive || !voiceEnabled) return;
    const info = INFO[id];
    if (!info?.title) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(info.title);
      u.rate = 1.0;
      u.volume = 0.9;
      window.speechSynthesis.speak(u);
    } catch (e) { /* noop */ }
  };

  const handleSelect = (id, newFocus) => {
    setSelectedInfo(id);
    if (newFocus) setFocus(newFocus);
    if (isMobile) setSidebarOpen(true);
    speakElementName(id);
  };

  const startFullTour = () => {
    setTourSteps(TOUR_STEPS);
    setTourLabel('Audio tour');
    setTourActive(true);
  };

  const startLevelTour = () => {
    const scale = getActiveScale(zoom);
    const filtered = stepsForScale(scale.id);
    if (filtered.length === 0) return;
    setTourSteps(filtered);
    setTourLabel(`Tour · ${SHORT_SCALE_NAME[scale.id] || scale.id}`);
    setTourActive(true);
  };

  const clearSelection = () => {
    setSelectedInfo(null);
    setFocus(null);
  };

  const jumpToScale = (scale) => {
    if (lockedRef.current && lockedRef.current !== scale.id) {
      setLockedScaleId(null);
    }
    setFocus(null); // old scale's focus is no longer relevant
    setZoom(defaultZoomFor(scale, isMobile));
  };

  const toggleLock = () => {
    if (lockedScaleId) {
      setLockedScaleId(null);
    } else {
      setLockedScaleId(getActiveScale(zoom).id);
    }
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        clearSelection();
        if (isMobile) setSidebarOpen(false);
      } else if (e.key === 'l' || e.key === 'L') {
        toggleLock();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        setZoom(z => clampZoom(z + 0.02));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        setZoom(z => clampZoom(z - 0.02));
      } else if (e.key === ']') {
        if (lockedRef.current) return;
        setZoom(z => stepScale(z, +1, isMobile));
      } else if (e.key === '[') {
        if (lockedRef.current) return;
        setZoom(z => stepScale(z, -1, isMobile));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, isMobile, lockedScaleId]);

  // Mouse wheel (desktop) — continuous zoom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      e.preventDefault();
      const locked = !!lockedRef.current;
      const maxStep = locked ? 0.008 : 0.04;
      const mult = locked ? 0.0004 : 0.0015;
      const step = Math.max(-maxStep, Math.min(maxStep, -e.deltaY * mult));
      setZoom(z => clampZoom(z + step));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Pinch-to-zoom (touch) — two-finger spread zooms in, pinch zooms out.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let lastDist = null;
    const handleTouchMove = (e) => {
      if (e.touches.length !== 2) {
        lastDist = null;
        return;
      }
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (lastDist !== null) {
        const delta = dist - lastDist;
        const locked = !!lockedRef.current;
        const maxStep = locked ? 0.006 : 0.03;
        const mult = locked ? 0.0008 : 0.0025;
        const step = Math.max(-maxStep, Math.min(maxStep, delta * mult));
        setZoom(z => clampZoom(z + step));
      }
      lastDist = dist;
    };
    const reset = () => { lastDist = null; };
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', reset);
    el.addEventListener('touchcancel', reset);
    return () => {
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', reset);
      el.removeEventListener('touchcancel', reset);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100dvh',
        background: '#0a0e1a',
        overflow: 'hidden',
        touchAction: 'none'
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 12], fov: 45 }}
        style={{ background: 'linear-gradient(180deg, #0a0e1a 0%, #131b2e 100%)' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <directionalLight position={[-5, -3, -5]} intensity={0.3} color="#7aa2ff" />
        <pointLight position={[0, 0, 8]} intensity={0.5} color="#ffd93d" />

        <ScaleController
          zoom={zoom}
          onSelect={handleSelect}
          selectedInfo={selectedInfo}
          focus={focus}
          stage={stage}
          cellCycleStage={cellCycleStage}
          mitosisProgress={mitosisProgress}
          mitosisDetail={mitosisDetail}
          extrusionProgress={extrusionProgress}
          transcribing={transcribing}
          histoneMark={histoneMark}
          replicationProgress={replicationProgress}
          altForm={altForm}
        />

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.4}
        />
      </Canvas>

      {/* Sidebar — on mobile, render directly (the Sidebar component handles
          its own compact header + bottom-sheet positioning). On desktop,
          wrap in an auto-hide container that slides off during tour unless
          the cursor is over the sidebar's area or an element is selected. */}
      {isMobile ? (
        <Sidebar
          zoom={zoom}
          selectedInfo={selectedInfo}
          onCloseInfo={clearSelection}
          lockedScaleId={lockedScaleId}
          onJump={jumpToScale}
          isMobile={isMobile}
          open={sidebarOpen}
          onOpen={() => setSidebarOpen(true)}
          onClose={() => setSidebarOpen(false)}
        />
      ) : (() => {
        const sidebarAutoHidden = tourActive && !inRightPanel && !selectedInfo;
        return (
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: 340,
            height: '100dvh',
            zIndex: 4,
            transform: sidebarAutoHidden ? 'translateX(100%)' : 'translateX(0)',
            transition: 'transform 0.35s cubic-bezier(.2,.8,.2,1)',
            pointerEvents: sidebarAutoHidden ? 'none' : 'auto'
          }}>
            <Sidebar
              zoom={zoom}
              selectedInfo={selectedInfo}
              onCloseInfo={clearSelection}
              lockedScaleId={lockedScaleId}
              onJump={jumpToScale}
              isMobile={isMobile}
              open={sidebarOpen}
              onOpen={() => setSidebarOpen(true)}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        );
      })()}

      {!(isMobile && sidebarOpen) && !tourActive && (
        <ScaleHint
          zoom={zoom}
          onJump={jumpToScale}
          lockedScaleId={lockedScaleId}
          onToggleLock={toggleLock}
          onTourLevel={startLevelTour}
          isMobile={isMobile}
        />
      )}

      {/* Top overlays — all timeline/dynamics controls. While the tour is
          playing, hide them entirely (they are not needed and visually
          compete with the narration). User can exit the tour to use them. */}
      {!(isMobile && sidebarOpen) && !tourActive && (() => {
        // No longer auto-hide within a tour session — tour branch returns
        // null before reaching here. Outside tour, always visible.
        const wrapperStyle = isMobile
          ? { display: 'contents' }
          : {
              position: 'absolute', top: 0, left: 0, right: 0,
              zIndex: 3,
              pointerEvents: 'auto'
            };
        return (
          <div style={wrapperStyle}>
            <TimelineControl
              zoom={zoom}
              visibleOnScaleId="loop"
              stages={DEVELOPMENTAL_STAGES}
              stageId={stageId}
              onStageChange={setStageId}
              label="Developmental time"
              sublabel="globin switch"
              isMobile={isMobile}
            />
            <LoopDynamicsControl
              zoom={zoom}
              extrusionProgress={extrusionProgress}
              extrusionPlaying={extrusionPlaying}
              onExtrusionPlayToggle={() => setExtrusionPlaying(p => !p)}
              onExtrusionChange={(v) => { setExtrusionPlaying(false); setExtrusionProgress(v); }}
              transcribing={transcribing}
              onTranscribeToggle={() => setTranscribing(t => !t)}
              isMobile={isMobile}
            />
            <HistoneMarksControl
              zoom={zoom}
              markId={histoneMarkId}
              onMarkChange={setHistoneMarkId}
              isMobile={isMobile}
            />
            <DnaDynamicsControl
              zoom={zoom}
              replicationProgress={replicationProgress}
              replicationPlaying={replicationPlaying}
              onReplicationPlayToggle={() => setReplicationPlaying(p => !p)}
              onReplicationChange={(v) => { setReplicationPlaying(false); setReplicationProgress(v); }}
              altFormId={altFormId}
              onAltFormChange={setAltFormId}
              isMobile={isMobile}
            />
            <TimelineControl
              zoom={zoom}
              visibleOnScaleId="nucleus"
              stages={CELL_CYCLE_STAGES}
              stageId={cellCycleStageId}
              onStageChange={onMitosisStageSelect}
              label="Cell cycle"
              sublabel="mitosis"
              accentColor="#93c5fd"
              accentBorder="rgba(147, 197, 253, 0.30)"
              accentHighlight="rgba(147, 197, 253, 0.55)"
              accentHighlightBg="rgba(147, 197, 253, 0.14)"
              isMobile={isMobile}
              playable
              playing={mitosisPlaying}
              onPlayToggle={() => {
                setMitosisPlaying((p) => {
                  if (!p && mitosisProgress >= 3) setMitosisProgress(0);
                  return !p;
                });
              }}
              progress={mitosisProgress}
              onProgressChange={(v) => {
                setMitosisPlaying(false);
                setMitosisProgress(v);
              }}
              progressMax={3}
              detailLevel={mitosisDetail}
              onDetailChange={setMitosisDetail}
            />
          </div>
        );
      })()}

      {/* Audio tour controls — always rendered so the "Take the tour"
          button remains visible when the tour is inactive. */}
      {!(isMobile && sidebarOpen) && (
        <AudioTourControl
          applyState={applyTourState}
          active={tourActive}
          onActiveChange={(v) => {
            // When activating externally, leave tourSteps/tourLabel as-is.
            // When the user clicks the inactive button, kick off a full tour.
            if (v && !tourActive) startFullTour();
            else setTourActive(v);
          }}
          steps={tourSteps}
          label={tourLabel}
          isMobile={isMobile}
        />
      )}

      {/* Voice mute toggle — small icon to the LEFT of the Take-the-tour
          button. On mobile both are icon-only so they fit in the top-right. */}
      {!tourActive && !(isMobile && sidebarOpen) && (
        <button
          onClick={() => {
            setVoiceEnabled(v => !v);
            try { window.speechSynthesis.cancel(); } catch {}
          }}
          title={voiceEnabled ? 'Mute element names' : 'Unmute element names'}
          aria-label={voiceEnabled ? 'Mute element names' : 'Unmute element names'}
          style={{
            position: 'absolute',
            top: isMobile ? 'calc(10px + env(safe-area-inset-top))' : 20,
            // Mobile: tour button is 40 wide at right:10 → start voice at right: 58.
            // Desktop: "Take the tour" button is ~140 wide at right:360 → start voice at right: 512.
            right: isMobile ? 58 : 512,
            zIndex: 3,
            width: isMobile ? 40 : 34,
            height: isMobile ? 40 : 34,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: 0,
            color: voiceEnabled ? '#cbd5e1' : '#475569',
            background: voiceEnabled ? 'rgba(255,255,255,0.06)' : 'rgba(71, 85, 105, 0.14)',
            border: `1px solid ${voiceEnabled ? 'rgba(255,255,255,0.15)' : 'rgba(71,85,105,0.45)'}`,
            borderRadius: 6,
            cursor: 'pointer',
            backdropFilter: 'blur(4px)'
          }}
        >
          {voiceEnabled ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
