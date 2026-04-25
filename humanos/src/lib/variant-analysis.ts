/**
 * Variant analysis utilities.
 *
 * Reads the compact variant-data.json snapshot (top 24 proteins, all
 * pathogenic variants returned by the MCP server, capped at 500 per protein).
 * Provides binning for the residue-level heatmap, hotspot ranking, and
 * top-variant filtering for the deep-dive panel.
 */

import variantData from '@/data/variant-data.json';

export interface Variant {
  /** 1-indexed residue position. */
  p: number;
  /** AlphaMissense pathogenicity score. */
  s: number;
  /** Variant string in single-letter notation (e.g. "P122R"). */
  v: string;
}

export interface Bin {
  /** Inclusive start of the residue range this bin covers. */
  start: number;
  /** Inclusive end of the residue range this bin covers. */
  end: number;
  /** Number of pathogenic variants in this bin. */
  count: number;
  /** Maximum AlphaMissense score across variants in this bin. */
  maxScore: number;
  /** Up to 6 highest-scoring variants in this bin (for hover tooltips). */
  top: Variant[];
}

const data = variantData as Record<string, Variant[]>;

export function getVariantsForProtein(uniprot: string): Variant[] {
  return data[uniprot] ?? [];
}

export function hasVariants(uniprot: string): boolean {
  return Array.isArray(data[uniprot]) && data[uniprot].length > 0;
}

/**
 * Bin variants by position into a fixed number of bins covering the residue
 * range from 1 to maxPosition. Used to drive the residue-level heatmap.
 */
export function binVariants(variants: Variant[], binCount = 60): { bins: Bin[]; maxPosition: number } {
  if (variants.length === 0) return { bins: [], maxPosition: 0 };
  const maxPosition = Math.max(...variants.map((v) => v.p));
  const binSize = Math.max(1, Math.ceil(maxPosition / binCount));

  const bins: Bin[] = [];
  for (let i = 0; i < binCount; i++) {
    const start = i * binSize + 1;
    const end = Math.min((i + 1) * binSize, maxPosition);
    bins.push({ start, end, count: 0, maxScore: 0, top: [] });
    if (end >= maxPosition) break;
  }

  for (const variant of variants) {
    const idx = Math.min(bins.length - 1, Math.floor((variant.p - 1) / binSize));
    const bin = bins[idx];
    bin.count += 1;
    if (variant.s > bin.maxScore) bin.maxScore = variant.s;
  }

  // Per bin, populate `top` with the highest-scoring variants for tooltips.
  const byBin: Record<number, Variant[]> = {};
  for (const variant of variants) {
    const idx = Math.min(bins.length - 1, Math.floor((variant.p - 1) / binSize));
    (byBin[idx] = byBin[idx] || []).push(variant);
  }
  for (const idxStr of Object.keys(byBin)) {
    const idx = Number(idxStr);
    bins[idx].top = byBin[idx].sort((a, b) => b.s - a.s).slice(0, 6);
  }

  return { bins, maxPosition };
}

/**
 * Return the top N variants by pathogenicity score, ties broken by position.
 */
export function topVariantsByScore(variants: Variant[], n = 10): Variant[] {
  return [...variants]
    .sort((a, b) => b.s - a.s || a.p - b.p)
    .slice(0, n);
}

/**
 * Identify hotspot positions with multiple distinct pathogenic substitutions.
 * Useful for highlighting in the deep-dive view.
 */
export function findHotspotPositions(variants: Variant[], minVariants = 3): number[] {
  const counts: Record<number, number> = {};
  for (const v of variants) counts[v.p] = (counts[v.p] || 0) + 1;
  return Object.entries(counts)
    .filter(([, c]) => c >= minVariants)
    .sort(([, a], [, b]) => b - a)
    .map(([p]) => Number(p));
}
