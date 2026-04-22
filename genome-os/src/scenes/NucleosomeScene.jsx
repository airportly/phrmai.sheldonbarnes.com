import React, { useMemo } from 'react';
import * as THREE from 'three';
import { NUCLEOSOMES } from '../data/locus';
import Selectable from './Selectable';
import Label from './Label';

const sel = (selectedInfo, id, base, boosted) =>
  selectedInfo === id ? boosted : base;

// Small tuft of 6 "tail" spheres around the nucleosome axis, clickable to open
// the info for the currently-selected histone mark (or a generic tail card if none).
function HistoneTails({ mark, opacity, onSelect, selectedInfo }) {
  const markId = mark?.id ?? 'none';
  const active = markId && markId !== 'none';
  const infoId = active ? markId : 'histone-tail';
  const color = mark?.color ?? '#6b7280';
  const emissive = mark?.emissive ?? '#9ca3af';
  // 6 tails per nucleosome: 3 near each axial face, distributed radially.
  const positions = [
    [ 0.18,  0.32,  0.12],
    [-0.22,  0.30, -0.14],
    [ 0.04,  0.34, -0.22],
    [ 0.20, -0.32,  0.10],
    [-0.20, -0.30, -0.16],
    [ 0.00, -0.34,  0.22],
  ];
  return (
    <group>
      {positions.map((p, i) => (
        <Selectable key={i} infoId={infoId} onSelect={onSelect}>
          <mesh position={p}>
            <sphereGeometry args={[0.065, 10, 10]} />
            <meshStandardMaterial
              color={color}
              transparent
              opacity={opacity * (active ? 0.95 : 0.55)}
              emissive={emissive}
              emissiveIntensity={active
                ? (selectedInfo === infoId ? 1.1 : 0.7)
                : 0.15}
              roughness={0.35}
            />
          </mesh>
        </Selectable>
      ))}
    </group>
  );
}

// A single nucleosome: histone octamer cylinder with DNA helix wrapped around it
function Nucleosome({ position, rotation, opacity, onSelect, selectedInfo, showLabel, mark }) {
  const wrapTurns = 1.7;
  const wrapPoints = 80;

  const dnaCurve = useMemo(() => {
    const pts = [];
    for (let i = 0; i < wrapPoints; i++) {
      const t = i / (wrapPoints - 1);
      const angle = t * Math.PI * 2 * wrapTurns;
      const axialOffset = (t - 0.5) * 0.35;
      const radius = 0.52;
      pts.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        axialOffset,
        Math.sin(angle) * radius
      ));
    }
    return new THREE.CatmullRomCurve3(pts, false);
  }, []);

  const dnaGeometry = useMemo(
    () => new THREE.TubeGeometry(dnaCurve, wrapPoints, 0.06, 6, false),
    [dnaCurve]
  );

  return (
    <group position={position} rotation={rotation}>
      {/* Histone octamer — click to learn about histones */}
      <Selectable infoId="histone" onSelect={onSelect}>
        <mesh>
          <cylinderGeometry args={[0.42, 0.42, 0.5, 24]} />
          <meshStandardMaterial
            color="#e879a6"
            transparent
            opacity={opacity * 0.9}
            roughness={0.3}
            metalness={0.2}
            emissive="#c2185b"
            emissiveIntensity={sel(selectedInfo, 'histone', 0.1, 0.8)}
          />
        </mesh>
      </Selectable>

      {/* DNA wrapped around the histone octamer */}
      <Selectable infoId="wrap-dna" onSelect={onSelect}>
        <mesh geometry={dnaGeometry}>
          <meshStandardMaterial
            color="#6b9eff"
            transparent
            opacity={opacity}
            roughness={0.4}
            emissive="#4d7dd8"
            emissiveIntensity={sel(selectedInfo, 'wrap-dna', 0.05, 0.6)}
          />
        </mesh>
      </Selectable>

      {/* Histone tails — always render as faint grey spheres; light up with mark color when a mark is selected */}
      <HistoneTails mark={mark} opacity={opacity} onSelect={onSelect} selectedInfo={selectedInfo} />

      {showLabel && <Label position={[0, 0.6, 0]} color="#f9a8d4">Nucleosome</Label>}
    </group>
  );
}

export default function NucleosomeScene({ opacity = 1, onSelect, selectedInfo, histoneMark }) {
  // Build linker DNA connecting nucleosomes
  const linkerGeometry = useMemo(() => {
    const points = [];
    NUCLEOSOMES.forEach((nuc) => {
      const x = (nuc.index - NUCLEOSOMES.length / 2) * 1.4;
      const y = Math.sin(nuc.index * 0.6) * 0.15;
      const z = Math.cos(nuc.index * 0.4) * 0.12;
      points.push(new THREE.Vector3(x - 0.35, y + 0.1, z));
      points.push(new THREE.Vector3(x + 0.35, y - 0.1, z));
    });
    const curve = new THREE.CatmullRomCurve3(points, false);
    return new THREE.TubeGeometry(curve, 200, 0.055, 6, false);
  }, []);

  // Midpoint between two nucleosomes for the linker-DNA callout label
  const midIdx = Math.floor(NUCLEOSOMES.length / 2);
  const linkerLabelX = (midIdx - 0.5 - NUCLEOSOMES.length / 2) * 1.4;

  // Which nucleosome to label upfront — a central one for orientation
  const labelIndex = Math.floor(NUCLEOSOMES.length / 2) - 1;

  return (
    <group>
      {/* Linker DNA connecting the nucleosomes */}
      <Selectable infoId="linker-dna" onSelect={onSelect}>
        <mesh geometry={linkerGeometry}>
          <meshStandardMaterial
            color="#6b9eff"
            transparent
            opacity={opacity * 0.85}
            roughness={0.4}
            emissive="#4d7dd8"
            emissiveIntensity={sel(selectedInfo, 'linker-dna', 0.05, 0.6)}
          />
        </mesh>
      </Selectable>

      {/* Individual nucleosomes */}
      {NUCLEOSOMES.map((nuc) => {
        const x = (nuc.index - NUCLEOSOMES.length / 2) * 1.4;
        const y = Math.sin(nuc.index * 0.6) * 0.15;
        const z = Math.cos(nuc.index * 0.4) * 0.12;
        return (
          <Nucleosome
            key={nuc.index}
            position={[x, y, z]}
            rotation={[nuc.rotation, nuc.index * 0.3, 0]}
            opacity={opacity}
            onSelect={onSelect}
            selectedInfo={selectedInfo}
            showLabel={nuc.index === labelIndex}
            mark={histoneMark}
          />
        );
      })}

      {/* One "Linker DNA" callout, pointing at a representative gap */}
      <Label position={[linkerLabelX, -0.7, 0]} color="#93c5fd">Linker DNA</Label>
    </group>
  );
}
