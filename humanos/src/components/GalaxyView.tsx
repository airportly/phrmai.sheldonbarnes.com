import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Protein } from '@/lib/protein-mapper';
import { buildGalaxyLayout, type ProteinNode, type DiseaseNode } from '@/lib/galaxy-layout';
import DiseaseIcon, { diseaseIconSvgString } from './DiseaseIcon';

/**
 * GalaxyView - Three.js 3D universe of the cardiometabolic dataset.
 *
 * Topology: 13 disease stars on a tilted ring around the origin, each with
 * its associated proteins as planets in orbit. Distance from the star is
 * inversely proportional to OpenTargets association score (high = close).
 * Camera defaults to a wide overview; click any planet or star to fly to it.
 *
 * Click → smooth camera arc; OrbitControls handle drag + zoom; layer toggles
 * surface gene-family / drug-class / function-class connections that cross
 * between solar systems so the user can literally follow an edge.
 *
 * Performance: proteins are rendered as a single InstancedMesh (one draw call
 * for ~1900 instances). Connection lines are a single BufferGeometry.
 */

interface Props {
  selectedProtein: Protein | null;
  onSelectProtein: (gene: string) => void;
  /** Optional disease key to fly to on mount / when this prop changes. */
  targetDiseaseKey?: string | null;
  /** Called when the user focuses a disease (clicked star or shortcut). */
  onDiseaseFocus?: (key: string | null) => void;
  /** Optional narration sink. The tour pipes step text through this so it
   *  appears in the chat log and is spoken via the existing voice path. */
  onNarrate?: (line: string) => void;
}

type LayerKey = 'family' | 'drug' | 'organ' | 'function';

interface LayerConfig {
  key: LayerKey;
  label: string;
  color: string;
  description: string;
}

const LAYERS: LayerConfig[] = [
  { key: 'family',   label: 'Gene family',   color: '#5eead4', description: 'KCN, APO, SCN, F, HNF siblings cross between systems' },
  { key: 'drug',     label: 'Drug targets',  color: '#fbbf24', description: 'highlights pharmacologically actionable proteins' },
  { key: 'organ',    label: 'Same organ',    color: '#a78bfa', description: 'lines proteins sharing an organ assignment' },
  { key: 'function', label: 'Function class',color: '#34d399', description: 'connects proteins by Ion channel / Receptor / etc.' },
];

const ORGAN_COLOR_BY_KEY: Record<string, number> = {
  brain:    0x7F77DD,
  heart:    0xD85A30,
  liver:    0xBA7517,
  pancreas: 0x1D9E75,
  kidneys:  0x378ADD,
  adipose:  0xD4537E,
};

const HEIGHT_DESKTOP = 580;
const HEIGHT_MOBILE = 380;
const CAMERA_FOV = 45;
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);
const OVERVIEW_DISTANCE = 1900;

export default function GalaxyView({ selectedProtein, onSelectProtein, targetDiseaseKey, onDiseaseFocus, onNarrate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const proteinMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const diseaseMeshesRef = useRef<Array<{ mesh: THREE.Mesh; node: DiseaseNode }>>([]);
  const connectionLinesRef = useRef<Map<LayerKey, THREE.LineSegments>>(new Map());
  const flyToRef = useRef<{ start: number; from: THREE.Vector3; to: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; duration: number } | null>(null);
  const hoveredIndexRef = useRef<number>(-1);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const selectedLabelRef = useRef<CSS2DObject | null>(null);

  const layout = useMemo(() => buildGalaxyLayout(), []);
  const tourScript = useMemo(() => buildTourScript(layout), [layout]);
  const [activeLayers, setActiveLayers] = useState<Set<LayerKey>>(new Set());
  const [focusInfo, setFocusInfo] = useState<{ kind: 'protein' | 'disease' | 'overview'; label: string; sub?: string }>({ kind: 'overview', label: 'Overview', sub: `${layout.proteins.length} proteins · 13 disease systems` });
  const [tourRunning, setTourRunning] = useState(false);
  const [tourStepIdx, setTourStepIdx] = useState(0);
  const tourCancelRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);
  // On mobile we hide the floating HUDs (focus card, info card, layer chips,
  // disease shortcuts) by default so the canvas gets the full viewport. The
  // user can toggle them back via the "HUD" pill in the header.
  const [showHUD, setShowHUD] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => {
      setIsMobile(mq.matches);
      setShowHUD(!mq.matches);
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const HEIGHT = isMobile ? HEIGHT_MOBILE : HEIGHT_DESKTOP;
  // The "info card" is what shows in the top-left when something is focused.
  // It auto-dismisses after AUTO_DISMISS_MS, can be closed early via the X.
  const [infoFocus, setInfoFocus] = useState<{ kind: 'protein'; gene: string } | { kind: 'disease'; diseaseKey: string } | null>(null);
  const [infoClosed, setInfoClosed] = useState<boolean>(false);
  useEffect(() => {
    if (!infoFocus || infoClosed) return;
    const t = setTimeout(() => setInfoClosed(true), 12000);
    return () => clearTimeout(t);
  }, [infoFocus, infoClosed]);
  // Reset closed state whenever focus changes.
  useEffect(() => { setInfoClosed(false); }, [infoFocus]);

  // Initial scene setup
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, container.clientWidth / HEIGHT, 1, 8000);
    camera.position.set(0, 600, OVERVIEW_DISTANCE);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, HEIGHT);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // CSS2D renderer overlays HTML labels at projected world positions. The
    // canvas it produces sits on top of the WebGL canvas with pointer-events
    // off so clicks still reach the 3D scene; individual labels can opt back
    // in via .pointer-events-auto if interactive.
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, HEIGHT);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(OVERVIEW_TARGET);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 80;
    controls.maxDistance = 4000;
    controlsRef.current = controls;

    // Ambient + a single directional rim light from above.
    scene.add(new THREE.AmbientLight(0x4a6da7, 0.5));
    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(500, 800, 200);
    scene.add(rim);

    // Background star field (inert, decorative).
    const bgStarGeom = new THREE.BufferGeometry();
    const bgStarCount = 600;
    const bgStarPositions = new Float32Array(bgStarCount * 3);
    for (let i = 0; i < bgStarCount; i++) {
      const r = 5500 + Math.random() * 1500;
      const t = Math.random() * Math.PI * 2;
      const p = (Math.random() - 0.5) * Math.PI;
      bgStarPositions[i * 3]     = Math.cos(t) * Math.cos(p) * r;
      bgStarPositions[i * 3 + 1] = Math.sin(p) * r;
      bgStarPositions[i * 3 + 2] = Math.sin(t) * Math.cos(p) * r;
    }
    bgStarGeom.setAttribute('position', new THREE.BufferAttribute(bgStarPositions, 3));
    const bgStars = new THREE.Points(bgStarGeom, new THREE.PointsMaterial({
      color: 0xaab8d4,
      size: 2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.55,
    }));
    scene.add(bgStars);

    // Disease stars (large glowing spheres at 13 ring positions).
    const diseaseMeshes: Array<{ mesh: THREE.Mesh; node: DiseaseNode }> = [];
    for (const d of layout.diseases) {
      const color = new THREE.Color(d.color);
      const haloGeom = new THREE.SphereGeometry(40, 24, 24);
      const haloMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.12, depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeom, haloMat);
      halo.position.set(...d.position);
      scene.add(halo);

      const coreGeom = new THREE.SphereGeometry(18, 32, 32);
      const coreMat = new THREE.MeshBasicMaterial({ color });
      const core = new THREE.Mesh(coreGeom, coreMat);
      core.position.set(...d.position);
      core.userData.diseaseKey = d.key;
      core.userData.diseaseNode = d;
      scene.add(core);

      diseaseMeshes.push({ mesh: core, node: d });

      // Disease emblem: the disease icon rendered as a glyph at the center of
      // the star, so each star is visually identified by its disease symbol.
      const emblemEl = document.createElement('div');
      emblemEl.innerHTML = diseaseIconSvgString(d.key, 24, '#0a0e1a');
      Object.assign(emblemEl.style, {
        pointerEvents: 'none',
        opacity: '0.92',
        // Subtle outer glow in the disease color for the "this is the star's
        // identity" feel; inner dark drop-shadow lifts the glyph off the
        // colored sphere even when colors are similar.
        filter: `drop-shadow(0 0 0 ${d.color}AA) drop-shadow(0 1px 1px rgba(0,0,0,0.4))`,
      });
      const emblemObj = new CSS2DObject(emblemEl);
      emblemObj.position.set(...d.position);
      scene.add(emblemObj);

      // Always-visible disease name, positioned just above the star.
      const labelEl = document.createElement('div');
      labelEl.title = d.label;
      labelEl.textContent = d.shortLabel;
      Object.assign(labelEl.style, {
        background: 'rgba(7, 11, 32, 0.85)',
        border: `1px solid ${d.color}88`,
        color: d.color,
        padding: '3px 9px',
        borderRadius: '999px',
        fontSize: '10px',
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        fontWeight: '500',
        whiteSpace: 'nowrap',
        textShadow: `0 0 8px ${d.color}40`,
        boxShadow: `0 2px 12px rgba(0,0,0,0.4), 0 0 12px ${d.color}22`,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      });
      const labelObj = new CSS2DObject(labelEl);
      labelObj.position.set(d.position[0], d.position[1] + 56, d.position[2]);
      scene.add(labelObj);
    }
    diseaseMeshesRef.current = diseaseMeshes;

    // Protein planets as a single InstancedMesh.
    const proteinGeom = new THREE.SphereGeometry(1, 8, 8);
    const proteinMat = new THREE.MeshLambertMaterial({ vertexColors: false });
    const inst = new THREE.InstancedMesh(proteinGeom, proteinMat, layout.proteins.length);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const colorAttr = new Float32Array(layout.proteins.length * 3);
    const dummy = new THREE.Object3D();
    layout.proteins.forEach((p, i) => {
      dummy.position.set(...p.position);
      dummy.scale.setScalar(p.size);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      const c = new THREE.Color(ORGAN_COLOR_BY_KEY[p.organ] ?? 0xaaaaaa);
      colorAttr[i * 3] = c.r;
      colorAttr[i * 3 + 1] = c.g;
      colorAttr[i * 3 + 2] = c.b;
    });
    inst.geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colorAttr, 3));
    // Wire vertex colors: use a custom material with onBeforeCompile to
    // sample per-instance color. Simpler: switch to MeshBasicMaterial and
    // tint each instance via setColorAt.
    const mat2 = new THREE.MeshBasicMaterial({ vertexColors: true });
    const inst2 = new THREE.InstancedMesh(proteinGeom, mat2, layout.proteins.length);
    inst2.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(layout.proteins.length * 3), 3);
    layout.proteins.forEach((p, i) => {
      dummy.position.set(...p.position);
      dummy.scale.setScalar(p.size);
      dummy.updateMatrix();
      inst2.setMatrixAt(i, dummy.matrix);
      const c = new THREE.Color(ORGAN_COLOR_BY_KEY[p.organ] ?? 0xaaaaaa);
      inst2.setColorAt(i, c);
    });
    inst2.instanceMatrix.needsUpdate = true;
    if (inst2.instanceColor) inst2.instanceColor.needsUpdate = true;
    proteinMeshRef.current = inst2;
    scene.add(inst2);

    // Mouse interactions
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 4 };
    const mouse = new THREE.Vector2();

    const handleMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      // Disease stars first (larger, less ambiguous)
      const diseaseHits = raycaster.intersectObjects(diseaseMeshes.map((d) => d.mesh));
      if (diseaseHits.length > 0) {
        const node = diseaseHits[0].object.userData.diseaseNode as DiseaseNode;
        flyTo(new THREE.Vector3(...node.position), 220);
        setFocusInfo({ kind: 'disease', label: node.label, sub: `${node.proteinCount} proteins · ${node.shortLabel}` });
        setInfoFocus({ kind: 'disease', diseaseKey: node.key });
        onDiseaseFocus?.(node.key);
        return;
      }

      const protHits = raycaster.intersectObject(inst2);
      if (protHits.length > 0 && protHits[0].instanceId !== undefined) {
        const idx = protHits[0].instanceId;
        const p = layout.proteins[idx];
        flyTo(new THREE.Vector3(...p.position), 80);
        setFocusInfo({ kind: 'protein', label: p.gene, sub: `${p.diseaseLabel} · score ${p.score.toFixed(2)}` });
        setInfoFocus({ kind: 'protein', gene: p.gene });
        onSelectProtein(p.gene);
      }
    };

    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('click', handleClick);

    // Animation loop
    let frameId = 0;
    const tick = () => {
      frameId = requestAnimationFrame(tick);
      controls.update();

      // Smooth fly-to: ease the camera + target along an arc.
      const fly = flyToRef.current;
      if (fly) {
        const t = Math.min(1, (performance.now() - fly.start) / fly.duration);
        const eased = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(fly.from, fly.to, eased);
        controls.target.lerpVectors(fly.fromTarget, fly.toTarget, eased);
        if (t >= 1) flyToRef.current = null;
      }

      // Highlight on hover (raycast against the instanced mesh in the loop so
      // hover is responsive even while flying).
      raycaster.setFromCamera(mouse, camera);
      const hovered = raycaster.intersectObject(inst2);
      const idx = (hovered.length > 0 && hovered[0].instanceId !== undefined) ? hovered[0].instanceId : -1;
      if (idx !== hoveredIndexRef.current) {
        hoveredIndexRef.current = idx;
        rendererRef.current!.domElement.style.cursor = idx >= 0 ? 'pointer' : 'default';
      }

      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    tick();

    // Resize observer keeps the canvas size in sync with its container.
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      camera.aspect = w / HEIGHT;
      labelRenderer.setSize(w, HEIGHT);
      camera.updateProjectionMatrix();
      renderer.setSize(w, HEIGHT);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('click', handleClick);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      if (container.contains(labelRenderer.domElement)) container.removeChild(labelRenderer.domElement);
    };
  }, [layout, onSelectProtein, HEIGHT]);

  // Sticky 3D-anchored label for the currently selected protein. Updates in
  // place when the selection changes; vanishes when nothing is selected.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (selectedLabelRef.current) {
      scene.remove(selectedLabelRef.current);
      selectedLabelRef.current = null;
    }

    if (!selectedProtein) return;
    const p = layout.proteinByGene.get(selectedProtein.gene);
    if (!p) return;

    const labelEl = document.createElement('div');
    const organColorHex = '#' + (
      ({ brain: 0x7F77DD, heart: 0xD85A30, liver: 0xBA7517, pancreas: 0x1D9E75, kidneys: 0x378ADD, adipose: 0xD4537E } as Record<string, number>)
        [p.organ] ?? 0xaaaaaa
    ).toString(16).padStart(6, '0');
    labelEl.innerHTML = `
      <div style="font-size:13px;font-weight:600;letter-spacing:0.5px;color:#fff;line-height:1.2">${p.gene}</div>
      <div style="font-size:9.5px;letter-spacing:1px;text-transform:uppercase;color:${organColorHex};margin-top:2px">${p.diseaseLabel}</div>
    `;
    Object.assign(labelEl.style, {
      background: 'rgba(7, 11, 32, 0.94)',
      border: `1px solid ${organColorHex}`,
      padding: '5px 11px',
      borderRadius: '8px',
      whiteSpace: 'nowrap',
      boxShadow: `0 4px 18px rgba(0,0,0,0.5), 0 0 16px ${organColorHex}55`,
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      transform: 'translate(0, -100%)',
      marginTop: '-12px',
    });

    const labelObj = new CSS2DObject(labelEl);
    labelObj.position.set(p.position[0], p.position[1] + 14 + p.size, p.position[2]);
    scene.add(labelObj);
    selectedLabelRef.current = labelObj;
  }, [selectedProtein, layout]);

  // Manage connection layers: build / dispose LineSegments objects on toggle.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const lines = connectionLinesRef.current;

    LAYERS.forEach((layer) => {
      const existing = lines.get(layer.key);
      const wantOn = activeLayers.has(layer.key);
      if (wantOn && !existing) {
        const obj = buildLayerLines(layer, layout.proteins);
        if (obj) {
          scene.add(obj);
          lines.set(layer.key, obj);
        }
      } else if (!wantOn && existing) {
        scene.remove(existing);
        existing.geometry.dispose();
        (existing.material as THREE.Material).dispose();
        lines.delete(layer.key);
      }
    });
  }, [activeLayers, layout]);

  // When the parent picks a different selected protein (e.g., from chat or
  // catalog), fly to it.
  useEffect(() => {
    if (!selectedProtein) return;
    const p = layout.proteinByGene.get(selectedProtein.gene);
    if (!p) return;
    flyTo(new THREE.Vector3(...p.position), 80);
    setFocusInfo({ kind: 'protein', label: p.gene, sub: `${p.diseaseLabel} · score ${p.score.toFixed(2)}` });
    setInfoFocus({ kind: 'protein', gene: p.gene });
  }, [selectedProtein, layout]);

  function flyTo(target: THREE.Vector3, distance: number) {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const dir = camera.position.clone().sub(controls.target).normalize();
    const newCamPos = target.clone().add(dir.multiplyScalar(distance));
    flyToRef.current = {
      start: performance.now(),
      from: camera.position.clone(),
      to: newCamPos,
      fromTarget: controls.target.clone(),
      toTarget: target.clone(),
      duration: 1300,
    };
  }

  function returnToOverview() {
    flyTo(OVERVIEW_TARGET, OVERVIEW_DISTANCE);
    setFocusInfo({ kind: 'overview', label: 'Overview', sub: `${layout.proteins.length} proteins · 13 disease systems` });
    setInfoFocus(null);
    onDiseaseFocus?.(null);
  }

  // Honor an external request to focus on a specific disease (e.g. from a
  // deep link `#view=galaxy&disease=nafld`).
  useEffect(() => {
    if (!targetDiseaseKey) return;
    const d = layout.diseases.find((x) => x.key === targetDiseaseKey);
    if (!d) return;
    // Defer slightly so the camera is initialized.
    const t = setTimeout(() => {
      flyTo(new THREE.Vector3(...d.position), 220);
      setFocusInfo({ kind: 'disease', label: d.label, sub: `${d.proteinCount} proteins · ${d.shortLabel}` });
      setInfoFocus({ kind: 'disease', diseaseKey: d.key });
    }, 150);
    return () => clearTimeout(t);
  }, [targetDiseaseKey, layout]);

  function toggleLayer(k: LayerKey) {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  // Tour runner. Walks the script step-by-step, narrating, flying, and
  // toggling layers. Steps are scheduled with chained setTimeouts whose ids
  // live in the cleanup queue so Stop is instant.
  useEffect(() => {
    if (!tourRunning) return;
    tourCancelRef.current = false;
    const timeouts: number[] = [];
    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        if (!tourCancelRef.current) fn();
      }, ms);
      timeouts.push(id);
    };

    const runStep = (i: number) => {
      if (tourCancelRef.current || i >= tourScript.length) {
        if (!tourCancelRef.current) {
          setTourRunning(false);
          setTourStepIdx(0);
        }
        return;
      }
      const step = tourScript[i];
      setTourStepIdx(i);
      if (step.narration && onNarrate) onNarrate(step.narration);

      switch (step.kind) {
        case 'overview': {
          flyTo(OVERVIEW_TARGET, OVERVIEW_DISTANCE);
          setFocusInfo({
            kind: 'overview',
            label: 'Overview',
            sub: `${layout.proteins.length} proteins · 13 disease systems`,
          });
          setInfoFocus(null);
          onDiseaseFocus?.(null);
          break;
        }
        case 'visit-disease': {
          const d = layout.diseases.find((x) => x.key === step.diseaseKey);
          if (d) {
            flyTo(new THREE.Vector3(...d.position), 220);
            setFocusInfo({ kind: 'disease', label: d.label, sub: `${d.proteinCount} proteins · ${d.shortLabel}` });
            setInfoFocus({ kind: 'disease', diseaseKey: d.key });
            onDiseaseFocus?.(d.key);
          }
          break;
        }
        case 'visit-protein': {
          const p = layout.proteinByGene.get(step.gene);
          if (p) {
            flyTo(new THREE.Vector3(...p.position), 80);
            setFocusInfo({ kind: 'protein', label: p.gene, sub: `${p.diseaseLabel} · score ${p.score.toFixed(2)}` });
            setInfoFocus({ kind: 'protein', gene: p.gene });
            // Bubble the selection up so the side panels refresh too.
            onSelectProtein(p.gene);
          }
          break;
        }
        case 'set-layers': {
          setActiveLayers(new Set(step.layers));
          break;
        }
      }

      schedule(() => runStep(i + 1), step.durationMs);
    };

    runStep(0);

    return () => {
      tourCancelRef.current = true;
      timeouts.forEach((id) => window.clearTimeout(id));
    };
    // The script and the layout are stable for a session; the rest of the
    // setters are referentially stable. Re-running this effect on every
    // render would yank the camera mid-tour, so we deliberately depend only
    // on `tourRunning`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourRunning]);

  function startTour() {
    setTourStepIdx(0);
    setTourRunning(true);
  }
  function stopTour() {
    tourCancelRef.current = true;
    setTourRunning(false);
    setTourStepIdx(0);
    setActiveLayers(new Set());
    returnToOverview();
  }

  return (
    <div className="w-full text-white/85">
      <div className="mb-3 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] tracking-[2.5px] text-cyan-300/70 font-medium uppercase">Galaxy</div>
          <div className="text-[18px] sm:text-[24px] tracking-wide font-light mt-1">Protein universe</div>
          <div className="text-[11px] text-white/45 mt-0.5">
            Drag to orbit · pinch to zoom · tap any star or planet to fly there
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
          <button
            onClick={tourRunning ? stopTour : startTour}
            className="rounded-full px-2.5 py-1 text-[10px] tracking-[1.5px] uppercase transition flex items-center gap-1.5"
            style={{
              background: tourRunning ? 'rgba(248, 113, 113, 0.15)' : 'rgba(127, 119, 221, 0.12)',
              border: `1px solid ${tourRunning ? 'rgba(248, 113, 113, 0.40)' : 'rgba(127, 119, 221, 0.45)'}`,
              color: tourRunning ? '#fca5a5' : '#a3a1ed',
            }}
            title={tourRunning ? 'Stop the galaxy tour' : 'Take the guided tour of the protein galaxy'}
          >
            <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor">
              {tourRunning ? <rect x="2" y="2" width="8" height="8" rx="1" /> : <polygon points="2,1 11,6 2,11" />}
            </svg>
            {tourRunning ? `Stop · ${tourStepIdx + 1}/${tourScript.length}` : 'Tour'}
          </button>
          <button
            onClick={() => setShowHUD((s) => !s)}
            className="sm:hidden rounded-full px-2.5 py-1 text-[10px] tracking-[1px] transition"
            style={{
              background: showHUD ? 'rgba(45, 212, 191, 0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${showHUD ? 'rgba(45, 212, 191, 0.45)' : 'rgba(255,255,255,0.10)'}`,
              color: showHUD ? '#5eead4' : 'rgba(255,255,255,0.55)',
            }}
            title="Toggle the HUD overlay (focus card, layer chips, disease shortcuts)"
          >
            HUD {showHUD ? '●' : '○'}
          </button>
          <div className={`items-center gap-1.5 flex-wrap justify-end ${showHUD ? 'flex' : 'hidden sm:flex'}`}>
            {LAYERS.map((layer) => {
              const active = activeLayers.has(layer.key);
              return (
                <button
                  key={layer.key}
                  onClick={() => toggleLayer(layer.key)}
                  disabled={tourRunning}
                  className="rounded-full px-2.5 py-0.5 text-[10px] tracking-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: active ? `${layer.color}1F` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? layer.color : 'rgba(255,255,255,0.10)'}`,
                    color: active ? layer.color : 'rgba(255,255,255,0.55)',
                  }}
                  title={tourRunning ? 'Layer toggles are driven by the tour right now' : layer.description}
                >
                  {layer.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden"
        style={{
          height: HEIGHT,
          background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(45, 212, 191, 0.05) 0%, rgba(7, 11, 32, 0) 70%)',
          border: '1px solid rgba(45, 212, 191, 0.15)',
          boxShadow: 'inset 0 0 80px rgba(45, 212, 191, 0.04)',
        }}
      >
        {/* Info card: rich info on the focused protein or disease, dismissable */}
        {showHUD && infoFocus && !infoClosed && infoFocus.kind === 'protein' && layout.proteinByGene.has(infoFocus.gene) && (
          <ProteinInfoCard
            protein={layout.proteinByGene.get(infoFocus.gene)!}
            onClose={() => setInfoClosed(true)}
          />
        )}
        {showHUD && infoFocus && !infoClosed && infoFocus.kind === 'disease' && (
          <DiseaseInfoCard
            disease={layout.diseases.find((d) => d.key === infoFocus.diseaseKey)!}
            onClose={() => setInfoClosed(true)}
            onJumpToProtein={(gene) => {
              const p = layout.proteinByGene.get(gene);
              if (p) {
                flyTo(new THREE.Vector3(...p.position), 80);
                setInfoFocus({ kind: 'protein', gene });
                onSelectProtein(gene);
              }
            }}
          />
        )}
        {showHUD && (!infoFocus || infoClosed) && (
          <div
            className="absolute top-3 left-3 rounded-lg px-3 py-2 pointer-events-none max-w-[60%] sm:max-w-[280px]"
            style={{
              background: 'rgba(7, 11, 32, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.10)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <div className="text-[9px] tracking-[2px] text-white/45 uppercase">{focusInfo.kind}</div>
            <div className="text-white text-[13px] tracking-wide font-medium mt-0.5 truncate">{focusInfo.label}</div>
            {focusInfo.sub && <div className="text-[10.5px] text-white/55 mt-0.5 truncate">{focusInfo.sub}</div>}
          </div>
        )}

        {/* Return-to-overview pill */}
        {focusInfo.kind !== 'overview' && (
          <button
            onClick={returnToOverview}
            className="absolute top-3 right-3 rounded-full px-3 py-1.5 text-[10px] tracking-[1.5px] uppercase transition"
            style={{
              background: 'rgba(45, 212, 191, 0.10)',
              border: '1px solid rgba(45, 212, 191, 0.40)',
              color: '#5eead4',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            title="Fly back out to the galactic overview"
          >
            ◇ Overview
          </button>
        )}

        {/* Direct-jump shortcuts to any disease system */}
        {showHUD && (
        <div
          className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1 pointer-events-auto"
          style={{ maxWidth: 'calc(100% - 24px)' }}
        >
          {layout.diseases.map((d) => (
            <button
              key={d.key}
              onClick={() => {
                flyTo(new THREE.Vector3(...d.position), 220);
                setFocusInfo({ kind: 'disease', label: d.label, sub: `${d.proteinCount} proteins · ${d.shortLabel}` });
                setInfoFocus({ kind: 'disease', diseaseKey: d.key });
                onDiseaseFocus?.(d.key);
              }}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] tracking-[0.5px] transition"
              style={{
                background: focusInfo.kind === 'disease' && focusInfo.label === d.label ? `${d.color}33` : 'rgba(7, 11, 32, 0.65)',
                border: `1px solid ${d.color}66`,
                color: d.color,
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
              title={d.description}
            >
              <DiseaseIcon diseaseKey={d.key} size={11} />
              <span>{d.shortLabel}</span>
            </button>
          ))}
        </div>
        )}
      </div>

      <Legend layers={LAYERS} active={activeLayers} />
    </div>
  );
}

function ProteinInfoCard({ protein, onClose }: { protein: ProteinNode; onClose: () => void }) {
  const organColor = '#' + (
    ({ brain: 0x7F77DD, heart: 0xD85A30, liver: 0xBA7517, pancreas: 0x1D9E75, kidneys: 0x378ADD, adipose: 0xD4537E } as Record<string, number>)
      [protein.organ] ?? 0xaaaaaa
  ).toString(16).padStart(6, '0');

  const [copied, setCopied] = useState(false);
  const openDeepDive = (cardTitle: string) => {
    window.dispatchEvent(new CustomEvent('human-os:open-deep-dive', { detail: { cardTitle } }));
  };
  const copyLink = () => {
    if (typeof window === 'undefined' || !navigator.clipboard) return;
    // Protein deep links keep the hash format for now — per-protein static
    // share pages are a v2 add-on (~1903 to generate). Falls back gracefully.
    const url = `${window.location.origin}${window.location.pathname}#view=galaxy&protein=${protein.gene}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };

  // Trim function summary to a readable preview.
  const fnPreview = (() => {
    const fn = (protein.function || '').trim();
    if (fn.length <= 220) return fn;
    const cut = fn.slice(0, 220);
    const dot = cut.lastIndexOf('.');
    return (dot > 80 ? cut.slice(0, dot + 1) : cut + '…');
  })();

  return (
    <div
      className="absolute top-3 left-3 rounded-xl px-3.5 py-3 pointer-events-auto max-w-[320px]"
      style={{
        background: 'rgba(7, 11, 32, 0.92)',
        border: `1px solid ${organColor}55`,
        boxShadow: `0 8px 24px rgba(0,0,0,0.5), inset 0 0 30px ${organColor}10`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white/45 hover:text-white hover:bg-white/10 transition"
        aria-label="Close info panel"
        title="Close (auto-dismisses in 12s)"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <div className="text-[9px] tracking-[2.5px] uppercase font-medium" style={{ color: organColor }}>
        Protein
      </div>
      <div className="flex items-baseline gap-2 mt-0.5 pr-6">
        <div className="text-[20px] tracking-wide font-medium text-white">{protein.gene}</div>
        <div className="text-[10px] text-white/45 font-mono">{protein.uniprot}</div>
      </div>
      <div className="text-[11px] text-white/65 mt-0.5 leading-tight">{protein.name}</div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        <Badge text={protein.diseaseLabel} color={organColor} />
        <Badge text={protein.functionClass} color="#94a3b8" />
        {protein.geneFamily !== 'Other' && (
          <Badge text={protein.geneFamily.replace(/ \(.*$/, '')} color="#5eead4" />
        )}
        {protein.isDrugTarget && <Badge text="Drug target" color="#fbbf24" />}
      </div>

      <div className="grid grid-cols-3 gap-1.5 mt-2.5">
        <Stat label="Score"   value={protein.score.toFixed(2)} />
        <Stat label="pLDDT"   value={protein.plddt != null ? protein.plddt.toFixed(1) : '—'} />
        <Stat label="Variants" value={protein.variantCount != null ? (protein.variantCount >= 500 ? '500+' : String(protein.variantCount)) : '—'} />
      </div>

      <div className="mt-2.5 text-[10.5px] text-white/65 leading-relaxed">
        {fnPreview}
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        <DeepDiveButton color={organColor} label="Structure"  onClick={() => openDeepDive('MOLECULAR STRUCTURE')} />
        <DeepDiveButton color={organColor} label="Variance"   onClick={() => openDeepDive('PATIENT POPULATION')} />
        <DeepDiveButton color={organColor} label="Binding"    onClick={() => openDeepDive('PROTEIN BINDING')} />
        <DeepDiveButton color={organColor} label="Toxicity"   onClick={() => openDeepDive('TOXICITY')} />
      </div>
      <button
        onClick={copyLink}
        className="mt-2 w-full rounded-md py-1 text-[10px] tracking-[1.5px] uppercase transition flex items-center justify-center gap-1.5"
        style={{
          background: copied ? `${organColor}22` : 'rgba(255,255,255,0.04)',
          border: `1px solid ${organColor}40`,
          color: copied ? organColor : 'rgba(255,255,255,0.65)',
        }}
        title="Copy a deep link to this protein"
      >
        {copied ? '✓ Link copied' : (
          <>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Copy link
          </>
        )}
      </button>
    </div>
  );
}

function DiseaseInfoCard({ disease, onClose, onJumpToProtein }: {
  disease: DiseaseNode;
  onClose: () => void;
  onJumpToProtein: (gene: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    if (typeof window === 'undefined' || !navigator.clipboard) return;
    // Path-based URL so crawlers / social cards can resolve per-disease meta.
    // The static landing page redirects users into the SPA with the right hash.
    const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
    const url = `${window.location.origin}${basePath}/disease/${disease.key}/`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };
  // Pull a few top proteins for this disease from the layout — proteins whose
  // primary disease label matches. The galaxy layout already has them grouped
  // by primary disease but we filter here for the rendered top-N.
  const proteins = useMemo(() => {
    const layout = buildGalaxyLayout();
    return layout.proteins
      .filter((p) => p.diseaseLabel.toLowerCase() === disease.label.toLowerCase())
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [disease.label]);

  return (
    <div
      className="absolute top-3 left-3 rounded-xl px-3.5 py-3 pointer-events-auto max-w-[340px]"
      style={{
        background: 'rgba(7, 11, 32, 0.92)',
        border: `1px solid ${disease.color}55`,
        boxShadow: `0 8px 24px rgba(0,0,0,0.5), inset 0 0 30px ${disease.color}10`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white/45 hover:text-white hover:bg-white/10 transition"
        aria-label="Close info panel"
        title="Close (auto-dismisses in 12s)"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <div className="flex items-center gap-2 pr-6">
        <span style={{ color: disease.color }}><DiseaseIcon diseaseKey={disease.key} size={16} /></span>
        <div className="text-[9px] tracking-[2.5px] uppercase font-medium" style={{ color: disease.color }}>
          Disease
        </div>
      </div>
      <div className="text-[18px] tracking-wide font-medium text-white mt-1 pr-6">{disease.label}</div>
      <div className="text-[10px] text-white/45 font-mono mt-0.5">primary organ · {disease.primaryOrgan}</div>

      <div className="text-[11.5px] text-white/75 mt-2.5 leading-relaxed">
        {disease.description}
      </div>

      <div className="grid grid-cols-2 gap-1.5 mt-2.5">
        <Stat label="Proteins"  value={disease.proteinCount.toString()} />
        <Stat label="Short"     value={disease.shortLabel} />
      </div>

      {proteins.length > 0 && (
        <>
          <div className="text-[9px] tracking-[2px] text-white/45 uppercase mt-3 mb-1.5">Top proteins</div>
          <div className="flex flex-wrap gap-1">
            {proteins.map((p) => (
              <button
                key={p.gene}
                onClick={() => onJumpToProtein(p.gene)}
                className="rounded-full px-2 py-0.5 text-[10px] tracking-wide transition"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${disease.color}55`,
                  color: 'rgba(255,255,255,0.85)',
                }}
                title={`Fly to ${p.gene} · score ${p.score.toFixed(2)}`}
              >
                {p.gene} <span className="opacity-50 font-mono">{p.score.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <button
        onClick={copyLink}
        className="mt-3 w-full rounded-md py-1 text-[10px] tracking-[1.5px] uppercase transition flex items-center justify-center gap-1.5"
        style={{
          background: copied ? `${disease.color}22` : 'rgba(255,255,255,0.04)',
          border: `1px solid ${disease.color}40`,
          color: copied ? disease.color : 'rgba(255,255,255,0.65)',
        }}
        title="Copy a deep link to this disease in the galaxy"
      >
        {copied ? '✓ Link copied' : (
          <>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Copy link
          </>
        )}
      </button>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="rounded-full px-1.5 py-px text-[9px] tracking-wide"
      style={{ background: `${color}1A`, border: `1px solid ${color}40`, color: `${color}E6` }}
    >
      {text}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md px-1.5 py-0.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[8.5px] tracking-[1.5px] text-white/40 uppercase">{label}</div>
      <div className="text-[12px] text-white font-mono">{value}</div>
    </div>
  );
}

function DeepDiveButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-2 py-1 text-[9.5px] tracking-[1px] uppercase transition"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${color}55`,
        color,
      }}
      title={`Open ${label} deep-dive`}
    >
      {label} →
    </button>
  );
}

function buildLayerLines(layer: LayerConfig, proteins: ProteinNode[]): THREE.LineSegments | null {
  const segments: number[] = [];
  const colorVals: number[] = [];
  const c = new THREE.Color(layer.color);

  if (layer.key === 'family') {
    const byFam = new Map<string, ProteinNode[]>();
    for (const p of proteins) {
      if (p.geneFamily === 'Other') continue;
      const arr = byFam.get(p.geneFamily) ?? [];
      arr.push(p);
      byFam.set(p.geneFamily, arr);
    }
    for (const members of byFam.values()) {
      if (members.length < 2) continue;
      const sorted = [...members].sort((a, b) => b.score - a.score);
      for (let i = 0; i < sorted.length - 1; i++) {
        pushSegment(sorted[i].position, sorted[i + 1].position);
      }
    }
  } else if (layer.key === 'drug') {
    const drugs = proteins.filter((p) => p.isDrugTarget);
    // Connect each drug-target to its 2 nearest drug-target neighbors (chain).
    for (let i = 0; i < drugs.length; i++) {
      const a = drugs[i];
      const others = drugs.filter((_, j) => j !== i)
        .map((b) => ({ b, d: dist3(a.position, b.position) }))
        .sort((x, y) => x.d - y.d)
        .slice(0, 2);
      for (const { b } of others) pushSegment(a.position, b.position);
    }
  } else if (layer.key === 'organ') {
    const byOrg = new Map<string, ProteinNode[]>();
    for (const p of proteins) {
      const arr = byOrg.get(p.organ) ?? [];
      arr.push(p);
      byOrg.set(p.organ, arr);
    }
    for (const members of byOrg.values()) {
      if (members.length < 2) continue;
      const sorted = [...members].sort((a, b) => b.score - a.score).slice(0, 30);
      for (let i = 0; i < sorted.length - 1; i++) {
        pushSegment(sorted[i].position, sorted[i + 1].position);
      }
    }
  } else if (layer.key === 'function') {
    const byFn = new Map<string, ProteinNode[]>();
    for (const p of proteins) {
      const arr = byFn.get(p.functionClass) ?? [];
      arr.push(p);
      byFn.set(p.functionClass, arr);
    }
    for (const members of byFn.values()) {
      if (members.length < 2) continue;
      const sorted = [...members].sort((a, b) => b.score - a.score).slice(0, 20);
      for (let i = 0; i < sorted.length - 1; i++) {
        pushSegment(sorted[i].position, sorted[i + 1].position);
      }
    }
  }

  function pushSegment(a: [number, number, number], b: [number, number, number]) {
    segments.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    colorVals.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }

  if (segments.length === 0) return null;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colorVals, 3));
  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  return new THREE.LineSegments(geom, mat);
}

function dist3(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function Legend({ layers, active }: { layers: LayerConfig[]; active: Set<LayerKey> }) {
  return (
    <div className="mt-3 flex items-center justify-between text-[9.5px] tracking-[1.5px] text-white/40 uppercase">
      <div className="flex items-center gap-3 flex-wrap">
        <LegendDot color="#7F77DD" label="Brain" />
        <LegendDot color="#D85A30" label="Heart" />
        <LegendDot color="#BA7517" label="Liver" />
        <LegendDot color="#1D9E75" label="Pancreas" />
        <LegendDot color="#378ADD" label="Kidneys" />
        <LegendDot color="#D4537E" label="Adipose" />
      </div>
      <div className="flex items-center gap-3">
        {active.size === 0 ? (
          <span>Layers off — click a chip above to overlay connections</span>
        ) : (
          <span>
            {Array.from(active).map((k) => layers.find((l) => l.key === k)?.label).filter(Boolean).join(' · ')} on
          </span>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="rounded-full" style={{ width: 6, height: 6, background: color, boxShadow: `0 0 5px ${color}` }} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tour
// ---------------------------------------------------------------------------

type TourStep =
  | { kind: 'overview'; durationMs: number; narration?: string }
  | { kind: 'visit-disease'; diseaseKey: string; durationMs: number; narration?: string }
  | { kind: 'visit-protein'; gene: string; durationMs: number; narration?: string }
  | { kind: 'set-layers'; layers: LayerKey[]; durationMs: number; narration?: string };

function buildTourScript(layout: ReturnType<typeof buildGalaxyLayout>): TourStep[] {
  const steps: TourStep[] = [];

  // Helper: top-N proteins for a disease, by association score.
  const topProteinsFor = (key: string, n = 1): ProteinNode[] =>
    layout.proteins
      .filter((p) => p.diseaseKey === key)
      .sort((a, b) => b.score - a.score)
      .slice(0, n);

  // Cross-system gene-family pair: a gene family with members in two
  // different diseases. Pick the highest-score representative from each of
  // the two diseases. This is the "follow a link across the galaxy" beat.
  const familyMembers = new Map<string, ProteinNode[]>();
  for (const p of layout.proteins) {
    if (p.geneFamily === 'Other') continue;
    const arr = familyMembers.get(p.geneFamily) ?? [];
    arr.push(p);
    familyMembers.set(p.geneFamily, arr);
  }
  let crossPair: { a: ProteinNode; b: ProteinNode; family: string } | null = null;
  for (const [family, members] of familyMembers.entries()) {
    const byDisease = new Map<string, ProteinNode[]>();
    for (const m of members) {
      const arr = byDisease.get(m.diseaseKey) ?? [];
      arr.push(m);
      byDisease.set(m.diseaseKey, arr);
    }
    if (byDisease.size < 2) continue;
    // Pick the two diseases whose strongest member sums to the highest
    // combined score — keeps the demo on well-evidenced links.
    const reps = [...byDisease.entries()]
      .map(([, arr]) => arr.sort((x, y) => y.score - x.score)[0])
      .sort((x, y) => y.score - x.score);
    const candidate = { a: reps[0], b: reps[1], family };
    if (!crossPair || candidate.a.score + candidate.b.score > crossPair.a.score + crossPair.b.score) {
      crossPair = candidate;
    }
  }

  // Top three diseases by associated-protein count.
  const topDiseases = [...layout.diseases]
    .sort((a, b) => b.proteinCount - a.proteinCount)
    .slice(0, 3);

  // Step 1: overview / orientation.
  steps.push({
    kind: 'overview',
    durationMs: 9000,
    narration:
      'Welcome to the protein galaxy. Thirteen cardiometabolic disease stars form a ring; their associated proteins orbit each star. Distance from the star reflects OpenTargets evidence — closer means stronger association. Color encodes the protein\'s primary organ.',
  });

  // Step 2: ring sweep — quick fly-through every disease so the user sees
  // them all named once. ~1.6s per disease, no per-disease narration to keep
  // it visually fluid.
  steps.push({
    kind: 'overview',
    durationMs: 4000,
    narration: 'First, a quick sweep of all thirteen disease systems.',
  });
  for (const d of layout.diseases) {
    steps.push({
      kind: 'visit-disease',
      diseaseKey: d.key,
      durationMs: 1700,
    });
  }

  // Step 3: deep dive into the top three by protein count.
  topDiseases.forEach((d, i) => {
    steps.push({
      kind: 'visit-disease',
      diseaseKey: d.key,
      durationMs: 4500,
      narration:
        i === 0
          ? `Top of the list by protein count: ${d.label}, with ${d.proteinCount} associated proteins. The closest planets carry the strongest evidence.`
          : `${d.label}. ${d.proteinCount} proteins in this system.`,
    });
    const top = topProteinsFor(d.key, 1)[0];
    if (top) {
      steps.push({
        kind: 'visit-protein',
        gene: top.gene,
        durationMs: 6500,
        narration:
          `${top.gene} sits closest to ${d.shortLabel} because its association score is ${top.score.toFixed(2)} — the highest in this system. ` +
          `It's coloured for ${top.organLabel.toLowerCase()} because that's where it's primarily expressed${top.isDrugTarget ? ', and the dashed halo marks it as a drug target' : ''}.`,
      });
    }
  });

  // Step 4: layer demos. Each one toggles ON, holds, then the next step
  // replaces the layer set. Ends with gene-family ON for the cross-link demo.
  steps.push({
    kind: 'set-layers',
    layers: ['organ'],
    durationMs: 6000,
    narration:
      'Turning on the same-organ layer. Lines now connect proteins that share an organ — useful for spotting tissue-specific clusters that span multiple diseases.',
  });
  steps.push({
    kind: 'set-layers',
    layers: ['function'],
    durationMs: 6000,
    narration:
      'Function class: ion channels link to ion channels, kinases to kinases. The same molecular role surfaces across unrelated diseases.',
  });
  steps.push({
    kind: 'set-layers',
    layers: ['drug'],
    durationMs: 5000,
    narration:
      'Drug targets — the pharmacologically actionable proteins. The chains track the closest drug-target neighbours, which is where drug-repurposing ideas tend to live.',
  });
  steps.push({
    kind: 'set-layers',
    layers: ['family'],
    durationMs: 5000,
    narration:
      'Gene family — APO, KCN, SCN, F, HNF and friends. Siblings often live in different disease systems; these are the structural cousins.',
  });

  // Step 5: cross-system link traversal along a real gene-family edge.
  if (crossPair) {
    const { a, b, family } = crossPair;
    const familyShort = family.replace(/ \(.*$/, '');
    steps.push({
      kind: 'visit-protein',
      gene: a.gene,
      durationMs: 5000,
      narration:
        `Following one of those gene-family links now. ${a.gene} sits in ${a.diseaseLabel} — a ${familyShort} family member.`,
    });
    steps.push({
      kind: 'visit-protein',
      gene: b.gene,
      durationMs: 7000,
      narration:
        `Across the galaxy: ${b.gene} in ${b.diseaseLabel}. Same ${familyShort} family. Different disease, shared structural backbone — that's the thread the family layer is tracing.`,
    });
  }

  // Step 6: outro / hand-off back to free explore.
  steps.push({
    kind: 'set-layers',
    layers: [],
    durationMs: 6000,
    narration:
      'End of tour. Toggle any layer, click any star or planet to fly there, or ask the chat for a deep dive on what you see.',
  });

  return steps;
}
