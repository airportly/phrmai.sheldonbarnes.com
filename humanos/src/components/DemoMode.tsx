import React, { useEffect, useRef, useState } from 'react';
import type { OrganKey, Protein } from '@/lib/protein-mapper';

/**
 * DemoMode - Scripted walkthrough that picks five proteins across the body,
 * each held for ~10 seconds with a one-line narration in the chat. Lets a
 * stakeholder press play, step away, and watch the interface tour itself.
 *
 * Honors stop on any user click outside the controls (the parent should call
 * stop() if a manual selection happens during a demo).
 */

interface DemoStep {
  organ: OrganKey;
  proteinGene: string;
  card: string | null;        // optional deep-dive to open mid-step
  narration: string;
}

const SCRIPT: DemoStep[] = [
  { organ: 'pancreas', proteinGene: 'GCK',   card: null,                 narration: 'Diabetes pivots on the pancreatic beta cell. Glucokinase is the glucose sensor.' },
  { organ: 'liver',    proteinGene: 'PCSK9', card: 'PROTEIN BINDING',    narration: 'PCSK9 binds the LDL receptor and routes it to lysosomal degradation. Drugs like alirocumab block this binding.' },
  { organ: 'heart',    proteinGene: 'SCN5A', card: 'PATIENT POPULATION', narration: 'Nav 1.5 carries the cardiac depolarizing current. The variant heatmap shows residues where pathogenic substitutions cluster.' },
  { organ: 'kidneys',  proteinGene: 'AGTR1', card: null,                 narration: 'AT1 is the angiotensin II receptor. ARBs like losartan block it to lower blood pressure.' },
  { organ: 'brain',    proteinGene: 'F2',    card: 'TOXICITY',           narration: 'Thrombin is the convergence of the coagulation cascade. Direct thrombin inhibitors like dabigatran reduce stroke risk.' },
];

interface Props {
  setSelectedOrgan: (organ: OrganKey | null) => void;
  setSelectedProtein: (protein: Protein | null) => void;
  setExpandedCard: (card: string | null) => void;
  resolveProtein: (organ: OrganKey, gene: string) => Protein | null;
  appendChat: (line: string) => void;
}

export default function DemoMode({
  setSelectedOrgan,
  setSelectedProtein,
  setExpandedCard,
  resolveProtein,
  appendChat,
}: Props) {
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    cancelRef.current = false;
    let i = 0;

    const advance = () => {
      if (cancelRef.current) return;
      const step = SCRIPT[i];
      const protein = resolveProtein(step.organ, step.proteinGene);
      setSelectedOrgan(step.organ);
      if (protein) setSelectedProtein(protein);
      appendChat(step.narration);
      setStepIdx(i);

      // Open deep-dive partway through the step.
      if (step.card) {
        setTimeout(() => {
          if (!cancelRef.current) setExpandedCard(step.card);
        }, 5000);
        // Close before advancing to the next step.
        setTimeout(() => {
          if (!cancelRef.current) setExpandedCard(null);
        }, 11000);
      }

      i += 1;
      if (i < SCRIPT.length) {
        setTimeout(advance, 13000);
      } else {
        setTimeout(() => {
          if (!cancelRef.current) {
            setRunning(false);
            appendChat('Walkthrough complete.');
          }
        }, 12000);
      }
    };
    advance();
    return () => { cancelRef.current = true; };
  }, [running, resolveProtein, setSelectedOrgan, setSelectedProtein, setExpandedCard, appendChat]);

  const start = () => {
    setStepIdx(0);
    setRunning(true);
  };
  const stop = () => {
    cancelRef.current = true;
    setRunning(false);
    setExpandedCard(null);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={running ? stop : start}
        className="px-3 py-2 rounded-full text-[11px] tracking-[1.5px] uppercase transition flex items-center gap-2"
        style={{
          background: running ? 'rgba(248, 113, 113, 0.15)' : 'rgba(127, 119, 221, 0.12)',
          border: `1px solid ${running ? 'rgba(248, 113, 113, 0.40)' : 'rgba(127, 119, 221, 0.40)'}`,
          color: running ? '#fca5a5' : '#a3a1ed',
        }}
        title={running ? 'Stop the walkthrough' : 'Auto-tour the body and key proteins'}
      >
        <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor">
          {running ? <rect x="2" y="2" width="8" height="8" rx="1" /> : <polygon points="2,1 11,6 2,11" />}
        </svg>
        {running ? `Stop · ${stepIdx + 1}/${SCRIPT.length}` : 'Demo'}
      </button>
    </div>
  );
}
