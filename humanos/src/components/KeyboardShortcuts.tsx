import React, { useEffect, useState } from 'react';
import type { OrganKey } from '@/lib/protein-mapper';

/**
 * KeyboardShortcuts - Global key handler plus an overlay you summon with `?`.
 *
 * Bindings:
 *   1 brain · 2 heart · 3 liver · 4 pancreas · 5 kidneys
 *   Esc  clear filter / close
 *   ?    show this overlay
 *   Cmd+K / Ctrl+K / / open the command palette (handled by CommandPalette)
 *
 * Skips when an input is focused so typing in the chat doesn't navigate.
 */

interface Props {
  onSelectOrgan: (organ: OrganKey) => void;
  onClearFilter: () => void;
}

const ORGAN_KEYS: Array<{ key: string; organ: OrganKey }> = [
  { key: '1', organ: 'brain' },
  { key: '2', organ: 'heart' },
  { key: '3', organ: 'liver' },
  { key: '4', organ: 'pancreas' },
  { key: '5', organ: 'kidneys' },
];

export default function KeyboardShortcuts({ onSelectOrgan, onClearFilter }: Props) {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement | null)?.isContentEditable;
      if (inInput) return;

      const k = e.key.toLowerCase();
      const map = ORGAN_KEYS.find((m) => m.key === k);
      if (map) {
        e.preventDefault();
        onSelectOrgan(map.organ);
        return;
      }
      if (k === 'escape') {
        onClearFilter();
        setShowHelp(false);
        return;
      }
      if (k === '?' || (e.shiftKey && k === '/')) {
        e.preventDefault();
        setShowHelp((s) => !s);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSelectOrgan, onClearFilter]);

  if (!showHelp) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        background: 'rgba(7, 11, 32, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={() => setShowHelp(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl px-6 pt-5 pb-5"
        style={{
          background: 'linear-gradient(180deg, rgba(10, 14, 39, 0.95) 0%, rgba(7, 11, 32, 0.98) 100%)',
          border: '1px solid rgba(45, 212, 191, 0.30)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] tracking-[2.5px] text-cyan-300/70 uppercase">Keyboard shortcuts</div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-2 mt-4">
          <Row keys={['1','2','3','4','5']} label="Jump to organ" />
          <Row keys={['⌘', 'K']} label="Open search" />
          <Row keys={['/']} label="Open search" />
          <Row keys={['Esc']} label="Clear filter / close" />
          <Row keys={['?']} label="Show this help" />
        </div>
        <div className="mt-5 text-[10.5px] text-white/35 leading-relaxed">
          Shortcuts pause when you're typing in the chat or search input.
        </div>
      </div>
    </div>
  );
}

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {keys.map((k) => (
          <kbd key={k} className="text-[11px] tracking-[1px] uppercase text-white/70 px-1.5 py-0.5 rounded border border-white/15 bg-white/5">
            {k}
          </kbd>
        ))}
      </div>
      <span className="text-[12px] text-white/65">{label}</span>
    </div>
  );
}
