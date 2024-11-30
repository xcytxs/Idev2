import { renderHook, act } from '@testing-library/react';
import { usePromptEnhancer } from './usePromptEnhancer';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

const mockReader = {
  read: vi.fn(),
};
const mockGetReader = vi.fn(() => mockReader);

// Create a simple TextDecoder mock that implements the required interface
class MockTextDecoder implements TextDecoder {
  encoding: string = 'utf-8';
  fatal: boolean = false;
  ignoreBOM: boolean = false;
  decode(_value?: BufferSource): string {
    return 'Enhanced prompt';
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  (global.fetch as any).mockReset();
  global.TextDecoder = MockTextDecoder as any;
});

describe('usePromptEnhancer', () => {
  const defaultModel = 'gpt-4';
  const defaultProvider = {
    id: 'openai',
    name: 'OpenAI',
    staticModels: [{ name: 'gpt-4', label: 'GPT-4', provider: 'OpenAI', maxTokenAllowed: 8000 }],
  };

  it('should initialize with default values', () => {
    const { result } = renderHook(() => usePromptEnhancer());

    expect(result.current.enhancingPrompt).toBe(false);
    expect(result.current.promptEnhanced).toBe(false);
    expect(typeof result.current.enhancePrompt).toBe('function');
    expect(typeof result.current.resetEnhancer).toBe('function');
  });

  it('should reset state when resetEnhancer is called', () => {
    const { result } = renderHook(() => usePromptEnhancer());

    act(() => {
      result.current.resetEnhancer();
    });

    expect(result.current.enhancingPrompt).toBe(false);
    expect(result.current.promptEnhanced).toBe(false);
  });

  it('should enhance prompt successfully', async () => {
    const mockResponse = {
      body: {
        getReader: mockGetReader,
      },
    };
    mockReader.read
      .mockResolvedValueOnce({ value: new TextEncoder().encode('Enhanced'), done: false })
      .mockResolvedValueOnce({ value: new TextEncoder().encode(' prompt'), done: false })
      .mockResolvedValueOnce({ value: undefined, done: true });

    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => usePromptEnhancer());
    const setInput = vi.fn();

    await act(async () => {
      await result.current.enhancePrompt('Original prompt', setInput, defaultModel, defaultProvider);
    });

    expect(result.current.enhancingPrompt).toBe(false);
    expect(result.current.promptEnhanced).toBe(true);
    expect(setInput).toHaveBeenCalledWith('Enhanced prompt');
  });

  it('should handle errors during prompt enhancement', async () => {
    const mockResponse = {
      body: {
        getReader: mockGetReader,
      },
    };
    mockReader.read.mockRejectedValueOnce(new Error('Enhancement failed'));
    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => usePromptEnhancer());
    const setInput = vi.fn();
    const originalPrompt = 'Original prompt';

    await act(async () => {
      await result.current.enhancePrompt(originalPrompt, setInput, defaultModel, defaultProvider).catch(() => {
        // Error is expected
      });
    });

    expect(result.current.enhancingPrompt).toBe(false);
    expect(result.current.promptEnhanced).toBe(true);
    expect(setInput).toHaveBeenCalledWith(originalPrompt);
  });

  it('should include API keys in request when provided', async () => {
    const mockResponse = {
      body: {
        getReader: mockGetReader,
      },
    };
    mockReader.read.mockResolvedValueOnce({ value: undefined, done: true });
    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => usePromptEnhancer());
    const setInput = vi.fn();
    const apiKeys = { openai: 'test-key' };

    await act(async () => {
      await result.current.enhancePrompt('Original prompt', setInput, defaultModel, defaultProvider, apiKeys);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/enhancer',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('test-key'),
      }),
    );
  });
});
