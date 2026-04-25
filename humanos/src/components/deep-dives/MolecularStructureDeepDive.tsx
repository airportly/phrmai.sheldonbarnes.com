import React, { useMemo } from 'react';
import type { Protein } from '@/lib/protein-mapper';
import { getVariantsForProtein, type Variant } from '@/lib/variant-analysis';
import structureConfidence from '@/data/structure-confidence.json';

/**
 * MolecularStructureDeepDive - Surfaces structural confidence for the
 * selected protein and overlays variant density.
 *
 * Three layers of data:
 *   1. AlphaFold v6 mean pLDDT and confidence-band fractions, snapshotted
 *      per protein from get_structure_confidence on the MCP server.
 *   2. Inferred residue length from the variant position max.
 *   3. Pathogenic variant density along the residue axis from AlphaMissense.
 *
 * Phase 5+ replaces this with a real ribbon viewer (NGL or Mol*) once the
 * structure files flow through the live MCP path.
 */

interface Props {
  protein: Protein;
}

interface ConfidenceRecord {
  alphafoldId: string;
  meanPlddt: number;
  band: string;
  veryHigh: number;
  confident: number;
  low: number;
  veryLow: number;
  disorderedEstimate: number;
}

const CONFIDENCE_DATA = (structureConfidence as { data: Record<string, ConfidenceRecord> }).data;

const BAND_COLOR = {
  veryHigh:  '#34d399',
  confident: '#a3e635',
  low:       '#facc15',
  veryLow:   '#f87171',
};

function bandLabel(band: string): { label: string; color: string } {
  switch (band) {
    case 'very high': return { label: 'Very high confidence', color: BAND_COLOR.veryHigh };
    case 'confident': return { label: 'Confident fold',       color: BAND_COLOR.confident };
    case 'low':       return { label: 'Low confidence',       color: BAND_COLOR.low };
    case 'very low':  return { label: 'Very low confidence',  color: BAND_COLOR.veryLow };
    default:          return { label: 'Unknown',              color: 'rgba(255,255,255,0.30)' };
  }
}

const ACCENT = '#10b981';

export default function MolecularStructureDeepDive({ protein }: Props) {
  const variants = useMemo(() => getVariantsForProtein(protein.uniprot), [protein.uniprot]);
  const confidence = CONFIDENCE_DATA[protein.uniprot];
  const length = useMemo(() => {
    if (variants.length > 0) return Math.max(...variants.map((v) => v.p));
    if (protein.hotspots && protein.hotspots.length > 0) return Math.max(...protein.hotspots);
    return null;
  }, [variants, protein.hotspots]);

  const band = confidence
    ? bandLabel(confidence.band)
    : (protein.plddt != null
        ? bandLabel(protein.plddt >= 90 ? 'very high' : protein.plddt >= 70 ? 'confident' : protein.plddt >= 50 ? 'low' : 'very low')
        : { label: 'No structure loaded', color: 'rgba(255,255,255,0.30)' });

  return (
    <div className="text-white/85">
      <div className="text-[10px] tracking-[2.5px] font-medium uppercase" style={{ color: ACCENT }}>
        Molecular Structure
      </div>
      <div className="text-[26px] tracking-wide font-light mt-1">{protein.gene}</div>
      <div className="text-[12px] text-white/45 mt-0.5">
        {protein.name} · {protein.uniprot}
        {confidence && <span className="ml-2 font-mono text-white/35">{confidence.alphafoldId}</span>}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Mean pLDDT" value={(confidence?.meanPlddt ?? protein.plddt ?? 0).toFixed(1)}
              tag={band.label} tagColor={band.color} />
        <Stat label="Residue length" value={length != null ? length.toString() : 'unknown'}
              hint={length != null ? 'inferred from variant positions' : 'no variants in snapshot'} />
        <Stat label="Disorder estimate"
              value={confidence ? `${Math.round(confidence.disorderedEstimate * 100)}%` : '—'}
              hint={confidence ? 'fraction in low + very-low bands' : 'no AlphaFold prediction'} />
      </div>

      {confidence && (
        <div className="mt-5 rounded-xl px-5 py-5"
             style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${ACCENT}24` }}>
          <div className="text-[10px] tracking-[2px] text-white/55 uppercase mb-3">Confidence band distribution</div>
          <BandStack confidence={confidence} />
          <div className="grid grid-cols-4 gap-2 mt-3">
            <BandLegend label="Very high" pct={confidence.veryHigh}  color={BAND_COLOR.veryHigh}  hint="pLDDT ≥ 90" />
            <BandLegend label="Confident" pct={confidence.confident} color={BAND_COLOR.confident} hint="70 to 90" />
            <BandLegend label="Low"       pct={confidence.low}       color={BAND_COLOR.low}       hint="50 to 70" />
            <BandLegend label="Very low"  pct={confidence.veryLow}   color={BAND_COLOR.veryLow}   hint="< 50" />
          </div>
        </div>
      )}

      <div className="mt-5 rounded-xl px-5 py-5"
           style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${ACCENT}24` }}>
        <div className="text-[10px] tracking-[2px] text-white/55 uppercase mb-2.5">Variant density along residue axis</div>
        <ResidueRibbon length={length ?? 0} variants={variants} accent={ACCENT} />
        <div className="flex justify-between mt-2 text-[9.5px] tracking-[1px] text-white/35 uppercase">
          <span>residue 1</span>
          <span>{length != null ? `residue ${length}` : 'length unknown'}</span>
        </div>
      </div>

      {protein.notes && (
        <div className="mt-4 rounded-xl px-5 py-4"
             style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${band.color}28` }}>
          <div className="text-[10px] tracking-[2px] text-white/55 uppercase mb-2">Mechanism note</div>
          <div className="text-[12.5px] text-white/80 leading-relaxed">{protein.notes}</div>
        </div>
      )}

      <div className="mt-5 text-[10.5px] text-white/35 leading-relaxed">
        Confidence bands follow the AlphaFold pLDDT guide. The disorder estimate is the share of residues at pLDDT below 70 — a useful signal for proteins where parts of the sequence are predicted to be intrinsically disordered. A real ribbon viewer (NGL or Mol*) replaces the variant-density strip in a future phase, once structure files flow through a live MCP endpoint.
      </div>
    </div>
  );
}

function BandStack({ confidence }: { confidence: ConfidenceRecord }) {
  const segments = [
    { width: confidence.veryHigh,  color: BAND_COLOR.veryHigh },
    { width: confidence.confident, color: BAND_COLOR.confident },
    { width: confidence.low,       color: BAND_COLOR.low },
    { width: confidence.veryLow,   color: BAND_COLOR.veryLow },
  ];
  return (
    <div className="relative h-[14px] rounded-full overflow-hidden flex"
         style={{ background: 'rgba(255,255,255,0.05)' }}>
      {segments.map((s, i) => (
        <div
          key={i}
          style={{
            width: `${s.width * 100}%`,
            background: s.color,
            boxShadow: `inset 0 0 8px ${s.color}99`,
          }}
        />
      ))}
    </div>
  );
}

function BandLegend({ label, pct, color, hint }: { label: string; pct: number; color: string; hint: string }) {
  return (
    <div className="rounded-md px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22` }}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="rounded-full" style={{ width: 5, height: 5, background: color, boxShadow: `0 0 4px ${color}` }} />
        <span className="text-[9.5px] tracking-[1.5px] uppercase" style={{ color }}>{label}</span>
      </div>
      <div className="text-[14px] text-white font-light tracking-wide">{Math.round(pct * 100)}%</div>
      <div className="text-[9.5px] text-white/35">{hint}</div>
    </div>
  );
}

function ResidueRibbon({ length, variants, accent }: { length: number; variants: Variant[]; accent: string }) {
  if (length === 0 || variants.length === 0) {
    return (
      <div className="relative h-[36px] rounded-md flex items-center justify-center text-[11px] text-white/40 italic"
           style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${accent}1F` }}>
        Variant data not pre-loaded for this protein
      </div>
    );
  }

  const bins = 100;
  const counts = new Array<number>(bins).fill(0);
  const maxScore = new Array<number>(bins).fill(0);
  for (const v of variants) {
    const idx = Math.min(bins - 1, Math.floor(((v.p - 1) / length) * bins));
    counts[idx] += 1;
    if (v.s > maxScore[idx]) maxScore[idx] = v.s;
  }
  const maxCount = Math.max(...counts, 1);

  return (
    <div className="relative h-[44px] rounded-md overflow-hidden"
         style={{ background: 'rgba(45,212,191,0.04)', border: `1px solid ${accent}28` }}>
      <div className="absolute inset-0 flex items-stretch">
        {counts.map((c, i) => {
          const heightPct = (c / maxCount) * 100;
          const score = maxScore[i];
          const color = score > 0.95 ? '#fb7185'
            : score > 0.85 ? '#fbbf24'
            : score > 0.70 ? '#facc15'
            : score > 0    ? '#a3e635'
            : 'transparent';
          return (
            <div key={i} className="flex-1 flex items-end">
              <div style={{ width: '100%', height: `${heightPct}%`, background: color, opacity: 0.85 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tag, tagColor, hint }: { label: string; value: string; tag?: string; tagColor?: string; hint?: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-[9.5px] tracking-[2px] text-white/45 uppercase">{label}</div>
      <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
        <div className="text-[18px] text-white font-light tracking-wide">{value}</div>
        {tag && <div className="text-[9.5px] tracking-wide" style={{ color: tagColor }}>{tag}</div>}
      </div>
      {hint && <div className="text-[9.5px] text-white/35 mt-0.5">{hint}</div>}
    </div>
  );
}
