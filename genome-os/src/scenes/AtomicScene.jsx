import React from 'react';
import { Line } from '@react-three/drei';
import { ATOMIC_SCENE, ATOM_COLORS } from '../data/locus';
import Selectable from './Selectable';
import Label from './Label';

const sel = (selectedInfo, id, base, boosted) =>
  selectedInfo === id ? boosted : base;

function Atom({ el, pos, opacity, selectedInfo }) {
  const color = ATOM_COLORS[el] || '#ffffff';
  const radius = el === 'H' ? 0.1 : 0.16;
  return (
    <mesh position={pos}>
      <sphereGeometry args={[radius, 20, 20]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        roughness={0.3}
        metalness={0.2}
        emissive={color}
        emissiveIntensity={sel(selectedInfo, 'atom', 0.2, 0.55)}
      />
    </mesh>
  );
}

// Midpoint of two 3D points
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

// Render one copy of the base pair + scaffolds, optionally as a translucent ghost
function BasePairCopy({ opacityScale, positionOffset = [0, 0, 0], selectedInfo, onSelect, interactive = true }) {
  const { guanine, cytosine, hbonds, scaffolds } = ATOMIC_SCENE;
  const shift = (p) => [p[0] + positionOffset[0], p[1] + positionOffset[1], p[2] + positionOffset[2]];

  const atomNode = (atom, idx) => <Atom key={idx} el={atom.el} pos={shift(atom.pos)} opacity={opacityScale} selectedInfo={interactive ? selectedInfo : null} />;

  const guanineAtoms = guanine.map(atomNode);
  const cytosineAtoms = cytosine.map(atomNode);

  return (
    <group>
      {/* Purine (guanine) ring system */}
      {interactive ? (
        <Selectable infoId="purine-ring" onSelect={onSelect}>
          <group>{guanineAtoms}</group>
        </Selectable>
      ) : <group>{guanineAtoms}</group>}

      {/* Pyrimidine (cytosine) ring system */}
      {interactive ? (
        <Selectable infoId="pyrimidine-ring" onSelect={onSelect}>
          <group>{cytosineAtoms}</group>
        </Selectable>
      ) : <group>{cytosineAtoms}</group>}

      {/* Hydrogen bonds — dashed lines between specific atoms */}
      {hbonds.map(([gIdx, cIdx], i) => {
        const a = shift(guanine[gIdx].pos);
        const b = shift(cytosine[cIdx].pos);
        const mid = midpoint(a, b);
        return (
          <group key={i}>
            <Line
              points={[a, b]}
              color="#ffffff"
              lineWidth={2}
              dashed
              dashSize={0.12}
              gapSize={0.08}
              transparent
              opacity={opacityScale * 0.8}
            />
            {interactive && (
              <Selectable infoId="hydrogen-bond" onSelect={onSelect}>
                <mesh position={mid}>
                  <sphereGeometry args={[0.08, 10, 10]} />
                  <meshStandardMaterial
                    color="#ffffff"
                    transparent
                    opacity={opacityScale * 0.3}
                    emissive="#ffffff"
                    emissiveIntensity={sel(selectedInfo, 'hydrogen-bond', 0.2, 0.9)}
                  />
                </mesh>
              </Selectable>
            )}
          </group>
        );
      })}

      {/* Sugar + phosphate scaffolds */}
      {scaffolds.map((s, i) => {
        const isSugar = s.el === 'sugar';
        const color = isSugar ? '#fde68a' : '#fb923c';
        const infoId = isSugar ? 'deoxyribose' : 'phosphate';
        const pos = shift(s.pos);
        const mesh = (
          <mesh position={pos}>
            <sphereGeometry args={[isSugar ? 0.22 : 0.2, 16, 16]} />
            <meshStandardMaterial
              color={color}
              transparent
              opacity={opacityScale}
              emissive={color}
              emissiveIntensity={interactive ? sel(selectedInfo, infoId, 0.25, 0.85) : 0.15}
            />
          </mesh>
        );
        return interactive ? (
          <Selectable key={i} infoId={infoId} onSelect={onSelect}>{mesh}</Selectable>
        ) : <group key={i}>{mesh}</group>;
      })}
    </group>
  );
}

export default function AtomicScene({ opacity = 1, onSelect, selectedInfo }) {
  const { stackGhost } = ATOMIC_SCENE;

  return (
    <group>
      {/* Ghost base pairs above and below — illustrate base stacking */}
      {stackGhost.map((ghost, i) => (
        <Selectable key={i} infoId="base-stacking" onSelect={onSelect}>
          <group position={ghost.offset}>
            <BasePairCopy
              opacityScale={opacity * ghost.opacity}
              interactive={false}
              selectedInfo={selectedInfo}
              onSelect={onSelect}
            />
          </group>
        </Selectable>
      ))}

      {/* The primary interactive base pair */}
      <BasePairCopy
        opacityScale={opacity}
        selectedInfo={selectedInfo}
        onSelect={onSelect}
      />

      {/* Static labels */}
      <Label position={[-1.8, 1.8, 0]} color="#fde68a" distanceFactor={7}>G</Label>
      <Label position={[2.3, 1.6, 0]} color="#fde68a" distanceFactor={7}>C</Label>
      <Label position={[0.4, 0.8, 0]} color="#ffffff" distanceFactor={7}>H-bonds</Label>
      <Label position={[0, 1.2, 1.0]} color="#c7d2fe" distanceFactor={7}>Base stacking</Label>
    </group>
  );
}
