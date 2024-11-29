import React, { useState, useCallback, useEffect } from 'react';
import { GITHUB_CONFIG } from './config';

interface GitHubAuthProps {
  onAuthComplete?: (token: string) => void;
  onError?: (error: Error) => void;
  children?: React.ReactNode;
}

interface GitHubErrorResponse {
  error?: string;
  error_description?: string;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface AccessTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export function GitHubAuth({ onAuthComplete, onError, children }: GitHubAuthProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const pollForToken = useCallback(async (code: string, interval: number) => {
    try {
      const params = new URLSearchParams({
        endpoint: GITHUB_CONFIG.accessTokenEndpoint,
        client_id: GITHUB_CONFIG.clientId,
        device_code: code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      });

      const response = await fetch(`${GITHUB_CONFIG.proxyUrl}?${params}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        }
      });

      const data: AccessTokenResponse = await response.json();

      if (data.access_token) {
        localStorage.setItem('github_token', data.access_token);
        setIsPolling(false);
        setIsLoading(false);
        onAuthComplete?.(data.access_token);
      } else if (data.error === 'authorization_pending') {
        // Continue polling
        setTimeout(() => pollForToken(code, interval), interval * 1000);
      } else {
        throw new Error(data.error_description || 'Authentication failed');
      }
    } catch (error: any) {
      setIsPolling(false);
      setIsLoading(false);
      onError?.(error);
    }
  }, [onAuthComplete, onError]);

  const startAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const params = new URLSearchParams({
        endpoint: GITHUB_CONFIG.deviceCodeEndpoint,
        client_id: GITHUB_CONFIG.clientId,
        scope: GITHUB_CONFIG.scope,
      });

      const response = await fetch(`${GITHUB_CONFIG.proxyUrl}?${params}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        let errorMessage = `Failed to start authentication process (${response.status})`;
        try {
          const errorData: GitHubErrorResponse = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error_description || errorData.error;
          }
        } catch {
          // Use default error message if JSON parsing fails
        }
        throw new Error(errorMessage);
      }

      const data: DeviceCodeResponse = await response.json();
      
      if (!data.device_code || !data.user_code || !data.verification_uri) {
        throw new Error('Invalid response from GitHub');
      }

      setDeviceCode(data.device_code);
      setUserCode(data.user_code);
      setVerificationUrl(data.verification_uri);
      setIsPolling(true);
      
      pollForToken(data.device_code, data.interval || 5);
    } catch (error: any) {
      setIsLoading(false);
      onError?.(error);
    }
  }, [pollForToken, onError]);

  useEffect(() => {
    return () => {
      setIsPolling(false);
    };
  }, []);

  if (userCode && verificationUrl) {
    return (
      <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-white">
        <p className="text-lg font-medium">Enter this code on GitHub:</p>
        <div className="text-2xl font-bold tracking-wide bg-gray-100 p-2 rounded">
          {userCode}
        </div>
        <a
          href={verificationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-600"
        >
          Click here to open GitHub
        </a>
        {isPolling && (
          <p className="text-sm text-gray-500">
            Waiting for authentication... You can close the GitHub window once authorized.
          </p>
        )}
      </div>
    );
  }

  if (children) {
    return (
      <div onClick={startAuth} className={isLoading ? 'opacity-50 pointer-events-none' : ''}>
        {children}
      </div>
    );
  }

  return (
    <button
      onClick={startAuth}
      disabled={isLoading}
      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
    >
      {isLoading ? 'Connecting...' : 'Connect to GitHub'}
    </button>
  );
}
