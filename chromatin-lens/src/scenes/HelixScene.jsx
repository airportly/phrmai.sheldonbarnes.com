import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { DNA_SEQUENCE, COMPLEMENT } from '../data/locus';
import Selectable from './Selectable';
import Label from './Label';

// Canonical B-form DNA parameters (scaled down from 0.34 → 0.18 so the full
// 50-bp helix fits the ~10-unit vertical viewport at grow=1 — previously the
// top/bottom and the replication-fork extremes were clipped.)
const BP_RISE = 0.18;
const BP_PER_TURN = 10.5;
const HELIX_RADIUS = 1.0;

const BASE_COLORS = {
  A: "#ff6b6b",
  T: "#4ecdc4",
  G: "#ffd93d",
  C: "#6b9eff"
};

const BASE_INFO_ID = {
  A: 'base-A',
  T: 'base-T',
  G: 'base-G',
  C: 'base-C'
};

const sel = (selectedInfo, id, base, boosted) =>
  selectedInfo === id ? boosted : base;

function BasePair({ index, base, position, opacity, onSelect, selectedInfo }) {
  const comp = COMPLEMENT[base];
  const angle = (index / BP_PER_TURN) * Math.PI * 2;
  const baseId = BASE_INFO_ID[base];
  const compId = BASE_INFO_ID[comp];

  return (
    <group position={position} rotation={[0, angle, 0]}>
      <Selectable infoId="basepair" onSelect={onSelect}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, HELIX_RADIUS * 2, 8]} />
          <meshStandardMaterial
            color="#888888"
            transparent
            opacity={opacity * 0.5}
            emissive="#aaaaaa"
            emissiveIntensity={sel(selectedInfo, 'basepair', 0, 0.5)}
          />
        </mesh>
      </Selectable>
      <Selectable infoId={baseId} onSelect={onSelect}>
        <mesh position={[HELIX_RADIUS * 0.5, 0, 0]}>
          <boxGeometry args={[0.7, 0.15, 0.25]} />
          <meshStandardMaterial
            color={BASE_COLORS[base]}
            transparent
            opacity={opacity}
            emissive={BASE_COLORS[base]}
            emissiveIntensity={sel(selectedInfo, baseId, 0.15, 0.8)}
          />
        </mesh>
      </Selectable>
      <Selectable infoId={compId} onSelect={onSelect}>
        <mesh position={[-HELIX_RADIUS * 0.5, 0, 0]}>
          <boxGeometry args={[0.7, 0.15, 0.25]} />
          <meshStandardMaterial
            color={BASE_COLORS[comp]}
            transparent
            opacity={opacity}
            emissive={BASE_COLORS[comp]}
            emissiveIntensity={sel(selectedInfo, compId, 0.15, 0.8)}
          />
        </mesh>
      </Selectable>
    </group>
  );
}

// =====================================================================
// Replication fork overlay
// =====================================================================
function ReplicationOverlay({ progress, numBases, totalHeight, opacity, onSelect, selectedInfo }) {
  if (progress <= 0) return null;

  const topY = totalHeight / 2;
  const botY = -totalHeight / 2;
  const forkY = botY + (topY - botY) * progress;

  // Leading strand — continuous tube hugging the REVERSE template, below fork
  const samplesPerBp = 4;
  const leadingPts = [];
  for (let i = 0; i <= numBases * samplesPerBp; i++) {
    const bpIdx = i / samplesPerBp;
    const y = bpIdx * BP_RISE - totalHeight / 2;
    if (y > forkY) break;
    const angle = (bpIdx / BP_PER_TURN) * Math.PI * 2 + Math.PI; // reverse side
    const r = HELIX_RADIUS * 1.22;
    leadingPts.push([Math.cos(angle) * r, y, Math.sin(angle) * r]);
  }

  // Lagging strand — Okazaki fragments hugging the FORWARD template
  const OKAZAKI_BP = 8;
  const laggingFragments = [];
  for (let start = 0; start < numBases; start += OKAZAKI_BP) {
    const end = Math.min(start + OKAZAKI_BP - 1, numBases - 1);
    const endY = end * BP_RISE - totalHeight / 2;
    if (endY > forkY) break;
    const pts = [];
    const samples = (end - start) * samplesPerBp;
    for (let i = 0; i <= samples; i++) {
      const bpIdx = start + i / samplesPerBp;
      const y = bpIdx * BP_RISE - totalHeight / 2;
      const angle = (bpIdx / BP_PER_TURN) * Math.PI * 2;
      const r = HELIX_RADIUS * 1.22;
      pts.push([Math.cos(angle) * r, y, Math.sin(angle) * r]);
    }
    laggingFragments.push(pts);
  }

  return (
    <group>
      {/* Helicase ring at the fork — at origin axis */}
      <Selectable infoId="helicase" onSelect={onSelect}>
        <group position={[0, forkY, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.45, 0.08, 12, 24]} />
            <meshStandardMaterial
              color="#fde68a"
              transparent
              opacity={opacity}
              emissive="#d97706"
              emissiveIntensity={sel(selectedInfo, 'helicase', 0.5, 0.95)}
            />
          </mesh>
        </group>
      </Selectable>

      {/* Replisome — compound blob off to one side of the fork */}
      <group position={[HELIX_RADIUS * 2.0, forkY, 0]}>
        <Selectable infoId="replisome" onSelect={onSelect}>
          <mesh>
            <sphereGeometry args={[0.35, 20, 20]} />
            <meshStandardMaterial
              color="#fb923c"
              transparent
              opacity={opacity}
              emissive="#c2410c"
              emissiveIntensity={sel(selectedInfo, 'replisome', 0.55, 0.95)}
            />
          </mesh>
        </Selectable>
        <Label position={[0.55, 0.05, 0]} color="#fdba74" distanceFactor={6}>Replisome</Label>
      </group>

      {/* Fork label */}
      <Label
        position={[-HELIX_RADIUS * 1.8, forkY, 0]}
        color="#fde68a"
        distanceFactor={6}
      >
        Fork
      </Label>

      {/* Leading strand — continuous green line */}
      {leadingPts.length > 1 && (
        <>
          <Line
            points={leadingPts}
            color="#4ade80"
            lineWidth={3}
            transparent
            opacity={opacity}
          />
          {/* Invisible click target on the leading strand */}
          <Selectable infoId="leading-strand" onSelect={onSelect}>
            <mesh position={leadingPts[Math.floor(leadingPts.length / 2)]}>
              <sphereGeometry args={[0.15, 12, 12]} />
              <meshStandardMaterial
                color="#4ade80"
                transparent
                opacity={opacity * 0.5}
                emissive="#22c55e"
                emissiveIntensity={sel(selectedInfo, 'leading-strand', 0.3, 0.95)}
              />
            </mesh>
          </Selectable>
        </>
      )}

      {/* Lagging strand — Okazaki fragments with visible gaps */}
      {laggingFragments.map((pts, i) => (
        <group key={i}>
          <Line
            points={pts}
            color="#22d3ee"
            lineWidth={3}
            transparent
            opacity={opacity}
          />
          <Selectable infoId="okazaki" onSelect={onSelect}>
            <mesh position={pts[Math.floor(pts.length / 2)]}>
              <sphereGeometry args={[0.1, 10, 10]} />
              <meshStandardMaterial
                color="#22d3ee"
                transparent
                opacity={opacity * 0.6}
                emissive="#06b6d4"
                emissiveIntensity={sel(selectedInfo, 'okazaki', 0.4, 0.95)}
              />
            </mesh>
          </Selectable>
        </group>
      ))}

      {/* Clickable fork region — invisible sphere at fork for the fork concept */}
      <Selectable infoId="replication-fork" onSelect={onSelect}>
        <mesh position={[0, forkY - 0.05, 0]}>
          <sphereGeometry args={[0.5, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </Selectable>
    </group>
  );
}

// =====================================================================
// Alt form overlays — rendered next to the helix, NOT inside it
// Position: to the right of the helix so the student can compare
// =====================================================================

function ZDNAOverlay({ opacity, onSelect, selectedInfo }) {
  // Zigzag in the y-x plane, 12 bp tall
  const n = 12;
  const height = n * BP_RISE;
  const r = 0.5;
  const offsetX = 3.0; // to the right of the main helix
  const strand1 = [];
  const strand2 = [];
  for (let i = 0; i <= n; i++) {
    const y = i * BP_RISE - height / 2;
    const side = i % 2 === 0 ? 1 : -1;
    strand1.push([offsetX + side * r, y, 0]);
    strand2.push([offsetX - side * r, y, 0.2]);
  }
  const midY = 0;

  return (
    <group>
      <Line points={strand1} color="#a78bfa" lineWidth={3} transparent opacity={opacity} />
      <Line points={strand2} color="#c4b5fd" lineWidth={3} transparent opacity={opacity} />
      {/* Base pair rungs */}
      {strand1.map((p, i) => {
        if (i % 2 !== 0 || i >= strand2.length) return null;
        return (
          <Line
            key={i}
            points={[p, strand2[i]]}
            color="#888888"
            lineWidth={1.5}
            transparent
            opacity={opacity * 0.5}
          />
        );
      })}
      <Selectable infoId="alt-z" onSelect={onSelect}>
        <mesh position={[offsetX, midY, 0]}>
          <sphereGeometry args={[0.6, 20, 20]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </Selectable>
      <Label position={[offsetX, -height / 2 - 0.5, 0]} color="#c4b5fd" distanceFactor={6}>
        Z-DNA
      </Label>
    </group>
  );
}

function GQuadruplexOverlay({ opacity, onSelect, selectedInfo }) {
  const offsetX = 3.0;
  const tetradYs = [-0.9, 0.0, 0.9];
  const r = 0.4;
  const corners = [
    [ r, 0,  r],
    [-r, 0,  r],
    [-r, 0, -r],
    [ r, 0, -r],
  ];

  return (
    <group position={[offsetX, 0, 0]}>
      {/* 4 vertical strands connecting corners */}
      {corners.map((c, k) => (
        <Line
          key={k}
          points={tetradYs.map(y => [c[0], y, c[2]])}
          color="#fb923c"
          lineWidth={3}
          transparent
          opacity={opacity}
        />
      ))}

      {/* 3 tetrads: G spheres at corners of each tetrad */}
      {tetradYs.map((y, ti) => (
        <group key={ti} position={[0, y, 0]}>
          {corners.map((c, k) => (
            <mesh key={k} position={[c[0], 0, c[2]]}>
              <sphereGeometry args={[0.16, 14, 14]} />
              <meshStandardMaterial
                color="#fbbf24"
                transparent
                opacity={opacity}
                emissive="#d97706"
                emissiveIntensity={0.4}
              />
            </mesh>
          ))}
          {/* Horizontal tetrad frame */}
          {corners.map((c, k) => {
            const next = corners[(k + 1) % 4];
            return (
              <Line
                key={`t${ti}-${k}`}
                points={[[c[0], 0, c[2]], [next[0], 0, next[2]]]}
                color="#fbbf24"
                lineWidth={2}
                transparent
                opacity={opacity * 0.7}
              />
            );
          })}
        </group>
      ))}

      {/* Clickable target at center */}
      <Selectable infoId="alt-g4" onSelect={onSelect}>
        <mesh>
          <sphereGeometry args={[0.55, 20, 20]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </Selectable>
      <Label position={[0, -1.5, 0]} color="#fcd34d" distanceFactor={6}>
        G-quadruplex
      </Label>
    </group>
  );
}

function RLoopOverlay({ opacity, onSelect, selectedInfo }) {
  const offsetX = 3.0;
  const n = 12;
  const height = n * BP_RISE;
  const dnaTemplate = [];
  const rnaStrand = [];
  const displacedSsDna = [];
  for (let i = 0; i <= n; i++) {
    const y = i * BP_RISE - height / 2;
    dnaTemplate.push([offsetX - 0.2, y, 0]);
    rnaStrand.push([offsetX + 0.2, y, 0]); // hybridized to template
    // Displaced ssDNA bubbles out in a curve
    const bubble = Math.sin((i / n) * Math.PI) * 0.8;
    displacedSsDna.push([offsetX + 0.6 + bubble, y, 0]);
  }

  return (
    <group>
      {/* Template DNA strand */}
      <Line points={dnaTemplate} color="#e0e7ff" lineWidth={3} transparent opacity={opacity} />
      {/* RNA strand hybridized to template */}
      <Line points={rnaStrand} color="#fb923c" lineWidth={3} transparent opacity={opacity} />
      {/* Displaced ssDNA — non-template strand pushed out */}
      <Line points={displacedSsDna} color="#fde68a" lineWidth={2} transparent opacity={opacity} />

      {/* RNA:DNA hybrid rungs */}
      {dnaTemplate.map((p, i) => (
        <Line
          key={i}
          points={[p, rnaStrand[i]]}
          color="#888888"
          lineWidth={1.2}
          transparent
          opacity={opacity * 0.5}
        />
      ))}

      <Selectable infoId="alt-r-loop" onSelect={onSelect}>
        <mesh position={[offsetX + 0.3, 0, 0]}>
          <sphereGeometry args={[0.7, 20, 20]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </Selectable>
      <Label position={[offsetX + 0.6, height / 2 + 0.5, 0]} color="#fdba74" distanceFactor={6}>
        R-loop · RNA
      </Label>
      <Label position={[offsetX + 1.2, 0, 0]} color="#fde68a" distanceFactor={6}>
        ssDNA
      </Label>
    </group>
  );
}

// =====================================================================
// Main HelixScene
// =====================================================================
export default function HelixScene({
  opacity = 1,
  onSelect,
  selectedInfo,
  replicationProgress = 0,
  altForm
}) {
  const bases = DNA_SEQUENCE.split('');
  const totalHeight = bases.length * BP_RISE;

  const { forwardGeometry, reverseGeometry } = useMemo(() => {
    const forwardPts = [];
    const reversePts = [];
    const samplesPerBp = 4;
    const totalSamples = bases.length * samplesPerBp;
    for (let i = 0; i < totalSamples; i++) {
      const bpIdx = i / samplesPerBp;
      const angle = (bpIdx / BP_PER_TURN) * Math.PI * 2;
      const y = bpIdx * BP_RISE - totalHeight / 2;
      forwardPts.push(new THREE.Vector3(
        Math.cos(angle) * HELIX_RADIUS,
        y,
        Math.sin(angle) * HELIX_RADIUS
      ));
      reversePts.push(new THREE.Vector3(
        Math.cos(angle + Math.PI) * HELIX_RADIUS,
        y,
        Math.sin(angle + Math.PI) * HELIX_RADIUS
      ));
    }
    const fwdCurve = new THREE.CatmullRomCurve3(forwardPts, false);
    const revCurve = new THREE.CatmullRomCurve3(reversePts, false);
    return {
      forwardGeometry: new THREE.TubeGeometry(fwdCurve, totalSamples, 0.12, 8, false),
      reverseGeometry: new THREE.TubeGeometry(revCurve, totalSamples, 0.12, 8, false)
    };
  }, [bases.length, totalHeight]);

  const topY = totalHeight / 2;
  const botY = -totalHeight / 2;
  const fwdAngleTop = ((bases.length - 1) / BP_PER_TURN) * Math.PI * 2;

  return (
    <group>
      <Selectable infoId="backbone" onSelect={onSelect}>
        <mesh geometry={forwardGeometry}>
          <meshStandardMaterial
            color="#e0e7ff"
            transparent
            opacity={opacity * 0.9}
            roughness={0.3}
            metalness={0.3}
            emissive="#a5b4fc"
            emissiveIntensity={sel(selectedInfo, 'backbone', 0, 0.5)}
          />
        </mesh>
      </Selectable>
      <Selectable infoId="backbone" onSelect={onSelect}>
        <mesh geometry={reverseGeometry}>
          <meshStandardMaterial
            color="#fde68a"
            transparent
            opacity={opacity * 0.9}
            roughness={0.3}
            metalness={0.3}
            emissive="#fbbf24"
            emissiveIntensity={sel(selectedInfo, 'backbone', 0, 0.5)}
          />
        </mesh>
      </Selectable>

      {bases.map((base, i) => (
        <BasePair
          key={i}
          index={i}
          base={base}
          position={[0, i * BP_RISE - totalHeight / 2, 0]}
          opacity={opacity}
          onSelect={onSelect}
          selectedInfo={selectedInfo}
        />
      ))}

      <Label
        position={[Math.cos(fwdAngleTop) * HELIX_RADIUS * 1.4, topY + 0.3, Math.sin(fwdAngleTop) * HELIX_RADIUS * 1.4]}
        color="#c7d2fe"
      >
        5′
      </Label>
      <Label
        position={[HELIX_RADIUS * 1.4, botY - 0.3, 0]}
        color="#c7d2fe"
      >
        3′
      </Label>

      {/* Replication fork overlay (if progress > 0) */}
      <ReplicationOverlay
        progress={replicationProgress}
        numBases={bases.length}
        totalHeight={totalHeight}
        opacity={opacity}
        onSelect={onSelect}
        selectedInfo={selectedInfo}
      />

      {/* Alternative DNA form overlay (if not B-DNA) */}
      {altForm?.id === 'z' && <ZDNAOverlay opacity={opacity} onSelect={onSelect} selectedInfo={selectedInfo} />}
      {altForm?.id === 'g4' && <GQuadruplexOverlay opacity={opacity} onSelect={onSelect} selectedInfo={selectedInfo} />}
      {altForm?.id === 'r-loop' && <RLoopOverlay opacity={opacity} onSelect={onSelect} selectedInfo={selectedInfo} />}
    </group>
  );
}
