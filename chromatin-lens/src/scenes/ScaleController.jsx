import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { SCALES } from '../data/locus';
import NucleusScene from './NucleusScene';
import CompartmentScene from './CompartmentScene';
import TADScene from './TADScene';
import LoopScene from './LoopScene';
import FiberScene from './FiberScene';
import NucleosomeScene from './NucleosomeScene';
import HelixScene from './HelixScene';
import AtomicScene from './AtomicScene';

const SCENE_COMPONENTS = {
  nucleus: NucleusScene,
  compartment: CompartmentScene,
  tad: TADScene,
  loop: LoopScene,
  fiber: FiberScene,
  nucleosomes: NucleosomeScene,
  helix: HelixScene,
  atomic: AtomicScene,
};

function computeOpacity(zoom, scale) {
  const { zoomMin, zoomMax } = scale;
  const fadeWidth = 0.02;
  if (zoom < zoomMin - fadeWidth) return 0;
  if (zoom > zoomMax + fadeWidth) return 0;
  if (zoom < zoomMin) return (zoom - (zoomMin - fadeWidth)) / fadeWidth;
  if (zoom > zoomMax) return 1 - (zoom - zoomMax) / fadeWidth;
  return 1;
}

function computeGrow(zoom, scale) {
  const fadeWidth = 0.02;
  const { zoomMin, zoomMax, maxGrow } = scale;
  if (zoom < zoomMin) {
    const t = Math.max(0, (zoom - (zoomMin - fadeWidth)) / fadeWidth);
    return 0.05 + 0.95 * t;
  }
  if (zoom > zoomMax) return maxGrow;
  const localT = (zoom - zoomMin) / (zoomMax - zoomMin);
  return Math.pow(maxGrow, localT);
}

export function getActiveScale(zoom) {
  for (const scale of SCALES) {
    if (zoom >= scale.zoomMin && zoom <= scale.zoomMax) return scale;
  }
  return SCALES[SCALES.length - 1];
}

// One scene at one scale. Holds a groupRef and smoothly lerps its position
// each frame so a user-selected focus point lands at world origin.
function ScaledScene({ scale, grow, opacity, onSelect, selectedInfo, focus, stage, cellCycleStage, mitosisProgress, mitosisDetail, extrusionProgress, transcribing, histoneMark, replicationProgress, altForm }) {
  const groupRef = useRef();
  const SceneComp = SCENE_COMPONENTS[scale.id];

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    let tx = 0, ty = 0, tz = 0;
    if (focus && focus.scaleId === scale.id && focus.localPoint) {
      tx = -focus.localPoint[0] * grow;
      ty = -focus.localPoint[1] * grow;
      tz = -focus.localPoint[2] * grow;
    }
    const k = 0.12; // lerp speed; higher = snappier
    g.position.x += (tx - g.position.x) * k;
    g.position.y += (ty - g.position.y) * k;
    g.position.z += (tz - g.position.z) * k;
  });

  // Wrap onSelect to convert the world-space click point into this scene's
  // local coords (invariant under zoom). Pass the focus object up to App.
  const handleSelect = (id, e) => {
    const p = e && e.point;
    if (p && grow > 0) {
      onSelect(id, {
        scaleId: scale.id,
        localPoint: [p.x / grow, p.y / grow, p.z / grow]
      });
    } else {
      onSelect(id, null);
    }
  };

  return (
    <group ref={groupRef} scale={grow}>
      <SceneComp
        opacity={opacity}
        onSelect={handleSelect}
        selectedInfo={selectedInfo}
        stage={stage}
        cellCycleStage={cellCycleStage}
        mitosisProgress={mitosisProgress}
        mitosisDetail={mitosisDetail}
        extrusionProgress={extrusionProgress}
        transcribing={transcribing}
        histoneMark={histoneMark}
        replicationProgress={replicationProgress}
        altForm={altForm}
      />
    </group>
  );
}

export default function ScaleController({ zoom, onSelect, selectedInfo, focus, stage, cellCycleStage, mitosisProgress, mitosisDetail, extrusionProgress, transcribing, histoneMark, replicationProgress, altForm }) {
  return (
    <>
      {SCALES.map((scale) => {
        const opacity = computeOpacity(zoom, scale);
        if (opacity < 0.01) return null;
        const grow = computeGrow(zoom, scale);
        return (
          <ScaledScene
            key={scale.id}
            scale={scale}
            grow={grow}
            opacity={opacity}
            onSelect={onSelect}
            selectedInfo={selectedInfo}
            focus={focus}
            stage={stage}
            cellCycleStage={cellCycleStage}
            mitosisProgress={mitosisProgress}
            mitosisDetail={mitosisDetail}
            extrusionProgress={extrusionProgress}
            transcribing={transcribing}
            histoneMark={histoneMark}
            replicationProgress={replicationProgress}
            altForm={altForm}
          />
        );
      })}
    </>
  );
}
