import React, { useState, useEffect, useCallback } from 'react';
import { Mic } from 'lucide-react';

interface VoiceInputProps {
  initialValue?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  0: {
    transcript: string;
  };
}

interface SpeechRecognitionResults {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResults;
}

export default function VoiceInput({ initialValue = '', onChange, disabled }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  const processTranscript = useCallback((results: SpeechRecognitionResults): string => {
    return Array.from(results)
      .map((result: SpeechRecognitionResult) => result[0])
      .map(result => result.transcript)
      .join('');
  }, []);

  const handleTranscript = useCallback((transcript: string) => {
    const newValue = initialValue + (initialValue ? ' ' : '') + transcript;
    onChange(newValue);
  }, [initialValue, onChange]);

  const handleRecognitionResult = useCallback((event: SpeechRecognitionEvent) => {
    const transcript = processTranscript(event.results);
    if (event.results[0].isFinal) {
      handleTranscript(transcript);
      setIsListening(false);
    }
  }, [processTranscript, handleTranscript]);

  const handleError = useCallback((event: { error: string }) => {
    console.error('Speech recognition error:', event.error);
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
    }
  }, [recognition, isListening]);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window)) return;

    const recognitionInstance = new (window as any).webkitSpeechRecognition();
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.onresult = handleRecognitionResult;
    recognitionInstance.onerror = handleError;

    setRecognition(recognitionInstance);

    return () => recognitionInstance.stop();
  }, [handleRecognitionResult, handleError]);

  if (!('webkitSpeechRecognition' in window)) {
    return null;
  }

  return (
    <button
      onClick={toggleListening}
      disabled={disabled}
      className="appearance-none border-none bg-none"
      style={{ background: 'none' }}
      title={isListening ? "Stop voice input" : "Start voice input"}>
      <div className="flex items-center justify-center">
        <Mic
          className={`w-5 h-5 transition-colors ${
            isListening
              ? 'text-bolt-elements-item-contentAccent animate-pulse'
              : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary'
          }`}
        />
      </div>
    </button>
  );
}
