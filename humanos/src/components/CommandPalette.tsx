import React, { useEffect, useMemo, useRef, useState } from 'react';
import { proteinMapper, type Protein, type OrganKey } from '@/lib/protein-mapper';
import diseaseMetadata from '@/data/disease-metadata.json';

/**
 * CommandPalette - Cmd+K / Ctrl+K spotlight that searches across proteins,
 * organs, and diseases in one input. Selecting a protein loads it; selecting
 * an organ filters to that organ; selecting a disease surfaces it (currently
 * routes to the primary organ for that disease — the disease deep-dive comes
 * next).
 *
 * Keyboard:
 *   Cmd/Ctrl+K    open
 *   Esc           close
 *   ↑ / ↓         move highlight
 *   Enter         pick highlighted
 *   /             also opens (like a search shortcut)
 */

type SearchKind = 'protein' | 'organ' | 'disease';

interface SearchItem {
  kind: SearchKind;
  label: string;        // primary identifier shown in the row
  subtitle: string;     // contextual line under it
  keyword: string;      // searchable text (lowercase)
  color: string;
  onSelect: () => void;
}

interface Props {
  onSelectProtein: (p: Protein) => void;
  onSelectOrgan: (o: OrganKey) => void;
  onSelectDisease?: (key: string) => void;
}

interface DiseaseRecord {
  label: string;
  shortLabel: string;
  efoId: string;
  color: string;
  primaryOrgan: string;
  description: string;
}

const DISEASES = (diseaseMetadata as { diseases: Record<string, DiseaseRecord> }).diseases;

export default function CommandPalette({ onSelectProtein, onSelectOrgan, onSelectDisease }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (!open && e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (open && e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const items: SearchItem[] = useMemo(() => {
    const out: SearchItem[] = [];
    const organKeys: OrganKey[] = ['brain', 'heart', 'liver', 'pancreas', 'kidneys', 'adipose'];

    for (const organKey of organKeys) {
      const data = proteinMapper.getOrganData(organKey);
      if (!data) continue;
      out.push({
        kind: 'organ',
        label: data.label,
        subtitle: `${data.proteins.length} proteins · ${data.diseases.join(', ')}`,
        keyword: `${data.label} ${data.subtitle} ${data.diseases.join(' ')} ${organKey}`.toLowerCase(),
        color: data.color,
        onSelect: () => onSelectOrgan(organKey),
      });
      for (const p of data.proteins) {
        out.push({
          kind: 'protein',
          label: p.gene,
          subtitle: `${p.name} · ${data.label.toLowerCase()} · score ${p.score.toFixed(2)}`,
          keyword: `${p.gene} ${p.uniprot} ${p.name} ${p.function}`.toLowerCase(),
          color: data.color,
          onSelect: () => onSelectProtein(p),
        });
      }
    }

    for (const [key, d] of Object.entries(DISEASES)) {
      const organKey = d.primaryOrgan as OrganKey;
      out.push({
        kind: 'disease',
        label: d.label,
        subtitle: `${d.efoId} · primary organ ${d.primaryOrgan}`,
        keyword: `${d.label} ${d.shortLabel} ${d.efoId} ${d.description} ${key}`.toLowerCase(),
        color: d.color,
        onSelect: () => (onSelectDisease ? onSelectDisease(key) : onSelectOrgan(organKey)),
      });
    }

    return out;
  }, [onSelectProtein, onSelectOrgan, onSelectDisease]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    const scored = items
      .map((item) => {
        let score = 0;
        if (item.label.toLowerCase() === q) score += 100;
        if (item.label.toLowerCase().startsWith(q)) score += 40;
        if (item.keyword.includes(q)) score += 10;
        return { item, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 14)
      .map((s) => s.item);
    return scored;
  }, [items, query]);

  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(Math.max(0, filtered.length - 1));
  }, [filtered.length, highlight]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[highlight];
      if (item) {
        item.onSelect();
        setOpen(false);
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-6"
      style={{
        background: 'rgba(7, 11, 32, 0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(10, 14, 39, 0.96) 0%, rgba(7, 11, 32, 0.99) 100%)',
          border: '1px solid rgba(45, 212, 191, 0.30)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.55), inset 0 0 60px rgba(45,212,191,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-3 pb-2 border-b border-white/5 flex items-center gap-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(45,212,191,0.7)" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M16 16 L21 21" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search proteins, organs, diseases…"
            className="flex-1 bg-transparent text-white placeholder-white/35 outline-none text-[14px] tracking-wide py-1"
          />
          <kbd className="text-[9.5px] tracking-[1.5px] uppercase text-white/40 px-1.5 py-0.5 rounded border border-white/10">Esc</kbd>
        </div>
        <div className="max-h-[55vh] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-[12px] text-white/40">
              No matches in the cardiometabolic v1.0 scope.
            </div>
          )}
          {filtered.map((item, idx) => {
            const active = idx === highlight;
            return (
              <button
                key={`${item.kind}:${item.label}:${idx}`}
                onClick={() => { item.onSelect(); setOpen(false); }}
                onMouseMove={() => setHighlight(idx)}
                className="w-full text-left flex items-center gap-3 px-4 py-2 transition"
                style={{ background: active ? 'rgba(45, 212, 191, 0.10)' : 'transparent' }}
              >
                <KindBadge kind={item.kind} color={item.color} />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-[13px] font-medium tracking-wide truncate">{item.label}</div>
                  <div className="text-white/45 text-[10.5px] truncate">{item.subtitle}</div>
                </div>
                {active && (
                  <span className="text-[9.5px] tracking-[1.5px] text-cyan-300/70 uppercase">↵</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between text-[9.5px] tracking-[1.5px] uppercase text-white/35">
          <div className="flex items-center gap-3">
            <Hint k="↑↓" label="Navigate" />
            <Hint k="↵" label="Select" />
            <Hint k="Esc" label="Close" />
          </div>
          <div>{filtered.length} {filtered.length === 1 ? 'result' : 'results'}</div>
        </div>
      </div>
    </div>
  );
}

function KindBadge({ kind, color }: { kind: SearchKind; color: string }) {
  const letter = kind === 'protein' ? 'P' : kind === 'organ' ? 'O' : 'D';
  return (
    <div
      className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] tracking-wide font-semibold"
      style={{
        background: `${color}1A`,
        border: `1px solid ${color}55`,
        color,
      }}
    >
      {letter}
    </div>
  );
}

function Hint({ k, label }: { k: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="text-white/55 px-1.5 py-px rounded border border-white/10">{k}</kbd>
      <span>{label}</span>
    </span>
  );
}
