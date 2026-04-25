import React, { useState, useRef, useEffect } from 'react';

/**
 * VoicePanel - Mic button for voice input via Web Speech API.
 * Triggers the onQuery callback with the transcribed text when the user
 * stops speaking.
 */

interface Props {
  onQuery: (query: string) => Promise<string>;
}

export default function VoicePanel({ onQuery }: Props) {
  const [listening, setListening] = useState(false);
  const [available, setAvailable] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setAvailable(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      const response = await onQuery(transcript);
      speak(response);
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch {}
    };
  }, [onQuery]);

  const toggle = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch (e) {
        console.error('Voice start failed:', e);
        setListening(false);
      }
    }
  };

  if (!available) {
    return (
      <button
        disabled
        className="bg-white/5 border border-white/10 text-white/30 px-3.5 py-2 rounded-full text-xs cursor-not-allowed"
      >
        Voice unavailable
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="px-3.5 py-2 rounded-full text-xs flex items-center gap-1.5 transition-all"
      style={{
        background: listening ? 'rgba(248, 113, 113, 0.2)' : 'rgba(20, 184, 166, 0.15)',
        border: `1px solid ${listening ? 'rgba(248, 113, 113, 0.5)' : 'rgba(20, 184, 166, 0.5)'}`,
        color: listening ? '#f87171' : '#2dd4bf',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
      </svg>
      <span>{listening ? 'Listening...' : 'Tap to talk'}</span>
    </button>
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
