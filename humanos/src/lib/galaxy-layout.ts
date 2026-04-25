/**
 * Galaxy layout - deterministic 3D positions for the protein universe.
 *
 * Topology: 13 disease stars distributed around the origin on a tilted ring.
 * Each protein is a planet orbiting its primary-disease star. Distance from
 * the star is inversely proportional to association score (high score = close).
 * Spherical coordinates around each disease use a deterministic hash of the
 * gene name so the layout is stable across reloads.
 */

import diseaseMetadata from '@/data/disease-metadata.json';
import { getAllEnrichedProteins, type EnrichedProtein } from './protein-classify';
import type { OrganKey } from './protein-mapper';

interface DiseaseRecord {
  label: string;
  shortLabel: string;
  efoId: string;
  color: string;
  primaryOrgan: string;
  description: string;
}

export interface DiseaseNode {
  key: string;
  label: string;
  shortLabel: string;
  color: string;
  primaryOrgan: OrganKey;
  description: string;
  position: [number, number, number];
  proteinCount: number;
}

export interface ProteinNode extends EnrichedProtein {
  position: [number, number, number];
  diseaseKey: string;
  diseaseLabel: string;
  /** distance from disease star center, in world units */
  orbitRadius: number;
  /** size of the rendered planet, in world units */
  size: number;
}

export interface GalaxyLayout {
  diseases: DiseaseNode[];
  proteins: ProteinNode[];
  diseaseByLabel: Map<string, DiseaseNode>;
  proteinByGene: Map<string, ProteinNode>;
}

const DISEASES = (diseaseMetadata as { diseases: Record<string, DiseaseRecord> }).diseases;

// Scale in world units. 800 = ring radius for disease stars; protein orbits
// span 35-220 around each star.
const DISEASE_RING = 800;
const ORBIT_MIN = 35;
const ORBIT_MAX = 220;

function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) * 16777619;
  }
  return (h >>> 0) / 0xffffffff;
}

export function buildGalaxyLayout(): GalaxyLayout {
  const all = getAllEnrichedProteins();
  const diseaseEntries = Object.entries(DISEASES);

  const diseases: DiseaseNode[] = diseaseEntries.map(([key, d], i) => {
    const angle = (i / diseaseEntries.length) * Math.PI * 2;
    const tilt = Math.sin(angle * 2) * 80;
    return {
      key,
      label: d.label,
      shortLabel: d.shortLabel,
      color: d.color,
      primaryOrgan: d.primaryOrgan as OrganKey,
      description: d.description,
      position: [
        Math.cos(angle) * DISEASE_RING,
        tilt,
        Math.sin(angle) * DISEASE_RING,
      ],
      proteinCount: 0,
    };
  });

  const diseaseByLabel = new Map<string, DiseaseNode>();
  diseases.forEach((d) => diseaseByLabel.set(d.label.toLowerCase(), d));

  // Place each protein around its primary disease's star. If the protein's
  // disease label doesn't resolve to a known disease, fall back to the
  // disease nearest its primary organ (rare in practice).
  const proteins: ProteinNode[] = all.map((p) => {
    const diseaseLabel = p.disease ?? '';
    let host = diseaseByLabel.get(diseaseLabel.toLowerCase());
    if (!host) {
      // Fallback: pick the disease whose primary organ matches.
      host = diseases.find((d) => d.primaryOrgan === p.organ) ?? diseases[0];
    }
    host.proteinCount += 1;

    // Higher score → closer in, with a small randomized jitter so equal-score
    // proteins don't overlap.
    const jitter = strHash(p.gene + ':r') * 30;
    const orbitRadius = ORBIT_MIN + (1 - p.score) * (ORBIT_MAX - ORBIT_MIN) + jitter;

    const theta = strHash(p.gene + ':t') * Math.PI * 2;
    const phi   = (strHash(p.gene + ':p') * 0.7 + 0.15) * Math.PI; // bias away from poles

    const dx = Math.sin(phi) * Math.cos(theta) * orbitRadius;
    const dy = Math.cos(phi) * orbitRadius * 0.6; // squash vertical so disks read
    const dz = Math.sin(phi) * Math.sin(theta) * orbitRadius;

    const size = 1.2 + p.score * 3.5;

    return {
      ...p,
      position: [host.position[0] + dx, host.position[1] + dy, host.position[2] + dz],
      diseaseKey: host.key,
      diseaseLabel: host.label,
      orbitRadius,
      size,
    };
  });

  const proteinByGene = new Map<string, ProteinNode>();
  proteins.forEach((p) => proteinByGene.set(p.gene, p));

  return { diseases, proteins, diseaseByLabel, proteinByGene };
}
