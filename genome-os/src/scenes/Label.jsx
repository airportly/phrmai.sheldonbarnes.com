import React from 'react';
import { Html } from '@react-three/drei';

// 3D-anchored text label. Pointer-events are disabled so it doesn't
// intercept clicks meant for the underlying mesh.
export default function Label({ position, children, color = '#e5e7eb', distanceFactor = 8 }) {
  return (
    <Html
      position={position}
      center
      distanceFactor={distanceFactor}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div style={{
        padding: '3px 8px',
        background: 'rgba(12, 18, 32, 0.78)',
        color,
        borderRadius: 4,
        border: '1px solid rgba(255,255,255,0.12)',
        fontSize: 11,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        whiteSpace: 'nowrap',
        letterSpacing: 0.3
      }}>
        {children}
      </div>
    </Html>
  );
}
