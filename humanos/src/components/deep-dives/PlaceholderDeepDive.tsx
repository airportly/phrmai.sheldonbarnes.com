import React from 'react';
import type { Protein } from '@/lib/protein-mapper';

/**
 * PlaceholderDeepDive - "Coming soon" stub for context cards whose
 * deep-dive views are not yet built. Keeps the click affordance honest:
 * every card opens something, even if that something acknowledges the gap.
 */

interface Props {
  cardTitle: string;
  protein: Protein | null;
  description: string;
  comingIn: string;
  accentColor: string;
}

export default function PlaceholderDeepDive({ cardTitle, protein, description, comingIn, accentColor }: Props) {
  return (
    <div className="text-white/85">
      <div className="text-[10px] tracking-[2.5px] font-medium uppercase" style={{ color: accentColor }}>{cardTitle}</div>
      <div className="text-[24px] tracking-wide font-light mt-1">
        {protein ? protein.gene : 'No protein selected'}
      </div>
      {protein && (
        <div className="text-[12px] text-white/45 mt-1">{protein.name} · {protein.uniprot}</div>
      )}

      <div className="mt-5 rounded-xl p-5"
           style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${accentColor}33` }}>
        <div className="text-[12px] text-white/65 leading-relaxed">{description}</div>
        <div className="mt-4 flex items-center gap-2">
          <span
            className="rounded-full"
            style={{
              width: '5px',
              height: '5px',
              background: accentColor,
              boxShadow: `0 0 6px ${accentColor}`,
            }}
          />
          <span className="text-[10px] tracking-[1.5px] uppercase" style={{ color: accentColor }}>
            {comingIn}
          </span>
        </div>
      </div>
    </div>
  );
}
