import React from 'react';

/**
 * ContextCard - One context dimension, one card.
 *
 * Holographic-glass treatment: dark translucent body with a strong colored
 * accent strip on top, the category label set in tracked caps in the same
 * accent color, then the data value, a one-line description, and a 5-dot
 * coverage rating.
 */

interface Props {
  title: string;
  color: string;
  mainText: string;
  subText: string;
  dots: number;
  onClick?: () => void;
}

export default function ContextCard({ title, color, mainText, subText, dots, onClick }: Props) {
  return (
    <div
      data-card-title={title}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`relative rounded-[10px] overflow-hidden backdrop-blur-md transition-all hover:translate-x-[1px] ${onClick ? 'cursor-pointer hover:bg-white/[0.02]' : ''}`}
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
        border: `1px solid ${color}33`,
        boxShadow: `inset 0 0 24px ${color}10, 0 1px 3px rgba(0,0,0,0.3)`,
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${color}cc, ${color}33)` }}
      />
      <div className="px-3 pt-2.5 pb-2.5">
        <div
          className="text-[9px] tracking-[2px] font-semibold mb-1.5 uppercase"
          style={{ color }}
        >
          {title}
        </div>
        <div className="text-[13px] text-white font-medium leading-tight mb-1">
          {mainText}
        </div>
        <div className="text-[10.5px] text-white/50 mb-2 leading-snug">
          {subText}
        </div>
        <div className="flex gap-[5px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="rounded-full transition-all"
              style={{
                width: '4px',
                height: '4px',
                background: i < dots ? color : 'rgba(255,255,255,0.12)',
                boxShadow: i < dots ? `0 0 4px ${color}99` : 'none',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
