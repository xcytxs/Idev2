import { useEffect, useState } from 'react';
import { createScopedLogger } from '~/utils/logger';

export function useWhisperCredentials() {
  const [hasCredentials, setHasCredentials] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkCredentials() {
      try {
        const response = await fetch('/api/voice-to-text');
        
        if (!response.ok) {
          setHasCredentials(false);
          return;
        }

        const data = await response.json();
        setHasCredentials(data.hasCredentials);
      } catch (error) {
        setHasCredentials(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkCredentials();
  }, []);

  return { hasCredentials, isLoading };
} 