import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { FIBER_PARAMS } from '../data/locus';
import Selectable from './Selectable';
import Label from './Label';

const sel = (selectedInfo, id, base, boosted) =>
  selectedInfo === id ? boosted : base;

export default function FiberScene({ opacity = 1, onSelect, selectedInfo }) {
  const { nucleosomesPerTurn, turns, radius, rise, nucleosomeRadius } = FIBER_PARAMS;
  const total = nucleosomesPerTurn * turns;

  const { nucleosomes, linker } = useMemo(() => {
    const positions = [];
    for (let i = 0; i < total; i++) {
      const angle = (i / nucleosomesPerTurn) * Math.PI * 2;
      const y = (i / nucleosomesPerTurn) * rise - (turns * rise) / 2;
      positions.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius
      ));
    }
    const linkerCurve = new THREE.CatmullRomCurve3(positions, false);
    const linkerTube = new THREE.TubeGeometry(linkerCurve, total * 4, 0.06, 6, false);
    return { nucleosomes: positions, linker: linkerTube };
  }, [total, nucleosomesPerTurn, turns, radius, rise]);

  return (
    <group>
      {/* Outer fiber envelope to click on */}
      <Selectable infoId="fiber-30nm" onSelect={onSelect}>
        <mesh>
          <cylinderGeometry args={[radius + 0.4, radius + 0.4, turns * rise + 1, 24, 1, true]} />
          <meshBasicMaterial
            color="#fca5a5"
            transparent
            opacity={opacity * 0.05}
            side={2}
          />
        </mesh>
      </Selectable>

      {/* Linker DNA running along the solenoid axis */}
      <mesh geometry={linker}>
        <meshStandardMaterial
          color="#6b9eff"
          transparent
          opacity={opacity * 0.75}
          roughness={0.4}
          emissive="#4d7dd8"
          emissiveIntensity={0.08}
        />
      </mesh>

      {/* Nucleosome disks */}
      {nucleosomes.map((p, i) => {
        const angleToCenter = Math.atan2(p.z, p.x);
        return (
          <group key={i} position={p}>
            <Selectable infoId="nucleosome" onSelect={onSelect}>
              <mesh rotation={[0, -angleToCenter, Math.PI / 2]}>
                <cylinderGeometry args={[nucleosomeRadius, nucleosomeRadius, 0.28, 20]} />
                <meshStandardMaterial
                  color="#e879a6"
                  transparent
                  opacity={opacity * 0.95}
                  roughness={0.3}
                  metalness={0.2}
                  emissive="#c2185b"
                  emissiveIntensity={sel(selectedInfo, 'nucleosome', 0.15, 0.8)}
                />
              </mesh>
            </Selectable>
            {/* Histone H1 linker histone as a small bead on the inside face */}
            {i % 2 === 0 && (
              <Selectable infoId="histone-h1" onSelect={onSelect}>
                <mesh position={[-p.x * 0.1, 0, -p.z * 0.1]}>
                  <sphereGeometry args={[0.09, 12, 12]} />
                  <meshStandardMaterial
                    color="#fde68a"
                    transparent
                    opacity={opacity}
                    emissive="#f59e0b"
                    emissiveIntensity={sel(selectedInfo, 'histone-h1', 0.4, 0.95)}
                  />
                </mesh>
              </Selectable>
            )}
            {/* Label one representative nucleosome and one H1 */}
            {i === nucleosomesPerTurn + 1 && (
              <Label position={[0, 0.55, 0]} color="#f9a8d4" distanceFactor={7}>Nucleosome</Label>
            )}
            {i === nucleosomesPerTurn * 2 && (
              <Label position={[0, -0.5, 0]} color="#fde68a" distanceFactor={7}>H1</Label>
            )}
          </group>
        );
      })}

      {/* Prominent "DISPUTED" banner */}
      <Html
        position={[0, (turns * rise) / 2 + 1.2, 0]}
        center
        distanceFactor={9}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{
          padding: '6px 12px',
          background: 'rgba(239, 68, 68, 0.12)',
          color: '#fca5a5',
          borderRadius: 6,
          border: '1px solid rgba(248, 113, 113, 0.55)',
          fontSize: 11,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          fontWeight: 600,
          whiteSpace: 'nowrap'
        }}>
          Disputed · textbook model
        </div>
      </Html>
    </group>
  );
}
