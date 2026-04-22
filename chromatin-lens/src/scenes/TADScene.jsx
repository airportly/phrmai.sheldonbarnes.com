import React, { useMemo } from 'react';
import * as THREE from 'three';
import { TAD_LAYOUT } from '../data/locus';
import Selectable from './Selectable';
import Label from './Label';

const sel = (selectedInfo, id, base, boosted) =>
  selectedInfo === id ? boosted : base;

// Build a meandering tube for one TAD: nLoops small loops along a local x-axis.
function buildTADTube(nLoops, width = 1.8, height = 1.0) {
  const pts = [];
  const samplesPerLoop = 14;
  const segments = nLoops * 2;
  for (let s = 0; s <= segments; s++) {
    for (let i = 0; i < samplesPerLoop; i++) {
      const localT = i / samplesPerLoop;
      const t = (s + localT) / segments;
      // oscillate in x across the TAD width
      const x = (t - 0.5) * width;
      // little loops in y-z plane
      const loopAngle = localT * Math.PI * 2 * (s % 2 === 0 ? 1 : -1);
      const loopR = 0.25 + (s % 3) * 0.05;
      const y = Math.sin(loopAngle) * loopR + Math.sin(t * Math.PI) * height * 0.5;
      const z = Math.cos(loopAngle) * loopR + Math.cos(t * Math.PI * 2) * 0.2;
      pts.push(new THREE.Vector3(x, y, z));
    }
  }
  const curve = new THREE.CatmullRomCurve3(pts, false);
  return new THREE.TubeGeometry(curve, pts.length, 0.06, 6, false);
}

export default function TADScene({ opacity = 1, onSelect, selectedInfo }) {
  const tads = useMemo(
    () => TAD_LAYOUT.map(t => ({ ...t, tube: buildTADTube(t.loops) })),
    []
  );

  return (
    <group>
      {tads.map((tad, i) => {
        const color = tad.highlight ? '#ffd93d' : '#6b9eff';
        const emissive = tad.highlight ? '#f59e0b' : '#3b82f6';
        return (
          <group key={tad.id} position={tad.center}>
            {/* Translucent bounding bubble indicating TAD volume */}
            <Selectable infoId="tad" onSelect={onSelect}>
              <mesh>
                <sphereGeometry args={[1.35, 32, 24]} />
                <meshStandardMaterial
                  color={color}
                  transparent
                  opacity={opacity * (tad.highlight ? 0.12 : 0.06)}
                  emissive={emissive}
                  emissiveIntensity={sel(selectedInfo, 'tad', tad.highlight ? 0.2 : 0.08, 0.5)}
                  side={2}
                  depthWrite={false}
                />
              </mesh>
            </Selectable>

            {/* The chromatin tube (several loops) */}
            <mesh geometry={tad.tube}>
              <meshStandardMaterial
                color={color}
                transparent
                opacity={opacity * (tad.highlight ? 0.95 : 0.55)}
                roughness={0.4}
                emissive={emissive}
                emissiveIntensity={tad.highlight ? 0.35 : 0.1}
              />
            </mesh>

            {tad.highlight && (
              <Label position={[0, 1.65, 0]} color="#fde68a" distanceFactor={9}>
                HBB TAD
              </Label>
            )}
            {!tad.highlight && i === 0 && (
              <Label position={[0, 1.55, 0]} color="#c7d2fe" distanceFactor={9}>
                Neighbor TAD
              </Label>
            )}
          </group>
        );
      })}

      {/* TAD boundary markers: CTCF clusters between adjacent TADs.
          Made noticeably bigger (0.16 → 0.28) and pushed slightly forward in
          z so they pop out of the translucent bubbles instead of getting
          lost between them. A soft outer halo adds a glow ring that reads
          even when the scene is small on mobile. */}
      {[-1.6, 1.6].map((x, i) => {
        const isSelected = selectedInfo === 'tad-boundary';
        return (
          <group key={i} position={[x, 0.4, 0.3]}>
            {/* Outer glow halo */}
            <mesh>
              <sphereGeometry args={[0.42, 20, 20]} />
              <meshBasicMaterial
                color="#ff6b6b"
                transparent
                opacity={opacity * (isSelected ? 0.25 : 0.14)}
                depthWrite={false}
              />
            </mesh>
            {/* Core sphere */}
            <Selectable infoId="tad-boundary" onSelect={onSelect}>
              <mesh>
                <sphereGeometry args={[0.28, 24, 24]} />
                <meshStandardMaterial
                  color="#ff6b6b"
                  transparent
                  opacity={opacity}
                  emissive="#ff3030"
                  emissiveIntensity={sel(selectedInfo, 'tad-boundary', 0.75, 1.1)}
                />
              </mesh>
            </Selectable>
            {i === 0 && (
              <Label position={[0, 0.6, 0]} color="#fecaca" distanceFactor={9}>
                CTCF boundary
              </Label>
            )}
          </group>
        );
      })}

      {/* Hi-C hint: a subtle triangular plane overlay behind the HBB TAD */}
      <mesh position={[0, -1.9, -0.5]} rotation={[-Math.PI / 2.5, 0, 0]}>
        <planeGeometry args={[2.6, 1.3]} />
        <meshBasicMaterial
          color="#ffd93d"
          transparent
          opacity={opacity * 0.08}
          side={2}
        />
      </mesh>
    </group>
  );
}
