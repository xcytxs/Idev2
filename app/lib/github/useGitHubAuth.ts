import { useCallback, useEffect, useState } from 'react';
import { getGitHubUser, type GitHubUser } from './github.client';

export function useGitHubAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<GitHubUser | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('github_token');
      if (token) {
        try {
          const userInfo = await getGitHubUser(token);
          setUser(userInfo);
          setIsAuthenticated(true);
        } catch (error) {
          // Token might be invalid, remove it
          localStorage.removeItem('github_token');
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const handleAuthComplete = useCallback(async (token: string) => {
    try {
      const userInfo = await getGitHubUser(token);
      setUser(userInfo);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Failed to get user info:', error);
    }
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('github_token');
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return {
    isAuthenticated,
    isLoading,
    user,
    handleAuthComplete,
    handleLogout
  };
}
