import React, { useMemo } from 'react';
import { proteinMapper, type Protein } from '@/lib/protein-mapper';

/**
 * DarkProteomeDeepDive - Visualizes structural-confidence coverage for the
 * selected protein and its peers in the same organ.
 *
 * AlphaFold pLDDT bands (per the AlphaFold confidence guide):
 *   ≥ 90  Very high confidence  (bright)
 *   70-90 Confident               (bright)
 *   50-70 Low                     (mixed)
 *   < 50  Very low                (dark)
 *
 * The "dark proteome" framing surfaces proteins where structural prediction is
 * weak, which usually means intrinsic disorder, complex hetero-oligomers, or
 * regions only adopting structure on partner binding.
 */

interface Props {
  protein: Protein;
}

const BAND_COLORS = {
  bright: '#34d399',
  light:  '#a3e635',
  mixed:  '#facc15',
  dark:   '#f87171',
} as const;

function bandFor(plddt: number | null): { label: string; color: string; tag: string } {
  if (plddt == null) return { label: 'Unknown', color: 'rgba(255,255,255,0.30)', tag: 'No structure' };
  if (plddt >= 90)   return { label: 'Very high', color: BAND_COLORS.bright, tag: 'Bright' };
  if (plddt >= 70)   return { label: 'Confident', color: BAND_COLORS.light,  tag: 'Bright' };
  if (plddt >= 50)   return { label: 'Low',       color: BAND_COLORS.mixed,  tag: 'Mixed' };
  return                       { label: 'Very low',  color: BAND_COLORS.dark,   tag: 'Dark' };
}

export default function DarkProteomeDeepDive({ protein }: Props) {
  const peers = useMemo(() => {
    const organKey = proteinMapper.getOrganForProtein(protein);
    if (!organKey) return [protein];
    return proteinMapper.getProteinsByOrgan(organKey);
  }, [protein]);

  const sorted = useMemo(() => [...peers].sort((a, b) => (b.plddt ?? 0) - (a.plddt ?? 0)), [peers]);
  const band = bandFor(protein.plddt);
  const meanPeer = peers.filter((p) => p.plddt != null).reduce((s, p) => s + (p.plddt ?? 0), 0) /
                   Math.max(1, peers.filter((p) => p.plddt != null).length);

  return (
    <div className="text-white/85">
      <div className="text-[10px] tracking-[2.5px] font-medium uppercase" style={{ color: BAND_COLORS.bright }}>
        Dark Proteome and Gaps
      </div>
      <div className="text-[26px] tracking-wide font-light mt-1">{protein.gene}</div>
      <div className="text-[12px] text-white/45 mt-0.5">{protein.name} · {protein.uniprot}</div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat
          label="Mean pLDDT"
          value={protein.plddt != null ? protein.plddt.toFixed(1) : 'n/a'}
          tag={band.tag}
          tagColor={band.color}
        />
        <Stat label="Confidence band" value={band.label} hint="AlphaFold v6" />
        <Stat label="Peer mean" value={meanPeer.toFixed(1)} hint="proteins in same organ" />
      </div>

      <div className="mt-5 rounded-xl px-5 py-5"
           style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${BAND_COLORS.bright}24` }}>
        <div className="text-[10px] tracking-[2px] text-white/55 uppercase mb-3">Peer comparison</div>
        <div className="space-y-1.5">
          {sorted.map((p) => (
            <PeerRow key={p.gene} peer={p} isSelected={p.gene === protein.gene} />
          ))}
        </div>
      </div>

      <div className="mt-5 text-[10.5px] text-white/35 leading-relaxed">
        Bands follow the AlphaFold confidence guide. "Dark" indicates that structural prediction is unreliable for parts of the protein, often because of intrinsic disorder, complex hetero-oligomers, or context-dependent fold formation. These regions are candidates for cryo-EM, NMR, or partner-bound co-folding workflows.
      </div>
    </div>
  );
}

function PeerRow({ peer, isSelected }: { peer: Protein; isSelected: boolean }) {
  const band = bandFor(peer.plddt);
  const widthPct = peer.plddt != null ? Math.max(2, peer.plddt) : 2;
  const onClick = () => {
    if (isSelected) return;
    window.dispatchEvent(new CustomEvent('human-os:select-protein', { detail: { gene: peer.gene } }));
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 text-[12px] w-full text-left rounded-md px-1.5 py-0.5 -mx-1.5 transition ${isSelected ? 'cursor-default' : 'hover:bg-white/[0.04] cursor-pointer'}`}
      title={isSelected ? undefined : `Load ${peer.gene}`}
    >
      <div className={`w-16 truncate ${isSelected ? 'text-white font-medium' : 'text-white/55'}`}>
        {peer.gene}
      </div>
      <div className="flex-1 relative h-[6px] rounded-full overflow-hidden"
           style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${widthPct}%`,
            background: band.color,
            boxShadow: isSelected ? `0 0 10px ${band.color}` : 'none',
          }}
        />
      </div>
      <div className={`w-12 text-right font-mono ${isSelected ? 'text-white' : 'text-white/50'}`}>
        {peer.plddt != null ? peer.plddt.toFixed(1) : '—'}
      </div>
    </button>
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
