import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import ScaleController, { getActiveScale } from './scenes/ScaleController';
import Sidebar from './components/Sidebar';
import ScaleHint from './components/ScaleHint';
import TimelineControl from './components/TimelineControl';
import LoopDynamicsControl from './components/LoopDynamicsControl';
import HistoneMarksControl from './components/HistoneMarksControl';
import DnaDynamicsControl from './components/DnaDynamicsControl';
import AudioTourControl from './components/AudioTourControl';
import { SCALES, DEVELOPMENTAL_STAGES, CELL_CYCLE_STAGES, HISTONE_MARKS, ALT_FORMS } from './data/locus';

function scaleMidpoint(scale) {
  return (scale.zoomMin + scale.zoomMax) / 2;
}

function stepScale(currentZoom, direction) {
  const active = getActiveScale(currentZoom);
  const idx = SCALES.findIndex(s => s.id === active.id);
  const nextIdx = Math.max(0, Math.min(SCALES.length - 1, idx + direction));
  return scaleMidpoint(SCALES[nextIdx]);
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
  const [zoom, setZoom] = useState(scaleMidpoint(SCALES[0]));
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

  // Apply a partial state snapshot — used by the tour to advance through steps.
  const applyTourState = (s) => {
    if (s.zoom !== undefined) setZoom(s.zoom);
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
      setFocus(null);
    }
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

  // Clamp zoom to the locked scale, or [0,1] otherwise.
  const clampZoom = (next) => {
    const lockedId = lockedRef.current;
    const lockedScale = lockedId ? SCALES.find(s => s.id === lockedId) : null;
    if (lockedScale) {
      const pad = 0.002;
      return Math.max(lockedScale.zoomMin + pad, Math.min(lockedScale.zoomMax - pad, next));
    }
    return Math.max(0, Math.min(1, next));
  };

  const handleSelect = (id, newFocus) => {
    setSelectedInfo(id);
    if (newFocus) setFocus(newFocus);
    if (isMobile) setSidebarOpen(true);
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
    setZoom(scaleMidpoint(scale));
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
        setZoom(z => stepScale(z, +1));
      } else if (e.key === '[') {
        if (lockedRef.current) return;
        setZoom(z => stepScale(z, -1));
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
      {!(isMobile && sidebarOpen) && !tourActive && (
        <ScaleHint
          zoom={zoom}
          onJump={jumpToScale}
          lockedScaleId={lockedScaleId}
          onToggleLock={toggleLock}
          isMobile={isMobile}
        />
      )}
      {!(isMobile && sidebarOpen) && (
        <AudioTourControl
          applyState={applyTourState}
          active={tourActive}
          onActiveChange={setTourActive}
          isMobile={isMobile}
        />
      )}
      {!(isMobile && sidebarOpen) && (
        <>
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
                if (!p && mitosisProgress >= 3) setMitosisProgress(0); // rewind if at end
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
        </>
      )}
    </div>
  );
}
