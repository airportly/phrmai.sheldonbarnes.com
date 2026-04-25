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
}

export default function ChatPanel({ onQuery, selectedProtein, injected }: Props) {
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
      className="relative z-10 mt-5 rounded-xl p-3.5 max-h-[200px] overflow-hidden flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div ref={logRef} className="text-[13px] text-white/85 leading-[1.6] overflow-y-auto flex-1 max-h-[120px]">
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
      </div>
      <div className="flex gap-2 mt-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={selectedProtein ? `Ask about ${selectedProtein.gene} or another protein...` : 'Ask about a protein, organ, or disease...'}
          className="flex-1 bg-white/5 border border-white/10 text-white px-3 py-2 rounded-full text-[13px] outline-none focus:border-white/25"
        />
        <button
          onClick={handleSubmit}
          className="px-4 py-2 rounded-full text-xs"
          style={{
            background: 'rgba(45, 212, 191, 0.2)',
            border: '1px solid rgba(45, 212, 191, 0.4)',
            color: '#2dd4bf',
          }}
        >
          Send
        </button>
      </div>
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
