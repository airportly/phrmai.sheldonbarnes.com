import React, { useMemo } from 'react';
import { proteinMapper, type OrganKey, type Protein } from '@/lib/protein-mapper';
import diseaseMetadata from '@/data/disease-metadata.json';

/**
 * DiseaseDeepDive - Cross-organ view for a single disease. Surfaces every
 * protein in the snapshot whose organ is associated with the chosen disease,
 * grouped by organ, sorted by association score.
 *
 * Useful for "show me the whole landscape" questions: which organs and which
 * proteins are implicated in coronary artery disease, atherosclerosis, etc.
 */

interface DiseaseRecord {
  label: string;
  shortLabel: string;
  efoId: string;
  color: string;
  primaryOrgan: string;
  description: string;
}

const DISEASES = (diseaseMetadata as { diseases: Record<string, DiseaseRecord> }).diseases;

interface Props {
  diseaseKey: string;
  onSelectProtein: (p: Protein) => void;
}

export default function DiseaseDeepDive({ diseaseKey, onSelectProtein }: Props) {
  const disease = DISEASES[diseaseKey];

  const grouped = useMemo(() => {
    if (!disease) return [];
    const out: Array<{ organ: OrganKey; organLabel: string; organColor: string; proteins: Protein[] }> = [];
    const organKeys: OrganKey[] = ['brain', 'heart', 'liver', 'pancreas', 'kidneys', 'adipose'];
    for (const organKey of organKeys) {
      const data = proteinMapper.getOrganData(organKey);
      if (!data) continue;
      const matches = data.diseases.filter((d) => d.toLowerCase() === disease.label.toLowerCase());
      if (matches.length === 0) continue;
      out.push({
        organ: organKey,
        organLabel: data.label,
        organColor: data.color,
        proteins: data.proteins.filter((p) => p.disease?.toLowerCase() === disease.label.toLowerCase() || data.diseases.length === 1),
      });
    }
    return out;
  }, [disease]);

  if (!disease) {
    return <div className="text-white/55 text-[12.5px]">Disease not in scope.</div>;
  }

  const totalProteins = grouped.reduce((s, g) => s + g.proteins.length, 0);

  return (
    <div className="text-white/85">
      <div className="text-[10px] tracking-[2.5px] font-medium uppercase" style={{ color: disease.color }}>
        Disease landscape
      </div>
      <div className="text-[26px] tracking-wide font-light mt-1">{disease.label}</div>
      <div className="text-[12px] text-white/45 mt-0.5">{disease.efoId} · primary organ {disease.primaryOrgan}</div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Organs implicated" value={grouped.length.toString()} />
        <Stat label="Proteins in scope" value={totalProteins.toString()} hint="snapshot subset" />
        <Stat label="EFO ID" value={disease.efoId} />
      </div>

      <div className="mt-5 rounded-xl px-5 py-5"
           style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${disease.color}24` }}>
        <div className="text-[10px] tracking-[2px] text-white/55 uppercase mb-2">About</div>
        <div className="text-[12.5px] text-white/75 leading-relaxed">{disease.description}</div>
      </div>

      {grouped.map((g) => (
        <div key={g.organ} className="mt-4 rounded-xl px-5 py-4"
             style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${g.organColor}28` }}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="rounded-full" style={{ width: 6, height: 6, background: g.organColor, boxShadow: `0 0 6px ${g.organColor}` }} />
              <div className="text-[11px] tracking-[2px] uppercase font-medium" style={{ color: g.organColor }}>{g.organLabel}</div>
            </div>
            <div className="text-[10px] text-white/35 tracking-[1px] uppercase">{g.proteins.length} proteins</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {g.proteins.sort((a, b) => b.score - a.score).map((p) => (
              <button
                key={p.gene}
                onClick={() => onSelectProtein(p)}
                className="text-left rounded-md px-3 py-2 transition hover:translate-x-[1px]"
                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${g.organColor}1F` }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-white text-[13px] font-medium tracking-wide">{p.gene}</span>
                  <span className="font-mono text-[10px] text-white/45">{p.score.toFixed(2)}</span>
                </div>
                <div className="text-[10.5px] text-white/50 mt-0.5 leading-tight line-clamp-2">{p.function.split('.')[0]}.</div>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-5 text-[10.5px] text-white/35 leading-relaxed">
        Click any protein to load it in the main interface. Cross-organ associations follow the snapshot mapping; the live MCP path will replace this with on-demand search_proteins_by_disease queries plus semantic-neighbor expansion.
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
