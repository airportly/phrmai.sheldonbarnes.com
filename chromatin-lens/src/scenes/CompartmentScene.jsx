import React, { useMemo } from 'react';
import * as THREE from 'three';
import { COMPARTMENT_SEGMENTS } from '../data/locus';
import Selectable from './Selectable';
import Label from './Label';

// Parametric 3D path representing a chromosome snaking through space.
function pathPoint(t) {
  const x = t * 9 - 4.5;
  const y = Math.sin(t * Math.PI * 2.5) * 1.2 + Math.cos(t * Math.PI * 5) * 0.2;
  const z = Math.cos(t * Math.PI * 1.8) * 0.7;
  return new THREE.Vector3(x, y, z);
}

const sel = (selectedInfo, id, base, boosted) =>
  selectedInfo === id ? boosted : base;

export default function CompartmentScene({ opacity = 1, onSelect, selectedInfo }) {
  // Pre-compute tube geometries for each A/B segment.
  const segments = useMemo(() => {
    const total = COMPARTMENT_SEGMENTS.reduce((s, x) => s + x.length, 0);
    let cum = 0;
    return COMPARTMENT_SEGMENTS.map((seg) => {
      const t0 = cum / total;
      cum += seg.length;
      const t1 = cum / total;
      // Sample points along this segment
      const N = 28;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const t = t0 + (t1 - t0) * (i / N);
        pts.push(pathPoint(t));
      }
      const curve = new THREE.CatmullRomCurve3(pts, false);
      const tube = new THREE.TubeGeometry(curve, N, 0.18, 8, false);
      const mid = pathPoint((t0 + t1) / 2);
      return { ...seg, tube, mid, t0, t1 };
    });
  }, []);

  // Labels: tag one A, one B, and the HBB segment
  const firstA = segments.find(s => s.type === 'A' && !s.highlightHbb);
  const firstB = segments.find(s => s.type === 'B');
  const hbb = segments.find(s => s.highlightHbb);

  return (
    <group>
      {segments.map((seg, i) => {
        const infoId = seg.type === 'A' ? 'compartment-a' : 'compartment-b';
        const color = seg.type === 'A' ? '#ffd93d' : '#6366f1';
        const emissive = seg.type === 'A' ? '#facc15' : '#4338ca';
        return (
          <Selectable key={i} infoId={infoId} onSelect={onSelect}>
            <mesh geometry={seg.tube}>
              <meshStandardMaterial
                color={color}
                transparent
                opacity={opacity * (seg.type === 'A' ? 0.95 : 0.75)}
                roughness={0.4}
                metalness={0.15}
                emissive={emissive}
                emissiveIntensity={
                  seg.highlightHbb
                    ? 0.6
                    : sel(selectedInfo, infoId, seg.type === 'A' ? 0.2 : 0.1, 0.6)
                }
              />
            </mesh>
          </Selectable>
        );
      })}

      {/* HBB locus beacon on the highlighted A segment */}
      {hbb && (
        <group position={[hbb.mid.x, hbb.mid.y, hbb.mid.z]}>
          <Selectable infoId="chr11" onSelect={onSelect}>
            <mesh>
              <sphereGeometry args={[0.22, 24, 24]} />
              <meshStandardMaterial
                color="#ff6b6b"
                transparent
                opacity={opacity}
                emissive="#ff3030"
                emissiveIntensity={0.9}
              />
            </mesh>
          </Selectable>
          <Label position={[0, 0.55, 0]} color="#fecaca" distanceFactor={8}>β-globin locus</Label>
        </group>
      )}

      {firstA && <Label position={[firstA.mid.x, firstA.mid.y + 0.4, firstA.mid.z]} color="#fde68a" distanceFactor={8}>A · active</Label>}
      {firstB && <Label position={[firstB.mid.x, firstB.mid.y - 0.4, firstB.mid.z]} color="#c7d2fe" distanceFactor={8}>B · inactive</Label>}
    </group>
  );
}
