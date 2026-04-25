import React from 'react';
import { proteinMapper, type Protein } from '@/lib/protein-mapper';
import GeneLink from '../GeneLink';

/**
 * ProteinBindingDeepDive - Renders binding-related context: full function
 * summary, OpenTargets disease association score, organ-level peer set, and
 * any curated mechanism notes (drug targets, drug classes).
 *
 * Phase 5+ should add the real semantic-neighbor query against the
 * search_similar_proteins_semantic MCP tool to surface functionally similar
 * proteins beyond the v1 organ scope.
 */

interface Props {
  protein: Protein;
}

const ACCENT = '#a78bfa';

export default function ProteinBindingDeepDive({ protein }: Props) {
  const organKey = proteinMapper.getOrganForProtein(protein);
  const organData = organKey ? proteinMapper.getOrganData(organKey) : null;
  const peers = organData ? organData.proteins.filter((p) => p.gene !== protein.gene).slice(0, 6) : [];

  return (
    <div className="text-white/85">
      <div className="text-[10px] tracking-[2.5px] font-medium uppercase" style={{ color: ACCENT }}>
        Protein Binding and Targets
      </div>
      <div className="text-[26px] tracking-wide font-light mt-1">{protein.gene}</div>
      <div className="text-[12px] text-white/45 mt-0.5">{protein.name} · {protein.uniprot}</div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Disease association" value={protein.score.toFixed(3)} hint="OpenTargets overall score" />
        <Stat label="Disease label" value={protein.disease ?? '—'} hint="primary scope assignment" />
        <Stat label="Function class" value={inferFunctionClass(protein.function)} hint="inferred from UniProt summary" />
      </div>

      <div className="mt-5 rounded-xl px-5 py-5"
           style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${ACCENT}24` }}>
        <div className="text-[10px] tracking-[2px] text-white/55 uppercase mb-2.5">Function summary</div>
        <div className="text-[13px] text-white/80 leading-relaxed">{protein.function}</div>
      </div>

      {protein.notes && (
        <div className="mt-4 rounded-xl px-5 py-4"
             style={{ background: `${ACCENT}0F`, border: `1px solid ${ACCENT}30` }}>
          <div className="text-[10px] tracking-[2px] uppercase mb-1.5" style={{ color: ACCENT }}>
            Mechanism / pharmacology
          </div>
          <div className="text-[13px] text-white/85 leading-relaxed">{protein.notes}</div>
        </div>
      )}

      {peers.length > 0 && (
        <div className="mt-4 rounded-xl px-5 py-4"
             style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${ACCENT}1F` }}>
          <div className="text-[10px] tracking-[2px] text-white/55 uppercase mb-2.5">Co-located in {organData?.label.toLowerCase()}</div>
          <div className="grid grid-cols-2 gap-2">
            {peers.map((p) => (
              <button
                key={p.gene}
                onClick={() => window.dispatchEvent(new CustomEvent('human-os:select-protein', { detail: { gene: p.gene } }))}
                className="text-left rounded-md px-3 py-2 transition hover:translate-x-[1px]"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                title={`Load ${p.gene}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-white text-[12.5px] font-medium tracking-wide">{p.gene}</span>
                  <span className="font-mono text-[10px] text-white/45">{p.score.toFixed(2)}</span>
                </div>
                <div className="text-[10.5px] text-white/45 mt-0.5 leading-tight line-clamp-2">{p.function.split('.')[0]}.</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 text-[10.5px] text-white/35 leading-relaxed">
        Semantic neighbor discovery (search_similar_proteins_semantic) and a richer interaction-network view route through Phase 5 once live MCP queries are wired. Today the peer panel is scoped to proteins co-located in the same organ via the snapshot.
      </div>
    </div>
  );
}

function inferFunctionClass(fn: string): string {
  const lower = fn.toLowerCase();
  if (lower.includes('channel'))      return 'Ion channel';
  if (lower.includes('receptor'))     return 'Receptor';
  if (lower.includes('kinase'))       return 'Kinase';
  if (lower.includes('transcription'))return 'Transcription factor';
  if (lower.includes('apolipoprotein') || lower.includes('lipoprotein')) return 'Apolipoprotein';
  if (lower.includes('factor'))       return 'Coagulation';
  if (lower.includes('reductase') || lower.includes('phosphat') || lower.includes('hydrolase') || lower.includes('kinase')) return 'Enzyme';
  if (lower.includes('atpase') || lower.includes('transport')) return 'Transporter';
  return 'Functional protein';
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-[9.5px] tracking-[2px] text-white/45 uppercase">{label}</div>
      <div className="text-[16px] text-white font-light tracking-wide mt-0.5 leading-tight">{value}</div>
      {hint && <div className="text-[9.5px] text-white/35 mt-0.5">{hint}</div>}
    </div>
  );
}
