import React from 'react';

/**
 * GeneLink - Inline button that, when clicked, dispatches the global
 * `human-os:select-protein` event with the gene symbol. The HumanOS root
 * listens for this event and routes to setSelectedProtein, so any deep-dive
 * or peer panel can wrap a gene name with this and get a working "load this
 * protein" affordance without prop-drilling a callback.
 */

interface Props {
  gene: string;
  className?: string;
  /** Style preset. "subtle" inherits color, "pill" looks like a chip. */
  variant?: 'subtle' | 'pill';
  color?: string;
  children?: React.ReactNode;
}

export default function GeneLink({ gene, className = '', variant = 'subtle', color = '#2dd4bf', children }: Props) {
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('human-os:select-protein', { detail: { gene } }));
  };
  if (variant === 'pill') {
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] tracking-wide transition hover:translate-y-[-1px] ${className}`}
        style={{ background: `${color}14`, border: `1px solid ${color}40`, color }}
        title={`Load ${gene}`}
      >
        {children ?? gene}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`underline decoration-dotted decoration-current/40 underline-offset-2 hover:decoration-current/80 transition ${className}`}
      style={{ color: 'inherit' }}
      title={`Load ${gene}`}
    >
      {children ?? gene}
    </button>
  );
}
