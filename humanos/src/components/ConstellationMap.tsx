import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Protein } from '@/lib/protein-mapper';
import {
  getAllEnrichedProteins,
  type EnrichedProtein,
  type FunctionClass,
  type GeneFamily,
  type PlddtBand,
  type VariantBurdenBand,
} from '@/lib/protein-classify';

/**
 * ConstellationMap - Star-field view of every protein in the snapshot.
 *
 * Visual encoding (every channel maps to real data):
 *   - Cluster center        function class (Ion channel, Receptor, Enzyme, …)
 *   - Star color            organ
 *   - Star radius           OpenTargets association score
 *   - Glow intensity        AlphaFold pLDDT band (Very high → bright; Very low → dim)
 *   - Pulse cadence         AlphaMissense variant burden (High → fast; None → still)
 *   - Cyan halo ring        drug-target status (any noted drug, target keyword, etc.)
 *   - Curved bundled lines  shared gene family (KCN*, APO*, F*, HNF*, SCN*)
 *
 * Interaction:
 *   - Hover a star: it brightens, family lines highlight, the rest of the
 *     constellation dims to ~15 % so the local context stands out.
 *   - Click a star: dispatches `human-os:select-protein` so the eight context
 *     cards refresh exactly like clicking an organ or a catalog row.
 */

interface Props {
  selectedProtein: Protein | null;
}

const DEFAULT_TOP_N = 200;

interface Positioned extends EnrichedProtein {
  x: number;
  y: number;
}

type FamilyLink = { from: Positioned; to: Positioned };

const VIEW_W = 1000;
const VIEW_H = 680;

// Hand-placed cluster centers tuned to keep the layout balanced and to give
// the largest function-class clusters more room. The 9 classes fall into a
// loose 3x3 grid biased toward the upper half (where the title and stats sit).
const CLASS_CENTERS: Record<FunctionClass, { x: number; y: number; angleStart: number }> = {
  'Ion channel':           { x: 220, y: 200, angleStart: -Math.PI / 2 },
  'Receptor':              { x: 500, y: 170, angleStart: -Math.PI / 2 },
  'Kinase':                { x: 800, y: 200, angleStart: -Math.PI / 2 },
  'Apolipoprotein':        { x: 170, y: 410, angleStart:  Math.PI },
  'Enzyme':                { x: 500, y: 380, angleStart: -Math.PI / 4 },
  'Transcription factor':  { x: 830, y: 410, angleStart:  0 },
  'Coagulation':           { x: 240, y: 590, angleStart:  Math.PI / 2 },
  'Transporter':           { x: 770, y: 580, angleStart:  Math.PI / 2 },
  'Other':                 { x: 500, y: 600, angleStart:  Math.PI / 2 },
};

const PLDDT_GLOW: Record<PlddtBand, { core: string; halo: string; haloOpacity: number; coreOpacity: number }> = {
  'Very high':    { core: '#dffaf6', halo: '#2dd4bf', haloOpacity: 0.55, coreOpacity: 1.0 },
  'Confident':    { core: '#cfeec5', halo: '#a3e635', haloOpacity: 0.40, coreOpacity: 0.95 },
  'Low':          { core: '#fde68a', halo: '#facc15', haloOpacity: 0.30, coreOpacity: 0.85 },
  'Very low':     { core: '#fecaca', halo: '#f87171', haloOpacity: 0.25, coreOpacity: 0.75 },
  'No structure': { core: '#cbd5e1', halo: '#64748b', haloOpacity: 0.15, coreOpacity: 0.60 },
};

const PULSE_DURATION: Record<VariantBurdenBand, number> = {
  'High burden': 1.1,
  'Moderate':    1.6,
  'Low':         2.4,
  'No data':     0,
};

export default function ConstellationMap({ selectedProtein }: Props) {
  const all = useMemo(() => getAllEnrichedProteins(), []);
  const [hovered, setHovered] = useState<string | null>(null);
  const [familyFilter, setFamilyFilter] = useState<GeneFamily | null>(null);
  const [topN, setTopN] = useState(Math.min(DEFAULT_TOP_N, all.length));
  const [isMobile, setIsMobile] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // viewBox state for zoom + pan. The SVG's intrinsic coordinate system is
  // VIEW_W x VIEW_H; we shrink the viewBox to zoom in and translate it to pan.
  // Min zoom is 1.0 (full view); max is 6x.
  const [view, setView] = useState({ x: 0, y: 0, w: VIEW_W, h: VIEW_H });
  const dragRef = useRef<{ startX: number; startY: number; vx: number; vy: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const ZOOM_MIN = 1;
  const ZOOM_MAX = 6;
  const zoom = VIEW_W / view.w;

  function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

  function applyZoom(factor: number, clientX?: number, clientY?: number) {
    setView((v) => {
      const newZoom = clamp((VIEW_W / v.w) * factor, ZOOM_MIN, ZOOM_MAX);
      const newW = VIEW_W / newZoom;
      const newH = VIEW_H / newZoom;
      let anchor = { x: v.x + v.w / 2, y: v.y + v.h / 2 };
      if (clientX != null && clientY != null && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const fx = (clientX - rect.left) / rect.width;
        const fy = (clientY - rect.top) / rect.height;
        anchor = { x: v.x + fx * v.w, y: v.y + fy * v.h };
      }
      // Keep anchor under the same screen position after the zoom.
      const fx = (anchor.x - v.x) / v.w;
      const fy = (anchor.y - v.y) / v.h;
      const newX = anchor.x - fx * newW;
      const newY = anchor.y - fy * newH;
      return {
        x: clamp(newX, -newW * 0.25, VIEW_W - newW * 0.75),
        y: clamp(newY, -newH * 0.25, VIEW_H - newH * 0.75),
        w: newW,
        h: newH,
      };
    });
  }

  function resetView() { setView({ x: 0, y: 0, w: VIEW_W, h: VIEW_H }); }

  // Native wheel listener so we can preventDefault (React's onWheel is passive
  // in modern browsers, so calling preventDefault from there has no effect and
  // page-scroll fights the zoom).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      applyZoom(factor, e.clientX, e.clientY);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
    // applyZoom closes over `view` via setView callback form, no dep needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    // Only start a pan when the user grabs empty space — clicks on stars
    // should still select. We detect this by checking if the target is the
    // SVG itself or a non-interactive layer.
    const target = e.target as Element;
    if (target.closest('[data-star="1"]')) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, vx: view.x, vy: view.y };
    setIsDragging(true);
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = dragRef.current;
    if (!d || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dxClient = e.clientX - d.startX;
    const dyClient = e.clientY - d.startY;
    const dxSvg = (dxClient / rect.width) * view.w;
    const dySvg = (dyClient / rect.height) * view.h;
    setView((v) => ({
      ...v,
      x: clamp(d.vx - dxSvg, -v.w * 0.25, VIEW_W - v.w * 0.75),
      y: clamp(d.vy - dySvg, -v.h * 0.25, VIEW_H - v.h * 0.75),
    }));
  }
  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    dragRef.current = null;
    setIsDragging(false);
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* no-op */ }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => {
      setIsMobile(mq.matches);
      setShowControls(!mq.matches);
      if (mq.matches) setTopN((n) => Math.min(n, 80));
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Always include the currently selected protein, even if it falls below the
  // top-N cutoff. Otherwise it'd vanish when you slide the cap down.
  const visibleProteins = useMemo(() => {
    const sorted = [...all].sort((a, b) => b.score - a.score);
    const top = sorted.slice(0, topN);
    if (selectedProtein && !top.some((p) => p.gene === selectedProtein.gene)) {
      const sel = sorted.find((p) => p.gene === selectedProtein.gene);
      if (sel) top.push(sel);
    }
    return top;
  }, [all, topN, selectedProtein]);

  // Layout: arrange proteins in concentric rings around their function-class
  // center, sorted by score (top by score sits in the middle of the cluster).
  const positioned = useMemo<Positioned[]>(() => {
    const grouped = new Map<FunctionClass, EnrichedProtein[]>();
    for (const p of visibleProteins) {
      const arr = grouped.get(p.functionClass) ?? [];
      arr.push(p);
      grouped.set(p.functionClass, arr);
    }
    const out: Positioned[] = [];
    for (const [cls, members] of grouped.entries()) {
      const center = CLASS_CENTERS[cls];
      const sorted = [...members].sort((a, b) => b.score - a.score);
      // Adaptive ring sizing: more proteins per ring as count grows so dense
      // clusters don't sprawl across the canvas.
      const perRing = sorted.length <= 7 ? 6 : sorted.length <= 30 ? 12 : 22;
      const ringStep = sorted.length <= 30 ? 32 : 22;
      sorted.forEach((p, i) => {
        if (i === 0) {
          out.push({ ...p, x: center.x, y: center.y });
          return;
        }
        const ring = Math.ceil(i / perRing);
        const idxInRing = i - (1 + perRing * (ring - 1));
        const inRing = Math.min(perRing, sorted.length - (1 + perRing * (ring - 1)));
        const radius = ring * ringStep + 14;
        const angleStep = (Math.PI * 2) / Math.max(inRing, 1);
        const angle = center.angleStart + idxInRing * angleStep + ring * 0.18;
        out.push({
          ...p,
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        });
      });
    }
    return out;
  }, [visibleProteins]);

  const familyLinks = useMemo<FamilyLink[]>(() => {
    const byFam = new Map<GeneFamily, Positioned[]>();
    for (const p of positioned) {
      if (p.geneFamily === 'Other') continue;
      const arr = byFam.get(p.geneFamily) ?? [];
      arr.push(p);
      byFam.set(p.geneFamily, arr);
    }
    const links: FamilyLink[] = [];
    for (const members of byFam.values()) {
      if (members.length < 2) continue;
      // Build a rough minimum-spanning chain by sorting by x then y so lines
      // don't crisscross too much. Connect each to the next.
      const sorted = [...members].sort((a, b) => a.x - b.x || a.y - b.y);
      for (let i = 0; i < sorted.length - 1; i++) {
        links.push({ from: sorted[i], to: sorted[i + 1] });
      }
    }
    return links;
  }, [positioned]);

  const families = useMemo<GeneFamily[]>(() => {
    const set = new Set<GeneFamily>();
    for (const p of positioned) if (p.geneFamily !== 'Other') set.add(p.geneFamily);
    return Array.from(set);
  }, [positioned]);

  const activeFamily: GeneFamily | null = useMemo(() => {
    if (familyFilter) return familyFilter;
    if (hovered) {
      const h = positioned.find((p) => p.gene === hovered);
      if (h && h.geneFamily !== 'Other') return h.geneFamily;
    }
    return null;
  }, [hovered, familyFilter, positioned]);

  return (
    <div ref={containerRef} className="w-full text-white/85">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between mb-3 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[10px] tracking-[2.5px] text-cyan-300/70 font-medium uppercase">Constellation</div>
            <button
              onClick={() => setShowControls((s) => !s)}
              className="sm:hidden ml-auto rounded-full px-2.5 py-0.5 text-[10px] tracking-[1px] transition"
              style={{
                background: showControls ? 'rgba(45, 212, 191, 0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${showControls ? 'rgba(45, 212, 191, 0.45)' : 'rgba(255,255,255,0.10)'}`,
                color: showControls ? '#5eead4' : 'rgba(255,255,255,0.55)',
              }}
            >
              Filters {showControls ? '●' : '○'}
            </button>
          </div>
          <div className="text-[18px] sm:text-[24px] tracking-wide font-light mt-1">
            Top {positioned.length} of {all.length} proteins · 9 function classes
          </div>
          <div className="text-[11px] text-white/45 mt-0.5 hidden sm:block">
            Star color = organ · radius = score · glow = pLDDT · pulse = variant burden · halo = drug target
          </div>
        </div>
        <div className={`flex-col sm:items-end gap-1.5 ${showControls ? 'flex' : 'hidden sm:flex'}`}>
          <DensitySlider value={topN} max={all.length} onChange={setTopN} />
          <FamilyFilters families={families} active={familyFilter} onChange={setFamilyFilter} />
        </div>
      </div>

      <div
        className="relative w-full rounded-2xl overflow-hidden min-h-[360px] sm:min-h-[540px]"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(20, 184, 166, 0.05) 0%, rgba(7, 11, 32, 0) 70%)',
          border: '1px solid rgba(45, 212, 191, 0.15)',
          boxShadow: 'inset 0 0 60px rgba(45, 212, 191, 0.03)',
        }}
      >
        <BackgroundStars />
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          className="block w-full h-auto select-none"
          style={{
            maxHeight: '60vh',
            cursor: isDragging ? 'grabbing' : zoom > 1.01 ? 'grab' : 'default',
            touchAction: 'none',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={resetView}
        >
          <defs>
            <filter id="star-glow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="star-glow-strong" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Cluster labels first so stars sit on top */}
          {Object.entries(CLASS_CENTERS).map(([cls, c]) => {
            const count = positioned.filter((p) => p.functionClass === cls).length;
            if (count === 0) return null;
            return (
              <text
                key={cls}
                x={c.x}
                y={c.y - clusterRadius(count) - 16}
                fill="rgba(255, 255, 255, 0.32)"
                fontSize="9.5"
                letterSpacing="2"
                textAnchor="middle"
                style={{ textTransform: 'uppercase', fontFamily: 'inherit' }}
              >
                {cls} · {count}
              </text>
            );
          })}

          {/* Family connections under the stars */}
          {familyLinks.map((l, i) => {
            const isActive = activeFamily === l.from.geneFamily;
            const isFiltered = familyFilter !== null && !isActive;
            return (
              <FamilyConnector key={i} from={l.from} to={l.to} active={isActive} dimmed={isFiltered} />
            );
          })}

          {/* Stars */}
          {positioned.map((p) => (
            <ProteinStar
              key={p.gene}
              protein={p}
              hovered={hovered === p.gene}
              dimmed={
                (familyFilter !== null && p.geneFamily !== familyFilter) ||
                (hovered !== null && hovered !== p.gene && (p.geneFamily === 'Other' || activeFamily !== p.geneFamily))
              }
              isSelected={selectedProtein?.gene === p.gene}
              onHover={(h) => setHovered(h ? p.gene : null)}
              onClick={() => window.dispatchEvent(new CustomEvent('human-os:select-protein', { detail: { gene: p.gene } }))}
            />
          ))}
        </svg>

        {hovered && !isMobile && (
          <HoverCard
            protein={positioned.find((p) => p.gene === hovered)!}
            container={containerRef.current}
          />
        )}

        <div
          className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-lg p-1"
          style={{
            background: 'rgba(7, 11, 32, 0.78)',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          <button
            onClick={() => applyZoom(1.4)}
            disabled={zoom >= ZOOM_MAX - 0.001}
            className="w-7 h-7 rounded text-white/70 text-[14px] leading-none hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Zoom in (or scroll wheel)"
          >+</button>
          <button
            onClick={() => applyZoom(1 / 1.4)}
            disabled={zoom <= ZOOM_MIN + 0.001}
            className="w-7 h-7 rounded text-white/70 text-[14px] leading-none hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Zoom out"
          >−</button>
          <button
            onClick={resetView}
            disabled={zoom <= ZOOM_MIN + 0.001 && view.x === 0 && view.y === 0}
            className="w-7 h-7 rounded text-white/55 text-[9px] tracking-wider hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Reset view (or double-click)"
          >FIT</button>
        </div>
      </div>

      <Legend />
    </div>
  );
}

function clusterRadius(count: number): number {
  if (count <= 1) return 18;
  if (count <= 7) return 50;
  return 80;
}

function ProteinStar({
  protein,
  hovered,
  dimmed,
  isSelected,
  onHover,
  onClick,
}: {
  protein: Positioned;
  hovered: boolean;
  dimmed: boolean;
  isSelected: boolean;
  onHover: (h: boolean) => void;
  onClick: () => void;
}) {
  const radius = 5 + protein.score * 6;             // 5 to ~11
  const glow = PLDDT_GLOW[protein.plddtBand];
  const pulseDur = PULSE_DURATION[protein.variantBurden];
  const opacity = dimmed ? 0.18 : 1;

  return (
    <g
      data-star="1"
      style={{ cursor: 'pointer', opacity, transition: 'opacity 0.25s' }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onClick}
    >
      {/* Drug-target halo */}
      {protein.isDrugTarget && (
        <circle
          cx={protein.x}
          cy={protein.y}
          r={radius + 5}
          fill="none"
          stroke="#2dd4bf"
          strokeOpacity={hovered || isSelected ? 0.75 : 0.45}
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      )}

      {/* Outer glow halo (pLDDT band color) */}
      <circle
        cx={protein.x}
        cy={protein.y}
        r={radius + 4}
        fill={glow.halo}
        opacity={hovered || isSelected ? glow.haloOpacity * 1.3 : glow.haloOpacity * 0.7}
        filter="url(#star-glow-strong)"
      >
        {pulseDur > 0 && (
          <animate
            attributeName="r"
            values={`${radius + 4};${radius + 7};${radius + 4}`}
            dur={`${pulseDur}s`}
            repeatCount="indefinite"
          />
        )}
        {pulseDur > 0 && (
          <animate
            attributeName="opacity"
            values={`${glow.haloOpacity * 0.7};${glow.haloOpacity * 1.4};${glow.haloOpacity * 0.7}`}
            dur={`${pulseDur}s`}
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* Inner organ-color core */}
      <circle
        cx={protein.x}
        cy={protein.y}
        r={radius}
        fill={protein.organColor}
        opacity={glow.coreOpacity}
        filter="url(#star-glow)"
        stroke={hovered || isSelected ? '#ffffff' : 'transparent'}
        strokeWidth={hovered || isSelected ? 1.5 : 0}
        strokeOpacity={0.65}
      />

      {/* Bright pinprick at center */}
      <circle cx={protein.x} cy={protein.y} r={Math.max(1.5, radius * 0.35)} fill={glow.core} opacity={0.95} />

      {/* Hover label */}
      {(hovered || isSelected) && (
        <text
          x={protein.x}
          y={protein.y - radius - 8}
          fill="#ffffff"
          fontSize="10"
          letterSpacing="1.5"
          textAnchor="middle"
          style={{ fontFamily: 'inherit', fontWeight: 500 }}
        >
          {protein.gene}
        </text>
      )}
    </g>
  );
}

function FamilyConnector({ from, to, active, dimmed }: { from: Positioned; to: Positioned; active: boolean; dimmed: boolean }) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  // Curve perpendicular to the line so it doesn't run through stars between.
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = len === 0 ? 0 : -dy / len;
  const ny = len === 0 ? 0 : dx / len;
  const offset = Math.min(40, len * 0.18);
  const cx = mx + nx * offset;
  const cy = my + ny * offset;
  const d = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
  return (
    <path
      d={d}
      fill="none"
      stroke={active ? '#5eead4' : 'rgba(45, 212, 191, 0.35)'}
      strokeWidth={active ? 1.2 : 0.6}
      strokeOpacity={dimmed ? 0.05 : active ? 0.8 : 0.25}
      strokeDasharray={active ? '0' : '3 4'}
      style={{ transition: 'all 0.25s', filter: active ? 'drop-shadow(0 0 4px #5eead4)' : 'none' }}
    />
  );
}

function DensitySlider({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  const presets = [50, 100, 200, 400, 800, max];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[9.5px] tracking-[1.5px] uppercase text-white/35">Show top</span>
      <input
        type="range"
        min={20}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 sm:w-32"
      />
      <span className="text-[11px] font-mono text-cyan-300/80 w-10 text-right">{value}</span>
      <div className="flex gap-1 ml-1 flex-wrap">
        {presets.map((n, i) => (
          <button
            key={i}
            onClick={() => onChange(Math.min(n, max))}
            className="text-[9.5px] tracking-[1px] uppercase px-1.5 py-0.5 rounded transition"
            style={{
              background: value === Math.min(n, max) ? 'rgba(45, 212, 191, 0.18)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${value === Math.min(n, max) ? 'rgba(45, 212, 191, 0.45)' : 'rgba(255,255,255,0.08)'}`,
              color: value === Math.min(n, max) ? '#5eead4' : 'rgba(255,255,255,0.55)',
            }}
            title={`Render top ${Math.min(n, max)} by association score`}
          >
            {n === max ? 'All' : n}
          </button>
        ))}
      </div>
    </div>
  );
}

function FamilyFilters({ families, active, onChange }: { families: GeneFamily[]; active: GeneFamily | null; onChange: (f: GeneFamily | null) => void }) {
  if (families.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:max-w-[60%] sm:justify-end">
      <span className="text-[9.5px] tracking-[1.5px] uppercase text-white/35">Families:</span>
      {families.map((f) => {
        const isActive = active === f;
        return (
          <button
            key={f}
            onClick={() => onChange(isActive ? null : f)}
            className="rounded-full px-2 py-0.5 text-[10px] tracking-[0.5px] transition"
            style={{
              background: isActive ? 'rgba(45, 212, 191, 0.18)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${isActive ? 'rgba(45, 212, 191, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
              color: isActive ? '#5eead4' : 'rgba(255, 255, 255, 0.55)',
            }}
            title={isActive ? `Show all families` : `Solo ${f}`}
          >
            {f.replace(/ \(.*$/, '')}
          </button>
        );
      })}
      {active && (
        <button
          onClick={() => onChange(null)}
          className="text-[9.5px] tracking-[1.5px] uppercase text-white/40 hover:text-white/80 transition pb-px"
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
}

function HoverCard({ protein }: { protein: Positioned; container: HTMLDivElement | null }) {
  return (
    <div
      className="absolute top-3 left-3 rounded-lg px-3 py-2 pointer-events-none"
      style={{
        background: 'rgba(7, 11, 32, 0.92)',
        border: `1px solid ${protein.organColor}66`,
        boxShadow: `0 6px 20px rgba(0,0,0,0.4), 0 0 16px ${protein.organColor}33`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        maxWidth: 280,
      }}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-white text-[15px] tracking-wide font-medium">{protein.gene}</span>
        <span className="text-[10px] text-white/45 font-mono">{protein.uniprot}</span>
      </div>
      <div className="text-[11px] text-white/65 mt-0.5 leading-tight line-clamp-2">{protein.name}</div>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <Badge label={protein.functionClass} color="#94a3b8" />
        <Badge label={protein.organLabel} color={protein.organColor} />
        {protein.geneFamily !== 'Other' && <Badge label={protein.geneFamily.replace(/ \(.*$/, '')} color="#5eead4" />}
        {protein.isDrugTarget && <Badge label="Drug target" color="#2dd4bf" />}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2 text-[9.5px] text-white/50">
        <Mini label="score"   value={protein.score.toFixed(2)} />
        <Mini label="pLDDT"   value={protein.plddt != null ? protein.plddt.toFixed(1) : '—'} />
        <Mini label="variants" value={protein.variantCount != null ? (protein.variantCount >= 500 ? '500+' : protein.variantCount.toString()) : '—'} />
      </div>
      <div className="text-[9.5px] text-white/35 mt-1.5">Click to load this protein</div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="rounded-full px-1.5 py-px text-[9px] tracking-wide"
      style={{ background: `${color}1A`, border: `1px solid ${color}40`, color: `${color}E6` }}
    >
      {label}
    </span>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md px-1.5 py-0.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="uppercase tracking-[1.5px]">{label}</span>{' '}
      <span className="text-white font-mono">{value}</span>
    </div>
  );
}

function BackgroundStars() {
  const stars = useMemo(() => {
    return Array.from({ length: 80 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      r: Math.random() * 1.2 + 0.4,
      o: Math.random() * 0.4 + 0.1,
    }));
  }, []);
  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.r}px`,
            height: `${s.r}px`,
            background: 'white',
            opacity: s.o,
          }}
        />
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[9.5px] tracking-[1.5px] text-white/40 uppercase">
      <div className="flex items-center gap-3 flex-wrap">
        <LegendDot color="#2dd4bf" label="High pLDDT (≥90)" />
        <LegendDot color="#a3e635" label="Confident (70-90)" />
        <LegendDot color="#facc15" label="Low (50-70)" />
        <LegendDot color="#f87171" label="Very low (<50)" />
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="rounded-full" style={{ width: 9, height: 9, border: '1px dashed #2dd4bf' }} /> Drug target
        </span>
        <span className="hidden sm:flex items-center gap-1">
          <span className="text-cyan-300/60">⤴</span> Hover · click to load
        </span>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="rounded-full" style={{ width: 6, height: 6, background: color, boxShadow: `0 0 5px ${color}` }} />
      {label}
    </span>
  );
}
