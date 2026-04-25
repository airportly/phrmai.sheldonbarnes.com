import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { OrganKey } from '@/lib/protein-mapper';
import { assetPath } from '@/lib/base-path';

/**
 * HumanBody - The rotating 3D body figure with clickable organs.
 *
 * Loads a translucent body shell (skin GLB) then derives each organ's world
 * position and absolute size from the shell's bounding box plus a table of
 * anatomical fractions. This keeps the layout correct regardless of how the
 * body shell is scaled, and matches roughly where the organs sit in real
 * anatomy rather than relying on values hand-tuned to one mesh.
 *
 * Manual rotation is enabled via OrbitControls. The autoRotate prop drives
 * the controls' built-in autoRotate, so the toggle still spins the view but
 * a click-drag at any time hands control back to the user.
 *
 * Falls back to procedural geometry if the skin GLB is missing.
 */

export type FramingPreset = 'full' | 'head' | 'chest' | 'pelvis' | 'legs';

interface Props {
  selectedOrgan: OrganKey | null;
  autoRotate: boolean;
  framing: FramingPreset;
  onOrganClick: (organ: OrganKey) => void;
}

// Framing presets are defined in body-shell-relative units. SHELL_SCALE = 2.7,
// so the body spans roughly y = -1.35 to +1.35. Targets are tuned to center the
// camera on the named region; distance controls how tight the framing is.
// Body shell spans roughly y = -1.35 (feet) to y = +1.45 (top of head). Knees
// sit around y = -0.50. "Knees up" frames the region from knees to head, with
// the camera target between them (around y = 0.45) and distance picked so that
// 1.95 units of vertical extent fit at FOV 38°.
const FRAMING_PRESETS: Record<FramingPreset, { target: [number, number, number]; distance: number; label: string }> = {
  full:   { target: [0,  0.10, 0], distance: 4.0, label: 'Full body' },
  head:   { target: [0,  1.20, 0], distance: 1.6, label: 'Head' },
  chest:  { target: [0,  0.55, 0], distance: 2.2, label: 'Chest' },
  pelvis: { target: [0, -0.30, 0], distance: 1.9, label: 'Pelvis' },
  legs:   { target: [0,  0.45, 0], distance: 2.95, label: 'Knees up' },
};

export const FRAMING_OPTIONS: Array<{ key: FramingPreset; label: string }> =
  (Object.keys(FRAMING_PRESETS) as FramingPreset[]).map((key) => ({ key, label: FRAMING_PRESETS[key].label }));

type Anatomy = {
  height: number;   // 0 = feet, 1 = top of head
  lateral: number;  // -1 = body's right, +1 = body's left (anatomical convention)
  depth: number;    // -1 = back, +1 = front
  size: number;     // organ max-dim as fraction of body height
  /**
   * Per-axis multiplier applied to the uniform `size` scale. Useful when the
   * GLB's bounding box doesn't match real organ proportions (e.g. the merged
   * liver mesh includes vessels that inflate the depth axis, so we squash z).
   */
  scaleAdjust?: { x?: number; y?: number; z?: number };
  /**
   * Optional bilateral pair (e.g. kidneys). When set, a second mesh is loaded
   * and placed at the mirrored lateral position. If `meshFile` is omitted the
   * primary mesh is reused with its X scale negated (geometric mirror).
   */
  pair?: { lateral: number; meshFile?: string };
  color: number;
  meshFile: string;
};

// Anatomical placement fractions. Tuned against standard human proportions, not
// any specific mesh, so they survive shell-scale tweaks. Adipose is intentionally
// omitted: BodyParts3D has no clean adipose mesh and a procedural sphere reads as
// noise. Adipose remains in the protein-mapper data model and is reachable via
// voice/chat ("fat tissue", "adipose"), just not as a clickable region in the body.
const ANATOMY: Partial<Record<OrganKey, Anatomy>> = {
  // Convention: positive lateral = body's anatomical LEFT (heart, pancreas tail).
  // Negative lateral = body's anatomical RIGHT (liver right lobe, gallbladder).
  brain:    { height: 0.94, lateral:  0.00, depth:  0.05, size: 0.09,  color: 0x7F77DD, meshFile: assetPath('/assets/anatomy/brain.glb') },
  heart:    { height: 0.74, lateral:  0.22, depth:  0.20, size: 0.075, color: 0xD85A30, meshFile: assetPath('/assets/anatomy/heart.glb'),
             scaleAdjust: { y: 1.05 } },
  // Liver mesh includes hepatic vessels that inflate the depth bbox. Squash z.
  liver:    { height: 0.60, lateral: -0.28, depth:  0.05, size: 0.115, color: 0xBA7517, meshFile: assetPath('/assets/anatomy/liver.glb'),
             scaleAdjust: { z: 0.62, y: 0.85 } },
  pancreas: { height: 0.56, lateral:  0.12, depth: -0.05, size: 0.090, color: 0x1D9E75, meshFile: assetPath('/assets/anatomy/pancreas.glb'),
             scaleAdjust: { z: 0.55 } },
  kidneys:  { height: 0.50, lateral:  0.18, depth: -0.45, size: 0.060, color: 0x378ADD, meshFile: assetPath('/assets/anatomy/kidney_left.glb'),
             scaleAdjust: { z: 0.70 },
             pair:        { lateral: -0.18, meshFile: assetPath('/assets/anatomy/kidney_right.glb') } },
};

const SHELL_SCALE = 2.7;
const BREATH_PERIOD = 4.3;          // seconds per breath cycle (~14 breaths/min)
const PARTICLE_COUNT = 18;          // inhale particles streaming toward nose
const EXHALE_COUNT = 14;            // exhale particles streaming outward

// Used when the skin GLB is unavailable and we fall back to procedural geometry.
// Matches roughly the bbox the procedural body shell ends up occupying.
const FALLBACK_BBOX = new THREE.Box3(
  new THREE.Vector3(-0.55, -1.45, -0.5),
  new THREE.Vector3(0.55, 1.83, 0.5),
);

export default function HumanBody({ selectedOrgan, autoRotate, framing, onOrganClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverTip, setHoverTip] = useState<{ organ: OrganKey; x: number; y: number } | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const bodyGroupRef = useRef<THREE.Group | null>(null);
  const organMeshesRef = useRef<Record<OrganKey, { mesh: THREE.Object3D }> | null>(null);
  const skinRef = useRef<THREE.Object3D | null>(null);
  const skinWireRef = useRef<THREE.Object3D | null>(null);
  const inhaleRef = useRef<ParticleSystem | null>(null);
  const exhaleRef = useRef<ParticleSystem | null>(null);
  const floatersRef = useRef<MolecularFloater[] | null>(null);
  const hoveredRef = useRef<OrganKey | null>(null);
  const selectedRef = useRef(selectedOrgan);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);
  useEffect(() => { selectedRef.current = selectedOrgan; }, [selectedOrgan]);

  // Animate camera to the requested framing preset whenever it changes.
  useEffect(() => {
    if (!controlsRef.current || !cameraRef.current) return;
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const preset = FRAMING_PRESETS[framing];

    const startTarget = controls.target.clone();
    const targetTarget = new THREE.Vector3(...preset.target);
    const startDistance = camera.position.distanceTo(controls.target);
    const targetDistance = preset.distance;
    const dir = camera.position.clone().sub(controls.target).normalize();

    const startTime = performance.now();
    const duration = 600;
    let frameId: number;

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      controls.target.lerpVectors(startTarget, targetTarget, eased);
      const distance = startDistance + (targetDistance - startDistance) * eased;
      camera.position.copy(controls.target.clone().add(dir.clone().multiplyScalar(distance)));
      controls.update();
      if (t < 1) frameId = requestAnimationFrame(tick);
    };
    tick();
    return () => { if (frameId) cancelAnimationFrame(frameId); };
  }, [framing]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const HEIGHT = 540;
    const camera = new THREE.PerspectiveCamera(38, container.clientWidth / HEIGHT, 0.1, 100);
    camera.position.set(0, 0.15, 4.0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, HEIGHT);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Post-processing: bloom on emissive surfaces. Threshold is high enough
    // that only the organ emissive materials and floater spheres bloom — the
    // wireframe shell and grid stay crisp.
    const composer = new EffectComposer(renderer);
    composer.setSize(container.clientWidth, HEIGHT);
    composer.setPixelRatio(window.devicePixelRatio);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, HEIGHT),
      0.55,  // strength
      0.55,  // radius
      0.65,  // threshold
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composerRef.current = composer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 2.0;
    controls.maxDistance = 8.0;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.2;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0x4a6da7, 0.6));
    const keyLight = new THREE.PointLight(0x2dd4bf, 1.2, 10);
    keyLight.position.set(0, 1, 3);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x7F77DD, 0.6, 10);
    rimLight.position.set(-3, 0, -1);
    scene.add(rimLight);

    const bodyGroup = new THREE.Group();
    scene.add(bodyGroup);
    bodyGroupRef.current = bodyGroup;

    floatersRef.current = setupMolecularFloaters(scene);

    // Grid floor
    const gridGeom = new THREE.PlaneGeometry(8, 8, 20, 20);
    const gridMat = new THREE.MeshBasicMaterial({ color: 0x2dd4bf, wireframe: true, transparent: true, opacity: 0.2 });
    const grid = new THREE.Mesh(gridGeom, gridMat);
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = -2.4;
    scene.add(grid);

    const loader = new GLTFLoader();

    // Load body shell first; once we have its bbox, place the organs.
    loader.load(
      assetPath('/assets/anatomy/skin.glb'),
      (gltf) => {
        const skin = gltf.scene;
        skin.scale.setScalar(SHELL_SCALE);
        applyHolographicShellMaterial(skin);
        bodyGroup.add(skin);
        skinRef.current = skin;

        const skinWire = skin.clone(true);
        skinWire.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshBasicMaterial({
              color: 0x2dd4bf, wireframe: true, transparent: true, opacity: 0.13, depthWrite: false,
            });
          }
        });
        bodyGroup.add(skinWire);
        skinWireRef.current = skinWire;

        const bbox = new THREE.Box3().setFromObject(skin);
        loadOrgansWithBbox(loader, bodyGroup, bbox, organMeshesRef);
        inhaleRef.current = setupInhaleParticles(bodyGroup, bbox);
        exhaleRef.current = setupExhaleParticles(bodyGroup, bbox);
      },
      undefined,
      () => {
        addProceduralBodyShell(bodyGroup);
        loadOrgansWithBbox(loader, bodyGroup, FALLBACK_BBOX, organMeshesRef);
        inhaleRef.current = setupInhaleParticles(bodyGroup, FALLBACK_BBOX);
        exhaleRef.current = setupExhaleParticles(bodyGroup, FALLBACK_BBOX);
      }
    );

    // Interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleMouseMove = (e: MouseEvent) => {
      if (!rendererRef.current || !cameraRef.current || !bodyGroupRef.current) return;
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, cameraRef.current);
      // Raycast against everything in the body group (organ meshes + invisible
      // click-helper spheres). The click helpers carry userData.organ, so a hit
      // anywhere within the helper resolves to the right organ.
      const intersects = raycaster.intersectObjects(bodyGroupRef.current.children, true);

      for (const hit of intersects) {
        let target: THREE.Object3D | null = hit.object;
        while (target && !target.userData.organ) {
          target = target.parent;
        }
        if (target && target.userData.organ) {
          const organ = target.userData.organ as OrganKey;
          hoveredRef.current = organ;
          rendererRef.current.domElement.style.cursor = 'pointer';
          setHoverTip({ organ, x: e.clientX, y: e.clientY });
          return;
        }
      }
      hoveredRef.current = null;
      rendererRef.current.domElement.style.cursor = 'default';
      setHoverTip(null);
    };

    const handleMouseLeave = () => {
      hoveredRef.current = null;
      setHoverTip(null);
      if (rendererRef.current) rendererRef.current.domElement.style.cursor = 'default';
    };

    const handleClick = () => {
      if (hoveredRef.current) onOrganClick(hoveredRef.current);
    };

    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseleave', handleMouseLeave);
    renderer.domElement.addEventListener('click', handleClick);

    let frameId: number;
    let lastTime = performance.now();
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const t = now / 1000;

      controls.update();

      // Breathing: ~14 breaths/min, with chest/belly scaling more in depth (Z)
      // than height. The skin and wireframe overlay are scaled together so the
      // outline expands and contracts in lockstep.
      const breathPhase = (t % BREATH_PERIOD) / BREATH_PERIOD;
      const breathWave = Math.sin(breathPhase * Math.PI * 2);
      const sx  = SHELL_SCALE * (1 + 0.012 * breathWave);
      const sy  = SHELL_SCALE * (1 + 0.018 * breathWave);
      const sz  = SHELL_SCALE * (1 + 0.040 * breathWave);
      if (skinRef.current)     skinRef.current.scale.set(sx, sy, sz);
      if (skinWireRef.current) skinWireRef.current.scale.set(sx, sy, sz);

      // Heart beat: lub-dub at 60 bpm. Two Gaussian pulses per second drive a
      // 10% scale jolt on the heart mesh.
      const heartPhase = t % 1.0;
      const lub = Math.exp(-Math.pow((heartPhase - 0.08) / 0.05, 2));
      const dub = 0.55 * Math.exp(-Math.pow((heartPhase - 0.30) / 0.05, 2));
      const heartPulse = lub + dub;

      if (organMeshesRef.current) {
        Object.entries(organMeshesRef.current).forEach(([key, { mesh }]) => {
          const isHovered = key === hoveredRef.current;
          const isSelected = key === selectedRef.current;
          const baseIntensity = isSelected ? 0.9 : isHovered ? 0.8 : 0.5;
          const intensityPulse = baseIntensity + Math.sin(Date.now() * 0.002 + key.charCodeAt(0)) * 0.15;

          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhongMaterial) {
              child.material.emissiveIntensity = intensityPulse;
            }
          });

          if (key === 'heart' && mesh.userData.baseScale instanceof THREE.Vector3) {
            const f = 1 + 0.10 * heartPulse;
            const b = mesh.userData.baseScale;
            mesh.scale.set(b.x * f, b.y * f, b.z * f);
          }
        });
      }

      // Subtle "alive" idle: head-end of body group sways slowly, returning to
      // rest. Keeps the silhouette from feeling locked even when autoRotate is off.
      if (bodyGroupRef.current) {
        bodyGroupRef.current.rotation.z = 0.012 * Math.sin(t * 0.35);
      }

      // Inhale stream (cyan) flows from front of face through nose into chest;
      // exhale stream (amber) flows outward from the nose. Each system's
      // material opacity tracks the appropriate half of the breath cycle.
      if (inhaleRef.current) updateInhaleParticles(inhaleRef.current, dt, breathPhase);
      if (exhaleRef.current) updateExhaleParticles(exhaleRef.current, dt, breathPhase);

      // Molecular floaters orbit slowly around the body in their own arcs.
      if (floatersRef.current) updateMolecularFloaters(floatersRef.current, t);

      if (composerRef.current) composerRef.current.render();
      else renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = container.clientWidth / HEIGHT;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(container.clientWidth, HEIGHT);
      if (composerRef.current) composerRef.current.setSize(container.clientWidth, HEIGHT);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mouseleave', handleMouseLeave);
      renderer.domElement.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onOrganClick]);

  return (
    <div className="relative flex flex-col items-center w-full">
      <div ref={containerRef} className="w-full h-[540px] relative" />
      {hoverTip && <OrganHoverTip organ={hoverTip.organ} x={hoverTip.x} y={hoverTip.y} />}
    </div>
  );
}

const ORGAN_LABELS: Record<OrganKey, string> = {
  brain:    'Brain',
  heart:    'Heart',
  liver:    'Liver',
  pancreas: 'Pancreas',
  kidneys:  'Kidneys',
  adipose:  'Adipose tissue',
};

function OrganHoverTip({ organ, x, y }: { organ: OrganKey; x: number; y: number }) {
  const anatomy = ANATOMY[organ];
  const colorHex = anatomy ? '#' + anatomy.color.toString(16).padStart(6, '0') : '#2dd4bf';
  return (
    <div
      style={{
        position: 'fixed',
        left: x + 14,
        top: y - 14,
        pointerEvents: 'none',
        background: 'rgba(7, 11, 32, 0.92)',
        border: `1px solid ${colorHex}66`,
        color: 'white',
        padding: '5px 11px',
        borderRadius: '999px',
        fontSize: '10.5px',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        fontWeight: 500,
        boxShadow: `0 4px 14px rgba(0,0,0,0.4), 0 0 16px ${colorHex}33`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 60,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: colorHex,
          boxShadow: `0 0 6px ${colorHex}`,
          marginRight: '7px',
          verticalAlign: 'middle',
        }}
      />
      <span style={{ verticalAlign: 'middle' }}>{ORGAN_LABELS[organ] ?? organ}</span>
    </div>
  );
}

function placeFromBbox(mesh: THREE.Object3D, anatomy: Anatomy, bbox: THREE.Box3) {
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const x = bbox.min.x + ((anatomy.lateral + 1) / 2) * size.x;
  const y = bbox.min.y + anatomy.height * size.y;
  const z = bbox.min.z + ((anatomy.depth + 1) / 2) * size.z;
  mesh.position.set(x, y, z);
  // GLB meshes are normalized to 1.0 max-dim during conversion. Apply uniform
  // size then optional per-axis adjustment for organs whose mesh proportions
  // don't match real anatomy.
  const baseScale = anatomy.size * size.y;
  const adj = anatomy.scaleAdjust ?? {};
  const sx = baseScale * (adj.x ?? 1);
  const sy = baseScale * (adj.y ?? 1);
  const sz = baseScale * (adj.z ?? 1);
  mesh.scale.set(sx, sy, sz);
  mesh.userData.baseScale = new THREE.Vector3(sx, sy, sz);
}

function loadOrgansWithBbox(
  loader: GLTFLoader,
  bodyGroup: THREE.Group,
  bbox: THREE.Box3,
  organMeshesRef: React.MutableRefObject<Record<OrganKey, { mesh: THREE.Object3D }> | null>,
) {
  const organMeshes: Record<string, { mesh: THREE.Object3D }> = {};
  const organKeys = Object.keys(ANATOMY) as OrganKey[];

  const placeAndAdd = (key: OrganKey, mesh: THREE.Object3D, anatomy: Anatomy) => {
    placeFromBbox(mesh, anatomy, bbox);
    mesh.userData.organ = key;
    bodyGroup.add(mesh);

    // Invisible click-helper sphere around each organ so the hit target is
    // ~50% larger than the visible mesh. Anatomical accuracy stays intact;
    // small organs (heart, pancreas) become reliably clickable.
    const clickTargetSize = anatomy.size * (bbox.max.y - bbox.min.y) * 1.5;
    const clickGeom = new THREE.SphereGeometry(clickTargetSize / 2, 12, 12);
    const clickMat = new THREE.MeshBasicMaterial({ visible: false });
    const clickTarget = new THREE.Mesh(clickGeom, clickMat);
    clickTarget.position.copy(mesh.position);
    clickTarget.userData.organ = key;
    bodyGroup.add(clickTarget);

    organMeshes[key] = { mesh };
    organMeshesRef.current = organMeshes as Record<OrganKey, { mesh: THREE.Object3D }>;
  };

  organKeys.forEach((key) => {
    const anatomy = ANATOMY[key];
    if (!anatomy) return;
    loader.load(
      anatomy.meshFile,
      (gltf) => {
        const mesh = gltf.scene;
        applyOrganMaterial(mesh, anatomy.color);
        placeAndAdd(key, mesh, anatomy);
      },
      undefined,
      () => {
        const geom = new THREE.SphereGeometry(0.5, 24, 24);
        const mat = new THREE.MeshPhongMaterial({
          color: anatomy.color,
          transparent: true,
          opacity: 0.7,
          emissive: anatomy.color,
          emissiveIntensity: 0.5,
        });
        const mesh = new THREE.Mesh(geom, mat);
        placeAndAdd(key, mesh, anatomy);
      }
    );

    // Bilateral pair: load (or mirror) a second mesh at the opposite lateral.
    if (anatomy.pair) {
      const pairAnatomy: Anatomy = { ...anatomy, lateral: anatomy.pair.lateral };
      const file = anatomy.pair.meshFile ?? anatomy.meshFile;
      loader.load(
        file,
        (gltf) => {
          const mesh = gltf.scene;
          applyOrganMaterial(mesh, anatomy.color);
          placeFromBbox(mesh, pairAnatomy, bbox);
          if (!anatomy.pair?.meshFile) {
            // Reusing the primary mesh: mirror geometry by negating X scale.
            mesh.scale.x *= -1;
            const base = mesh.userData.baseScale as THREE.Vector3 | undefined;
            if (base) base.x *= -1;
          }
          mesh.userData.organ = key;
          bodyGroup.add(mesh);

          // Click target also for the paired mesh.
          const ctSize = pairAnatomy.size * (bbox.max.y - bbox.min.y) * 1.5;
          const ctGeom = new THREE.SphereGeometry(ctSize / 2, 12, 12);
          const ctMat = new THREE.MeshBasicMaterial({ visible: false });
          const ct = new THREE.Mesh(ctGeom, ctMat);
          ct.position.copy(mesh.position);
          ct.userData.organ = key;
          bodyGroup.add(ct);
        },
        undefined,
        () => {
          // No fallback for pair — primary still rendered.
        }
      );
    }
  });
}

function applyHolographicShellMaterial(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = new THREE.MeshPhongMaterial({
        color: 0x2dd4bf,
        transparent: true,
        opacity: 0.07,
        shininess: 80,
        specular: 0x2dd4bf,
        depthWrite: false,
      });
    }
  });
}

function applyOrganMaterial(obj: THREE.Object3D, color: number) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity: 0.7,
        emissive: color,
        emissiveIntensity: 0.5,
      });
    }
  });
}

// ---- Molecular floaters ----------------------------------------------------

interface MolecularFloater {
  group: THREE.Group;
  orbitRadius: number;
  orbitSpeed: number;       // radians per second
  orbitPhase: number;
  orbitTilt: number;        // rotation about X to tilt the orbital plane
  baseHeight: number;       // y offset of the orbit center
  bobAmplitude: number;
  bobSpeed: number;
  spin: THREE.Vector3;      // self-rotation rate (rad/s)
}

const FLOATER_COLORS = [0x9be7e3, 0xa78bfa, 0xfbbf24, 0xf472b6, 0x10b981, 0x60a5fa, 0xfb923c];

function createMoleculeGroup(color: number, atomCount: number, atomScale: number): THREE.Group {
  const group = new THREE.Group();
  const positions: THREE.Vector3[] = [new THREE.Vector3()];
  for (let i = 1; i < atomCount; i++) {
    const anchor = positions[Math.floor(Math.random() * positions.length)];
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    positions.push(anchor.clone().add(dir.multiplyScalar(atomScale * 1.7)));
  }

  const atomMat = new THREE.MeshPhongMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.7,
    transparent: true,
    opacity: 0.92,
    shininess: 80,
  });
  const bondMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.45,
  });

  positions.forEach((pos, i) => {
    const radius = i === 0 ? atomScale * 1.05 : atomScale * 0.65;
    const sphereGeom = new THREE.SphereGeometry(radius, 12, 12);
    const sphere = new THREE.Mesh(sphereGeom, atomMat.clone());
    sphere.position.copy(pos);
    group.add(sphere);
  });

  const bondedKeys = new Set<string>();
  for (let i = 0; i < positions.length; i++) {
    let closestJ = -1;
    let closestDist = Infinity;
    for (let j = 0; j < positions.length; j++) {
      if (i === j) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (bondedKeys.has(key)) continue;
      const d = positions[i].distanceTo(positions[j]);
      if (d < closestDist) { closestDist = d; closestJ = j; }
    }
    if (closestJ === -1) continue;
    const k = i < closestJ ? `${i}-${closestJ}` : `${closestJ}-${i}`;
    bondedKeys.add(k);
    const dir = positions[closestJ].clone().sub(positions[i]);
    const len = dir.length();
    const bondGeom = new THREE.CylinderGeometry(atomScale * 0.22, atomScale * 0.22, len, 8);
    const bond = new THREE.Mesh(bondGeom, bondMat.clone());
    bond.position.copy(positions[i]).add(dir.clone().multiplyScalar(0.5));
    bond.lookAt(positions[closestJ]);
    bond.rotateX(Math.PI / 2);
    group.add(bond);
  }

  return group;
}

function setupMolecularFloaters(scene: THREE.Scene): MolecularFloater[] {
  const floaters: MolecularFloater[] = [];
  const count = 7;
  for (let i = 0; i < count; i++) {
    const color = FLOATER_COLORS[i % FLOATER_COLORS.length];
    const atomCount = 3 + Math.floor(Math.random() * 4);
    const atomScale = 0.05 + Math.random() * 0.025;
    const group = createMoleculeGroup(color, atomCount, atomScale);
    scene.add(group);
    floaters.push({
      group,
      orbitRadius: 2.1 + Math.random() * 1.4,
      orbitSpeed: 0.06 + Math.random() * 0.10,
      orbitPhase: Math.random() * Math.PI * 2,
      orbitTilt: (Math.random() - 0.5) * 0.6,
      baseHeight: -0.6 + Math.random() * 1.7,
      bobAmplitude: 0.10 + Math.random() * 0.14,
      bobSpeed: 0.4 + Math.random() * 0.6,
      spin: new THREE.Vector3(
        0.5 + Math.random() * 0.8,
        0.4 + Math.random() * 1.0,
        0.3 + Math.random() * 0.6,
      ),
    });
  }
  return floaters;
}

function updateMolecularFloaters(floaters: MolecularFloater[], t: number) {
  for (const f of floaters) {
    const angle = f.orbitPhase + t * f.orbitSpeed;
    const x = Math.cos(angle) * f.orbitRadius;
    const z = Math.sin(angle) * f.orbitRadius;
    const y = f.baseHeight + Math.sin(t * f.bobSpeed) * f.bobAmplitude;
    f.group.position.set(x, y + f.orbitTilt * x, z);
    f.group.rotation.x = t * f.spin.x * 0.5;
    f.group.rotation.y = t * f.spin.y * 0.5;
    f.group.rotation.z = t * f.spin.z * 0.5;
  }
}

interface ParticleSystem {
  points: THREE.Points;
  geom: THREE.BufferGeometry;
  data: ParticleEntry[];
  origin: THREE.Vector3;
  destination: THREE.Vector3;
}

interface ParticleEntry {
  spawn: THREE.Vector3;
  age: number;
  duration: number;
  pos: THREE.Vector3;
  jitter: THREE.Vector3; // small per-particle target offset for variation
}

function makeRadialGradientTexture(rgb: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0,    `rgba(${rgb}, 1.0)`);
  grad.addColorStop(0.4,  `rgba(${rgb}, 0.45)`);
  grad.addColorStop(1,    `rgba(${rgb}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

// Inhale: spawn in front of face, travel through the nose, continue past it
// into the chest interior. Particles disappear once they reach the lung target,
// so a fraction of the path is "inside" the body and reads through the
// translucent skin shell.
function setupInhaleParticles(bodyGroup: THREE.Group, bbox: THREE.Box3): ParticleSystem {
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const noseTarget = new THREE.Vector3(
    bbox.min.x + 0.5  * size.x,
    bbox.min.y + 0.90 * size.y,
    bbox.min.z + 0.65 * size.z,
  );
  // Lung-area target: deep in the chest, slightly posterior of body center.
  const lungTarget = new THREE.Vector3(
    bbox.min.x + 0.5  * size.x,
    bbox.min.y + 0.65 * size.y,
    bbox.min.z + 0.30 * size.z,
  );

  const data: ParticleEntry[] = [];
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const spawn = randomFrontOfFaceSpawn(noseTarget);
    const entry: ParticleEntry = {
      spawn,
      age: Math.random() * 2,
      duration: 1.6 + Math.random() * 1.4,
      pos: spawn.clone(),
      jitter: new THREE.Vector3((Math.random() - 0.5) * 0.10, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.06),
    };
    data.push(entry);
    positions[i * 3] = entry.pos.x;
    positions[i * 3 + 1] = entry.pos.y;
    positions[i * 3 + 2] = entry.pos.z;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0x9be7e3,
    size: 0.085,
    map: makeRadialGradientTexture('155, 231, 227'),
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geom, mat);
  bodyGroup.add(points);
  return { points, geom, data, origin: noseTarget, destination: lungTarget };
}

// Exhale: amber particles spawn near the nose and stream outward and slightly
// downward, fading as they disperse.
function setupExhaleParticles(bodyGroup: THREE.Group, bbox: THREE.Box3): ParticleSystem {
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const noseSource = new THREE.Vector3(
    bbox.min.x + 0.5  * size.x,
    bbox.min.y + 0.88 * size.y,
    bbox.min.z + 0.68 * size.z,
  );
  // Generic outward target: drift slightly down and well forward of the face.
  const outwardTarget = new THREE.Vector3(
    noseSource.x,
    noseSource.y - 0.12,
    noseSource.z + 0.95,
  );

  const data: ParticleEntry[] = [];
  const positions = new Float32Array(EXHALE_COUNT * 3);
  for (let i = 0; i < EXHALE_COUNT; i++) {
    const entry: ParticleEntry = {
      spawn: noseSource.clone(),
      age: Math.random() * 1.5,
      duration: 1.3 + Math.random() * 0.9,
      pos: noseSource.clone(),
      jitter: new THREE.Vector3((Math.random() - 0.5) * 0.40, (Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.20),
    };
    data.push(entry);
    positions[i * 3] = entry.pos.x;
    positions[i * 3 + 1] = entry.pos.y;
    positions[i * 3 + 2] = entry.pos.z;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xfbbf24,
    size: 0.10,
    map: makeRadialGradientTexture('251, 191, 36'),
    transparent: true,
    opacity: 0.0,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geom, mat);
  bodyGroup.add(points);
  return { points, geom, data, origin: noseSource, destination: outwardTarget };
}

function randomFrontOfFaceSpawn(nose: THREE.Vector3): THREE.Vector3 {
  const rZ = 0.45 + Math.random() * 0.55;
  return new THREE.Vector3(
    nose.x + (Math.random() - 0.5) * 0.55,
    nose.y + (Math.random() - 0.5) * 0.45,
    nose.z + rZ,
  );
}

function updateInhaleParticles(sys: ParticleSystem, dt: number, breathPhase: number) {
  const positions = sys.geom.attributes.position as THREE.BufferAttribute;
  // Inhale intensity peaks at phase 0.25, fades to zero at 0.5.
  const inhale = breathPhase < 0.5 ? Math.sin(breathPhase * Math.PI * 2) : 0;
  const speedFactor = 0.25 + 0.85 * Math.max(0, inhale);

  for (let i = 0; i < sys.data.length; i++) {
    const p = sys.data[i];
    p.age += dt * speedFactor;
    if (p.age >= p.duration) {
      p.spawn = randomFrontOfFaceSpawn(sys.origin);
      p.age = 0;
      p.duration = 1.4 + Math.random() * 1.4;
    }
    const u = p.age / p.duration;
    const easedU = u * u;
    // Path: spawn → (origin = nose) at u≈0.5, then origin → destination (lung target).
    if (u < 0.55) {
      const localU = easedU / 0.30;
      p.pos.lerpVectors(p.spawn, sys.origin, Math.min(1, localU));
    } else {
      const localU = (u - 0.55) / 0.45;
      p.pos.lerpVectors(sys.origin, sys.destination, Math.min(1, localU));
      p.pos.add(p.jitter.clone().multiplyScalar(localU));
    }
    positions.setXYZ(i, p.pos.x, p.pos.y, p.pos.z);
  }
  positions.needsUpdate = true;

  const mat = sys.points.material as THREE.PointsMaterial;
  mat.opacity = 0.40 + 0.50 * Math.max(0, inhale);
}

function updateExhaleParticles(sys: ParticleSystem, dt: number, breathPhase: number) {
  const positions = sys.geom.attributes.position as THREE.BufferAttribute;
  // Exhale intensity peaks at phase 0.75, fades to zero at 0 / 0.5.
  const exhale = breathPhase >= 0.5 ? Math.sin((breathPhase - 0.5) * Math.PI * 2) : 0;
  const speedFactor = 0.20 + 0.85 * Math.max(0, exhale);

  for (let i = 0; i < sys.data.length; i++) {
    const p = sys.data[i];
    p.age += dt * speedFactor;
    if (p.age >= p.duration) {
      p.age = 0;
      p.duration = 1.2 + Math.random() * 0.9;
      p.jitter.set(
        (Math.random() - 0.5) * 0.40,
        (Math.random() - 0.5) * 0.18,
        (Math.random() - 0.5) * 0.20,
      );
    }
    const u = p.age / p.duration;
    p.pos.lerpVectors(sys.origin, sys.destination, u);
    p.pos.add(p.jitter.clone().multiplyScalar(u));
    positions.setXYZ(i, p.pos.x, p.pos.y, p.pos.z);
  }
  positions.needsUpdate = true;

  const mat = sys.points.material as THREE.PointsMaterial;
  // Particles dissipate as they travel — fade alpha out at the end of their
  // path even when exhale is at peak.
  mat.opacity = 0.55 * Math.max(0, exhale);
}

function addProceduralBodyShell(group: THREE.Group) {
  const makeBodyPart = (geometry: THREE.BufferGeometry, position: [number, number, number]) => {
    const mat = new THREE.MeshPhongMaterial({
      color: 0x2dd4bf, transparent: true, opacity: 0.12, shininess: 80, specular: 0x2dd4bf,
    });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x2dd4bf, wireframe: true, transparent: true, opacity: 0.25 });
    const wire = new THREE.Mesh(geometry, wireMat);
    wire.position.set(...position);
    group.add(mesh);
    group.add(wire);
  };

  makeBodyPart(new THREE.SphereGeometry(0.28, 24, 24), [0, 1.55, 0]);
  makeBodyPart(new THREE.CylinderGeometry(0.08, 0.1, 0.2, 16), [0, 1.2, 0]);
  makeBodyPart(new THREE.CylinderGeometry(0.42, 0.32, 1.0, 16), [0, 0.45, 0]);
  makeBodyPart(new THREE.CylinderGeometry(0.32, 0.28, 0.6, 16), [0, -0.3, 0]);
  makeBodyPart(new THREE.CylinderGeometry(0.13, 0.16, 0.7, 12), [-0.45, 0.5, 0]);
  makeBodyPart(new THREE.CylinderGeometry(0.13, 0.16, 0.7, 12), [0.45, 0.5, 0]);
  makeBodyPart(new THREE.CylinderGeometry(0.16, 0.2, 0.8, 12), [-0.18, -1.05, 0]);
  makeBodyPart(new THREE.CylinderGeometry(0.16, 0.2, 0.8, 12), [0.18, -1.05, 0]);
}
