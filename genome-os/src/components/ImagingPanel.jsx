import React from 'react';
import { IMAGING } from '../data/locus';

// Stylized SVG illustrations evoking each imaging technique.
// These are NOT the actual published images — they are schematic
// reproductions so the panel can show "what scientists see" without
// copyright or broken-link risk. The citation field points to the
// real source paper.

const IMAGE_SIZE = { w: 200, h: 110 };

function Frame({ children }) {
  return (
    <svg
      viewBox={`0 0 ${IMAGE_SIZE.w} ${IMAGE_SIZE.h}`}
      style={{ width: '100%', height: 110, display: 'block', borderRadius: 5, background: '#06080f' }}
    >
      {children}
    </svg>
  );
}

// FISH / confocal: colored territories inside a nucleus
function FISHImage() {
  return (
    <Frame>
      <defs>
        <radialGradient id="nuc-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0a0e1a" />
        </radialGradient>
      </defs>
      <rect width="200" height="110" fill="#000" />
      <circle cx="100" cy="55" r="46" fill="url(#nuc-bg)" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      {/* territory blobs */}
      <ellipse cx="82" cy="40" rx="11" ry="8" fill="#ffd93d" opacity="0.88" />
      <ellipse cx="108" cy="36" rx="9" ry="7" fill="#f472b6" opacity="0.82" />
      <ellipse cx="120" cy="60" rx="12" ry="8" fill="#7aa2ff" opacity="0.82" />
      <ellipse cx="85" cy="70" rx="9" ry="7" fill="#a78bfa" opacity="0.82" />
      <ellipse cx="100" cy="78" rx="8" ry="6" fill="#4ecdc4" opacity="0.82" />
      <ellipse cx="73" cy="58" rx="7" ry="6" fill="#fb923c" opacity="0.78" />
      <ellipse cx="115" cy="80" rx="6" ry="5" fill="#60a5fa" opacity="0.72" />
      {/* glow */}
      <circle cx="100" cy="55" r="48" fill="none" stroke="rgba(122,162,255,0.08)" strokeWidth="6" />
    </Frame>
  );
}

// Hi-C heatmap — diagonal with compartment checkerboard
function HiCImage() {
  const rows = 16;
  const cells = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < rows; j++) {
      const d = Math.abs(i - j);
      const diagBoost = Math.max(0, 1 - d / 4);
      const checker = ((i >> 1) + (j >> 1)) % 2 === 0 ? 0.25 : 0.05;
      const v = Math.min(1, diagBoost + checker * (1 - Math.abs(i - j) / 12));
      cells.push({ i, j, v });
    }
  }
  const size = 80;
  const cs = size / rows;
  return (
    <Frame>
      <rect width="200" height="110" fill="#0a0e1a" />
      <g transform="translate(60 15)">
        {cells.map((c, k) => (
          <rect
            key={k}
            x={c.j * cs}
            y={c.i * cs}
            width={cs}
            height={cs}
            fill={`rgba(255, ${Math.floor(180 - c.v * 120)}, 60, ${c.v * 0.95 + 0.05})`}
          />
        ))}
        <rect x="0" y="0" width={size} height={size} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
      </g>
      {/* axis labels */}
      <text x="100" y="110" textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="system-ui">chr11 position</text>
    </Frame>
  );
}

// Hi-C TAD — contact map with a clear triangle
function HiCTADImage() {
  const rows = 14;
  const cells = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < rows; j++) {
      const d = Math.abs(i - j);
      const diag = Math.max(0, 1 - d / 3);
      // strong triangle in middle
      const inTAD = i >= 5 && i <= 10 && j >= 5 && j <= 10;
      const tadBoost = inTAD ? 0.55 : 0;
      const v = Math.min(1, diag + tadBoost);
      cells.push({ i, j, v });
    }
  }
  const size = 80;
  const cs = size / rows;
  return (
    <Frame>
      <rect width="200" height="110" fill="#0a0e1a" />
      <g transform="translate(60 15)">
        {cells.map((c, k) => (
          <rect
            key={k}
            x={c.j * cs}
            y={c.i * cs}
            width={cs}
            height={cs}
            fill={`rgba(255, ${Math.floor(180 - c.v * 120)}, 60, ${c.v * 0.9 + 0.05})`}
          />
        ))}
        {/* TAD triangle outline */}
        <polygon
          points={`${5 * cs},${5 * cs} ${11 * cs},${5 * cs} ${11 * cs},${11 * cs}`}
          fill="none"
          stroke="#ffd93d"
          strokeWidth="1.5"
        />
        <rect x="0" y="0" width={size} height={size} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
      </g>
    </Frame>
  );
}

// Hi-C loop peak — an off-diagonal dot
function HiCLoopImage() {
  const rows = 14;
  const cells = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < rows; j++) {
      const d = Math.abs(i - j);
      const diag = Math.max(0, 1 - d / 4);
      const peak = (i === 3 && j === 11) || (i === 11 && j === 3) ? 1 : 0;
      cells.push({ i, j, v: Math.min(1, diag + peak) });
    }
  }
  const size = 80;
  const cs = size / rows;
  return (
    <Frame>
      <rect width="200" height="110" fill="#0a0e1a" />
      <g transform="translate(60 15)">
        {cells.map((c, k) => (
          <rect
            key={k}
            x={c.j * cs}
            y={c.i * cs}
            width={cs}
            height={cs}
            fill={`rgba(255, ${Math.floor(180 - c.v * 120)}, 60, ${c.v * 0.9 + 0.05})`}
          />
        ))}
        {/* loop peak highlight */}
        <circle cx={11.5 * cs} cy={3.5 * cs} r={3.5} fill="none" stroke="#ffd93d" strokeWidth="1.2" />
        <circle cx={3.5 * cs} cy={11.5 * cs} r={3.5} fill="none" stroke="#ffd93d" strokeWidth="1.2" />
      </g>
      <text x="156" y="26" textAnchor="start" fontSize="8" fill="#fde68a" fontFamily="system-ui">loop peak</text>
    </Frame>
  );
}

// 30-nm fiber — EM negative-stain style grayscale coil
function FiberEMImage() {
  const turns = 5;
  const coils = [];
  for (let i = 0; i < turns; i++) {
    const y = 18 + i * 16;
    coils.push(
      <ellipse key={i} cx="100" cy={y} rx="35" ry="7" fill="none" stroke="#e5e7eb" strokeWidth="2" opacity={0.9} />
    );
    coils.push(
      <ellipse key={'b' + i} cx="100" cy={y + 4} rx="35" ry="4" fill="none" stroke="#9ca3af" strokeWidth="1" opacity={0.5} />
    );
  }
  return (
    <Frame>
      <rect width="200" height="110" fill="#1f2937" />
      {/* grainy EM noise effect via many tiny dots */}
      {Array.from({ length: 100 }, (_, k) => (
        <circle
          key={k}
          cx={Math.random() * 200}
          cy={Math.random() * 110}
          r={0.4 + Math.random() * 0.6}
          fill="rgba(255,255,255,0.07)"
        />
      ))}
      {coils}
    </Frame>
  );
}

// Nucleosomes — EM beads on a string, grayscale
function NucleosomeEMImage() {
  const beads = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const x = 20 + i * 22;
    const y = 55 + Math.sin(i * 0.9) * 8;
    beads.push(
      <circle key={i} cx={x} cy={y} r={8} fill="#374151" stroke="#111827" strokeWidth="1" />
    );
    beads.push(
      <circle key={'hl' + i} cx={x - 2} cy={y - 2} r={3} fill="rgba(255,255,255,0.12)" />
    );
  }
  // connecting linker DNA
  const path = [];
  for (let i = 0; i < n; i++) {
    const x = 20 + i * 22;
    const y = 55 + Math.sin(i * 0.9) * 8;
    path.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }
  return (
    <Frame>
      <rect width="200" height="110" fill="#1f2937" />
      {/* EM grain */}
      {Array.from({ length: 80 }, (_, k) => (
        <circle
          key={k}
          cx={Math.random() * 200}
          cy={Math.random() * 110}
          r={0.4 + Math.random() * 0.6}
          fill="rgba(255,255,255,0.06)"
        />
      ))}
      <path d={path.join(' ')} stroke="#4b5563" strokeWidth="1.4" fill="none" />
      {beads}
    </Frame>
  );
}

// X-ray diffraction — Photo 51 style X pattern
function Photo51Image() {
  const dots = [];
  const cx = 100, cy = 55;
  // Central missing region
  const angles = [45, 135, 225, 315];
  angles.forEach(aDeg => {
    for (let r = 15; r <= 45; r += 7) {
      const a = (aDeg * Math.PI) / 180;
      dots.push(
        <ellipse
          key={`${aDeg}-${r}`}
          cx={cx + Math.cos(a) * r}
          cy={cy + Math.sin(a) * r}
          rx={2.5 - r / 25}
          ry={1.5 - r / 40}
          fill="rgba(255,255,255,0.85)"
          transform={`rotate(${aDeg} ${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r})`}
        />
      );
    }
  });
  return (
    <Frame>
      <rect width="200" height="110" fill="#000" />
      <circle cx={cx} cy={cy} r="8" fill="#222" />
      {dots}
      <circle cx={cx} cy={cy} r="48" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
    </Frame>
  );
}

// Atomic — ball-and-stick in CPK colors
function AtomicImage() {
  const atoms = [
    { x: 55, y: 55, r: 8, c: '#6b9eff' },   // N
    { x: 75, y: 45, r: 7, c: '#d1d5db' },   // C
    { x: 95, y: 52, r: 7, c: '#d1d5db' },   // C
    { x: 100, y: 72, r: 8, c: '#ff6b6b' },  // O
    { x: 125, y: 45, r: 7, c: '#d1d5db' },  // C
    { x: 145, y: 55, r: 8, c: '#6b9eff' },  // N
    { x: 140, y: 75, r: 5, c: '#ffffff' },  // H
  ];
  const bonds = [
    [0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [5, 6]
  ];
  return (
    <Frame>
      <rect width="200" height="110" fill="#0a0e1a" />
      {bonds.map(([a, b], k) => {
        const A = atoms[a], B = atoms[b];
        return (
          <line
            key={k}
            x1={A.x} y1={A.y} x2={B.x} y2={B.y}
            stroke="#9ca3af" strokeWidth="2.5"
          />
        );
      })}
      {atoms.map((a, k) => (
        <g key={k}>
          <circle cx={a.x} cy={a.y} r={a.r} fill={a.c} />
          <circle cx={a.x - a.r * 0.3} cy={a.y - a.r * 0.3} r={a.r * 0.35} fill="rgba(255,255,255,0.25)" />
        </g>
      ))}
    </Frame>
  );
}

const IMAGES = {
  nucleus: FISHImage,
  compartment: HiCImage,
  tad: HiCTADImage,
  loop: HiCLoopImage,
  fiber: FiberEMImage,
  nucleosomes: NucleosomeEMImage,
  helix: Photo51Image,
  atomic: AtomicImage,
};

const MATCH_STYLES = {
  strong: {
    label: 'Direct',
    color: '#86efac',
    border: 'rgba(134, 239, 172, 0.45)',
    bg: 'rgba(34, 197, 94, 0.10)'
  },
  moderate: {
    label: 'Mixed',
    color: '#fde68a',
    border: 'rgba(253, 224, 71, 0.45)',
    bg: 'rgba(234, 179, 8, 0.10)'
  },
  weak: {
    label: 'Inferred',
    color: '#c7d2fe',
    border: 'rgba(165, 180, 252, 0.45)',
    bg: 'rgba(99, 102, 241, 0.10)'
  },
  disputed: {
    label: 'Disputed',
    color: '#fca5a5',
    border: 'rgba(248, 113, 113, 0.55)',
    bg: 'rgba(239, 68, 68, 0.10)'
  },
};

export default function ImagingPanel({ scaleId }) {
  const data = IMAGING[scaleId];
  if (!data) return null;
  const Image = IMAGES[scaleId];
  const style = MATCH_STYLES[data.match] || MATCH_STYLES.moderate;

  return (
    <div style={{
      marginBottom: 20,
      padding: '10px 12px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7, gap: 6 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', whiteSpace: 'nowrap' }}>
          Real imaging
        </div>
        <span style={{
          padding: '1px 7px',
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: style.color,
          background: style.bg,
          border: `1px solid ${style.border}`,
          borderRadius: 3,
          fontWeight: 600,
          whiteSpace: 'nowrap'
        }}>
          {style.label}
        </span>
      </div>

      {Image && <Image />}

      <div style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', marginTop: 5 }}>
        Schematic — not the real image
      </div>

      <div style={{ fontSize: 12, color: '#d1d5db', marginTop: 8, lineHeight: 1.5 }}>
        <div style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600, marginBottom: 3 }}>
          {data.technique}
        </div>
        {data.caption}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        fontSize: 10,
        color: '#6b7280',
        marginTop: 8,
        paddingTop: 7,
        borderTop: '1px solid rgba(255,255,255,0.05)'
      }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={data.reference}>
          {data.reference}
        </span>
        {data.sourceUrl && (
          <a
            href={data.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              color: '#93c5fd',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              fontWeight: 500,
              flexShrink: 0
            }}
            title={data.sourceLabel}
          >
            View real
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
