import React from 'react';
import ContextCard from './ContextCard';
import type { Protein } from '@/lib/protein-mapper';

/**
 * ContextPanel - Renders four context cards on either the left or right side
 * of the body figure. Empty state shows the layout but with placeholder values.
 */

interface Props {
  side: 'left' | 'right';
  protein: Protein | null;
  onCardClick?: (title: string) => void;
}

const LEFT_TITLES = ['MOLECULAR STRUCTURE', 'PROTEIN BINDING', 'ADME PROFILE', 'TOXICITY'] as const;
const RIGHT_TITLES = ['SIGNALING PATHWAYS', 'PATIENT POPULATION', 'DARK PROTEOME', 'UNKNOWN UNKNOWNS'] as const;

const CARD_COLORS: Record<string, string> = {
  'MOLECULAR STRUCTURE': '#10b981',
  'PROTEIN BINDING':     '#a78bfa',
  'ADME PROFILE':        '#22d3ee',
  'TOXICITY':            '#f59e0b',
  'SIGNALING PATHWAYS':  '#c084fc',
  'PATIENT POPULATION':  '#facc15',
  'DARK PROTEOME':       '#34d399',
  'UNKNOWN UNKNOWNS':    '#f87171',
};

const PLACEHOLDERS: Record<string, { mainText: string; subText: string }> = {
  'MOLECULAR STRUCTURE': { mainText: 'Defines core aspects of molecular structure', subText: 'Awaiting protein selection' },
  'PROTEIN BINDING':     { mainText: 'Covers protein binding and target interactions', subText: 'Awaiting protein selection' },
  'ADME PROFILE':        { mainText: 'Profiles absorption, distribution, metabolism, excretion', subText: 'Phase 4 deep-dive' },
  'TOXICITY':            { mainText: 'Assesses toxicity and safety signals', subText: 'Awaiting protein selection' },
  'SIGNALING PATHWAYS':  { mainText: 'Explores anatomy and interactions of signaling pathways', subText: 'Awaiting protein selection' },
  'PATIENT POPULATION':  { mainText: 'Analyzes variability across patient populations', subText: 'Awaiting protein selection' },
  'DARK PROTEOME':       { mainText: 'Explores understudied proteins and structural gaps', subText: 'Awaiting protein selection' },
  'UNKNOWN UNKNOWNS':    { mainText: 'Risks and factors not yet identified', subText: 'Awaiting protein selection' },
};

export default function ContextPanel({ side, protein, onCardClick }: Props) {
  const titles = side === 'left' ? LEFT_TITLES : RIGHT_TITLES;
  const cards = titles.map((title) => buildCard(title, protein));

  return (
    <div className="flex flex-col gap-2.5">
      {cards.map((c) => (
        <ContextCard
          key={c.title}
          title={c.title}
          color={CARD_COLORS[c.title]}
          mainText={c.mainText}
          subText={c.subText}
          dots={c.dots}
          onClick={onCardClick ? () => onCardClick(c.title) : undefined}
        />
      ))}
    </div>
  );
}

function buildCard(title: string, protein: Protein | null): { title: string; mainText: string; subText: string; dots: number } {
  if (!protein) {
    const ph = PLACEHOLDERS[title];
    return { title, mainText: ph.mainText, subText: ph.subText, dots: 0 };
  }
  switch (title) {
    case 'MOLECULAR STRUCTURE': {
      const plddt = protein.plddt;
      const confidence = (plddt ?? 0) > 90 ? 'Very high confidence'
        : (plddt ?? 0) > 70 ? 'Confident fold'
        : (plddt ?? 0) > 50 ? 'Moderate confidence'
        : 'Low or unknown';
      return {
        title,
        mainText: plddt ? `pLDDT ${plddt.toFixed(1)}` : 'Structure unavailable',
        subText: confidence,
        dots: Math.round((plddt ?? 0) / 20),
      };
    }
    case 'PROTEIN BINDING':
      return {
        title,
        mainText: protein.function,
        subText: `Disease association ${protein.score.toFixed(2)}`,
        dots: Math.round(protein.score * 5),
      };
    case 'ADME PROFILE':
      return {
        title,
        mainText: 'External integration pending',
        subText: 'DrugBank and FAERS connectors arrive in Phase 4',
        dots: 0,
      };
    case 'TOXICITY': {
      const burden = protein.variantCount ?? 0;
      return {
        title,
        mainText: burden > 200 ? 'High variant burden' : burden > 0 ? 'Standard profile' : 'Awaiting variant data',
        subText: 'Substitution intolerance proxy',
        dots: Math.min(5, Math.round(burden / 100)),
      };
    }
    case 'SIGNALING PATHWAYS':
      return {
        title,
        mainText: protein.disease ?? 'Pathway data pending',
        subText: 'Reactome enrichment, MCP-backed in Phase 2',
        dots: 4,
      };
    case 'PATIENT POPULATION': {
      const count = protein.variantCount;
      return {
        title,
        mainText: count != null ? `${count} pathogenic variants` : 'Loading variants',
        subText: protein.hotspots && protein.hotspots.length > 0
          ? `Hotspots at ${protein.hotspots.slice(0, 3).join(', ')}`
          : 'AlphaMissense pathogenic class only',
        dots: count != null ? Math.min(5, Math.round(count / 50)) : 0,
      };
    }
    case 'DARK PROTEOME': {
      const wellFolded = (protein.plddt ?? 0) > 80;
      return {
        title,
        mainText: wellFolded ? 'Well characterized' : 'Some dark regions',
        subText: (protein.plddt ?? 0) < 70 ? 'Disordered segments present' : 'Bright structural coverage',
        dots: wellFolded ? 5 : 3,
      };
    }
    case 'UNKNOWN UNKNOWNS':
      return {
        title,
        mainText: 'Six of eight layers populated',
        subText: 'ADME and full toxicity coverage gap',
        dots: 3,
      };
  }
  return { title, mainText: '', subText: '', dots: 0 };
}
