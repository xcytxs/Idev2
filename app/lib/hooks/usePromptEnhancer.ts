import { useState, useCallback } from 'react';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('usePromptEnhancement');

interface EnhancerState {
  isEnhancing: boolean;
  isEnhanced: boolean;
  error: string | null;
  originalPrompt: string | null;
}

export function usePromptEnhancer() {
  const [state, setState] = useState<EnhancerState>({
    isEnhancing: false,
    isEnhanced: false,
    error: null,
    originalPrompt: null,
  });

  const resetEnhancer = useCallback(() => {
    setState({
      isEnhancing: false,
      isEnhanced: false,
      error: null,
      originalPrompt: null,
    });
  }, []);

  const revertToOriginal = useCallback((setInput: (value: string) => void) => {
    if (state.originalPrompt) {
      setInput(state.originalPrompt);
      resetEnhancer();
    }
  }, [state.originalPrompt, resetEnhancer]);

  const enhancePrompt = useCallback(async (
    input: string, 
    setInput: (value: string) => void,
    options?: {
      onSuccess?: () => void;
      onError?: (error: Error) => void;
    }
  ) => {
    if (!input.trim()) {
      setState(prev => ({ ...prev, error: 'Please enter a prompt to enhance' }));
      return;
    }

    setState(prev => ({ 
      ...prev,
      isEnhancing: true,
      error: null,
      originalPrompt: input 
    }));

    try {
      const response = await fetch('/api/enhancer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
        }),
      });

      if (!response.ok) {
        throw new Error(`Enhancement failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      setInput(''); // Clear existing input before streaming
      let enhancedPrompt = '';

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        const chunk = new TextDecoder().decode(value);
        enhancedPrompt += chunk;
        setInput(enhancedPrompt);
        
        logger.trace('Streaming chunk', { chunk, enhancedPrompt });
      }

      setState(prev => ({
        ...prev,
        isEnhancing: false,
        isEnhanced: true,
        error: null,
      }));

      options?.onSuccess?.();

    } catch (error) {
      logger.error('Enhancement error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to enhance prompt';
      
      setState(prev => ({
        ...prev,
        isEnhancing: false,
        isEnhanced: false,
        error: errorMessage,
      }));

      // Revert to original input on error
      if (state.originalPrompt) {
        setInput(state.originalPrompt);
      }

      options?.onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [state.originalPrompt]);

  return {
    enhancePrompt,
    revertToOriginal,
    resetEnhancer,
    isEnhancing: state.isEnhancing,
    isEnhanced: state.isEnhanced,
    error: state.error,
    hasOriginal: !!state.originalPrompt,
  };
}

// Example usage:
/*
function PromptInput() {
  const [input, setInput] = useState('');
  const { 
    enhancePrompt, 
    revertToOriginal,
    isEnhancing,
    isEnhanced,
    error,
    hasOriginal
  } = usePromptEnhancer();

  return (
    <div>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={isEnhancing}
      />
      
      <div>
        <button 
          onClick={() => enhancePrompt(input, setInput, {
            onSuccess: () => console.log('Enhancement successful!'),
            onError: (error) => console.error('Enhancement failed:', error)
          })}
          disabled={isEnhancing || !input.trim()}
        >
          {isEnhancing ? 'Enhancing...' : 'Enhance Prompt'}
        </button>

        {hasOriginal && (
          <button 
            onClick={() => revertToOriginal(setInput)}
            disabled={isEnhancing}
          >
            Revert to Original
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}
      {isEnhanced && <div className="success">Prompt enhanced successfully!</div>}
    </div>
  );
}
*/