import React from 'react';

// Wraps a 3D element with:
//   - hover cursor change
//   - click that opens an info card (via onSelect)
//   - stops propagation so the App-level click-to-dive doesn't also fire
export default function Selectable({ infoId, onSelect, children }) {
  return (
    <group
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.nativeEvent && typeof e.nativeEvent.stopPropagation === 'function') {
          e.nativeEvent.stopPropagation();
        }
        onSelect?.(infoId, e);
      }}
    >
      {children}
    </group>
  );
}
