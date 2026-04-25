import React from 'react';
import type { Protein } from '@/lib/protein-mapper';

/**
 * ComplexityMeter - Horizontal bar showing the context complexity for the
 * selected protein. Combines structural confidence (pLDDT), disease
 * association score, and variant burden into a single 0 to 1 value.
 *
 * Empty state shows the meter at 0 with placeholder copy.
 */

interface Props {
  protein: Protein | null;
  value: number; // 0 to 1
}

const LEGEND: Array<{ label: string; color: string }> = [
  { label: 'Molecular',         color: '#10b981' },
  { label: 'Biological',        color: '#a78bfa' },
  { label: 'Safety',            color: '#f59e0b' },
  { label: 'Genomic',           color: '#facc15' },
  { label: 'Unknown',           color: '#f87171' },
  { label: 'Pharmacokinetic',   color: '#22d3ee' },
];

export default function ComplexityMeter({ protein, value }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));

  return (
    <div
      className="rounded-xl px-5 py-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
        border: '1px solid rgba(45, 212, 191, 0.15)',
        boxShadow: 'inset 0 0 30px rgba(45, 212, 191, 0.04)',
      }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[10px] tracking-[2.5px] text-white/55 font-medium">CONTEXT COMPLEXITY</div>
        <div
          className="text-[15px] font-light tracking-wider"
          style={{
            color: protein ? '#fbbf24' : 'rgba(255,255,255,0.25)',
            textShadow: protein ? '0 0 12px rgba(251,191,36,0.4)' : 'none',
          }}
        >
          {pct}%
        </div>
      </div>

      <div className="relative h-[6px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #2dd4bf 0%, #facc15 60%, #fbbf24 100%)',
            boxShadow: protein ? '0 0 16px rgba(251,191,36,0.5)' : 'none',
          }}
        />
        <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none"
             style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%)' }} />
      </div>

      <div className="flex items-center justify-between mt-3 flex-wrap gap-x-4 gap-y-1">
        {LEGEND.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className="rounded-full"
              style={{
                width: '5px',
                height: '5px',
                background: item.color,
                boxShadow: `0 0 4px ${item.color}80`,
              }}
            />
            <span className="text-[9.5px] tracking-[1px] text-white/45 uppercase">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
