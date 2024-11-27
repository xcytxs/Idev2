import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelCache } from '../ModelCache';
import type { ModelInfo } from '~/types/provider';

describe('ModelCache', () => {
    let modelCache: ModelCache;
    const mockLogger = {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        setLevel: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock Date.now() to control time
        vi.useFakeTimers();
        modelCache = new ModelCache(mockLogger);
    });

    it('should initialize with empty cache', () => {
        expect(mockLogger.trace).toHaveBeenCalledWith('ModelCache');
    });

    it('should return null for non-existent provider', async () => {
        const result = await modelCache.get('non-existent');
        expect(result).toBeNull();
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'Getting cached models for provider: non-existent'
        );
    });

    it('should successfully cache and retrieve models', async () => {
        const provider = 'test-provider';
        const models: ModelInfo[] = [
            {
                id: 'model1', name: 'Test Model 1',
                provider: '',
                maxTokens: 0,
                capabilities: []
            },
            {
                id: 'model2', name: 'Test Model 2',
                provider: '',
                maxTokens: 0,
                capabilities: []
            },
        ];

        await modelCache.set(provider, models);
        const result = await modelCache.get(provider);

        expect(result).toEqual(models);
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'Getting cached models for provider: test-provider'
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'Returning cached models for provider:',
            models
        );
    });

    it('should return null and clear cache when TTL expires', async () => {
        const provider = 'test-provider';
        const models: ModelInfo[] = [
            {
                id: 'model1', name: 'Test Model 1',
                provider: '',
                maxTokens: 0,
                capabilities: []
            },
        ];

        await modelCache.set(provider, models);
        
        // Advance time beyond TTL (5 minutes + 1 second)
        vi.advanceTimersByTime(1000 * 60 * 5 + 1000);
        
        const result = await modelCache.get(provider);
        expect(result).toBeNull();
    });

    it('should update cache when setting models for existing provider', async () => {
        const provider = 'test-provider';
        const initialModels: ModelInfo[] = [
            {
                id: 'model1', name: 'Test Model 1',
                provider: '',
                maxTokens: 0,
                capabilities: []
            },
        ];
        const updatedModels: ModelInfo[] = [
            {
                id: 'model2', name: 'Test Model 2',
                provider: '',
                maxTokens: 0,
                capabilities: []
            },
        ];

        await modelCache.set(provider, initialModels);
        await modelCache.set(provider, updatedModels);
        const result = await modelCache.get(provider);

        expect(result).toEqual(updatedModels);
    });
}); 