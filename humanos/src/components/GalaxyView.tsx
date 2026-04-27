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

/** Per-instance alpha used for the planet fade. We compute the alpha from
 *  each protein's QUANTILE RANK within its disease, not from the raw score,
 *  because the score distribution is tight enough (half the dataset between
 *  0.44 and 0.54) that any linear-on-score mapping reads as "everything's
 *  the same opacity". Quantile rank guarantees that within any one disease
 *  the strongest evidence reads at full opacity and the weakest at minimum
 *  regardless of how compressed the absolute scores are. */
const ALPHA_MIN = 0.18;
const ALPHA_MAX = 0.9;
function buildAlphaByGene(proteins: ProteinNode[]): Map<string, number> {
  const byDisease = new Map<string, ProteinNode[]>();
  for (const p of proteins) {
    const arr = byDisease.get(p.diseaseKey) ?? [];
    arr.push(p);
    byDisease.set(p.diseaseKey, arr);
  }
  const out = new Map<string, number>();
  for (const arr of byDisease.values()) {
    const sorted = [...arr].sort((a, b) => b.score - a.score);
    const n = sorted.length;
    sorted.forEach((p, i) => {
      // Rank 0 = best evidence in this disease → ALPHA_MAX. Rank n-1 = worst
      // → ALPHA_MIN. Single-protein diseases get the max.
      const t = n <= 1 ? 0 : i / (n - 1);
      out.set(p.gene, ALPHA_MAX - t * (ALPHA_MAX - ALPHA_MIN));
    });
  }
  return out;
}

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
  const diseaseHalosRef = useRef<Array<{ mesh: THREE.Mesh; node: DiseaseNode }>>([]);
  const connectionLinesRef = useRef<Map<LayerKey, THREE.LineSegments>>(new Map());
  // Animated wormhole at the galactic origin — a clickable teaser for the
  // Discovery app. Rings rotate at different speeds in the tick loop, the
  // group has a subtle breathing pulse, and a click pops the promo modal.
  const wormholeRef = useRef<{
    group: THREE.Group;
    parallels: Array<{
      line: THREE.Line;
      material: THREE.LineBasicMaterial;
      phase: number;
      segs: number;
    }>;
    halfHeight: number;
    throatRadius: number;
    flareRadius: number;
    radiusAt: (y: number) => number;
    core: THREE.Mesh;
    hitbox: THREE.Mesh;
  } | null>(null);
  // Convergence animation: when the user clicks "Step through" on the
  // wormhole modal, every disease star, halo, label and protein instance
  // lerps toward the throat with shrinking scale and fading alpha, then
  // we navigate to /discovery/. The ref holds the start time, the duration,
  // and a snapshot of the per-instance alphas so the lerp doesn't compound
  // across frames.
  const convergenceRef = useRef<{
    start: number;
    duration: number;
    throat: THREE.Vector3;
    baseAlphas: Float32Array;
  } | null>(null);
  const flyToRef = useRef<{ start: number; from: THREE.Vector3; to: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; duration: number } | null>(null);
  const hoveredIndexRef = useRef<number>(-1);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const selectedLabelRef = useRef<CSS2DObject | null>(null);
  // Track the index of the currently highlighted instance so we can restore
  // its original organ-tint color before promoting a new one.
  const highlightedIdxRef = useRef<number>(-1);
  // Hold the latest prop callback in a ref so the scene-setup effect can read
  // it without taking a dependency on the prop reference. The parent passes
  // these as inline arrows, so without the ref the entire WebGL scene would
  // tear down and rebuild every time selectedProtein changes — which is
  // exactly what the tour does, mid-fly, breaking cross-system fly-tos.
  const onSelectProteinRef = useRef(onSelectProtein);
  useEffect(() => { onSelectProteinRef.current = onSelectProtein; }, [onSelectProtein]);

  const layout = useMemo(() => buildGalaxyLayout(), []);
  const tourScript = useMemo(() => buildTourScript(layout), [layout]);
  const [activeLayers, setActiveLayers] = useState<Set<LayerKey>>(new Set());
  const [focusInfo, setFocusInfo] = useState<{ kind: 'protein' | 'disease' | 'overview'; label: string; sub?: string }>({ kind: 'overview', label: 'Overview', sub: `${layout.proteins.length} proteins · ${layout.diseases.length} disease systems` });
  const [tourRunning, setTourRunning] = useState(false);
  const [tourStepIdx, setTourStepIdx] = useState(0);
  const tourCancelRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);
  // On mobile we hide the floating HUDs (focus card, info card, layer chips,
  // disease shortcuts) by default so the canvas gets the full viewport. The
  // user can toggle them back via the "HUD" pill in the header.
  const [showHUD, setShowHUD] = useState(true);

  // Per-element chrome visibility, driven by the gear/options panel. Lets the
  // user collapse the galaxy to its bare 3D canvas (every key set to false)
  // so the universe reads cleanly for screenshots / demos.
  // detailCard is intentionally NOT in this list: clicking a star or planet
  // is an explicit "tell me about this" gesture, so its info card surfaces
  // every time regardless of chrome state. Everything else honors the gear
  // toggles even on click.
  type ChromeKey = 'header' | 'focusCard' | 'connectionCard' | 'overviewPill' | 'diseaseShortcuts' | 'diseaseLabels' | 'legend';
  const [chrome, setChrome] = useState<Record<ChromeKey, boolean>>({
    header: true,
    focusCard: true,
    connectionCard: true,
    overviewPill: true,
    diseaseShortcuts: true,
    diseaseLabels: true,
    legend: true,
  });
  const [optionsOpen, setOptionsOpen] = useState(false);
  const allChromeOff = (Object.keys(chrome) as ChromeKey[]).every((k) => !chrome[k]);
  function setAllChrome(v: boolean) {
    setChrome({ header: v, focusCard: v, connectionCard: v, overviewPill: v, diseaseShortcuts: v, diseaseLabels: v, legend: v });
  }
  function toggleChrome(k: ChromeKey) { setChrome((c) => ({ ...c, [k]: !c[k] })); }
  // Refs to the in-scene CSS2D label objects so the diseaseLabels toggle can
  // hide them without rebuilding the whole scene. Stored as parallel arrays
  // (one entry per disease) so the lock-to-disease mode can address each
  // disease's emblem + label independently.
  const diseaseLabelObjsRef = useRef<Array<{ emblem: CSS2DObject; label: CSS2DObject; node: DiseaseNode }>>([]);

  // Lock-to-disease mode: when set, only the named disease star, its planets,
  // and intra-disease connection lines render. Everything else fades out.
  const [lockedDiseaseKey, setLockedDiseaseKey] = useState<string | null>(null);

  // Wormhole promo modal — surfaced when the user clicks the spinning ring
  // at the galactic origin. Tease for the Discovery app.
  const [wormholeModalOpen, setWormholeModalOpen] = useState(false);
  // State mirror of `convergenceRef` so the button label can flip into
  // "Engaging wormhole…" when the convergence starts. The ref itself drives
  // the imperative animation; the state drives JSX.
  const [convergenceRunning, setConvergenceRunning] = useState(false);

  // Apply visibility for both the diseaseLabels chrome toggle AND the lock —
  // only the locked disease's emblem/label shows when locked, none/all show
  // otherwise based on the chrome toggle. Also applies to the disease star
  // sphere + halo so a fully locked galaxy reads as a single system.
  useEffect(() => {
    for (const e of diseaseLabelObjsRef.current) {
      const allowedByChrome = chrome.diseaseLabels;
      const allowedByLock = !lockedDiseaseKey || e.node.key === lockedDiseaseKey;
      const visible = allowedByChrome && allowedByLock;
      e.emblem.visible = visible;
      e.label.visible = visible;
    }
    for (const dm of diseaseMeshesRef.current) {
      dm.mesh.visible = !lockedDiseaseKey || dm.node.key === lockedDiseaseKey;
    }
    for (const dm of diseaseHalosRef.current) {
      dm.mesh.visible = !lockedDiseaseKey || dm.node.key === lockedDiseaseKey;
    }
  }, [chrome.diseaseLabels, lockedDiseaseKey]);

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
  // When the user clicks on a layer connection line, surface what the two
  // proteins are and why they're linked. Lives separately from infoFocus so
  // the "you clicked an edge" reading doesn't fight the existing
  // protein/disease card on screen.
  const [connectionCard, setConnectionCard] = useState<{
    a: ProteinNode;
    b: ProteinNode;
    layerKey: LayerKey;
    reason: string;
  } | null>(null);
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

    // ---------------------------------------------------------------
    // Wormhole at the galactic origin — Einstein–Rosen wireframe funnel
    // ---------------------------------------------------------------
    //
    // Orientation: rim sits in the XZ plane at y=0 (flush with the
    // disease ring), funnel DESCENDS to a throat at y = -halfHeight. The
    // overview camera at (0, 600, 1900) is above the rim and looks down,
    // so you see straight into the well — exactly the reference angle.
    //
    // Visuals built as line geometry, not a mesh:
    //   1. Static MERIDIANS (vertical ribs) form the funnel's spine.
    //   2. Animated PARALLELS (horizontal rings) continuously fall from
    //      the rim down toward the throat — the "matter falling in"
    //      effect. Each ring fades as it nears the throat so the eye
    //      reads the motion as inflow rather than a treadmill.
    //
    // A bright additive sphere at the throat stands in for the event
    // horizon. An oversized invisible cylinder catches clicks across
    // the whole funnel volume.
    const wormhole = new THREE.Group();
    wormhole.position.set(0, 0, 0);

    const halfHeight = 220;       // funnel depth (rim at y=0, throat at y=-halfHeight)
    const throatRadius = 14;      // radius at the bottom (event horizon)
    const flareRadius = 230;      // radius at the rim
    const FLARE_EXP = 1.7;        // >1 = narrow throat, fast flare
    const RIM_SEGS = 96;          // angular resolution of each parallel
    const MERIDIAN_COUNT = 40;    // vertical ribs
    const Y_RES = 80;             // sample points per meridian

    // y is in [-halfHeight, 0]: 0 = rim (wide), -halfHeight = throat (narrow).
    const radiusAt = (y: number) => {
      const t = Math.max(0, Math.min(1, (y + halfHeight) / halfHeight));
      return throatRadius + Math.pow(t, FLARE_EXP) * (flareRadius - throatRadius);
    };

    // Static meridians (vertical ribs along the funnel surface).
    const meridianMat = new THREE.LineBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let m = 0; m < MERIDIAN_COUNT; m++) {
      const angle = (m / MERIDIAN_COUNT) * Math.PI * 2;
      const ca = Math.cos(angle), sa = Math.sin(angle);
      const pts: number[] = [];
      for (let i = 0; i <= Y_RES; i++) {
        // i=0 → throat (y=-halfHeight), i=Y_RES → rim (y=0).
        const y = -halfHeight + (i / Y_RES) * halfHeight;
        const r = radiusAt(y);
        pts.push(ca * r, y, sa * r);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const line = new THREE.Line(g, meridianMat);
      line.userData.wormhole = true;
      wormhole.add(line);
    }

    // Animated parallels (horizontal rings flowing inward).
    const PARALLEL_COUNT = 22;
    const parallels: Array<{ line: THREE.Line; material: THREE.LineBasicMaterial; phase: number; segs: number; }> = [];
    for (let p = 0; p < PARALLEL_COUNT; p++) {
      const ringPts = new Float32Array((RIM_SEGS + 1) * 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(ringPts, 3));
      // Per-ring material so each ring can fade independently with phase.
      const mat = new THREE.LineBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(g, mat);
      line.userData.wormhole = true;
      wormhole.add(line);
      // Stagger initial phases so the rings spread evenly along the funnel.
      parallels.push({ line, material: mat, phase: p / PARALLEL_COUNT, segs: RIM_SEGS });
    }

    // Bright event horizon — a small additive sphere at y=0 plus a hot disk
    // facing upward so that looking down into the throat gives a clear
    // bright "hole" instead of a tiny dot.
    const coreGeom = new THREE.SphereGeometry(throatRadius * 0.95, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Mesh(coreGeom, coreMat);
    // Throat sits at the bottom of the funnel.
    core.position.set(0, -halfHeight, 0);
    core.userData.wormhole = true;
    wormhole.add(core);

    const horizonDiskGeom = new THREE.CircleGeometry(throatRadius * 1.5, 64);
    const horizonDiskMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const horizonDisk = new THREE.Mesh(horizonDiskGeom, horizonDiskMat);
    // Disk faces UP so the camera, looking down from above, sees a hot
    // bright spot at the bottom of the well.
    horizonDisk.rotation.x = -Math.PI / 2;
    horizonDisk.position.set(0, -halfHeight + 0.5, 0);
    horizonDisk.userData.wormhole = true;
    wormhole.add(horizonDisk);

    const haloGeom = new THREE.SphereGeometry(throatRadius * 2.4, 24, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Mesh(haloGeom, haloMat);
    halo.position.set(0, -halfHeight, 0);
    halo.userData.wormhole = true;
    wormhole.add(halo);

    // Generous invisible hitbox — a cylinder spanning the funnel — so click
    // targeting works from above the rim *and* from the side. CylinderGeometry
    // takes top/bottom radii in that order, so the wider radius goes first
    // since the rim (top, y=0) is wider than the throat (bottom, y=-halfHeight).
    const hitGeom = new THREE.CylinderGeometry(flareRadius * 0.6, throatRadius * 2, halfHeight + 40, 16, 1, true);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    const hitbox = new THREE.Mesh(hitGeom, hitMat);
    hitbox.position.set(0, -halfHeight / 2, 0);
    hitbox.userData.wormhole = true;
    wormhole.add(hitbox);

    scene.add(wormhole);
    wormholeRef.current = { group: wormhole, parallels, halfHeight, throatRadius, flareRadius, radiusAt, core, hitbox };

    // Disease stars (large glowing spheres at 13 ring positions).
    const diseaseMeshes: Array<{ mesh: THREE.Mesh; node: DiseaseNode }> = [];
    const diseaseHalos: Array<{ mesh: THREE.Mesh; node: DiseaseNode }> = [];
    const labelEntries: Array<{ emblem: CSS2DObject; label: CSS2DObject; node: DiseaseNode }> = [];
    for (const d of layout.diseases) {
      const color = new THREE.Color(d.color);
      const haloGeom = new THREE.SphereGeometry(40, 24, 24);
      const haloMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.12, depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeom, haloMat);
      halo.position.set(...d.position);
      scene.add(halo);
      diseaseHalos.push({ mesh: halo, node: d });

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
      labelEntries.push({ emblem: emblemObj, label: labelObj, node: d });
    }
    diseaseMeshesRef.current = diseaseMeshes;
    diseaseHalosRef.current = diseaseHalos;
    diseaseLabelObjsRef.current = labelEntries;

    // Protein planets as a single InstancedMesh.
    //
    // Coloring: each instance gets its disease's full color via the standard
    // `instanceColor` attribute. Three.js multiplies that against the base
    // material color automatically (no `vertexColors` flag — that flag would
    // reach for a non-existent geometry color attribute and fall back to
    // black).
    //
    // Alpha: three.js doesn't support per-instance opacity natively, so we
    // hijack the shader. We declare an `instanceAlpha` InstancedBufferAttribute
    // on the geometry and inject a vertex→fragment varying via
    // onBeforeCompile. The fragment stage multiplies gl_FragColor.a by the
    // varying right before output. depthWrite is off so transparent planets
    // don't punch holes in each other's z-buffer.
    const proteinGeom = new THREE.SphereGeometry(1, 8, 8);
    const alphaArr = new Float32Array(layout.proteins.length);
    proteinGeom.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(alphaArr, 1));
    const proteinMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    proteinMat.onBeforeCompile = (shader) => {
      shader.vertexShader = `attribute float instanceAlpha;\nvarying float vInstanceAlpha;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstanceAlpha = instanceAlpha;');
      // The `<opaque_fragment>` chunk is what writes gl_FragColor in
      // three.js 0.184; we multiply alpha right after so per-instance
      // opacity actually lands on the output.
      shader.fragmentShader = `varying float vInstanceAlpha;\n${shader.fragmentShader}`
        .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= vInstanceAlpha;');
    };
    const inst2 = new THREE.InstancedMesh(proteinGeom, proteinMat, layout.proteins.length);
    inst2.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    inst2.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(layout.proteins.length * 3), 3);
    const dummy = new THREE.Object3D();
    const diseaseByKey = new Map(layout.diseases.map((d) => [d.key, d]));
    const alphaByGene = buildAlphaByGene(layout.proteins);
    layout.proteins.forEach((p, i) => {
      dummy.position.set(...p.position);
      dummy.scale.setScalar(p.size);
      dummy.updateMatrix();
      inst2.setMatrixAt(i, dummy.matrix);
      const host = diseaseByKey.get(p.diseaseKey);
      inst2.setColorAt(i, new THREE.Color(host?.color ?? '#7aa3d4'));
      alphaArr[i] = alphaByGene.get(p.gene) ?? ALPHA_MAX;
    });
    inst2.instanceMatrix.needsUpdate = true;
    if (inst2.instanceColor) inst2.instanceColor.needsUpdate = true;
    (proteinGeom.getAttribute('instanceAlpha') as THREE.InstancedBufferAttribute).needsUpdate = true;
    proteinMeshRef.current = inst2;
    scene.add(inst2);

    // Mouse interactions
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 4 };
    // Lines are 1-pixel thin; without a generous threshold the user practically
    // can't click them. World-units; tuned by trial.
    raycaster.params.Line = { threshold: 6 };
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

      // Wormhole gets first dibs — it sits at the origin where overlap with
      // far-side disease stars is possible from certain angles, and the
      // promo modal is the priority interaction when the user actually
      // aimed at the vortex.
      if (wormholeRef.current) {
        const wh = raycaster.intersectObject(wormholeRef.current.hitbox);
        if (wh.length > 0) {
          // Fly the camera to a "looking down the well" angle: high above
          // the rim, slightly forward, target biased toward the upper part
          // of the funnel so both rim and bright throat are framed.
          const wormholeTarget = new THREE.Vector3(0, -wormholeRef.current.halfHeight * 0.45, 0);
          const wormholeCam    = new THREE.Vector3(0, 320, 180);
          flyToRef.current = {
            start: performance.now(),
            from: camera.position.clone(),
            to: wormholeCam,
            fromTarget: controls.target.clone(),
            toTarget: wormholeTarget,
            duration: 1300,
          };
          // Open the modal as the camera arrives.
          setTimeout(() => setWormholeModalOpen(true), 900);
          return;
        }
      }

      // Disease stars first (larger, less ambiguous)
      const diseaseHits = raycaster.intersectObjects(diseaseMeshes.map((d) => d.mesh));
      if (diseaseHits.length > 0) {
        const node = diseaseHits[0].object.userData.diseaseNode as DiseaseNode;
        flyTo(new THREE.Vector3(...node.position), 220);
        setFocusInfo({ kind: 'disease', label: node.label, sub: `${node.proteinCount} proteins · ${node.shortLabel}` });
        setInfoFocus({ kind: 'disease', diseaseKey: node.key });
        setConnectionCard(null);
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
        setConnectionCard(null);
        onSelectProteinRef.current(p.gene);
        return;
      }

      // Connection-line clicks. Iterate the active layer LineSegments objects
      // and look for the closest line hit; whichever wins, resolve the segment
      // back to the pair via userData.pairs and pop the connection card.
      const lineObjs = Array.from(connectionLinesRef.current.values());
      if (lineObjs.length > 0) {
        const lineHits = raycaster.intersectObjects(lineObjs);
        if (lineHits.length > 0) {
          const hit = lineHits[0];
          const obj = hit.object as THREE.LineSegments;
          const idx = hit.index;
          const pairs = obj.userData.pairs as ConnectionPair[] | undefined;
          if (idx != null && pairs) {
            const segIdx = Math.floor(idx / 2);
            const pair = pairs[segIdx];
            if (pair) {
              setConnectionCard({ a: pair.a, b: pair.b, layerKey: pair.layerKey, reason: pair.reason });
            }
          }
        }
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

      // Convergence animation: the user hit "Step through" on the wormhole
      // modal. Lerp every disease star, halo, sticky label, and protein
      // instance toward the throat with shrinking scale and fading alpha.
      // When the lerp completes, navigate to the Discovery app.
      if (convergenceRef.current) {
        const c = convergenceRef.current;
        const now = performance.now();
        const t = Math.min(1, (now - c.start) / c.duration);
        // Power-3 ease so the action accelerates inward — slow start, fast
        // collapse, dramatic finish at the throat.
        const eased = Math.pow(t, 2.4);
        const throat = c.throat;

        for (const dm of diseaseMeshesRef.current) {
          const orig = new THREE.Vector3(...dm.node.position);
          dm.mesh.position.lerpVectors(orig, throat, eased);
          dm.mesh.scale.setScalar(Math.max(0.001, 1 - eased));
        }
        for (const dh of diseaseHalosRef.current) {
          const orig = new THREE.Vector3(...dh.node.position);
          dh.mesh.position.lerpVectors(orig, throat, eased);
          dh.mesh.scale.setScalar(Math.max(0.001, 1 - eased));
          (dh.mesh.material as THREE.MeshBasicMaterial).opacity = 0.12 * (1 - eased);
        }
        for (const e of diseaseLabelObjsRef.current) {
          const fade = String(1 - eased);
          (e.emblem.element as HTMLElement).style.opacity = fade;
          (e.label.element as HTMLElement).style.opacity = fade;
        }
        if (selectedLabelRef.current) {
          (selectedLabelRef.current.element as HTMLElement).style.opacity = String(1 - eased);
        }

        if (proteinMeshRef.current) {
          const inst = proteinMeshRef.current;
          const dummy = new THREE.Object3D();
          for (let i = 0; i < layout.proteins.length; i++) {
            const p = layout.proteins[i];
            const orig = new THREE.Vector3(p.position[0], p.position[1], p.position[2]);
            const newPos = orig.lerp(throat, eased);
            dummy.position.copy(newPos);
            dummy.scale.setScalar(Math.max(0.001, p.size * (1 - eased)));
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
          }
          inst.instanceMatrix.needsUpdate = true;
          const alphaAttr = inst.geometry.getAttribute('instanceAlpha') as THREE.InstancedBufferAttribute | undefined;
          if (alphaAttr) {
            const fadeMul = 1 - eased;
            for (let i = 0; i < layout.proteins.length; i++) {
              alphaAttr.setX(i, c.baseAlphas[i] * fadeMul);
            }
            alphaAttr.needsUpdate = true;
          }
        }

        // Wormhole flares right at the end — bright bloom, big scale-up
        // so the climax reads from the far overview camera. Two-stage
        // curve: gentle ramp through most of the convergence, dramatic
        // bloom in the last 20%.
        if (wormholeRef.current) {
          const ramp  = Math.pow(t, 3);   // gentle ramp
          const bloom = Math.pow(t, 8);   // sharp final flare
          const coreMat = wormholeRef.current.core.material as THREE.MeshBasicMaterial;
          coreMat.opacity = Math.min(1, 0.7 + ramp * 0.3 + bloom * 0.4);
          wormholeRef.current.group.scale.setScalar(1 + ramp * 0.4 + bloom * 0.9);
        }

        if (t >= 1) {
          // All matter is in. Step through.
          convergenceRef.current = null;
          window.location.href = '/discovery/';
          return;
        }
      }

      // Animate the central wormhole — Einstein–Rosen funnel.
      //
      // Each parallel ring's `phase` moves from 1 (rim) → 0 (throat) at a
      // constant rate; we recompute its vertex positions every frame at
      // that height. As phase nears 0 we both narrow toward the throat
      // radius AND fade opacity, so it reads as matter being pulled into
      // the event horizon rather than rings sliding past on a treadmill.
      // Group rotates slowly around Y for the swirl. Event horizon's
      // brightness pulses on a sin so it never feels static.
      if (wormholeRef.current) {
        const wh = wormholeRef.current;
        const now = performance.now();

        // Slow swirl around the funnel axis.
        wh.group.rotation.y = now * 0.00015;

        const INFLOW_PER_MS = 1 / 6500; // ~6.5s for a ring to fall in
        for (const p of wh.parallels) {
          p.phase = (p.phase - INFLOW_PER_MS * 16 + 1) % 1;
          // phase=1 at rim (y=0), phase=0 at throat (y=-halfHeight) — so
          // the ring's y descends as the phase decreases. Material falls.
          const y = -(1 - p.phase) * wh.halfHeight;
          const r = wh.radiusAt(y);
          const positions = p.line.geometry.attributes.position.array as Float32Array;
          for (let s = 0; s <= p.segs; s++) {
            const a = (s / p.segs) * Math.PI * 2;
            positions[s * 3]     = Math.cos(a) * r;
            positions[s * 3 + 1] = y;
            positions[s * 3 + 2] = Math.sin(a) * r;
          }
          p.line.geometry.attributes.position.needsUpdate = true;
          // Brightest near rim, fade toward throat — so the inflow visually
          // "drains" rather than just relocates.
          p.material.opacity = 0.15 + Math.pow(p.phase, 0.7) * 0.7;
        }

        const coreMat = wh.core.material as THREE.MeshBasicMaterial;
        coreMat.opacity = 0.7 + Math.sin(now * 0.003) * 0.25;
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
    // We deliberately do NOT depend on `onSelectProtein` here: the parent
    // passes it as an inline arrow, so taking a dep would tear down and
    // rebuild the entire WebGL scene every time `selectedProtein` changes
    // (which the tour does between every step). The callback is read through
    // `onSelectProteinRef` instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, HEIGHT]);

  // Sticky 3D-anchored label for the currently selected protein. Updates in
  // place when the selection changes; vanishes when nothing is selected.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (selectedLabelRef.current) {
      scene.remove(selectedLabelRef.current);
      selectedLabelRef.current = null;
    }

    // Restore the previously highlighted planet's disease color and the
    // score-driven alpha. Size stays at p.size both ways so the planet
    // doesn't visually "jump" on selection.
    const inst = proteinMeshRef.current;
    const alphaAttr = inst?.geometry.getAttribute('instanceAlpha') as THREE.InstancedBufferAttribute | undefined;
    const diseaseByKey = new Map(layout.diseases.map((d) => [d.key, d]));
    const alphaByGene = buildAlphaByGene(layout.proteins);
    if (inst) {
      const prevIdx = highlightedIdxRef.current;
      if (prevIdx >= 0 && prevIdx < layout.proteins.length) {
        const prev = layout.proteins[prevIdx];
        const prevHost = diseaseByKey.get(prev.diseaseKey);
        inst.setColorAt(prevIdx, new THREE.Color(prevHost?.color ?? '#7aa3d4'));
        if (alphaAttr) {
          alphaAttr.setX(prevIdx, alphaByGene.get(prev.gene) ?? ALPHA_MAX);
          alphaAttr.needsUpdate = true;
        }
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      }
      highlightedIdxRef.current = -1;
    }

    if (!selectedProtein) return;
    const p = layout.proteinByGene.get(selectedProtein.gene);
    if (!p) return;

    // Promote the selected planet: shift toward white and pin it to full
    // opacity so it reads against every disease tint and against any other
    // ghosted neighbors. Size is unchanged on purpose.
    const idx = layout.proteins.indexOf(p);
    if (inst && idx >= 0) {
      const host = diseaseByKey.get(p.diseaseKey);
      const base = new THREE.Color(host?.color ?? '#7aa3d4');
      const highlight = base.clone().lerp(new THREE.Color(0xffffff), 0.7);
      inst.setColorAt(idx, highlight);
      if (alphaAttr) {
        alphaAttr.setX(idx, 1.0);
        alphaAttr.needsUpdate = true;
      }
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      highlightedIdxRef.current = idx;
    }

    const labelEl = document.createElement('div');
    const host = diseaseByKey.get(p.diseaseKey);
    const accent = host?.color ?? '#7aa3d4';
    labelEl.innerHTML = `
      <div style="font-size:13px;font-weight:600;letter-spacing:0.5px;color:#fff;line-height:1.2">${p.gene}</div>
      <div style="font-size:9.5px;letter-spacing:1px;text-transform:uppercase;color:${accent};margin-top:2px">${p.diseaseLabel}</div>
    `;
    Object.assign(labelEl.style, {
      background: 'rgba(7, 11, 32, 0.94)',
      border: `1px solid ${accent}`,
      padding: '5px 11px',
      borderRadius: '8px',
      whiteSpace: 'nowrap',
      boxShadow: `0 4px 18px rgba(0,0,0,0.5), 0 0 16px ${accent}55`,
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
  // Lock-aware: when a disease is locked, layer lines are scoped to proteins
  // in that disease only — so "same family" doesn't draw a line that exits
  // the locked system entirely.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const lines = connectionLinesRef.current;
    const visibleProteins = lockedDiseaseKey
      ? layout.proteins.filter((p) => p.diseaseKey === lockedDiseaseKey)
      : layout.proteins;

    // When the lock state changes, any existing line objects were built off
    // the old protein set — drop them so the active ones get rebuilt below.
    for (const [key, obj] of Array.from(lines.entries())) {
      scene.remove(obj);
      obj.geometry.dispose();
      (obj.material as THREE.Material).dispose();
      lines.delete(key);
    }

    LAYERS.forEach((layer) => {
      const wantOn = activeLayers.has(layer.key);
      if (wantOn) {
        const obj = buildLayerLines(layer, visibleProteins);
        if (obj) {
          scene.add(obj);
          lines.set(layer.key, obj);
        }
      }
    });
  }, [activeLayers, layout, lockedDiseaseKey]);

  // Per-instance alpha for proteins: when a disease is locked, drive every
  // non-locked protein's alpha to zero so the canvas reduces to a single
  // disease system. When unlocked, restore the score-driven quantile alphas.
  useEffect(() => {
    const inst = proteinMeshRef.current;
    if (!inst) return;
    const alphaAttr = inst.geometry.getAttribute('instanceAlpha') as THREE.InstancedBufferAttribute | undefined;
    if (!alphaAttr) return;
    const alphaByGene = buildAlphaByGene(layout.proteins);
    layout.proteins.forEach((p, i) => {
      const inScope = !lockedDiseaseKey || p.diseaseKey === lockedDiseaseKey;
      alphaAttr.setX(i, inScope ? (alphaByGene.get(p.gene) ?? ALPHA_MAX) : 0);
    });
    alphaAttr.needsUpdate = true;
    // Highlighted protein tracking: if the currently highlighted protein got
    // lockd-out, drop the highlight so the ref doesn't leak into the next
    // selection.
    const prevIdx = highlightedIdxRef.current;
    if (prevIdx >= 0) {
      const prev = layout.proteins[prevIdx];
      if (lockedDiseaseKey && prev && prev.diseaseKey !== lockedDiseaseKey) {
        highlightedIdxRef.current = -1;
      }
    }
  }, [lockedDiseaseKey, layout]);

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
    setFocusInfo({ kind: 'overview', label: 'Overview', sub: `${layout.proteins.length} proteins · ${layout.diseases.length} disease systems` });
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
      if (step.narration && onNarrate) {
        // Drop any narration still queued from earlier steps so audio stays
        // pinned to the camera. Without this, long lines accumulate in the
        // SpeechSynthesis queue and the user ends up hearing step N while
        // looking at step N+2's disease.
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        onNarrate(step.narration);
      }

      switch (step.kind) {
        case 'overview': {
          flyTo(OVERVIEW_TARGET, OVERVIEW_DISTANCE);
          setFocusInfo({
            kind: 'overview',
            label: 'Overview',
            sub: `${layout.proteins.length} proteins · ${layout.diseases.length} disease systems`,
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
            onSelectProteinRef.current(p.gene);
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
    setConnectionCard(null);
    returnToOverview();
    // Silence any narration that's already in the speechSynthesis queue —
    // otherwise Stop only halts the camera/layers while the voice keeps
    // talking through the rest of the queued lines.
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  return (
    <div className="w-full text-white/85">
      {chrome.header && (
      <div className="mb-3 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] tracking-[2.5px] text-cyan-300/70 font-medium uppercase">Galaxy</div>
          <div className="text-[18px] sm:text-[24px] tracking-wide font-light mt-1">Protein universe</div>
          <div className="text-[11px] text-white/45 mt-0.5">
            Drag to orbit · pinch to zoom · tap any star or planet to fly there
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap relative">
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
      )}

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
        {/* Info card: rich info on the focused protein or disease, dismissable.
            Surfaced on click regardless of chrome — clicking is a deliberate
            "what is this?" gesture. */}
        {showHUD && infoFocus && !infoClosed && infoFocus.kind === 'protein' && layout.proteinByGene.has(infoFocus.gene) && (
          <ProteinInfoCard
            protein={layout.proteinByGene.get(infoFocus.gene)!}
            onClose={() => setInfoClosed(true)}
          />
        )}
        {showHUD && infoFocus && !infoClosed && infoFocus.kind === 'disease' && (() => {
          const d = layout.diseases.find((dx) => dx.key === infoFocus.diseaseKey);
          if (!d) return null;
          return (
            <DiseaseInfoCard
              disease={d}
              onClose={() => setInfoClosed(true)}
              onJumpToProtein={(gene) => {
                const p = layout.proteinByGene.get(gene);
                if (p) {
                  flyTo(new THREE.Vector3(...p.position), 80);
                  setInfoFocus({ kind: 'protein', gene });
                  onSelectProtein(gene);
                }
              }}
              locked={lockedDiseaseKey === d.key}
              onToggleLock={() => {
                if (lockedDiseaseKey === d.key) {
                  setLockedDiseaseKey(null);
                  // Pull back to overview when releasing the lock so the user
                  // sees the full galaxy reappear instead of staying zoomed.
                  flyTo(OVERVIEW_TARGET, OVERVIEW_DISTANCE);
                } else {
                  setLockedDiseaseKey(d.key);
                  flyTo(new THREE.Vector3(...d.position), 320);
                }
              }}
            />
          );
        })()}
        {showHUD && chrome.connectionCard && connectionCard && (
          <ConnectionInfoCard
            pair={connectionCard}
            layerLabel={LAYERS.find((l) => l.key === connectionCard.layerKey)?.label ?? connectionCard.layerKey}
            layerColor={LAYERS.find((l) => l.key === connectionCard.layerKey)?.color ?? '#5eead4'}
            onClose={() => setConnectionCard(null)}
            onJumpTo={(gene) => {
              const p = layout.proteinByGene.get(gene);
              if (p) {
                flyTo(new THREE.Vector3(...p.position), 80);
                setFocusInfo({ kind: 'protein', label: p.gene, sub: `${p.diseaseLabel} · score ${p.score.toFixed(2)}` });
                setInfoFocus({ kind: 'protein', gene });
                onSelectProtein(gene);
              }
            }}
          />
        )}
        {showHUD && chrome.focusCard && (!infoFocus || infoClosed) && (
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
        {chrome.overviewPill && focusInfo.kind !== 'overview' && (
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

        {/* Locked-to-disease pill: a persistent top-center indicator + one-click
            unlock. Visible whenever a lock is active, regardless of chrome. */}
        {lockedDiseaseKey && (() => {
          const d = layout.diseases.find((dx) => dx.key === lockedDiseaseKey);
          if (!d) return null;
          return (
            <div
              className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full pl-3 pr-1 py-1 z-10"
              style={{
                background: 'rgba(7, 11, 32, 0.92)',
                border: `1px solid ${d.color}80`,
                boxShadow: `0 4px 18px rgba(0,0,0,0.45), 0 0 14px ${d.color}33`,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              <span className="text-[9px] tracking-[2px] uppercase text-white/55">Locked to</span>
              <span className="text-[11px] tracking-wide font-medium" style={{ color: d.color }}>{d.label}</span>
              <button
                onClick={() => {
                  setLockedDiseaseKey(null);
                  flyTo(OVERVIEW_TARGET, OVERVIEW_DISTANCE);
                }}
                className="rounded-full w-6 h-6 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition"
                title="Release the lock — show every disease system again"
                aria-label="Unlock"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })()}

        {/* Direct-jump shortcuts to any disease system. Hidden when a system
            is locked since only one disease is in scope at that point. */}
        {showHUD && chrome.diseaseShortcuts && !lockedDiseaseKey && (
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

        {/* Wormhole portal modal — fired by clicking the spinning vortex.
            Sits along the bottom edge so the funnel stays visible above it,
            with a single CTA that kicks off the convergence animation. */}
        {wormholeModalOpen && (
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-3 z-30 pointer-events-auto"
            style={{
              maxWidth: 'min(480px, calc(100% - 24px))',
              width: '100%',
              animation: 'wormholePortalFadeIn 320ms ease-out',
            }}
          >
            <div
              className="rounded-2xl px-4 py-3 sm:px-5 sm:py-4"
              style={{
                background: 'rgba(7, 11, 32, 0.86)',
                border: '1px solid rgba(127, 119, 221, 0.55)',
                boxShadow: '0 14px 44px rgba(0,0,0,0.55), 0 0 60px rgba(127, 119, 221, 0.18)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="text-[9.5px] tracking-[3px] uppercase text-cyan-300/70">Wormhole</div>
                <button
                  onClick={() => setWormholeModalOpen(false)}
                  className="text-white/40 hover:text-white/80 transition text-[16px] leading-none"
                  aria-label="Dismiss"
                  title="Stay in the galaxy"
                  disabled={convergenceRunning}
                >
                  ×
                </button>
              </div>
              <div className="text-[15px] sm:text-[17px] tracking-wide font-light text-white leading-snug">
                Step through to discoveries{' '}
                <em className="not-italic" style={{ color: '#a78bfa' }}>beyond</em> this galaxy.
              </div>
              <p className="text-[11.5px] text-white/55 mt-1 leading-snug">
                Everything you see here gets pulled into the well — and you come out the other side
                in <strong className="text-white/80">Discovery</strong>.
              </p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    if (convergenceRunning) return;
                    setConvergenceRunning(true);

                    // Step 1 — pull the camera back to a grand overview so
                    // the kid (or any audience) sees the *entire* galaxy
                    // contract into the wormhole, not just one corner. High
                    // angle plus a small forward tilt frames both the disease
                    // ring at radius ~800 and the funnel well below it.
                    const PRE_FLY_MS = 1600;
                    const overviewCam = new THREE.Vector3(0, 1200, 1700);
                    const overviewTarget = new THREE.Vector3(0, -120, 0);
                    if (cameraRef.current && controlsRef.current) {
                      flyToRef.current = {
                        start: performance.now(),
                        from: cameraRef.current.position.clone(),
                        to: overviewCam,
                        fromTarget: controlsRef.current.target.clone(),
                        toTarget: overviewTarget,
                        duration: PRE_FLY_MS,
                      };
                    }

                    // Step 2 — the moment the camera arrives, snapshot the
                    // current per-instance alphas (so the per-frame fade
                    // doesn't compound) and arm the convergence ref. The
                    // tick loop takes it from there: every disease, halo,
                    // label, and protein lerps into the throat.
                    setTimeout(() => {
                      const inst = proteinMeshRef.current;
                      let baseAlphas = new Float32Array(layout.proteins.length);
                      if (inst) {
                        const attr = inst.geometry.getAttribute('instanceAlpha') as THREE.InstancedBufferAttribute | undefined;
                        if (attr) baseAlphas = new Float32Array(attr.array as Float32Array);
                      }
                      const wh = wormholeRef.current;
                      const throatY = wh ? -wh.halfHeight : 0;
                      convergenceRef.current = {
                        start: performance.now(),
                        duration: 2800,
                        throat: new THREE.Vector3(0, throatY, 0),
                        baseAlphas,
                      };
                    }, PRE_FLY_MS + 60);
                  }}
                  disabled={convergenceRunning}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] tracking-[1.5px] uppercase transition disabled:opacity-70 disabled:cursor-wait"
                  style={{
                    background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.30), rgba(127, 119, 221, 0.35))',
                    border: '1px solid rgba(127, 119, 221, 0.65)',
                    color: '#e6ecff',
                    boxShadow: '0 0 18px rgba(127, 119, 221, 0.22)',
                  }}
                  title="Pull the galaxy through the wormhole"
                >
                  {convergenceRunning ? 'Engaging wormhole…' : 'Step through ↗'}
                </button>
                <button
                  onClick={() => setWormholeModalOpen(false)}
                  disabled={convergenceRunning}
                  className="rounded-full px-3 py-1.5 text-[10.5px] tracking-[1.5px] uppercase transition disabled:opacity-40"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.18)',
                    color: 'rgba(255,255,255,0.55)',
                  }}
                >
                  Stay here
                </button>
              </div>
            </div>
            <style jsx>{`
              @keyframes wormholePortalFadeIn {
                from { opacity: 0; transform: translate(-50%, 8px); }
                to   { opacity: 1; transform: translate(-50%, 0); }
              }
            `}</style>
          </div>
        )}

        {/* Always-visible gear: lets the user toggle every other piece of
            chrome on/off — including itself implicitly via "Hide all chrome".
            Stays in the bottom-right of the canvas regardless of `chrome` so
            the user is never locked out of the options. */}
        <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2 z-20 pointer-events-none">
          {optionsOpen && (
            <div
              className="rounded-lg p-3 pointer-events-auto"
              style={{
                background: 'rgba(7, 11, 32, 0.94)',
                border: '1px solid rgba(127, 119, 221, 0.45)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                minWidth: 220,
              }}
            >
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <div className="text-[9.5px] tracking-[2px] uppercase text-cyan-300/70">Galaxy options</div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setAllChrome(false)}
                    className="text-[9px] tracking-[1px] uppercase text-white/55 hover:text-white/90 transition"
                    title="Hide every overlay so only the 3D galaxy is visible"
                  >Hide all</button>
                  <span className="text-white/20">·</span>
                  <button
                    onClick={() => setAllChrome(true)}
                    className="text-[9px] tracking-[1px] uppercase text-white/55 hover:text-white/90 transition"
                    title="Show all overlays"
                  >Show all</button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {([
                  ['header', 'Header & controls'],
                  ['focusCard', 'Focus card (top-left)'],
                  ['connectionCard', 'Connection card'],
                  ['overviewPill', 'Overview pill'],
                  ['diseaseShortcuts', 'Disease shortcuts'],
                  ['diseaseLabels', 'Disease labels (3D)'],
                  ['legend', 'Legend (below canvas)'],
                ] as Array<[ChromeKey, string]>).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between gap-3 cursor-pointer text-[11px] text-white/75 hover:text-white">
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={chrome[key]}
                      onChange={() => toggleChrome(key)}
                      className="accent-cyan-300 cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => setOptionsOpen((o) => !o)}
            className="pointer-events-auto rounded-full w-8 h-8 flex items-center justify-center transition"
            style={{
              background: optionsOpen || allChromeOff ? 'rgba(127, 119, 221, 0.20)' : 'rgba(7, 11, 32, 0.78)',
              border: `1px solid ${optionsOpen || allChromeOff ? 'rgba(127, 119, 221, 0.55)' : 'rgba(255, 255, 255, 0.18)'}`,
              color: optionsOpen || allChromeOff ? '#a3a1ed' : 'rgba(255,255,255,0.65)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            title={optionsOpen ? 'Close options' : 'Galaxy options — show/hide overlays'}
            aria-label="Galaxy options"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {chrome.legend && <Legend layers={LAYERS} active={activeLayers} />}
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

function ConnectionInfoCard({
  pair,
  layerLabel,
  layerColor,
  onClose,
  onJumpTo,
}: {
  pair: { a: ProteinNode; b: ProteinNode; layerKey: LayerKey; reason: string };
  layerLabel: string;
  layerColor: string;
  onClose: () => void;
  onJumpTo: (gene: string) => void;
}) {
  const { a, b, reason } = pair;
  return (
    <div
      className="absolute bottom-3 left-3 rounded-lg p-3 max-w-[92%] sm:max-w-[420px] z-10"
      style={{
        background: 'rgba(7, 11, 32, 0.92)',
        border: `1px solid ${layerColor}55`,
        boxShadow: `0 6px 20px rgba(0,0,0,0.45), 0 0 18px ${layerColor}22`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <div className="text-[9.5px] tracking-[2px] uppercase" style={{ color: layerColor }}>
          {layerLabel} · connection
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/80 transition text-[14px] leading-none"
          title="Dismiss"
          aria-label="Dismiss connection info"
        >
          ×
        </button>
      </div>
      <div className="text-white text-[14px] tracking-wide font-light flex items-center gap-2 flex-wrap">
        <button
          onClick={() => onJumpTo(a.gene)}
          className="hover:text-cyan-300 transition underline-offset-2 hover:underline"
          title={`Fly to ${a.gene}`}
        >
          {a.gene}
        </button>
        <span className="text-white/40">↔</span>
        <button
          onClick={() => onJumpTo(b.gene)}
          className="hover:text-cyan-300 transition underline-offset-2 hover:underline"
          title={`Fly to ${b.gene}`}
        >
          {b.gene}
        </button>
      </div>
      <div className="text-[11px] text-white/55 mt-1">
        {a.diseaseLabel} → {b.diseaseLabel}
      </div>
      <div className="text-[12px] text-white/80 mt-2 leading-snug">{reason}</div>
      <div className="text-[10px] text-white/35 mt-2">Click either gene to fly to it.</div>
    </div>
  );
}

function DiseaseInfoCard({ disease, onClose, onJumpToProtein, locked, onToggleLock }: {
  disease: DiseaseNode;
  onClose: () => void;
  onJumpToProtein: (gene: string) => void;
  locked: boolean;
  onToggleLock: () => void;
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
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button
          onClick={onToggleLock}
          className="rounded-md py-1 text-[10px] tracking-[1.5px] uppercase transition flex items-center justify-center gap-1.5"
          style={{
            background: locked ? `${disease.color}33` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${locked ? disease.color : `${disease.color}40`}`,
            color: locked ? disease.color : 'rgba(255,255,255,0.65)',
          }}
          title={locked
            ? `Unlock — show all disease systems again`
            : `Lock the galaxy to ${disease.label}: hide every other disease, planet, and connection line`}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {locked ? (
              <>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
              </>
            ) : (
              <>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </>
            )}
          </svg>
          {locked ? 'Unlock' : 'Lock to system'}
        </button>
        <button
          onClick={copyLink}
          className="rounded-md py-1 text-[10px] tracking-[1.5px] uppercase transition flex items-center justify-center gap-1.5"
          style={{
            background: copied ? `${disease.color}22` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${disease.color}40`,
            color: copied ? disease.color : 'rgba(255,255,255,0.65)',
          }}
          title="Copy a deep link to this disease in the galaxy"
        >
          {copied ? '✓ Copied' : (
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

/** A clickable edge between two proteins on a given connection layer. The
 *  index in `LineSegmentsWithPairs.userData.pairs` matches the segment index
 *  in the underlying BufferGeometry so a raycaster hit can resolve directly
 *  back to the protein pair and the reason the edge exists. */
interface ConnectionPair {
  a: ProteinNode;
  b: ProteinNode;
  layerKey: LayerKey;
  reason: string;
}

function buildLayerLines(layer: LayerConfig, proteins: ProteinNode[]): THREE.LineSegments | null {
  const segments: number[] = [];
  const colorVals: number[] = [];
  const pairs: ConnectionPair[] = [];
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
        const a = sorted[i], b = sorted[i + 1];
        pushSegment(a, b, `Both members of the ${a.geneFamily} family.`);
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
      for (const { b } of others) {
        pushSegment(a, b, 'Both flagged as pharmacologically actionable drug targets — and they sit close enough in the galaxy that a repurposing thread between their disease systems is plausible.');
      }
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
        const a = sorted[i], b = sorted[i + 1];
        pushSegment(a, b, `Both primarily expressed in ${a.organLabel.toLowerCase()} — same tissue context, different disease orbits.`);
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
        const a = sorted[i], b = sorted[i + 1];
        pushSegment(a, b, `Same molecular function class: ${a.functionClass.toLowerCase()}.`);
      }
    }
  }

  function pushSegment(a: ProteinNode, b: ProteinNode, reason: string) {
    segments.push(a.position[0], a.position[1], a.position[2], b.position[0], b.position[1], b.position[2]);
    colorVals.push(c.r, c.g, c.b, c.r, c.g, c.b);
    pairs.push({ a, b, layerKey: layer.key, reason });
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
  const obj = new THREE.LineSegments(geom, mat);
  // Stash the pair metadata on the object so the click raycaster can resolve
  // an `intersect.index` (vertex index in the buffer) back to the pair that
  // produced this segment. Segment k uses vertices 2k and 2k+1, so the pair
  // index is `Math.floor(intersect.index! / 2)`.
  obj.userData.pairs = pairs;
  obj.userData.layerKey = layer.key;
  return obj;
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
      `Welcome to the protein galaxy. ${layout.diseases.length} cardiometabolic disease stars form a ring; their associated proteins orbit each star. Distance from the star reflects OpenTargets evidence — closer means stronger association. Color encodes the protein's primary organ.`,
  });

  // Step 2: ring sweep — quick fly-through every disease so the user sees
  // them all named once. ~1.6s per disease, no per-disease narration to keep
  // it visually fluid.
  steps.push({
    kind: 'overview',
    durationMs: 4000,
    narration: `First, a quick sweep of all ${layout.diseases.length} disease systems.`,
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
