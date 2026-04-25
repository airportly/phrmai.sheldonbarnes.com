import React, { useEffect, useRef, useState } from 'react';

/**
 * ConnectorLines - Dashed SVG paths from each context card to the body region
 * it represents. Pure decorative overlay; pointer-events disabled so it never
 * intercepts clicks. Paths recompute on resize.
 *
 * Card-to-region mapping is anatomical-ish, not literal: cards on the left
 * fan out to head / upper chest / abdomen / pelvis; cards on the right do the
 * same. The exact y fractions are tuned against the 540px-tall body canvas.
 */

type RegionKey = 'head' | 'upperChest' | 'midAbdomen' | 'pelvis';

const REGION_Y_FRACTION: Record<RegionKey, number> = {
  head:       0.16,
  upperChest: 0.36,
  midAbdomen: 0.58,
  pelvis:     0.78,
};

const CARD_TARGETS: Record<string, { side: 'left' | 'right'; region: RegionKey; color: string }> = {
  'MOLECULAR STRUCTURE': { side: 'left',  region: 'head',       color: '#10b981' },
  'PROTEIN BINDING':     { side: 'left',  region: 'upperChest', color: '#a78bfa' },
  'ADME PROFILE':        { side: 'left',  region: 'midAbdomen', color: '#22d3ee' },
  'TOXICITY':            { side: 'left',  region: 'pelvis',     color: '#f59e0b' },
  'SIGNALING PATHWAYS':  { side: 'right', region: 'head',       color: '#c084fc' },
  'PATIENT POPULATION':  { side: 'right', region: 'upperChest', color: '#facc15' },
  'DARK PROTEOME':       { side: 'right', region: 'midAbdomen', color: '#34d399' },
  'UNKNOWN UNKNOWNS':    { side: 'right', region: 'pelvis',     color: '#f87171' },
};

interface PathDef {
  id: string;
  d: string;
  color: string;
}

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** y range (in px) of the body canvas inside the grid container, relative to its top. */
  bodyYRange: { top: number; bottom: number };
}

export default function ConnectorLines({ containerRef, bodyYRange }: Props) {
  const [paths, setPaths] = useState<PathDef[]>([]);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const compute = () => {
      const el = containerRef.current;
      if (!el) return;
      const containerRect = el.getBoundingClientRect();
      setSize({ w: containerRect.width, h: containerRect.height });

      // Body canvas sits in the middle 1fr column, between two 240px columns
      // separated by gap-5 (20px). Derive its center x from the container.
      const sideColumn = 240;
      const gap = 20;
      const bodyCenterX = (containerRect.width + sideColumn + gap - sideColumn - gap) / 2;

      const cards = Array.from(el.querySelectorAll('[data-card-title]')) as HTMLElement[];
      const next: PathDef[] = [];

      cards.forEach((card) => {
        const title = card.dataset.cardTitle ?? '';
        const target = CARD_TARGETS[title];
        if (!target) return;
        const cardRect = card.getBoundingClientRect();
        const cardX = (target.side === 'left' ? cardRect.right : cardRect.left) - containerRect.left;
        const cardY = (cardRect.top + cardRect.bottom) / 2 - containerRect.top;
        const bodyHeightPx = bodyYRange.bottom - bodyYRange.top;
        const targetY = bodyYRange.top + REGION_Y_FRACTION[target.region] * bodyHeightPx;
        // Land slightly inside the body silhouette so the line reads as if it
        // anchors to a region rather than the centerline.
        const lateralBias = target.side === 'left' ? -38 : 38;
        const targetX = bodyCenterX + lateralBias;

        const dx = targetX - cardX;
        const cx1 = cardX + dx * 0.55;
        const cy1 = cardY;
        const cx2 = cardX + dx * 0.55;
        const cy2 = targetY;
        const d = `M ${cardX.toFixed(1)} ${cardY.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${targetX.toFixed(1)} ${targetY.toFixed(1)}`;
        next.push({ id: title, d, color: target.color });
      });

      setPaths(next);
    };

    compute();
    const el = containerRef.current;
    const ro = new ResizeObserver(compute);
    if (el) ro.observe(el);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [containerRef, bodyYRange.top, bodyYRange.bottom]);

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={size.w || '100%'}
      height={size.h || '100%'}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <filter id="connector-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {paths.map((p) => (
        <g key={p.id}>
          <path
            d={p.d}
            stroke={p.color}
            strokeWidth={1.0}
            strokeOpacity={0.35}
            strokeDasharray="3 5"
            fill="none"
            filter="url(#connector-glow)"
          />
          <circle cx={parseFloat(p.d.split(' ')[1])}    cy={parseFloat(p.d.split(' ')[2])} r={2} fill={p.color} opacity={0.6} />
          <circle cx={parseFloat(p.d.split(' ').slice(-2)[0])} cy={parseFloat(p.d.split(' ').slice(-2)[1])} r={2} fill={p.color} opacity={0.6} />
        </g>
      ))}
    </svg>
  );
}
