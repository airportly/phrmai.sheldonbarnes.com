import React, { useEffect, useMemo, useState } from 'react';
import type { Protein } from '@/lib/protein-mapper';
import {
  binVariants,
  findHotspotPositions,
  getVariantsForProtein,
  topVariantsByScore,
  type Bin,
  type Variant,
} from '@/lib/variant-analysis';

/**
 * VariantDeepDive - Residue-level pathogenic variant heatmap for the
 * Patient Population Variance card.
 *
 * Bins all AlphaMissense pathogenic variants for the selected protein into
 * ~60 windows along the residue axis. Bar height = count, bar color = max
 * pathogenicity score in the window. Hovering a bar surfaces the specific
 * top variants. Hotspot positions (3+ distinct substitutions) are highlighted.
 */

interface Props {
  protein: Protein;
}

export default function VariantDeepDive({ protein }: Props) {
  const variants = useMemo(() => getVariantsForProtein(protein.uniprot), [protein.uniprot]);

  if (variants.length === 0) {
    return <EmptyState protein={protein} />;
  }

  return <Heatmap protein={protein} variants={variants} />;
}

function Heatmap({ protein, variants }: { protein: Protein; variants: Variant[] }) {
  const [hoveredBin, setHoveredBin] = useState<number | null>(null);
  const [pinnedBin, setPinnedBin] = useState<number | null>(null);
  const [variantDetail, setVariantDetail] = useState<Variant | null>(null);
  const onSelectVariant = (v: Variant) => setVariantDetail(v);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (variantDetail) setVariantDetail(null);
        else if (pinnedBin !== null) setPinnedBin(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinnedBin, variantDetail]);
  const { bins, maxPosition } = useMemo(() => binVariants(variants, 60), [variants]);
  const hotspots = useMemo(() => findHotspotPositions(variants, 3).slice(0, 10), [variants]);
  const topVariants = useMemo(() => topVariantsByScore(variants, 10), [variants]);

  const maxCount = Math.max(...bins.map((b) => b.count));
  // The "active" bin: pin wins over hover. Lets you click a bar, then look
  // away — the variants below stay frozen so you can read them.
  const activeBin = pinnedBin ?? hoveredBin;

  return (
    <div className="text-white/85">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <div className="text-[10px] tracking-[2.5px] text-yellow-300/80 font-medium uppercase">Patient Population Variance</div>
          <div className="text-[26px] tracking-wide font-light mt-1">{protein.gene}</div>
          <div className="text-[12px] text-white/45 mt-0.5">{protein.name} · {protein.uniprot}</div>
        </div>
        <Stat label="Pathogenic variants" value={variants.length.toLocaleString()} accent={variants.length >= 500 ? '500+' : undefined} />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="Residue range" value={`1 to ${maxPosition}`} />
        <Stat label="Distinct hotspots" value={hotspots.length.toString()} hint="positions with 3+ pathogenic substitutions" />
        <Stat label="Peak score" value={Math.max(...variants.map((v) => v.s)).toFixed(3)} hint="AlphaMissense pathogenicity" />
      </div>

      <div className="rounded-xl px-5 py-5"
           style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(250, 204, 21, 0.18)' }}>
        <div className="flex items-end justify-between mb-2">
          <div className="text-[10px] tracking-[2px] text-white/55 uppercase">Variants by residue</div>
          <div className="flex items-center gap-3">
            <div className="text-[10px] tracking-[1.5px] text-white/45 uppercase">
              {activeBin !== null
                ? `Residue ${bins[activeBin].start} to ${bins[activeBin].end} · ${bins[activeBin].count} variants`
                : 'Hover · click to pin'}
            </div>
            {pinnedBin !== null && (
              <button
                onClick={() => setPinnedBin(null)}
                className="text-[9.5px] tracking-[1.5px] uppercase px-2 py-0.5 rounded-full transition"
                style={{
                  background: 'rgba(250, 204, 21, 0.15)',
                  border: '1px solid rgba(250, 204, 21, 0.45)',
                  color: '#fde68a',
                }}
                title="Unpin (or press Esc)"
              >
                ✕ Unpin
              </button>
            )}
          </div>
        </div>

        <div className="relative h-[200px] flex items-end gap-[2px]">
          {bins.map((bin, idx) => (
            <BinBar
              key={idx}
              bin={bin}
              maxCount={maxCount}
              isHovered={hoveredBin === idx}
              isPinned={pinnedBin === idx}
              onHover={(h) => setHoveredBin(h ? idx : null)}
              onClick={() => setPinnedBin((p) => (p === idx ? null : idx))}
            />
          ))}
        </div>

        <div className="flex justify-between mt-2 text-[9.5px] tracking-[1px] text-white/35 uppercase">
          <span>1</span>
          <span>residue position</span>
          <span>{maxPosition}</span>
        </div>

        {activeBin !== null && bins[activeBin].top.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {bins[activeBin].top.map((v) => (
              <VariantChip key={v.v} variant={v} onClick={() => onSelectVariant(v)} />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5 mt-5">
        <div>
          <div className="text-[10px] tracking-[2px] text-white/55 uppercase mb-2.5">Top hotspots</div>
          <div className="flex flex-wrap gap-1.5">
            {hotspots.length === 0 && <span className="text-[12px] text-white/35">No multi-variant hotspots</span>}
            {hotspots.map((pos) => (
              <button
                key={pos}
                onClick={() => {
                  // Pin the bar containing this hotspot.
                  const idx = bins.findIndex((b) => b.start <= pos && pos <= b.end);
                  if (idx >= 0) setPinnedBin(idx);
                }}
                className="px-2.5 py-1 rounded-full text-[11px] tracking-wide hover:bg-yellow-500/15 transition cursor-pointer"
                style={{
                  background: 'rgba(250, 204, 21, 0.10)',
                  border: '1px solid rgba(250, 204, 21, 0.35)',
                  color: '#fde68a',
                }}
                title={`Pin the bin containing residue ${pos}`}
              >
                Residue {pos}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] tracking-[2px] text-white/55 uppercase mb-2.5">Highest-scoring variants</div>
          <div className="flex flex-wrap gap-1.5">
            {topVariants.map((v) => (
              <VariantChip key={v.v} variant={v} compact onClick={() => onSelectVariant(v)} />
            ))}
          </div>
        </div>
      </div>

      {variantDetail && (
        <VariantDetailPopover
          variant={variantDetail}
          protein={protein}
          onClose={() => setVariantDetail(null)}
        />
      )}

      <div className="mt-5 text-[10.5px] text-white/35 leading-relaxed">
        Variants drawn from the AlphaMissense pathogenic class loaded into the cardiometabolic-research MCP server. Snapshot was capped at 500 variants per protein during data sync. Heatmap bins are computed at runtime; hotspot threshold is three or more distinct pathogenic substitutions at the same residue.
      </div>
    </div>
  );
}

function BinBar({ bin, maxCount, isHovered, isPinned, onHover, onClick }: { bin: Bin; maxCount: number; isHovered: boolean; isPinned: boolean; onHover: (h: boolean) => void; onClick: () => void }) {
  const heightPct = maxCount === 0 ? 0 : (bin.count / maxCount) * 100;
  const intensity = bin.maxScore;
  const color = intensity > 0.95 ? '#fbbf24'
    : intensity > 0.85 ? '#facc15'
    : intensity > 0.70 ? '#fde047'
    : intensity > 0    ? '#a3e635'
    : 'rgba(255,255,255,0.10)';
  const active = isPinned || isHovered;
  const opacity = active ? 1.0 : 0.85;
  return (
    <div
      className="flex-1 cursor-pointer transition-all relative"
      style={{
        height: `${heightPct}%`,
        minHeight: bin.count > 0 ? '2px' : '1px',
        background: color,
        opacity,
        boxShadow: isPinned ? `0 0 16px ${color}, 0 0 4px ${color}` : isHovered ? `0 0 12px ${color}` : 'none',
        outline: isPinned ? `1px solid ${color}` : 'none',
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onClick}
    >
      {isPinned && (
        <div
          className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full"
          style={{ width: 4, height: 4, background: color, boxShadow: `0 0 6px ${color}` }}
        />
      )}
    </div>
  );
}

function VariantChip({ variant, compact = false, onClick }: { variant: Variant; compact?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`text-left rounded-md px-2.5 py-1.5 transition ${onClick ? 'hover:bg-yellow-500/10 cursor-pointer' : 'cursor-default'}`}
      style={{ background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.20)' }}
    >
      <div className="font-mono text-[12px] text-yellow-100 leading-tight">{variant.v}</div>
      {!compact && <div className="text-[10px] text-white/45 mt-0.5">score {variant.s.toFixed(3)}</div>}
      {compact && <div className="text-[9.5px] text-white/40 mt-0.5">{variant.s.toFixed(3)}</div>}
    </button>
  );
}

function Stat({ label, value, hint, accent, tag }: { label: string; value: string; hint?: string; accent?: string; tag?: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-[9.5px] tracking-[2px] text-white/45 uppercase">{label}</div>
      <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
        <div className="text-[18px] text-white font-light tracking-wide">{value}</div>
        {accent && !tag && <div className="text-[10px] text-yellow-300/80 tracking-wide">{accent}</div>}
        {tag && <div className="text-[10px] tracking-wide" style={{ color: accent }}>{tag}</div>}
      </div>
      {hint && <div className="text-[9.5px] text-white/35 mt-0.5">{hint}</div>}
    </div>
  );
}

function VariantDetailPopover({ variant, protein, onClose }: { variant: Variant; protein: Protein; onClose: () => void }) {
  const ref = variant.v.match(/^([A-Z])(\d+)([A-Z])$/);
  const [, refAA, posStr, altAA] = ref ?? [, variant.v.charAt(0), '', variant.v.charAt(variant.v.length - 1)];
  const score = variant.s;
  const severity = score >= 0.95 ? 'Critical' : score >= 0.85 ? 'High' : score >= 0.70 ? 'Moderate' : 'Below moderate';
  const severityColor = score >= 0.95 ? '#fb7185' : score >= 0.85 ? '#fbbf24' : score >= 0.70 ? '#facc15' : '#a3e635';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6"
         style={{ background: 'rgba(7,11,32,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
         onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-2xl px-6 pt-6 pb-5"
        style={{
          background: 'linear-gradient(180deg, rgba(10, 14, 39, 0.96) 0%, rgba(7, 11, 32, 0.99) 100%)',
          border: `1px solid ${severityColor}55`,
          boxShadow: `0 30px 60px rgba(0,0,0,0.5), inset 0 0 60px ${severityColor}10`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 rounded-full w-7 h-7 flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10"
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="text-[10px] tracking-[2.5px] uppercase font-medium" style={{ color: severityColor }}>
          Pathogenic variant
        </div>
        <div className="font-mono text-[32px] text-yellow-100 mt-1 tracking-wide">{variant.v}</div>
        <div className="text-[12px] text-white/55 mt-1">{protein.gene} · {protein.uniprot}</div>

        <div className="grid grid-cols-2 gap-2.5 mt-5">
          <Stat label="Reference aa" value={refAA ?? '?'} />
          <Stat label="Alternate aa" value={altAA ?? '?'} />
          <Stat label="Position" value={variant.p.toString()} hint={`of ${posStr || 'unknown'} length`} />
          <Stat label="Pathogenicity" value={score.toFixed(3)} tag={severity} accent={severityColor} />
        </div>

        <div className="mt-4 rounded-lg p-3.5" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${severityColor}28` }}>
          <div className="text-[10px] tracking-[2px] text-white/55 uppercase mb-1.5">Interpretation</div>
          <div className="text-[12px] text-white/75 leading-relaxed">
            AlphaMissense classifies this {refAA ?? 'reference'}→{altAA ?? 'alt'} substitution at position {variant.p} as
            <span className="font-medium" style={{ color: severityColor }}> {severity.toLowerCase()} </span>
            pathogenicity. Higher scores correspond to predicted disruption of native function or fold stability.
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`https://www.uniprot.org/uniprotkb/${protein.uniprot}#sequences`}
            target="_blank" rel="noopener noreferrer"
            className="text-[11px] tracking-[1.5px] uppercase px-3 py-1.5 rounded-full transition"
            style={{ background: 'rgba(45, 212, 191, 0.10)', border: '1px solid rgba(45, 212, 191, 0.35)', color: '#5eead4' }}
          >
            UniProt sequence ↗
          </a>
          <a
            href={`https://alphafold.ebi.ac.uk/entry/${protein.uniprot}`}
            target="_blank" rel="noopener noreferrer"
            className="text-[11px] tracking-[1.5px] uppercase px-3 py-1.5 rounded-full transition"
            style={{ background: 'rgba(127, 119, 221, 0.10)', border: '1px solid rgba(127, 119, 221, 0.35)', color: '#a3a1ed' }}
          >
            AlphaFold view ↗
          </a>
        </div>

        <div className="mt-4 text-[10px] text-white/35 leading-relaxed">
          Per-residue context (domain assignment, structural neighborhood, ClinVar links) flows in once the live MCP path lands.
        </div>
      </div>
    </div>
  );
}

function EmptyState({ protein }: { protein: Protein }) {
  return (
    <div className="text-white/85">
      <div className="text-[10px] tracking-[2.5px] text-yellow-300/80 font-medium uppercase">Patient Population Variance</div>
      <div className="text-[24px] tracking-wide font-light mt-1">{protein.gene}</div>
      <div className="text-[12px] text-white/45 mt-1">{protein.name} · {protein.uniprot}</div>

      <div className="mt-5 rounded-xl p-5"
           style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(250, 204, 21, 0.15)' }}>
        <div className="text-[12px] text-white/60 leading-relaxed">
          Per-residue variant detail was not pre-loaded for this protein in the current snapshot. The summary card still shows the database-reported pathogenic counts and hotspot residues. Full residue-level fetch comes online when the live MCP path is wired up.
        </div>
        {protein.hotspots && protein.hotspots.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] tracking-[2px] text-white/45 uppercase mb-1.5">Reported hotspots</div>
            <div className="flex flex-wrap gap-1.5">
              {protein.hotspots.map((pos) => (
                <span key={pos}
                      className="px-2.5 py-1 rounded-full text-[11px] tracking-wide"
                      style={{
                        background: 'rgba(250, 204, 21, 0.10)',
                        border: '1px solid rgba(250, 204, 21, 0.35)',
                        color: '#fde68a',
                      }}>
                  Residue {pos}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
