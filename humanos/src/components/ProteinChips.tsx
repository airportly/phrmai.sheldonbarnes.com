import React, { useMemo, useState } from 'react';
import { proteinMapper, type Protein, type OrganKey } from '@/lib/protein-mapper';

/**
 * ProteinChips - Strip showing proteins in the active organ. With the full
 * 1,903-protein snapshot, an organ may hold hundreds of associations, so the
 * strip caps at 16 chips by default and offers a "+ N more" expansion plus an
 * inline filter to find a specific gene without leaving the body view.
 *
 * Hidden when no organ is active.
 */

interface Props {
  organ: OrganKey | null;
  selected: Protein | null;
  onSelect: (protein: Protein) => void;
}

const DEFAULT_VISIBLE = 16;

export default function ProteinChips({ organ, selected, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');

  // Reset chip state whenever the active organ changes.
  React.useEffect(() => {
    setExpanded(false);
    setQuery('');
  }, [organ]);

  const data = organ ? proteinMapper.getOrganData(organ) : null;
  const proteins = data?.proteins ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return proteins;
    return proteins.filter((p) =>
      p.gene.toLowerCase().includes(q) ||
      p.uniprot.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q),
    );
  }, [proteins, query]);

  if (!organ || !data || proteins.length === 0) return null;

  const accent = data.color;
  const visible = expanded || query ? filtered : filtered.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = filtered.length - visible.length;

  return (
    <div className="mt-3 w-full">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="text-[9.5px] tracking-[2px] text-white/40 uppercase">
          {filtered.length === proteins.length
            ? `${proteins.length} proteins in ${data.label.toLowerCase()}`
            : `${filtered.length} of ${proteins.length} match in ${data.label.toLowerCase()}`}
        </div>
        {proteins.length > DEFAULT_VISIBLE && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter genes…"
            className="bg-white/5 border border-white/10 text-white placeholder-white/30 text-[10.5px] tracking-wide outline-none focus:border-cyan-500/40 rounded-full px-3 py-0.5 w-[140px]"
          />
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {visible.map((p) => {
          const active = selected?.gene === p.gene;
          return (
            <button
              key={p.gene}
              onClick={() => onSelect(p)}
              className="rounded-full px-2.5 py-1 text-[11px] tracking-[1px] transition-all"
              style={{
                background: active ? `${accent}22` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? accent : 'rgba(255,255,255,0.10)'}`,
                color: active ? accent : 'rgba(255,255,255,0.70)',
                boxShadow: active ? `0 0 8px ${accent}55` : 'none',
              }}
              title={`${p.name} · score ${p.score.toFixed(2)}${p.plddt != null ? ` · pLDDT ${p.plddt.toFixed(1)}` : ''}`}
            >
              <span className="font-medium">{p.gene}</span>
              <span className="ml-1.5 opacity-50 text-[9.5px] font-mono">{p.score.toFixed(2)}</span>
            </button>
          );
        })}
        {hiddenCount > 0 && !query && (
          <button
            onClick={() => setExpanded(true)}
            className="rounded-full px-2.5 py-1 text-[10.5px] tracking-[1px] uppercase transition"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px dashed rgba(255,255,255,0.20)',
              color: 'rgba(255,255,255,0.55)',
            }}
            title="Show all proteins"
          >
            + {hiddenCount} more
          </button>
        )}
        {expanded && filtered.length === proteins.length && (
          <button
            onClick={() => setExpanded(false)}
            className="rounded-full px-2.5 py-1 text-[10.5px] tracking-[1px] uppercase transition text-white/45 hover:text-white/80"
          >
            Collapse
          </button>
        )}
        {filtered.length === 0 && (
          <span className="text-[11px] text-white/35 italic px-2 py-1">No matches</span>
        )}
      </div>
    </div>
  );
}
