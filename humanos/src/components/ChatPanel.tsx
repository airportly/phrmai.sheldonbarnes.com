import React, { useState, useRef, useEffect } from 'react';
import type { Protein, OrganKey } from '@/lib/protein-mapper';

/**
 * ChatPanel - Text chat interface for asking questions about proteins,
 * organs, or diseases. Voice input is in a separate VoicePanel component.
 * 
 * In Phase 3, this connects to the Anthropic API with the cardiometabolic
 * MCP server attached for natural language responses.
 */

interface Message {
  who: string;
  text: string;
  color?: string;
}

interface Props {
  onQuery: (query: string) => Promise<string>;
  selectedProtein: Protein | null;
  selectedOrgan: OrganKey | null;
  /** When the parent injects a narration line (e.g. demo mode), it bumps this
   *  key. ChatPanel watches the key and appends the message + speaks it. */
  injected?: { text: string; key: number } | null;
  /** True while a /api/chat round-trip is in flight. Drives the "thinking"
   *  indicator and disables input during the call. */
  thinking?: boolean;
  /** Names of MCP tools the AI invoked on the last turn — surfaced briefly
   *  underneath the response so the user sees what it actually did. */
  lastTools?: string[];
}

export default function ChatPanel({ onQuery, selectedProtein, injected, thinking, lastTools }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      who: 'SYSTEM',
      text: 'Click an organ on the body, or ask about a protein. Try: "Tell me about PCSK9" or "What\'s in the liver?"',
      color: 'rgba(45, 212, 191, 0.9)',
    },
  ]);
  const [input, setInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!injected) return;
    setMessages((m) => [...m, { who: 'HUMAN OS', text: injected.text }]);
    speak(injected.text);
  }, [injected?.key]);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    const query = input;
    setInput('');
    
    setMessages((m) => [...m, { who: 'YOU', text: query, color: 'rgba(255,255,255,0.5)' }]);
    
    const response = await onQuery(query);
    
    setMessages((m) => [...m, { who: 'HUMAN OS', text: response }]);
    speak(response);
  };

  return (
    <div
      className="relative z-10 rounded-xl p-3.5 max-h-[220px] overflow-hidden flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div ref={logRef} className="text-[13px] text-white/85 leading-[1.6] overflow-y-auto flex-1 max-h-[140px]">
        {messages.map((m, i) => (
          <div key={i} className={i > 0 ? 'mt-3 pt-2.5 border-t border-white/5' : ''}>
            <div
              className="text-[11px] tracking-[1px] mb-1.5"
              style={{ color: m.color ?? 'rgba(45, 212, 191, 0.9)' }}
            >
              {m.who}
            </div>
            <div className="text-white/85">{m.text}</div>
          </div>
        ))}
        {thinking && <ThinkingIndicator />}
        {!thinking && lastTools && lastTools.length > 0 && (
          <div className="mt-2 text-[10px] tracking-[1px] uppercase text-cyan-300/55">
            Consulted: {lastTools.join(' · ')}
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !thinking && handleSubmit()}
          disabled={thinking}
          placeholder={
            thinking
              ? 'Thinking…'
              : selectedProtein
                ? `Ask about ${selectedProtein.gene} or another protein...`
                : 'Ask about a protein, organ, or disease...'
          }
          className="flex-1 bg-white/5 border border-white/10 text-white px-3 py-2 rounded-full text-[13px] outline-none focus:border-white/25 disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={thinking || !input.trim()}
          className="px-4 py-2 rounded-full text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'rgba(45, 212, 191, 0.2)',
            border: '1px solid rgba(45, 212, 191, 0.4)',
            color: '#2dd4bf',
          }}
        >
          {thinking ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

/** Animated "the AI is reasoning" indicator. Three pulsing dots plus a
 *  rotating verb so it doesn't read as a static stub. The verbs are
 *  intentionally generic — the real round-trip doesn't stream tool names,
 *  so this is the honest framing of "we don't know exactly what it's doing
 *  yet, but it's working". Tool names are surfaced after the response lands. */
function ThinkingIndicator() {
  const VERBS = [
    'Reasoning over your question',
    'Consulting the protein database',
    'Cross-referencing disease associations',
    'Pulling structural confidence',
    'Summarizing the evidence',
  ];
  const [verbIdx, setVerbIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setVerbIdx((i) => (i + 1) % VERBS.length), 2200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="mt-3 pt-2.5 border-t border-white/5">
      <div className="text-[11px] tracking-[1px] mb-1.5 text-cyan-300/90 flex items-center gap-2">
        HUMAN OS
        <span className="inline-flex gap-1 items-center" aria-label="thinking">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-300/80" style={{ animation: 'thinking-bounce 1.2s infinite', animationDelay: '0s' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-300/80" style={{ animation: 'thinking-bounce 1.2s infinite', animationDelay: '0.18s' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-300/80" style={{ animation: 'thinking-bounce 1.2s infinite', animationDelay: '0.36s' }} />
        </span>
      </div>
      <div className="text-white/60 italic text-[12px]" key={verbIdx} style={{ animation: 'thinking-fade 2.2s ease-in-out infinite' }}>
        {VERBS[verbIdx]}…
      </div>
      <style jsx>{`
        @keyframes thinking-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-3px); opacity: 1; }
        }
        @keyframes thinking-fade {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.95; }
        }
      `}</style>
    </div>
  );
}

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 0.9;
  window.speechSynthesis.speak(utterance);
}
