import React, { useMemo, useState } from 'react';
import {
  getAllEnrichedProteins,
  type FunctionClass,
} from '@/lib/protein-classify';
import type { OrganKey } from '@/lib/protein-mapper';

/**
 * SankeyFlow - Small two-column flow diagram showing how protein function
 * classes distribute across organs in the snapshot. Left column nodes are
 * function classes; right column nodes are organs. Ribbon thickness encodes
 * the count of proteins in that (class × organ) cell.
 *
 * Hover a node on either side to highlight its outgoing/incoming ribbons.
 * Lives inside the Catalog view as a header summary; pure SVG, no D3.
 */

interface Props {
  height?: number;
}

const VIEW_W = 920;

export default function SankeyFlow({ height = 200 }: Props) {
  const all = useMemo(() => getAllEnrichedProteins(), []);
  const [hovered, setHovered] = useState<{ kind: 'class' | 'organ'; key: string } | null>(null);

  const classCounts = useMemo(() => {
    const m = new Map<FunctionClass, number>();
    for (const p of all) m.set(p.functionClass, (m.get(p.functionClass) ?? 0) + 1);
    return m;
  }, [all]);

  const organCounts = useMemo(() => {
    const m = new Map<OrganKey, number>();
    for (const p of all) m.set(p.organ, (m.get(p.organ) ?? 0) + 1);
    return m;
  }, [all]);

  const links = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of all) {
      const k = `${p.functionClass}::${p.organ}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([k, count]) => {
      const [cls, organ] = k.split('::') as [FunctionClass, OrganKey];
      return { cls, organ, count };
    });
  }, [all]);

  const total = all.length;
  const PAD = 14;
  const LEFT_X = 24;
  const RIGHT_X = VIEW_W - 24;
  const NODE_W = 8;
  const innerH = height - PAD * 2;

  // Build vertical layout: class nodes on left in declared order, organ nodes
  // on right in declared order. Each node's height is proportional to count.
  const classOrder = Array.from(classCounts.keys()).sort((a, b) =>
    (classCounts.get(b) ?? 0) - (classCounts.get(a) ?? 0));
  const organOrder = Array.from(organCounts.keys()).sort((a, b) =>
    (organCounts.get(b) ?? 0) - (organCounts.get(a) ?? 0));

  const classGap = 4;
  const organGap = 4;
  const classTotalGap = classGap * Math.max(0, classOrder.length - 1);
  const organTotalGap = organGap * Math.max(0, organOrder.length - 1);
  const classScale = (innerH - classTotalGap) / total;
  const organScale = (innerH - organTotalGap) / total;

  const classRects: Array<{ key: FunctionClass; y: number; h: number }> = [];
  let cursorY = PAD;
  for (const cls of classOrder) {
    const h = (classCounts.get(cls) ?? 0) * classScale;
    classRects.push({ key: cls, y: cursorY, h });
    cursorY += h + classGap;
  }

  const organRects: Array<{ key: OrganKey; y: number; h: number; color: string }> = [];
  cursorY = PAD;
  for (const organ of organOrder) {
    const h = (organCounts.get(organ) ?? 0) * organScale;
    const sample = all.find((p) => p.organ === organ);
    organRects.push({ key: organ, y: cursorY, h, color: sample?.organColor ?? '#94a3b8' });
    cursorY += h + organGap;
  }

  // For each link, compute ribbon endpoints by stacking within the source and
  // target nodes. Maintain per-node "fill cursors" so stacked ribbons line up.
  const classFill = new Map<FunctionClass, number>();
  const organFill = new Map<OrganKey, number>();
  // Sort links so the largest stack first (visually cleaner).
  const orderedLinks = [...links].sort((a, b) => b.count - a.count);

  return (
    <div className="rounded-xl px-5 py-4"
         style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(45, 212, 191, 0.15)' }}>
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] tracking-[2px] text-white/55 uppercase">Function class → organ</div>
        <div className="text-[10px] tracking-[1.5px] text-white/35 uppercase">
          {hovered ? `${hovered.kind === 'class' ? 'Function' : 'Organ'}: ${hovered.key}` : 'Hover a node to focus'}
        </div>
      </div>
      <svg viewBox={`0 0 ${VIEW_W} ${height}`} className="block w-full h-auto" style={{ maxHeight: height }}>
        {orderedLinks.map((link, i) => {
          const src = classRects.find((r) => r.key === link.cls);
          const dst = organRects.find((r) => r.key === link.organ);
          if (!src || !dst) return null;
          const srcRibbonH = link.count * classScale;
          const dstRibbonH = link.count * organScale;
          const srcY = src.y + (classFill.get(src.key) ?? 0);
          const dstY = dst.y + (organFill.get(dst.key) ?? 0);
          classFill.set(src.key, (classFill.get(src.key) ?? 0) + srcRibbonH);
          organFill.set(dst.key, (organFill.get(dst.key) ?? 0) + dstRibbonH);

          const x1 = LEFT_X + NODE_W;
          const x2 = RIGHT_X - NODE_W;
          const ctrl = (x2 - x1) * 0.5;
          const path = ribbonPath(x1, srcY, srcRibbonH, x2, dstY, dstRibbonH, ctrl);
          const isHighlighted =
            !hovered ||
            (hovered.kind === 'class' && hovered.key === link.cls) ||
            (hovered.kind === 'organ' && hovered.key === link.organ);

          return (
            <path
              key={i}
              d={path}
              fill={dst.color}
              fillOpacity={isHighlighted ? 0.45 : 0.07}
              stroke={dst.color}
              strokeOpacity={isHighlighted ? 0.55 : 0.05}
              strokeWidth={0.5}
              style={{ transition: 'all 0.2s' }}
            />
          );
        })}

        {classRects.map((r) => {
          const isHovered = hovered?.kind === 'class' && hovered.key === r.key;
          return (
            <g
              key={r.key}
              onMouseEnter={() => setHovered({ kind: 'class', key: r.key })}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={LEFT_X}
                y={r.y}
                width={NODE_W}
                height={Math.max(2, r.h)}
                rx={2}
                fill={isHovered ? '#5eead4' : 'rgba(255,255,255,0.55)'}
              />
              <text
                x={LEFT_X - 6}
                y={r.y + r.h / 2 + 3}
                fill={isHovered ? '#5eead4' : 'rgba(255,255,255,0.65)'}
                fontSize="9.5"
                letterSpacing="1"
                textAnchor="end"
                style={{ fontFamily: 'inherit' }}
              >
                {r.key} · {classCounts.get(r.key)}
              </text>
            </g>
          );
        })}

        {organRects.map((r) => {
          const isHovered = hovered?.kind === 'organ' && hovered.key === r.key;
          return (
            <g
              key={r.key}
              onMouseEnter={() => setHovered({ kind: 'organ', key: r.key })}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={RIGHT_X - NODE_W}
                y={r.y}
                width={NODE_W}
                height={Math.max(2, r.h)}
                rx={2}
                fill={isHovered ? '#ffffff' : r.color}
                opacity={isHovered ? 1 : 0.85}
              />
              <text
                x={RIGHT_X + 6}
                y={r.y + r.h / 2 + 3}
                fill={isHovered ? '#ffffff' : r.color}
                fontSize="9.5"
                letterSpacing="1"
                textAnchor="start"
                style={{ fontFamily: 'inherit', textTransform: 'capitalize' }}
              >
                {r.key} · {organCounts.get(r.key)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ribbonPath(x1: number, y1: number, h1: number, x2: number, y2: number, h2: number, ctrl: number): string {
  const x1r = x1;
  const x2l = x2;
  const cx1 = x1r + ctrl;
  const cx2 = x2l - ctrl;
  // Top edge
  const top = `M ${x1r} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2l} ${y2}`;
  // Right edge
  const right = `L ${x2l} ${y2 + h2}`;
  // Bottom edge (reverse curve)
  const bot = `C ${cx2} ${y2 + h2}, ${cx1} ${y1 + h1}, ${x1r} ${y1 + h1}`;
  // Left edge close
  const close = `Z`;
  return `${top} ${right} ${bot} ${close}`;
}
