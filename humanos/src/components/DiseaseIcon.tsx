import React from 'react';

/**
 * DiseaseIcon - Small inline SVG glyphs, one per cardiometabolic-v1.0 disease.
 *
 * The actual path content lives in `DISEASE_ICON_PATHS` so it can be reused
 * both as a React component (for JSX) and as a raw SVG string via
 * `diseaseIconSvgString` (for CSS2DRenderer labels in the 3D galaxy, where
 * we manipulate vanilla DOM elements outside React's tree).
 *
 * All icons use a 24x24 viewBox, render with currentColor for stroke, and
 * are intentionally abstract — they need to read at 12-16px.
 */

interface Props {
  diseaseKey: string;
  size?: number;
  className?: string;
}

export const DISEASE_ICON_PATHS: Record<string, string> = {
  // Glucose hexagon with central dot — the "sugar" archetype.
  diabetes_mellitus:
    `<polygon points="12,3 20,7 20,17 12,21 4,17 4,7"/>` +
    `<circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>`,

  // Wide rounded body silhouette.
  obesity:
    `<circle cx="12" cy="6.5" r="2.5"/>` +
    `<path d="M 5 22 Q 5 12 12 12 Q 19 12 19 22"/>` +
    `<line x1="5" y1="22" x2="19" y2="22"/>`,

  // Three overlapping rings — the "cluster of conditions" Venn.
  metabolic_syndrome:
    `<circle cx="9" cy="10" r="5.5"/>` +
    `<circle cx="15" cy="10" r="5.5"/>` +
    `<circle cx="12" cy="16" r="5.5"/>`,

  // Liver droplet — angled teardrop shape with a venous mark.
  nafld:
    `<path d="M 12 3 C 18 8, 20 13, 18 18 C 16 22, 10 22, 7 19 C 4 15, 6 8, 12 3 Z"/>` +
    `<path d="M 9 14 Q 12 17 15 14"/>`,

  // Heart with a partial blockage line through one branch.
  cad:
    `<path d="M 12 21 C 4 14, 4 6, 8 6 Q 12 6, 12 9 Q 12 6, 16 6 C 20 6, 20 14, 12 21 Z"/>` +
    `<line x1="6" y1="9" x2="10" y2="13" stroke-width="2.4"/>`,

  // Heart with a lightning bolt.
  mi:
    `<path d="M 12 21 C 4 14, 4 6, 8 6 Q 12 6, 12 9 Q 12 6, 16 6 C 20 6, 20 14, 12 21 Z"/>` +
    `<path d="M 13 9 L 11 13 L 13 13 L 11 17" stroke-width="1.9"/>`,

  // Heart with a fading downward arrow underneath.
  heart_failure:
    `<path d="M 12 18 C 5 12, 5 5, 9 5 Q 12 5, 12 8 Q 12 5, 15 5 C 19 5, 19 12, 12 18 Z"/>` +
    `<path d="M 9 21 L 12 23 L 15 21"/>` +
    `<line x1="12" y1="18.5" x2="12" y2="22.5"/>`,

  // Pressure gauge — arc with a needle.
  hypertension:
    `<path d="M 4 16 A 9 9 0 0 1 20 16"/>` +
    `<line x1="12" y1="16" x2="17" y2="9.5"/>` +
    `<circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none"/>`,

  // Wavy lipid chain.
  dyslipidemia:
    `<path d="M 3 8 Q 6.5 4, 10 8 Q 13.5 12, 17 8 Q 20.5 4, 24 8" transform="translate(-1.5,4)"/>` +
    `<path d="M 3 8 Q 6.5 12, 10 8 Q 13.5 4, 17 8 Q 20.5 12, 24 8" transform="translate(-1.5,10)"/>`,

  // Vessel cross-section with a plaque narrowing the lumen.
  atherosclerosis:
    `<path d="M 3 7 L 21 7"/>` +
    `<path d="M 3 17 L 21 17"/>` +
    `<path d="M 7 7 Q 11 11, 15 7" fill="currentColor" stroke="none" opacity="0.5"/>` +
    `<path d="M 7 7 Q 11 11, 15 7"/>`,

  // Irregular ECG waveform.
  afib:
    `<path d="M 3 12 L 6 12 L 7.5 8 L 9 16 L 10.5 12 L 13 13 L 14.5 9 L 16 14 L 18 12 L 21 12"/>`,

  // Brain silhouette with a lightning slash through it.
  stroke:
    `<path d="M 7 6 C 4 6, 3 10, 5 12 C 3 14, 4 18, 7 18 C 9 20, 13 20, 14 18 C 17 18, 19 14, 17 12 C 19 10, 18 6, 15 6 C 13 4, 9 4, 7 6 Z"/>` +
    `<path d="M 13 9 L 11 13 L 13 13 L 11 17" stroke-width="1.9"/>`,

  // Double helix — the "monogenic / inherited" archetype.
  fh:
    `<path d="M 8 4 Q 16 8, 8 12 Q 16 16, 8 20"/>` +
    `<path d="M 16 4 Q 8 8, 16 12 Q 8 16, 16 20"/>` +
    `<line x1="9" y1="7" x2="15" y2="7" opacity="0.6"/>` +
    `<line x1="9" y1="13" x2="15" y2="13" opacity="0.6"/>` +
    `<line x1="9" y1="19" x2="15" y2="19" opacity="0.6"/>`,
};

const FALLBACK_PATH = `<circle cx="12" cy="12" r="9"/>`;

export default function DiseaseIcon({ diseaseKey, size = 14, className }: Props) {
  const inner = DISEASE_ICON_PATHS[diseaseKey] ?? FALLBACK_PATH;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

/**
 * Returns a full <svg> string for use in vanilla DOM contexts (CSS2DRenderer
 * labels, etc.) where we can't render a React component. Honors a `color`
 * override since `currentColor` doesn't propagate when injected via
 * innerHTML on an element that doesn't have a CSS color set.
 */
export function diseaseIconSvgString(diseaseKey: string, size: number = 14, color: string = 'currentColor'): string {
  const inner = DISEASE_ICON_PATHS[diseaseKey] ?? FALLBACK_PATH;
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">` +
    inner +
    `</svg>`
  );
}
