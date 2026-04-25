import React, { useMemo } from 'react';
import type { Protein } from '@/lib/protein-mapper';
import { getVariantsForProtein, topVariantsByScore } from '@/lib/variant-analysis';

/**
 * ToxicityDeepDive - Variant-burden view as a proxy for substitution
 * intolerance and on-target safety risk.
 *
 * The card itself surfaces a coarse "high burden / standard profile" tag.
 * The deep-dive splits the variants into score bands and surfaces the
 * highest-pathogenicity hits, which are the residues a pharmacologist would
 * want to avoid disturbing with on-target binding.
 *
 * Real ADR / FAERS integration is out of scope for v1. The mechanism notes
 * stored against each protein cover the drug class context.
 */

interface Props {
  protein: Protein;
}

const ACCENT = '#f59e0b';

export default function ToxicityDeepDive({ protein }: Props) {
  const variants = useMemo(() => getVariantsForProtein(protein.uniprot), [protein.uniprot]);
  const top = useMemo(() => topVariantsByScore(variants, 12), [variants]);

  // Bin variants by AlphaMissense score band.
  const bands = useMemo(() => {
    const out = { critical: 0, high: 0, moderate: 0, low: 0 };
    for (const v of variants) {
      if (v.s >= 0.95) out.critical += 1;
      else if (v.s >= 0.85) out.high += 1;
      else if (v.s >= 0.70) out.moderate += 1;
      else out.low += 1;
    }
    return out;
  }, [variants]);

  const total = variants.length;
  const burdenLabel = total >= 400 ? 'Very high' : total >= 200 ? 'High' : total >= 50 ? 'Moderate' : total > 0 ? 'Low' : 'Unknown';

  return (
    <div className="text-white/85">
      <div className="text-[10px] tracking-[2.5px] font-medium uppercase" style={{ color: ACCENT }}>
        Toxicity and Safety Signals
      </div>
      <div className="text-[26px] tracking-wide font-light mt-1">{protein.gene}</div>
      <div className="text-[12px] text-white/45 mt-0.5">{protein.name} · {protein.uniprot}</div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Variant burden" value={burdenLabel} tag={total >= 500 ? '500+' : total.toString()} tagColor={ACCENT} />
        <Stat label="High-pathogenicity" value={(bands.critical + bands.high).toString()} hint="score ≥ 0.85" />
        <Stat label="Critical residues" value={bands.critical.toString()} hint="score ≥ 0.95" />
      </div>

      {total > 0 && (
        <div className="mt-5 rounded-xl px-5 py-5"
             style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${ACCENT}24` }}>
          <div className="text-[10px] tracking-[2px] text-white/55 uppercase mb-3">Severity distribution</div>
          <div className="space-y-2">
            <BurdenRow label="Critical (≥0.95)" count={bands.critical} total={total} color="#fb7185" />
            <BurdenRow label="High (0.85 to 0.95)" count={bands.high} total={total} color="#fbbf24" />
            <BurdenRow label="Moderate (0.70 to 0.85)" count={bands.moderate} total={total} color="#facc15" />
            <BurdenRow label="Below moderate" count={bands.low} total={total} color="#a3e635" />
          </div>
        </div>
      )}

      {top.length > 0 && (
        <div className="mt-4 rounded-xl px-5 py-4"
             style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${ACCENT}1F` }}>
          <div className="text-[10px] tracking-[2px] text-white/55 uppercase mb-2.5">Highest-impact substitutions</div>
          <div className="grid grid-cols-3 gap-2">
            {top.map((v) => (
              <div key={v.v}
                   className="rounded-md px-2.5 py-1.5"
                   style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}28` }}>
                <div className="font-mono text-[12px] text-amber-100">{v.v}</div>
                <div className="text-[9.5px] text-white/45 mt-0.5">score {v.s.toFixed(3)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {protein.notes && (
        <div className="mt-4 rounded-xl px-5 py-4"
             style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${ACCENT}1F` }}>
          <div className="text-[10px] tracking-[2px] text-white/55 uppercase mb-1.5">Drug class context</div>
          <div className="text-[12.5px] text-white/80 leading-relaxed">{protein.notes}</div>
        </div>
      )}

      <div className="mt-5 text-[10.5px] text-white/35 leading-relaxed">
        AlphaMissense pathogenicity score is the substitution-intolerance proxy used here. Real adverse-event aggregation against FAERS or VigiBase, plus on-target liability heuristics, are downstream additions. Today the view treats variant density and severity bands as a first-pass risk surface.
      </div>
    </div>
  );
}

function BurdenRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : (count / total) * 100;
  return (
    <div className="flex items-center gap-3 text-[12px]">
      <div className="w-44 text-white/55 truncate">{label}</div>
      <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}55` }} />
      </div>
      <div className="w-10 text-right font-mono text-white/55">{count}</div>
    </div>
  );
}

function Stat({ label, value, tag, tagColor, hint }: { label: string; value: string; tag?: string; tagColor?: string; hint?: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-[9.5px] tracking-[2px] text-white/45 uppercase">{label}</div>
      <div className="flex items-baseline gap-2 mt-0.5">
        <div className="text-[18px] text-white font-light tracking-wide">{value}</div>
        {tag && <div className="text-[10px] tracking-wide" style={{ color: tagColor }}>{tag}</div>}
      </div>
      {hint && <div className="text-[9.5px] text-white/35 mt-0.5">{hint}</div>}
    </div>
  );
}
