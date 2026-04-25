import React from 'react';
import type { Protein } from '@/lib/protein-mapper';
import { hasVariants } from '@/lib/variant-analysis';

/**
 * UnknownUnknownsDeepDive - Coverage matrix across all eight context
 * dimensions for the selected protein. Each dimension is rated full / partial
 * / missing based on what data is actually available in the snapshot.
 *
 * The point of the view is honesty: name what's missing instead of pretending
 * every card is fully populated. The "% covered" headline is the same
 * complexity score the meter on the main page shows, expressed as coverage.
 */

interface Props {
  protein: Protein;
}

const ACCENT = '#f87171';

type CoverageState = 'full' | 'partial' | 'missing';

interface Dimension {
  title: string;
  state: CoverageState;
  rationale: string;
  color: string;
}

export default function UnknownUnknownsDeepDive({ protein }: Props) {
  const dims: Dimension[] = [
    {
      title: 'Molecular Structure',
      state: protein.plddt != null ? (protein.plddt >= 70 ? 'full' : 'partial') : 'missing',
      rationale: protein.plddt != null
        ? `AlphaFold v6 structure with mean pLDDT ${protein.plddt.toFixed(1)}`
        : 'No AlphaFold structure in scope',
      color: '#10b981',
    },
    {
      title: 'Protein Binding',
      state: 'full',
      rationale: `Function summary, OpenTargets disease association ${protein.score.toFixed(2)}`,
      color: '#a78bfa',
    },
    {
      title: 'ADME Profile',
      state: 'missing',
      rationale: 'Requires DrugBank or equivalent integration; out of scope for v1',
      color: '#22d3ee',
    },
    {
      title: 'Toxicity',
      state: hasVariants(protein.uniprot) ? 'partial' : 'missing',
      rationale: hasVariants(protein.uniprot)
        ? 'Variant-burden proxy via AlphaMissense; no FAERS aggregation'
        : 'No variant data in snapshot',
      color: '#f59e0b',
    },
    {
      title: 'Signaling Pathways',
      state: protein.disease ? 'partial' : 'missing',
      rationale: protein.disease
        ? `Disease scope (${protein.disease}); Reactome traversal pending`
        : 'No primary disease assignment',
      color: '#c084fc',
    },
    {
      title: 'Patient Population',
      state: hasVariants(protein.uniprot) ? 'full' : 'partial',
      rationale: hasVariants(protein.uniprot)
        ? 'Pathogenic variant set with hotspot residues'
        : 'Variant counts only; no per-residue detail',
      color: '#facc15',
    },
    {
      title: 'Dark Proteome',
      state: protein.plddt != null ? 'full' : 'missing',
      rationale: protein.plddt != null
        ? 'Mean pLDDT band classification with peer comparison'
        : 'No structural confidence loaded',
      color: '#34d399',
    },
    {
      title: 'Unknown Unknowns',
      state: 'partial',
      rationale: 'This view itself; meta-coverage rendered from the seven other dimensions',
      color: '#f87171',
    },
  ];

  const fullCount = dims.filter((d) => d.state === 'full').length;
  const partialCount = dims.filter((d) => d.state === 'partial').length;
  const coveragePct = Math.round(((fullCount + partialCount * 0.5) / dims.length) * 100);

  return (
    <div className="text-white/85">
      <div className="text-[10px] tracking-[2.5px] font-medium uppercase" style={{ color: ACCENT }}>
        Unknown Unknowns
      </div>
      <div className="text-[26px] tracking-wide font-light mt-1">{protein.gene}</div>
      <div className="text-[12px] text-white/45 mt-0.5">{protein.name} · {protein.uniprot}</div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Coverage" value={`${coveragePct}%`} hint={`${fullCount} full · ${partialCount} partial · ${dims.length - fullCount - partialCount} missing`} />
        <Stat label="Full dimensions" value={fullCount.toString()} hint="data is rich" />
        <Stat label="Missing dimensions" value={(dims.length - fullCount - partialCount).toString()} hint="next experiments live here" />
      </div>

      <div className="mt-5 rounded-xl px-5 py-5"
           style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${ACCENT}24` }}>
        <div className="text-[10px] tracking-[2px] text-white/55 uppercase mb-3">Coverage matrix</div>
        <div className="grid grid-cols-2 gap-2.5">
          {dims.map((d) => (
            <DimRow key={d.title} dim={d} />
          ))}
        </div>
      </div>

      <div className="mt-5 text-[10.5px] text-white/35 leading-relaxed">
        Honest coverage map. "Full" means the snapshot has the data the deep-dive expects; "Partial" means the card can render something but a richer source (Reactome, FAERS, per-residue pLDDT) is the next addition; "Missing" names a gap that's better not to paper over. Where you see a missing band, that's where the most informative next experiment lives.
      </div>
    </div>
  );
}

function DimRow({ dim }: { dim: Dimension }) {
  const stateColor = dim.state === 'full' ? '#34d399' : dim.state === 'partial' ? '#facc15' : '#f87171';
  const stateLabel = dim.state === 'full' ? 'Full' : dim.state === 'partial' ? 'Partial' : 'Missing';
  return (
    <div className="rounded-md px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${dim.color}22` }}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10.5px] tracking-[1.5px] uppercase font-medium" style={{ color: dim.color }}>
          {dim.title}
        </div>
        <div className="flex items-center gap-1.5 text-[9.5px] tracking-[1px] uppercase" style={{ color: stateColor }}>
          <span className="rounded-full" style={{ width: 5, height: 5, background: stateColor, boxShadow: `0 0 5px ${stateColor}` }} />
          {stateLabel}
        </div>
      </div>
      <div className="text-[10.5px] text-white/55 leading-snug">{dim.rationale}</div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-[9.5px] tracking-[2px] text-white/45 uppercase">{label}</div>
      <div className="text-[18px] text-white font-light tracking-wide mt-0.5">{value}</div>
      {hint && <div className="text-[9.5px] text-white/35 mt-0.5">{hint}</div>}
    </div>
  );
}
