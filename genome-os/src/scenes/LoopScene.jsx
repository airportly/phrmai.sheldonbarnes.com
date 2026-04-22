import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { CTCF_ANCHORS, GENES } from '../data/locus';
import Selectable from './Selectable';
import Label from './Label';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sstep = (a, b, t) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};

// Build a loop curve where the "shape" factor is scaled by `extent` ∈ [0, 1].
// extent=0 → collapses to a point at the base; extent=1 → full teardrop.
function generateLoopPoints(numPoints = 200, extent = 1) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const angle = t * Math.PI * 2;
    const radius = 2.5;
    const shape = Math.sin(t * Math.PI) * extent;
    const x = Math.sin(angle) * radius * shape;
    const y = Math.cos(angle) * radius * shape - 0.5;
    const z = Math.sin(t * Math.PI * 3) * 0.3 * extent;
    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
}

function getPointAt(points, t) {
  const idx = Math.floor(t * (points.length - 1));
  return points[idx];
}

const sel = (selectedInfo, id, base = 0.3, boosted = 0.9) =>
  selectedInfo === id ? boosted : base;

// ---- Pol II + nascent mRNA animation ----
function TranscribingPolII({ points, geneStart, geneEnd, opacity, onSelect, selectedInfo }) {
  const polRef = useRef();
  const mrnaRefs = useRef([]);
  const clockRef = useRef(0);

  // Pre-seed a few mRNA particle refs
  const mrnaCount = 5;
  const particles = useMemo(
    () => Array.from({ length: mrnaCount }, (_, i) => ({ seed: i, spawnPhase: (i / mrnaCount) })),
    []
  );

  useFrame((state, delta) => {
    clockRef.current += delta;
    // Pol II position cycles along the gene, then brief gap
    const CYCLE_SEC = 6;
    const cycleT = (clockRef.current % CYCLE_SEC) / CYCLE_SEC;
    // Spend 85% of cycle traversing, 15% offloaded
    const onGene = cycleT < 0.85;
    const traversalT = cycleT / 0.85;
    if (polRef.current) {
      if (onGene) {
        const u = geneStart + (geneEnd - geneStart) * traversalT;
        const p = getPointAt(points, u);
        polRef.current.position.set(p.x, p.y, p.z);
        polRef.current.visible = true;
      } else {
        polRef.current.visible = false;
      }
    }

    // Update mRNA particles — each drifts outward from the Pol II's current pos
    const geneMid = (geneStart + geneEnd) / 2;
    const geneMidPos = getPointAt(points, geneMid);
    mrnaRefs.current.forEach((m, i) => {
      if (!m) return;
      const phase = (clockRef.current * 0.5 + particles[i].spawnPhase) % 1;
      const u = geneStart + (geneEnd - geneStart) * phase;
      const p = getPointAt(points, u);
      // Drift radially outward from the gene midpoint
      const dir = new THREE.Vector3(p.x - geneMidPos.x, p.y - geneMidPos.y, p.z - geneMidPos.z).normalize();
      const r = phase * 0.8;
      m.position.set(p.x + dir.x * r, p.y + dir.y * r + phase * 0.3, p.z + dir.z * r);
      m.scale.setScalar(Math.max(0.001, 1 - phase));
      m.visible = phase > 0.05;
    });
  });

  return (
    <group>
      <Selectable infoId="pol-ii" onSelect={onSelect}>
        <mesh ref={polRef}>
          <sphereGeometry args={[0.16, 20, 20]} />
          <meshStandardMaterial
            color="#f472b6"
            transparent
            opacity={opacity}
            emissive="#ec4899"
            emissiveIntensity={sel(selectedInfo, 'pol-ii', 0.5, 0.95)}
            roughness={0.3}
          />
        </mesh>
      </Selectable>
      {particles.map((p, i) => (
        <Selectable key={i} infoId="mrna" onSelect={onSelect}>
          <mesh ref={(el) => (mrnaRefs.current[i] = el)}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshStandardMaterial
              color="#4ecdc4"
              transparent
              opacity={opacity * 0.85}
              emissive="#2dd4bf"
              emissiveIntensity={sel(selectedInfo, 'mrna', 0.5, 0.95)}
            />
          </mesh>
        </Selectable>
      ))}
    </group>
  );
}

export default function LoopScene({
  opacity = 1,
  onSelect,
  selectedInfo,
  stage,
  extrusionProgress = 1,
  transcribing = false,
}) {
  // Extrusion eases so t=0 stays ~invisible, t=1 is full loop.
  const extent = sstep(0.0, 1.0, extrusionProgress);

  // Regenerate loop points when extent changes — cheap (200 samples)
  const points = useMemo(() => generateLoopPoints(200, Math.max(0.01, extent)), [extent]);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points, true), [points]);
  const tubeGeometry = useMemo(
    () => new THREE.TubeGeometry(curve, 200, 0.08, 8, true),
    [curve]
  );

  const lcrPos = getPointAt(points, 0.02);

  const activeGeneNames = stage?.activeGenes ?? ['HBB'];
  const activeBeams = useMemo(
    () =>
      GENES
        .filter(g => activeGeneNames.includes(g.name))
        .map(g => {
          const midT = (g.start + g.end) / 2;
          const p = getPointAt(points, midT);
          return {
            name: g.name,
            points: [[lcrPos.x, lcrPos.y, lcrPos.z], [p.x, p.y, p.z]]
          };
        }),
    [activeGeneNames, points, lcrPos]
  );

  // HBB gene positions for transcription (always present; rendered only when transcribing)
  const hbbGene = GENES.find(g => g.name === 'HBB');

  // Hide genes + CTCFs during very early extrusion (loop hasn't formed yet)
  const detailVis = sstep(0.1, 0.5, extrusionProgress);
  // Cohesin is visible from the start (it's what's doing the extrusion)
  const cohesinVis = 1;

  return (
    <group>
      {/* Chromatin loop tube */}
      <Selectable infoId={extent < 0.8 ? 'extrusion-loop' : 'loop'} onSelect={onSelect}>
        <mesh geometry={tubeGeometry}>
          <meshStandardMaterial
            color="#6b9eff"
            transparent
            opacity={opacity * 0.85}
            roughness={0.4}
            metalness={0.1}
            emissive="#4d7dd8"
            emissiveIntensity={sel(selectedInfo, 'loop', 0.05, 0.5)}
          />
        </mesh>
      </Selectable>

      {/* LCR→active-gene contact beam(s) — only once loop is substantially formed */}
      {detailVis > 0.1 && activeBeams.map((beam) => (
        <Line
          key={beam.name}
          points={beam.points}
          color="#ffd93d"
          lineWidth={2.2}
          transparent
          opacity={opacity * 0.7 * detailVis}
        />
      ))}

      {/* LCR region marker */}
      {detailVis > 0.05 && (
        <group position={[lcrPos.x, lcrPos.y, lcrPos.z]}>
          <Selectable infoId="lcr" onSelect={onSelect}>
            <mesh>
              <sphereGeometry args={[0.18, 24, 24]} />
              <meshStandardMaterial
                color="#a78bfa"
                transparent
                opacity={opacity * detailVis}
                emissive="#7c3aed"
                emissiveIntensity={sel(selectedInfo, 'lcr', 0.35, 0.9)}
              />
            </mesh>
          </Selectable>
          {detailVis > 0.5 && <Label position={[0, 0.35, 0]} color="#c4b5fd">LCR</Label>}
        </group>
      )}

      {/* CTCF anchor spheres — visible only once the loop has formed enough to have anchors */}
      {CTCF_ANCHORS.map((anchor, i) => {
        const pos = getPointAt(points, anchor.position);
        return (
          <group key={i} position={[pos.x, pos.y, pos.z]}>
            <Selectable infoId="ctcf" onSelect={onSelect}>
              <mesh>
                <sphereGeometry args={[0.22, 32, 32]} />
                <meshStandardMaterial
                  color="#ff6b6b"
                  transparent
                  opacity={opacity * Math.max(0.4, detailVis)}
                  emissive="#ff3030"
                  emissiveIntensity={sel(selectedInfo, 'ctcf', 0.3, 0.9)}
                />
              </mesh>
            </Selectable>
            {detailVis > 0.5 && <Label position={[0, 0.4, 0]} color="#fca5a5">CTCF</Label>}
          </group>
        );
      })}

      {/* Gene markers — fade in as the loop forms */}
      {detailVis > 0.1 && GENES.map((gene, i) => {
        const midT = (gene.start + gene.end) / 2;
        const midPos = getPointAt(points, midT);
        const infoId = gene.name.toLowerCase();
        const isActive = activeGeneNames.includes(gene.name);
        const labelYOffset = i % 2 === 0 ? 0.32 : -0.32;
        return (
          <group key={i} position={[midPos.x, midPos.y, midPos.z]}>
            <Selectable infoId={infoId} onSelect={onSelect}>
              <mesh>
                <sphereGeometry args={[isActive ? 0.16 : 0.13, 16, 16]} />
                <meshStandardMaterial
                  color={isActive ? '#ffd93d' : '#8fbc8f'}
                  transparent
                  opacity={opacity * detailVis}
                  emissive={isActive ? '#ffaa00' : '#4a7c4a'}
                  emissiveIntensity={
                    isActive
                      ? sel(selectedInfo, infoId, 0.55, 0.95)
                      : sel(selectedInfo, infoId, 0.1, 0.7)
                  }
                />
              </mesh>
            </Selectable>
            {detailVis > 0.5 && (
              <Label
                position={[0, labelYOffset, 0]}
                color={isActive ? '#fde68a' : '#c8e6c9'}
              >
                {gene.name}
              </Label>
            )}
          </group>
        );
      })}

      {/* Cohesin ring — the machine doing the extrusion; always at the loop base */}
      <group position={[0, -0.5, 0]}>
        <Selectable infoId="cohesin" onSelect={onSelect}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.35, 0.06, 16, 32]} />
            <meshStandardMaterial
              color="#c084fc"
              transparent
              opacity={opacity * 0.85 * cohesinVis}
              emissive="#9333ea"
              emissiveIntensity={sel(selectedInfo, 'cohesin', 0.25, 0.9)}
            />
          </mesh>
        </Selectable>
        <Label position={[0, 0.35, 0]} color="#d8b4fe">Cohesin</Label>
      </group>

      {/* Transcribing Pol II + nascent mRNA — animates only when enabled AND loop is formed */}
      {transcribing && detailVis > 0.5 && hbbGene && (
        <TranscribingPolII
          points={points}
          geneStart={hbbGene.start}
          geneEnd={hbbGene.end}
          opacity={opacity}
          onSelect={onSelect}
          selectedInfo={selectedInfo}
        />
      )}
    </group>
  );
}
