// Small SVG glyphs used as app-card icons. Keeping these as functions that
// return markup strings so the shell stays dependency-free (no React here).

const wrap = (inner) =>
  `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

export const GLYPHS = {
  // ChromatinLens — nucleus + chromosome territories
  nucleus: (accent, accent2) =>
    wrap(`
      <defs>
        <radialGradient id="nucBg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#nucBg)"/>
      <circle cx="32" cy="32" r="26" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="1.3"/>
      <circle cx="22" cy="24" r="5" fill="${accent2}"/>
      <circle cx="40" cy="21" r="4" fill="${accent}"/>
      <circle cx="44" cy="38" r="5" fill="#a78bfa"/>
      <circle cx="22" cy="42" r="4" fill="#4ecdc4"/>
      <circle cx="32" cy="35" r="3" fill="#fb7185" opacity="0.85"/>
    `),

  // Molecule viewer — double-helix loop
  helix: (accent, accent2) =>
    wrap(`
      <path d="M 18 10 Q 32 22 46 10 Q 32 28 18 22 Q 32 40 46 28 Q 32 46 18 40 Q 32 58 46 46"
            fill="none" stroke="${accent}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M 46 10 Q 32 28 18 22 Q 32 40 46 28 Q 32 46 18 40 Q 32 58 46 46 Q 32 64 18 54"
            fill="none" stroke="${accent2}" stroke-width="2.2" stroke-linecap="round"/>
    `),

  // SDK — stacked bricks / package shape
  sdk: (accent, accent2) =>
    wrap(`
      <rect x="10" y="38" width="22" height="16" rx="3" fill="${accent}" opacity="0.5"/>
      <rect x="32" y="38" width="22" height="16" rx="3" fill="${accent2}" opacity="0.55"/>
      <rect x="10" y="22" width="22" height="16" rx="3" fill="${accent2}" opacity="0.7"/>
      <rect x="32" y="22" width="22" height="16" rx="3" fill="${accent}" opacity="0.75"/>
      <rect x="21" y="6"  width="22" height="16" rx="3" fill="${accent}" opacity="1"/>
      <path d="M32 14 l5 4 -5 4 -5 -4 z" fill="${accent2}" opacity="0.85"/>
    `)
};

export function glyphFor(id, accent, accent2) {
  const fn = GLYPHS[id];
  return fn ? fn(accent, accent2) : '';
}
