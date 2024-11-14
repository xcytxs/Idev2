import { useState } from 'react';
import { toast } from 'react-toastify';

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

      if (!response.ok) {
        const errorData = (await response.json()) as { error: string };
        throw new Error(errorData.error || 'Failed to convert voice to text');
      }

      const text = await response.text();
      return text;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to convert voice to text');
      return null;
    } finally {
      setConverting(false);
    }
  };

  return { converting, convertVoiceToText };
}
