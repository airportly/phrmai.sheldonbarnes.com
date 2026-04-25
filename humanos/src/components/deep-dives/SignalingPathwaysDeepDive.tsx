import React from 'react';
import { proteinMapper, type Protein } from '@/lib/protein-mapper';
import diseaseMetadata from '@/data/disease-metadata.json';

const DISEASE_KEY_BY_LABEL: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  const m = (diseaseMetadata as { diseases: Record<string, { label: string }> }).diseases;
  for (const [key, d] of Object.entries(m)) out[d.label.toLowerCase()] = key;
  return out;
})();

/**
 * SignalingPathwaysDeepDive - Surfaces the disease-association landscape for
 * the selected protein. The cardiometabolic-research scope is 13 diseases;
 * this view shows which of those each protein in the same organ is associated
 * with, plus a simple severity bar from the OpenTargets score.
 *
 * Phase 5+ should integrate the Reactome pathway traversal once an HTTP MCP
 * endpoint or a Reactome API call is wired.
 */

interface Props {
  protein: Protein;
  onSelectDisease?: (key: string) => void;
}

const ACCENT = '#c084fc';

export default function SignalingPathwaysDeepDive({ protein, onSelectDisease }: Props) {
  const organKey = proteinMapper.getOrganForProtein(protein);
  const organData = organKey ? proteinMapper.getOrganData(organKey) : null;
  const diseases = organData?.diseases ?? [];

  return (
    <div className="text-white/85">
      <div className="text-[10px] tracking-[2.5px] font-medium uppercase" style={{ color: ACCENT }}>
        Signaling Pathways
      </div>
      <div className="text-[26px] tracking-wide font-light mt-1">{protein.gene}</div>
      <div className="text-[12px] text-white/45 mt-0.5">{protein.name} · {protein.uniprot}</div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Primary disease" value={protein.disease ?? '—'} />
        <Stat label="Association score" value={protein.score.toFixed(3)} hint="OpenTargets overall" />
        <Stat label="Diseases in organ" value={diseases.length.toString()} hint="cardiometabolic v1.0 scope" />
      </div>

      <div className="mt-5 rounded-xl px-5 py-5"
           style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${ACCENT}24` }}>
        <div className="text-[10px] tracking-[2px] text-white/55 uppercase mb-3">Disease landscape (organ scope)</div>
        <div className="space-y-2">
          {diseases.map((disease) => {
            const isPrimary = protein.disease === disease;
            const severity = isPrimary ? protein.score : 0.45;
            const key = DISEASE_KEY_BY_LABEL[disease.toLowerCase()];
            const clickable = !!(key && onSelectDisease);
            return (
              <button
                key={disease}
                onClick={() => clickable && onSelectDisease!(key)}
                disabled={!clickable}
                className={`flex items-center gap-3 w-full text-left rounded-md px-1.5 py-1 -mx-1.5 transition ${clickable ? 'hover:bg-white/[0.04] cursor-pointer' : 'cursor-default'}`}
                title={clickable ? `Open ${disease} landscape` : undefined}
              >
                <div className={`w-44 truncate ${isPrimary ? 'text-white' : 'text-white/55'} text-[12.5px]`}>
                  {disease}
                </div>
                <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${severity * 100}%`,
                      background: ACCENT,
                      opacity: isPrimary ? 0.9 : 0.4,
                      boxShadow: isPrimary ? `0 0 10px ${ACCENT}80` : 'none',
                    }}
                  />
                </div>
                <div className="w-12 text-right font-mono text-[11px] text-white/55">
                  {isPrimary ? severity.toFixed(2) : '—'}
                </div>
                {clickable && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" opacity="0.55">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-xl px-5 py-4"
           style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${ACCENT}1F` }}>
        <div className="text-[10px] tracking-[2px] uppercase mb-1.5" style={{ color: ACCENT }}>
          Pathway hint
        </div>
        <div className="text-[13px] text-white/85 leading-relaxed">{protein.function}</div>
      </div>

      <div className="mt-5 text-[10.5px] text-white/35 leading-relaxed">
        Severity bars derive from the protein's primary OpenTargets disease score in the snapshot. A live Reactome traversal (upstream regulators, downstream effectors, pathway enrichment) is the Phase 5 deep-dive replacement; today the view scopes to the diseases linked to this organ in the cardiometabolic v1.0 set.
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-[9.5px] tracking-[2px] text-white/45 uppercase">{label}</div>
      <div className="text-[15px] text-white font-light tracking-wide mt-0.5 leading-tight">{value}</div>
      {hint && <div className="text-[9.5px] text-white/35 mt-0.5">{hint}</div>}
    </div>
  );
}
