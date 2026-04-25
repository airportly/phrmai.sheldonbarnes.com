import React, { useEffect, useState } from 'react';

/**
 * Onboarding - Three-step first-run overlay that names the body, the cards,
 * and the chat panel. Persists "seen" state in localStorage so it shows once.
 *
 * Skipped entirely if the user lands with a hash (deep link) — they already
 * know what they're looking for.
 */

const STORAGE_KEY = 'human-os.onboarded.v1';

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Click the body',
    body: 'The body figure is the navigation primitive. Click brain, heart, liver, pancreas, or kidneys to load proteins for that organ. Drag to rotate, scroll to zoom, use the framing chips to focus on a region.',
  },
  {
    title: 'Read the cards',
    body: 'Eight context dimensions surround the body. Click any card to open a deep-dive: variant heatmaps, peer-comparison, severity bands, coverage matrix. Every number traces to the cardiometabolic-research database.',
  },
  {
    title: 'Talk to it',
    body: 'Type or speak in the chat. Voice queries route through Claude with the MCP server attached when ANTHROPIC_API_KEY is set. Try "tell me about PCSK9" or "what proteins are in the liver?"',
  },
];

interface Props {
  alreadyHasSelection: boolean;
}

export default function Onboarding({ alreadyHasSelection }: Props) {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (alreadyHasSelection) return;
    if (window.location.hash && window.location.hash !== '#') return;
    if (localStorage.getItem(STORAGE_KEY) === '1') return;
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, [alreadyHasSelection]);

  if (!open) return null;

  const dismiss = () => {
    setOpen(false);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, '1');
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        background: 'rgba(7, 11, 32, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md rounded-2xl px-7 pt-6 pb-6"
        style={{
          background: 'linear-gradient(180deg, rgba(10, 14, 39, 0.95) 0%, rgba(7, 11, 32, 0.98) 100%)',
          border: '1px solid rgba(45, 212, 191, 0.30)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.5), inset 0 0 60px rgba(45,212,191,0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] tracking-[2.5px] text-cyan-300/70 uppercase">
          Step {step + 1} of {STEPS.length}
        </div>
        <div className="text-[22px] tracking-wide text-white font-light mt-1">{current.title}</div>
        <div className="text-[13px] text-white/70 mt-3 leading-relaxed">{current.body}</div>

        <div className="flex items-center justify-between mt-5">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === step ? '18px' : '6px',
                  height: '6px',
                  background: i === step ? '#2dd4bf' : 'rgba(255,255,255,0.18)',
                  boxShadow: i === step ? '0 0 6px #2dd4bf' : 'none',
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={dismiss}
              className="text-[11px] tracking-[1.5px] text-white/45 hover:text-white/80 uppercase pb-px border-b border-white/10 hover:border-white/40 transition"
            >
              Skip
            </button>
            <button
              onClick={() => isLast ? dismiss() : setStep((s) => s + 1)}
              className="px-3.5 py-1.5 rounded-full text-[11px] tracking-[1.5px] uppercase transition"
              style={{
                background: 'rgba(45, 212, 191, 0.18)',
                border: '1px solid rgba(45, 212, 191, 0.45)',
                color: '#2dd4bf',
              }}
            >
              {isLast ? 'Get started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
