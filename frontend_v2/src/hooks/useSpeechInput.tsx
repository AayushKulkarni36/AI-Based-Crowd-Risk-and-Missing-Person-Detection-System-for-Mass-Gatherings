import { useState, useCallback } from 'react';

export function useSpeechInput(lang: string = 'en') {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    
    // Map language parameter to locales
    if (lang === 'hi') recognition.lang = 'hi-IN';
    else if (lang === 'mr') recognition.lang = 'mr-IN';
    else recognition.lang = 'en-US';
    
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const t = event.results[current][0].transcript;
      setTranscript(t);
    };

    recognition.onerror = (event: any) => {
      setError(event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [lang]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      // Browsers handle stopping the stream normally.
    }
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    setTranscript
  };
}
