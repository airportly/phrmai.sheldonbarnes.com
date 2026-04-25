import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Hook for browser speech recognition and synthesis.
 * Wraps Web Speech API for input and SpeechSynthesis API for output.
 *
 * Browser support:
 * - Chrome, Edge: Full support
 * - Safari: Limited (requires user gesture, prefixed API)
 * - Firefox: No SpeechRecognition support
 *
 * If SpeechRecognition is unavailable, the typed-text fallback in ChatPanel still works.
 */
export function useSpeech() {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Initialize SpeechRecognition once
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recog = new SR();
    recog.continuous = false;
    recog.interimResults = false;
    recog.lang = "en-US";
    recognitionRef.current = recog;
  }, []);

  const startListening = useCallback((onResult: (transcript: string) => void) => {
    const recog = recognitionRef.current;
    if (!recog) {
      console.warn("SpeechRecognition not available in this browser");
      return false;
    }

    recog.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };
    recog.onend = () => setIsListening(false);
    recog.onerror = () => setIsListening(false);

    try {
      recog.start();
      setIsListening(true);
      return true;
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
      return false;
    }
  }, []);

  const stopListening = useCallback(() => {
    const recog = recognitionRef.current;
    if (recog) recog.stop();
    setIsListening(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
  }, []);

  return { isListening, startListening, stopListening, speak };
}
