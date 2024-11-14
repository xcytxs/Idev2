import { useState } from 'react';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useVoiceToText');

export function useVoiceToText() {
  const [converting, setConverting] = useState(false);

  const convertVoiceToText = async (audioBlob: Blob) => {
    setConverting(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch('/api/voice-to-text', {
        method: 'POST',
        body: formData,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let text = '';

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          text += decoder.decode(value);
        }
      }

      return text;
    } catch (error) {
      logger.error('Failed to convert voice to text:', error);
      throw error;
    } finally {
      setConverting(false);
    }
  };

  return { converting, convertVoiceToText };
} 