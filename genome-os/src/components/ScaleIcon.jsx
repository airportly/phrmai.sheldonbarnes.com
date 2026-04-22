import React from 'react';

// Small SVG rendition of what each level looks like, for the sidebar and lock UI.
export default function ScaleIcon({ id, size = 28, dim = false }) {
  const alpha = dim ? 0.45 : 1;
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 28 28',
    fill: 'none',
    style: { opacity: alpha, flexShrink: 0 }
  };

  switch (id) {
    case 'nucleus':
      return (
        <svg {...common}>
          <circle cx="14" cy="14" r="12" stroke="#a5b4fc" strokeWidth="1.2" opacity="0.6" />
          <circle cx="9" cy="10" r="2.2" fill="#ffd93d" />
          <circle cx="17" cy="8"  r="2"   fill="#7aa2ff" />
          <circle cx="19" cy="17" r="2"   fill="#a78bfa" />
          <circle cx="9"  cy="19" r="1.8" fill="#4ecdc4" />
          <circle cx="14" cy="14" r="1.3" fill="#fb7185" opacity="0.9" />
        </svg>
      );
    case 'compartment':
      return (
        <svg {...common}>
          <rect x="2"  y="11" width="4" height="6" fill="#ffd93d" />
          <rect x="6"  y="11" width="4" height="6" fill="#6366f1" />
          <rect x="10" y="11" width="4" height="6" fill="#ffd93d" />
          <rect x="14" y="11" width="4" height="6" fill="#6366f1" />
          <rect x="18" y="11" width="4" height="6" fill="#ffd93d" />
          <rect x="22" y="11" width="4" height="6" fill="#6366f1" />
        </svg>
      );
    case 'tad':
      return (
        <svg {...common}>
          <rect x="2"  y="7" width="11" height="14" rx="3" fill="rgba(122,162,255,0.08)" stroke="#7aa2ff" strokeWidth="1.2" opacity="0.6" />
          <rect x="15" y="7" width="11" height="14" rx="3" fill="rgba(255,217,61,0.18)" stroke="#ffd93d" strokeWidth="1.5" />
          <path d="M 17 18 Q 20 11 24 18" stroke="#ffd93d" strokeWidth="1.2" fill="none" />
          <path d="M 4 18 Q 7 12 12 18" stroke="#7aa2ff" strokeWidth="1" fill="none" opacity="0.7" />
        </svg>
      );
    case 'loop':
      return (
        <svg {...common}>
          <path d="M 5 23 L 5 14 Q 5 5 14 5 Q 23 5 23 14 L 23 23" stroke="#7aa2ff" strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="5"  cy="23" r="2.4" fill="#ff6b6b" />
          <circle cx="23" cy="23" r="2.4" fill="#ff6b6b" />
          <circle cx="14" cy="23" r="1.8" fill="#c084fc" />
          <circle cx="18" cy="7"  r="1.5" fill="#ffd93d" />
        </svg>
      );
    case 'fiber':
      return (
        <svg {...common}>
          <path d="M 4 7  Q 14 3 24 7  Q 14 11 4 7"  stroke="#e879a6" strokeWidth="1.4" fill="none" />
          <path d="M 4 14 Q 14 10 24 14 Q 14 18 4 14" stroke="#e879a6" strokeWidth="1.4" fill="none" />
          <path d="M 4 21 Q 14 17 24 21 Q 14 25 4 21" stroke="#e879a6" strokeWidth="1.4" fill="none" />
          <text x="20" y="6" fontSize="5" fill="#fca5a5" fontWeight="700">?</text>
        </svg>
      );
    case 'nucleosomes':
      return (
        <svg {...common}>
          <line x1="1" y1="14" x2="27" y2="14" stroke="#6b9eff" strokeWidth="1.5" />
          <circle cx="6"  cy="14" r="3.5" fill="#e879a6" />
          <circle cx="14" cy="14" r="3.5" fill="#e879a6" />
          <circle cx="22" cy="14" r="3.5" fill="#e879a6" />
        </svg>
      );
    case 'helix':
      return (
        <svg {...common}>
          <path d="M 4 4  Q 14 9 24 4  Q 14 14 4 9 Q 14 19 24 14 Q 14 24 4 19" stroke="#6b9eff" strokeWidth="1.5" fill="none" />
          <path d="M 24 4 Q 14 14 4 9 Q 14 19 24 14 Q 14 24 4 19 Q 14 29 24 24" stroke="#fde68a" strokeWidth="1.5" fill="none" />
        </svg>
      );
    case 'atomic':
      return (
        <svg {...common}>
          <circle cx="6"  cy="10" r="2" fill="#6b9eff" />
          <circle cx="10" cy="14" r="2" fill="#d1d5db" />
          <circle cx="6"  cy="18" r="2" fill="#ff6b6b" />
          <circle cx="22" cy="10" r="2" fill="#6b9eff" />
          <circle cx="18" cy="14" r="2" fill="#d1d5db" />
          <circle cx="22" cy="18" r="2" fill="#ff6b6b" />
          <line x1="12" y1="14" x2="16" y2="14" stroke="#ffffff" strokeWidth="0.8" strokeDasharray="1.2,1" />
        </svg>
      );
    default:
      return null;
  }
}

// Lock glyphs (unicode-free, inline SVG)
export function LockIcon({ locked, size = 13 }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };
  return locked ? (
    <svg {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  ) : (
    <svg {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.5-2" />
    </svg>
  );
}
