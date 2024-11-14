import { useEffect, useState } from 'react';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useWhisperCredentials');

export function useWhisperCredentials() {
  const [hasCredentials, setHasCredentials] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkCredentials() {
      try {
        logger.info('Checking Whisper credentials...');
        const response = await fetch('/api/voice-to-text');
        
        if (!response.ok) {
          logger.error('Failed to check credentials:', response.status);
          setHasCredentials(false);
          return;
        }

        const data = await response.json();
        logger.info('Credentials check result:', JSON.stringify(data, null, 2));
        
        logger.info('Setting hasCredentials to:', data.hasCredentials);
        setHasCredentials(data.hasCredentials);
      } catch (error) {
        logger.error('Failed to check Whisper credentials:', error);
        setHasCredentials(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkCredentials();
  }, []);

  return { hasCredentials, isLoading };
} 