import React, { useEffect } from 'react';
import type { Protein } from '@/lib/protein-mapper';
import VariantDeepDive from './VariantDeepDive';
import PlaceholderDeepDive from './PlaceholderDeepDive';
import DarkProteomeDeepDive from './DarkProteomeDeepDive';
import MolecularStructureDeepDive from './MolecularStructureDeepDive';
import ProteinBindingDeepDive from './ProteinBindingDeepDive';
import SignalingPathwaysDeepDive from './SignalingPathwaysDeepDive';
import ToxicityDeepDive from './ToxicityDeepDive';
import UnknownUnknownsDeepDive from './UnknownUnknownsDeepDive';
import DiseaseDeepDive from './DiseaseDeepDive';

/**
 * DeepDiveOverlay - Modal layer that opens when the user clicks a context
 * card. Routes the card title to the right deep-dive component. Only
 * Patient Population Variance has a fully built view in v1; the other seven
 * surface a placeholder that names the data source coming online next.
 *
 * Closes via X button, ESC key, or backdrop click.
 */

interface Props {
  cardTitle: string | null;
  protein: Protein | null;
  diseaseKey?: string | null;
  onClose: () => void;
  onSelectProtein?: (p: Protein) => void;
  onSelectDisease?: (key: string) => void;
}

export default function DeepDiveOverlay({ cardTitle, protein, diseaseKey, onClose, onSelectProtein, onSelectDisease }: Props) {
  useEffect(() => {
    if (!cardTitle && !diseaseKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cardTitle, diseaseKey, onClose]);

  if (!cardTitle && !diseaseKey) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        background: 'rgba(7, 11, 32, 0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl px-7 pt-6 pb-7"
        style={{
          background: 'linear-gradient(180deg, rgba(10, 14, 39, 0.92) 0%, rgba(7, 11, 32, 0.96) 100%)',
          border: '1px solid rgba(45, 212, 191, 0.20)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.5), inset 0 0 60px rgba(45,212,191,0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 rounded-full w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {diseaseKey ? (
          <DiseaseDeepDive
            diseaseKey={diseaseKey}
            onSelectProtein={(p) => {
              onSelectProtein?.(p);
              onClose();
            }}
          />
        ) : (
          <DeepDiveContent cardTitle={cardTitle as string} protein={protein} onSelectDisease={onSelectDisease} />
        )}
      </div>
    </div>
  );
}

function DeepDiveContent({ cardTitle, protein, onSelectDisease }: { cardTitle: string; protein: Protein | null; onSelectDisease?: (key: string) => void }) {
  // Cards with a fully built deep-dive route here.
  const accent = ACCENT_BY_CARD[cardTitle] ?? '#94a3b8';
  if (!protein) return <NoProteinPlaceholder cardTitle={cardTitle} accentColor={accent} />;

  switch (cardTitle) {
    case 'MOLECULAR STRUCTURE': return <MolecularStructureDeepDive protein={protein} />;
    case 'PROTEIN BINDING':     return <ProteinBindingDeepDive protein={protein} />;
    case 'SIGNALING PATHWAYS':  return <SignalingPathwaysDeepDive protein={protein} onSelectDisease={onSelectDisease} />;
    case 'PATIENT POPULATION':  return <VariantDeepDive protein={protein} />;
    case 'DARK PROTEOME':       return <DarkProteomeDeepDive protein={protein} />;
    case 'TOXICITY':            return <ToxicityDeepDive protein={protein} />;
    case 'UNKNOWN UNKNOWNS':    return <UnknownUnknownsDeepDive protein={protein} />;
  }

  const config = PLACEHOLDER_CONFIG[cardTitle] ?? {
    description: 'Deep-dive view for this card is not yet built.',
    comingIn: 'On the roadmap',
    accentColor: '#94a3b8',
  };
  return (
    <PlaceholderDeepDive
      cardTitle={cardTitle}
      protein={protein}
      description={config.description}
      comingIn={config.comingIn}
      accentColor={config.accentColor}
    />
  );
}

const ACCENT_BY_CARD: Record<string, string> = {
  'MOLECULAR STRUCTURE': '#10b981',
  'PROTEIN BINDING':     '#a78bfa',
  'ADME PROFILE':        '#22d3ee',
  'TOXICITY':            '#f59e0b',
  'SIGNALING PATHWAYS':  '#c084fc',
  'PATIENT POPULATION':  '#facc15',
  'DARK PROTEOME':       '#34d399',
  'UNKNOWN UNKNOWNS':    '#f87171',
};

function NoProteinPlaceholder({ cardTitle, accentColor }: { cardTitle: string; accentColor: string }) {
  return (
    <PlaceholderDeepDive
      cardTitle={cardTitle}
      protein={null}
      description="Click an organ on the body or ask about a gene to load a protein, then this card opens its dedicated view."
      comingIn="Awaiting protein selection"
      accentColor={accentColor}
    />
  );
}

const PLACEHOLDER_CONFIG: Record<string, { description: string; comingIn: string; accentColor: string }> = {
  'MOLECULAR STRUCTURE': {
    description: 'AlphaFold v6 ribbon viewer with per-residue pLDDT coloring, domain annotation, and binding pocket overlay. The structure block in the MCP record (DOI, mean and per-residue pLDDT, fold class) is the source.',
    comingIn: 'Phase 5 deep-dive',
    accentColor: '#10b981',
  },
  'PROTEIN BINDING': {
    description: 'Interaction network for this protein: physical binding partners, semantic neighbors from the embedding index, and OpenTargets disease associations weighted by score.',
    comingIn: 'Phase 5 deep-dive',
    accentColor: '#a78bfa',
  },
  'ADME PROFILE': {
    description: 'Absorption, distribution, metabolism, excretion. External integration with DrugBank and PK databases. Out of scope for v1 by design.',
    comingIn: 'Future phase, requires DrugBank',
    accentColor: '#22d3ee',
  },
  'TOXICITY': {
    description: 'Safety signals. FAERS adverse event aggregation by drug class plus on-target liability heuristics. Variant-burden proxy is rendered in the card itself today.',
    comingIn: 'Future phase, requires FAERS',
    accentColor: '#f59e0b',
  },
  'SIGNALING PATHWAYS': {
    description: 'Reactome pathway view rooted at this protein, plus upstream regulators and downstream effectors. MCP-backed traversal once the live HTTP path is wired.',
    comingIn: 'Phase 5 deep-dive',
    accentColor: '#c084fc',
  },
  'DARK PROTEOME': {
    description: 'Disordered region map and pLDDT distribution showing structural confidence by residue. Identifies dark segments where the AlphaFold prediction has low confidence.',
    comingIn: 'Phase 5 deep-dive',
    accentColor: '#34d399',
  },
  'UNKNOWN UNKNOWNS': {
    description: 'Coverage matrix across the eight context dimensions. Surfaces what is known, what is missing, and where the most informative next experiment would land.',
    comingIn: 'Phase 5 design exercise',
    accentColor: '#f87171',
  },
};
