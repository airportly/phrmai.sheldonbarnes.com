import React from 'react';
import { Line } from '@react-three/drei';
import { CHROMOSOME_TERRITORIES, LAD_POSITIONS } from '../data/locus';
import Selectable from './Selectable';
import Label from './Label';

const sel = (selectedInfo, id, base, boosted) =>
  selectedInfo === id ? boosted : base;

// ---- Easing / interpolation helpers ----
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sstep = (a, b, t) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const lerp = (a, b, t) => a + (b - a) * t;

// =====================================================================
// Shared helpers: chromosome layout at each stage
// =====================================================================

function metaphaseX(i, n, spacing = 0.65) {
  return (i - (n - 1) / 2) * spacing;
}

// Position inside a daughter nucleus — a cluster around ±DAUGHTER_Y.
function daughterPosition(i, n, sign /* +1 top, -1 bottom */) {
  const DAUGHTER_Y = 2.2;
  const angle = (i / n) * Math.PI * 2;
  const r = 0.55 + (i % 3) * 0.15;
  const px = Math.cos(angle) * r;
  const pz = Math.sin(angle) * r;
  const py = sign * DAUGHTER_Y + Math.sin(i * 1.3) * 0.25;
  return [px, py, pz];
}

// =====================================================================
// Interphase view — the normal resting state
// =====================================================================
function InterphaseView({ opacity, onSelect, selectedInfo }) {
  return (
    <group>
      <Selectable infoId="nuclear-envelope" onSelect={onSelect}>
        <mesh>
          <sphereGeometry args={[3.6, 48, 32]} />
          <meshStandardMaterial
            color="#7aa2ff"
            transparent
            opacity={opacity * 0.08}
            roughness={0.7}
            metalness={0.0}
            side={2}
            emissive="#7aa2ff"
            emissiveIntensity={sel(selectedInfo, 'nuclear-envelope', 0.04, 0.25)}
          />
        </mesh>
      </Selectable>
      <mesh>
        <sphereGeometry args={[3.6, 48, 32]} />
        <meshBasicMaterial color="#a5b4fc" transparent opacity={opacity * 0.18} wireframe />
      </mesh>

      <Selectable infoId="nucleus" onSelect={onSelect}>
        <mesh visible={false}>
          <sphereGeometry args={[3.55, 16, 12]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </Selectable>

      <group position={[-1.1, -1.0, 0.9]}>
        <Selectable infoId="nucleolus" onSelect={onSelect}>
          <mesh>
            <sphereGeometry args={[0.95, 32, 24]} />
            <meshStandardMaterial
              color="#fb7185"
              transparent
              opacity={opacity * 0.85}
              roughness={0.5}
              emissive="#e11d48"
              emissiveIntensity={sel(selectedInfo, 'nucleolus', 0.3, 0.8)}
            />
          </mesh>
        </Selectable>
        <Label position={[0, 1.2, 0]} color="#fda4af" distanceFactor={10}>Nucleolus</Label>
      </group>

      {CHROMOSOME_TERRITORIES.map((t) => {
        const infoId = t.id === 'chr11' ? 'chr11' : 'chromosome-territory';
        return (
          <group key={t.id} position={t.position}>
            <Selectable infoId={infoId} onSelect={onSelect}>
              <mesh>
                <icosahedronGeometry args={[t.radius, 1]} />
                <meshStandardMaterial
                  color={t.color}
                  transparent
                  opacity={opacity * (t.highlight ? 0.95 : 0.75)}
                  roughness={0.5}
                  metalness={0.15}
                  emissive={t.color}
                  emissiveIntensity={
                    t.highlight
                      ? sel(selectedInfo, 'chr11', 0.45, 0.9)
                      : sel(selectedInfo, 'chromosome-territory', 0.1, 0.6)
                  }
                />
              </mesh>
            </Selectable>
            {t.highlight && (
              <Label position={[0, t.radius + 0.35, 0]} color="#fde68a" distanceFactor={10}>chr11</Label>
            )}
          </group>
        );
      })}

      {LAD_POSITIONS.map((lad, i) => (
        <group key={i} position={lad.position}>
          <Selectable infoId="lad" onSelect={onSelect}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.35, 0.08, 12, 24]} />
              <meshStandardMaterial
                color="#86efac"
                transparent
                opacity={opacity}
                emissive="#22c55e"
                emissiveIntensity={sel(selectedInfo, 'lad', 0.5, 0.95)}
              />
            </mesh>
          </Selectable>
          {i === 0 && <Label position={[0, 0.45, 0]} color="#bbf7d0" distanceFactor={10}>LAD</Label>}
        </group>
      ))}
    </group>
  );
}

// =====================================================================
// Per-element shape primitives
// =====================================================================

function TerritoryBall({ color, radius, highlight, selectedInfo }) {
  return (
    <mesh>
      <icosahedronGeometry args={[radius, 1]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={highlight ? 0.95 : 0.75}
        roughness={0.5}
        metalness={0.15}
        emissive={color}
        emissiveIntensity={highlight ? 0.45 : 0.15}
      />
    </mesh>
  );
}

function XChromosome({ color, intensity = 0.2 }) {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <cylinderGeometry args={[0.1, 0.1, 1.4, 12]} />
        <meshStandardMaterial color={color} roughness={0.4} emissive={color} emissiveIntensity={intensity} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]}>
        <cylinderGeometry args={[0.1, 0.1, 1.4, 12]} />
        <meshStandardMaterial color={color} roughness={0.4} emissive={color} emissiveIntensity={intensity} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial color="#374151" emissive="#9ca3af" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function Chromatid({ color, intensity = 0.2, angle = 0 }) {
  return (
    <mesh rotation={[0, 0, angle]}>
      <cylinderGeometry args={[0.1, 0.1, 1.3, 12]} />
      <meshStandardMaterial color={color} roughness={0.4} emissive={color} emissiveIntensity={intensity} />
    </mesh>
  );
}

// =====================================================================
// MetaphaseView — used for 'instant' and cross-fade mode
// =====================================================================
function MetaphaseView({ opacity, onSelect, selectedInfo }) {
  const n = CHROMOSOME_TERRITORIES.length;
  const POLE_Y = 3;
  return (
    <group>
      {[POLE_Y, -POLE_Y].map((y) => (
        <Selectable key={y} infoId="spindle" onSelect={onSelect}>
          <mesh position={[0, y, 0]}>
            <sphereGeometry args={[0.14, 14, 14]} />
            <meshStandardMaterial
              color="#c7d2fe"
              transparent
              opacity={opacity}
              emissive="#818cf8"
              emissiveIntensity={sel(selectedInfo, 'spindle', 0.5, 0.9)}
            />
          </mesh>
        </Selectable>
      ))}

      {CHROMOSOME_TERRITORIES.map((t, i) => {
        const x = metaphaseX(i, n);
        return (
          <group key={t.id}>
            <Line points={[[0, POLE_Y, 0], [x, 0, 0]]} color="#c7d2fe" lineWidth={1} transparent opacity={opacity * 0.5} />
            <Line points={[[0, -POLE_Y, 0], [x, 0, 0]]} color="#c7d2fe" lineWidth={1} transparent opacity={opacity * 0.5} />
            <group position={[x, 0, 0]}>
              <Selectable infoId={t.highlight ? 'chr11' : 'mitotic-chromosome'} onSelect={onSelect}>
                <group>
                  <mesh rotation={[0, 0, Math.PI / 4]}>
                    <cylinderGeometry args={[0.1, 0.1, 1.4, 12]} />
                    <meshStandardMaterial
                      color={t.color}
                      transparent
                      opacity={opacity}
                      roughness={0.4}
                      emissive={t.color}
                      emissiveIntensity={t.highlight
                        ? sel(selectedInfo, 'chr11', 0.5, 0.95)
                        : sel(selectedInfo, 'mitotic-chromosome', 0.2, 0.8)}
                    />
                  </mesh>
                  <mesh rotation={[0, 0, -Math.PI / 4]}>
                    <cylinderGeometry args={[0.1, 0.1, 1.4, 12]} />
                    <meshStandardMaterial
                      color={t.color}
                      transparent
                      opacity={opacity}
                      roughness={0.4}
                      emissive={t.color}
                      emissiveIntensity={t.highlight
                        ? sel(selectedInfo, 'chr11', 0.5, 0.95)
                        : sel(selectedInfo, 'mitotic-chromosome', 0.2, 0.8)}
                    />
                  </mesh>
                </group>
              </Selectable>
              <Selectable infoId="centromere" onSelect={onSelect}>
                <mesh>
                  <sphereGeometry args={[0.13, 16, 16]} />
                  <meshStandardMaterial
                    color="#374151"
                    transparent
                    opacity={opacity}
                    emissive="#9ca3af"
                    emissiveIntensity={sel(selectedInfo, 'centromere', 0.25, 0.8)}
                  />
                </mesh>
              </Selectable>
              {t.highlight && (
                <Label position={[0, 1.1, 0]} color="#fde68a" distanceFactor={10}>chr11</Label>
              )}
            </group>
          </group>
        );
      })}
    </group>
  );
}

// =====================================================================
// AnaphaseView — sister chromatids heading to opposite poles
// =====================================================================
function AnaphaseView({ opacity, onSelect, selectedInfo }) {
  const n = CHROMOSOME_TERRITORIES.length;
  const POLE_Y = 3;
  const CHROMATID_Y = 1.3;

  return (
    <group>
      {[POLE_Y, -POLE_Y].map((y) => (
        <Selectable key={y} infoId="spindle" onSelect={onSelect}>
          <mesh position={[0, y, 0]}>
            <sphereGeometry args={[0.14, 14, 14]} />
            <meshStandardMaterial
              color="#c7d2fe"
              transparent
              opacity={opacity}
              emissive="#818cf8"
              emissiveIntensity={sel(selectedInfo, 'spindle', 0.5, 0.9)}
            />
          </mesh>
        </Selectable>
      ))}

      {CHROMOSOME_TERRITORIES.map((t, i) => {
        const x = metaphaseX(i, n);
        const highlightId = t.highlight ? 'chr11' : 'chromatid';
        const intensity = t.highlight
          ? sel(selectedInfo, 'chr11', 0.5, 0.95)
          : sel(selectedInfo, 'chromatid', 0.2, 0.85);
        return (
          <group key={t.id}>
            <Selectable infoId={highlightId} onSelect={onSelect}>
              <mesh position={[x, CHROMATID_Y, 0]} rotation={[0, 0, Math.PI / 6]}>
                <cylinderGeometry args={[0.1, 0.1, 1.3, 12]} />
                <meshStandardMaterial color={t.color} transparent opacity={opacity} emissive={t.color} emissiveIntensity={intensity} />
              </mesh>
            </Selectable>
            <Selectable infoId={highlightId} onSelect={onSelect}>
              <mesh position={[x, -CHROMATID_Y, 0]} rotation={[0, 0, -Math.PI / 6]}>
                <cylinderGeometry args={[0.1, 0.1, 1.3, 12]} />
                <meshStandardMaterial color={t.color} transparent opacity={opacity} emissive={t.color} emissiveIntensity={intensity} />
              </mesh>
            </Selectable>
            <Line points={[[0, POLE_Y, 0], [x, CHROMATID_Y + 0.4, 0]]} color="#c7d2fe" lineWidth={1} transparent opacity={opacity * 0.45} />
            <Line points={[[0, -POLE_Y, 0], [x, -CHROMATID_Y - 0.4, 0]]} color="#c7d2fe" lineWidth={1} transparent opacity={opacity * 0.45} />
          </group>
        );
      })}
    </group>
  );
}

// =====================================================================
// TelophaseView — two daughter nuclei forming
// =====================================================================
function TelophaseView({ opacity, onSelect, selectedInfo }) {
  const DAUGHTER_Y = 2.2;

  function Daughter({ y, label }) {
    return (
      <group position={[0, y, 0]}>
        <Selectable infoId="nuclear-envelope" onSelect={onSelect}>
          <mesh>
            <sphereGeometry args={[1.5, 32, 24]} />
            <meshStandardMaterial
              color="#7aa2ff"
              transparent
              opacity={opacity * 0.12}
              side={2}
              emissive="#7aa2ff"
              emissiveIntensity={sel(selectedInfo, 'nuclear-envelope', 0.05, 0.25)}
            />
          </mesh>
        </Selectable>
        <mesh>
          <sphereGeometry args={[1.5, 32, 24]} />
          <meshBasicMaterial color="#a5b4fc" transparent opacity={opacity * 0.2} wireframe />
        </mesh>
        {CHROMOSOME_TERRITORIES.map((t, i) => {
          const pos = daughterPosition(i, CHROMOSOME_TERRITORIES.length, y > 0 ? 1 : -1);
          const localPos = [pos[0], pos[1] - y, pos[2]]; // relative to this daughter's y
          const infoId = t.highlight ? 'chr11' : 'chromosome-territory';
          return (
            <group key={t.id} position={localPos}>
              <Selectable infoId={infoId} onSelect={onSelect}>
                <mesh>
                  <icosahedronGeometry args={[t.radius * 0.35, 1]} />
                  <meshStandardMaterial
                    color={t.color}
                    transparent
                    opacity={opacity * (t.highlight ? 0.95 : 0.8)}
                    emissive={t.color}
                    emissiveIntensity={t.highlight ? 0.5 : 0.15}
                    roughness={0.4}
                  />
                </mesh>
              </Selectable>
            </group>
          );
        })}
        <Label position={[0, 1.8, 0]} color="#c4b5fd" distanceFactor={10}>{label}</Label>
      </group>
    );
  }

  return (
    <group>
      <Daughter y={DAUGHTER_Y} label="Daughter nucleus 1" />
      <Daughter y={-DAUGHTER_Y} label="Daughter nucleus 2" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 1.35, 64]} />
        <meshBasicMaterial color="#fca5a5" transparent opacity={opacity * 0.5} side={2} />
      </mesh>
      <Label position={[1.8, 0, 0]} color="#fca5a5" distanceFactor={10}>Cleavage furrow</Label>
    </group>
  );
}

// =====================================================================
// Mid mode — cross-fade between the four discrete stage views
// =====================================================================
function MidMitosisView({ opacity, progress, onSelect, selectedInfo }) {
  const t = clamp01(progress / 3) * 3; // keep in [0, 3]
  const w = (s) => Math.max(0, 1 - Math.abs(t - s));
  const wInt = w(0);
  const wMeta = w(1);
  const wAna = w(2);
  const wTelo = w(3);
  return (
    <group>
      {wInt > 0.01 && <InterphaseView opacity={opacity * wInt} onSelect={onSelect} selectedInfo={selectedInfo} />}
      {wMeta > 0.01 && <MetaphaseView opacity={opacity * wMeta} onSelect={onSelect} selectedInfo={selectedInfo} />}
      {wAna > 0.01 && <AnaphaseView opacity={opacity * wAna} onSelect={onSelect} selectedInfo={selectedInfo} />}
      {wTelo > 0.01 && <TelophaseView opacity={opacity * wTelo} onSelect={onSelect} selectedInfo={selectedInfo} />}
    </group>
  );
}

// =====================================================================
// Full mode — continuous interpolation of every element
// =====================================================================
function FullMitosisView({ opacity, progress, onSelect, selectedInfo }) {
  const t = clamp01(progress / 3) * 3;
  const n = CHROMOSOME_TERRITORIES.length;
  const POLE_Y = 3;

  // --- Global opacities / scales over t ---
  // Interphase envelope: dissolves across t ∈ [0.3, 0.9]
  const envInterphaseOp = (1 - sstep(0.3, 0.9, t)) * opacity;
  // Daughter envelopes: reform across t ∈ [2.3, 3.0]
  const envDaughterOp = sstep(2.3, 3.0, t) * opacity;
  // Nucleolus: fades at t ∈ [0.1, 0.6]
  const nucleolusOp = (1 - sstep(0.1, 0.6, t)) * opacity;
  // Territory shape (interphase blobs): present ∈ [0, 1]
  const territoryVis = 1 - sstep(0.3, 1.0, t);
  // X-chromosome (metaphase): present ∈ [0.7, 1.9]
  const xShapeVis = sstep(0.55, 1.0, t) * (1 - sstep(1.7, 2.0, t));
  // Chromatid rods (anaphase): present ∈ [1.8, 3.1]
  const chromatidVis = sstep(1.7, 2.0, t) * (1 - sstep(2.9, 3.2, t));
  // Daughter clusters: present ∈ [2.6, 3]
  const daughterClusterVis = sstep(2.6, 3.0, t);
  // Spindle pole visibility
  const spindleVis = sstep(0.8, 1.1, t) * (1 - sstep(2.9, 3.1, t));
  // Cleavage furrow
  const cleavageVis = sstep(2.5, 3.0, t);

  // --- Per-chromosome interpolated positions & separations ---
  const chromos = CHROMOSOME_TERRITORIES.map((chr, i) => {
    const interphasePos = chr.position;
    const metaX = metaphaseX(i, n);
    const metaPos = [metaX, 0, 0];
    // During t ∈ [0, 1]: territory → metaphase plate
    const toMeta = sstep(0.3, 1.0, t);
    const centralPos = [
      lerp(interphasePos[0], metaPos[0], toMeta),
      lerp(interphasePos[1], metaPos[1], toMeta),
      lerp(interphasePos[2], metaPos[2], toMeta),
    ];

    // During t ∈ [1.5, 2]: sisters separate vertically
    const splitAmount = sstep(1.5, 2.0, t); // 0 to 1
    // During t ∈ [2, 3]: sisters cluster into daughter nucleus positions
    const toDaughter = sstep(2.0, 3.0, t);
    const daughterTop = daughterPosition(i, n, +1);
    const daughterBot = daughterPosition(i, n, -1);

    // Sister positions: start at central pos (metaphase plate), split vertically,
    // then blend toward daughter positions.
    const metaTop = [centralPos[0], centralPos[1] + 0.65 * splitAmount, centralPos[2]];
    const metaBot = [centralPos[0], centralPos[1] - 0.65 * splitAmount, centralPos[2]];

    const topPos = [
      lerp(metaTop[0], daughterTop[0], toDaughter),
      lerp(metaTop[1], daughterTop[1], toDaughter),
      lerp(metaTop[2], daughterTop[2], toDaughter),
    ];
    const botPos = [
      lerp(metaBot[0], daughterBot[0], toDaughter),
      lerp(metaBot[1], daughterBot[1], toDaughter),
      lerp(metaBot[2], daughterBot[2], toDaughter),
    ];

    return { chr, centralPos, topPos, botPos };
  });

  return (
    <group>
      {/* Interphase nuclear envelope, dissolving */}
      {envInterphaseOp > 0.01 && (
        <>
          <Selectable infoId="nuclear-envelope" onSelect={onSelect}>
            <mesh>
              <sphereGeometry args={[3.6, 48, 32]} />
              <meshStandardMaterial
                color="#7aa2ff"
                transparent
                opacity={envInterphaseOp * 0.08}
                side={2}
                emissive="#7aa2ff"
                emissiveIntensity={sel(selectedInfo, 'nuclear-envelope', 0.04, 0.25)}
              />
            </mesh>
          </Selectable>
          <mesh>
            <sphereGeometry args={[3.6, 48, 32]} />
            <meshBasicMaterial color="#a5b4fc" transparent opacity={envInterphaseOp * 0.18} wireframe />
          </mesh>
          <Selectable infoId="nucleus" onSelect={onSelect}>
            <mesh visible={false}>
              <sphereGeometry args={[3.55, 16, 12]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
          </Selectable>
        </>
      )}

      {/* Nucleolus fades in prophase */}
      {nucleolusOp > 0.01 && (
        <group position={[-1.1, -1.0, 0.9]}>
          <Selectable infoId="nucleolus" onSelect={onSelect}>
            <mesh>
              <sphereGeometry args={[0.95, 32, 24]} />
              <meshStandardMaterial
                color="#fb7185"
                transparent
                opacity={nucleolusOp * 0.85}
                roughness={0.5}
                emissive="#e11d48"
                emissiveIntensity={sel(selectedInfo, 'nucleolus', 0.3, 0.8)}
              />
            </mesh>
          </Selectable>
        </group>
      )}

      {/* LADs visible during interphase */}
      {territoryVis > 0.01 && LAD_POSITIONS.map((lad, i) => (
        <group key={i} position={lad.position}>
          <Selectable infoId="lad" onSelect={onSelect}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.35, 0.08, 12, 24]} />
              <meshStandardMaterial
                color="#86efac"
                transparent
                opacity={opacity * territoryVis}
                emissive="#22c55e"
                emissiveIntensity={sel(selectedInfo, 'lad', 0.5, 0.95)}
              />
            </mesh>
          </Selectable>
        </group>
      ))}

      {/* Spindle poles */}
      {spindleVis > 0.01 && [POLE_Y, -POLE_Y].map((y) => (
        <Selectable key={y} infoId="spindle" onSelect={onSelect}>
          <mesh position={[0, y, 0]}>
            <sphereGeometry args={[0.14, 14, 14]} />
            <meshStandardMaterial
              color="#c7d2fe"
              transparent
              opacity={opacity * spindleVis}
              emissive="#818cf8"
              emissiveIntensity={sel(selectedInfo, 'spindle', 0.5, 0.9)}
            />
          </mesh>
        </Selectable>
      ))}

      {/* Cleavage furrow */}
      {cleavageVis > 0.01 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.2, 1.35, 64]} />
          <meshBasicMaterial color="#fca5a5" transparent opacity={opacity * cleavageVis * 0.55} side={2} />
        </mesh>
      )}

      {/* Daughter envelopes reforming at telophase */}
      {envDaughterOp > 0.01 && [2.2, -2.2].map((dy, di) => (
        <group key={di} position={[0, dy, 0]}>
          <Selectable infoId="nuclear-envelope" onSelect={onSelect}>
            <mesh>
              <sphereGeometry args={[1.5, 32, 24]} />
              <meshStandardMaterial
                color="#7aa2ff"
                transparent
                opacity={envDaughterOp * 0.12}
                side={2}
                emissive="#7aa2ff"
                emissiveIntensity={sel(selectedInfo, 'nuclear-envelope', 0.05, 0.25)}
              />
            </mesh>
          </Selectable>
          <mesh>
            <sphereGeometry args={[1.5, 32, 24]} />
            <meshBasicMaterial color="#a5b4fc" transparent opacity={envDaughterOp * 0.2} wireframe />
          </mesh>
        </group>
      ))}

      {/* Chromosomes — rendered in three overlapping shape variants,
          each scaled/faded based on progress */}
      {chromos.map(({ chr, centralPos, topPos, botPos }, i) => {
        const infoIdMain = chr.highlight ? 'chr11' : 'chromosome-territory';
        const infoIdCondensed = chr.highlight ? 'chr11' : 'mitotic-chromosome';
        const infoIdChromatid = chr.highlight ? 'chr11' : 'chromatid';
        const emissiveBoost = chr.highlight ? 0.5 : 0.2;
        return (
          <group key={chr.id}>
            {/* Territory shape — at interphase or metaphase-plate position depending on t */}
            {territoryVis > 0.01 && (
              <group position={centralPos}>
                <Selectable infoId={infoIdMain} onSelect={onSelect}>
                  <mesh>
                    <icosahedronGeometry args={[chr.radius * (0.4 + 0.6 * (1 - sstep(0.5, 1.0, t))), 1]} />
                    <meshStandardMaterial
                      color={chr.color}
                      transparent
                      opacity={opacity * territoryVis * (chr.highlight ? 0.95 : 0.75)}
                      roughness={0.5}
                      emissive={chr.color}
                      emissiveIntensity={emissiveBoost}
                    />
                  </mesh>
                </Selectable>
                {chr.highlight && territoryVis > 0.4 && (
                  <Label position={[0, chr.radius + 0.35, 0]} color="#fde68a" distanceFactor={10}>chr11</Label>
                )}
              </group>
            )}

            {/* X-chromosome shape — overlaid at metaphase-plate position */}
            {xShapeVis > 0.01 && (
              <group position={centralPos}>
                <Selectable infoId={infoIdCondensed} onSelect={onSelect}>
                  <group>
                    <mesh rotation={[0, 0, Math.PI / 4]}>
                      <cylinderGeometry args={[0.1, 0.1, 1.4 * xShapeVis, 12]} />
                      <meshStandardMaterial
                        color={chr.color}
                        transparent
                        opacity={opacity * xShapeVis}
                        emissive={chr.color}
                        emissiveIntensity={emissiveBoost}
                        roughness={0.4}
                      />
                    </mesh>
                    <mesh rotation={[0, 0, -Math.PI / 4]}>
                      <cylinderGeometry args={[0.1, 0.1, 1.4 * xShapeVis, 12]} />
                      <meshStandardMaterial
                        color={chr.color}
                        transparent
                        opacity={opacity * xShapeVis}
                        emissive={chr.color}
                        emissiveIntensity={emissiveBoost}
                        roughness={0.4}
                      />
                    </mesh>
                  </group>
                </Selectable>
                <Selectable infoId="centromere" onSelect={onSelect}>
                  <mesh>
                    <sphereGeometry args={[0.13 * xShapeVis, 14, 14]} />
                    <meshStandardMaterial
                      color="#374151"
                      transparent
                      opacity={opacity * xShapeVis}
                      emissive="#9ca3af"
                      emissiveIntensity={sel(selectedInfo, 'centromere', 0.25, 0.8)}
                    />
                  </mesh>
                </Selectable>
              </group>
            )}

            {/* Chromatid rods — separated, moving toward poles then into daughters */}
            {chromatidVis > 0.01 && (
              <>
                <group position={topPos}>
                  <Selectable infoId={infoIdChromatid} onSelect={onSelect}>
                    <mesh rotation={[0, 0, Math.PI / 6]}>
                      <cylinderGeometry args={[0.1, 0.1, 1.3 * chromatidVis, 12]} />
                      <meshStandardMaterial
                        color={chr.color}
                        transparent
                        opacity={opacity * chromatidVis}
                        emissive={chr.color}
                        emissiveIntensity={emissiveBoost}
                        roughness={0.4}
                      />
                    </mesh>
                  </Selectable>
                </group>
                <group position={botPos}>
                  <Selectable infoId={infoIdChromatid} onSelect={onSelect}>
                    <mesh rotation={[0, 0, -Math.PI / 6]}>
                      <cylinderGeometry args={[0.1, 0.1, 1.3 * chromatidVis, 12]} />
                      <meshStandardMaterial
                        color={chr.color}
                        transparent
                        opacity={opacity * chromatidVis}
                        emissive={chr.color}
                        emissiveIntensity={emissiveBoost}
                        roughness={0.4}
                      />
                    </mesh>
                  </Selectable>
                </group>
              </>
            )}

            {/* Daughter cluster blobs — small icosahedra reappearing at telophase */}
            {daughterClusterVis > 0.01 && (
              <>
                <group position={topPos}>
                  <Selectable infoId={infoIdMain} onSelect={onSelect}>
                    <mesh>
                      <icosahedronGeometry args={[chr.radius * 0.35 * daughterClusterVis, 1]} />
                      <meshStandardMaterial
                        color={chr.color}
                        transparent
                        opacity={opacity * daughterClusterVis * (chr.highlight ? 0.95 : 0.8)}
                        emissive={chr.color}
                        emissiveIntensity={emissiveBoost}
                        roughness={0.4}
                      />
                    </mesh>
                  </Selectable>
                </group>
                <group position={botPos}>
                  <Selectable infoId={infoIdMain} onSelect={onSelect}>
                    <mesh>
                      <icosahedronGeometry args={[chr.radius * 0.35 * daughterClusterVis, 1]} />
                      <meshStandardMaterial
                        color={chr.color}
                        transparent
                        opacity={opacity * daughterClusterVis * (chr.highlight ? 0.95 : 0.8)}
                        emissive={chr.color}
                        emissiveIntensity={emissiveBoost}
                        roughness={0.4}
                      />
                    </mesh>
                  </Selectable>
                </group>
              </>
            )}

            {/* Microtubule lines — full at metaphase, shorten during anaphase */}
            {spindleVis > 0.01 && (
              <>
                <Line
                  points={[
                    [0, POLE_Y, 0],
                    chromatidVis > 0.3 ? topPos : centralPos
                  ]}
                  color="#c7d2fe"
                  lineWidth={1}
                  transparent
                  opacity={opacity * spindleVis * 0.45}
                />
                <Line
                  points={[
                    [0, -POLE_Y, 0],
                    chromatidVis > 0.3 ? botPos : centralPos
                  ]}
                  color="#c7d2fe"
                  lineWidth={1}
                  transparent
                  opacity={opacity * spindleVis * 0.45}
                />
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

// =====================================================================
// Dispatch
// =====================================================================
export default function NucleusScene({
  opacity = 1,
  onSelect,
  selectedInfo,
  cellCycleStage,
  mitosisProgress = 0,
  mitosisDetail = 'instant'
}) {
  if (mitosisDetail === 'full') {
    return <FullMitosisView opacity={opacity} progress={mitosisProgress} onSelect={onSelect} selectedInfo={selectedInfo} />;
  }
  if (mitosisDetail === 'mid') {
    return <MidMitosisView opacity={opacity} progress={mitosisProgress} onSelect={onSelect} selectedInfo={selectedInfo} />;
  }
  // 'instant' — hard jumps between discrete stages
  const stageId = cellCycleStage?.id || 'interphase';
  if (stageId === 'metaphase') return <MetaphaseView opacity={opacity} onSelect={onSelect} selectedInfo={selectedInfo} />;
  if (stageId === 'anaphase') return <AnaphaseView opacity={opacity} onSelect={onSelect} selectedInfo={selectedInfo} />;
  if (stageId === 'telophase') return <TelophaseView opacity={opacity} onSelect={onSelect} selectedInfo={selectedInfo} />;
  return <InterphaseView opacity={opacity} onSelect={onSelect} selectedInfo={selectedInfo} />;
}
