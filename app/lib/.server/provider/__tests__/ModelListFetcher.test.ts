import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelListFetcher } from '../ModelListFetcher';
import { createScopedLogger } from '~/utils/logger';

// Mock the logger
vi.mock('~/utils/logger', () => ({
    createScopedLogger: vi.fn(() => ({
        debug: vi.fn(),
        error: vi.fn()
    }))
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ModelListFetcher', () => {
    let fetcher: ModelListFetcher;
    const mockLogger = createScopedLogger('ModelListFetcher');

    beforeEach(() => {
        vi.clearAllMocks();
        fetcher = new ModelListFetcher(mockLogger);
    });

    it('should successfully fetch model list without token', async () => {
        const mockData = { models: ['model1', 'model2'] };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockData)
        });

        const result = await fetcher.fetchModelList('https://api.example.com/models');

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/models', {
            headers: {}
        });
        expect(mockLogger.debug).toHaveBeenCalledWith('Fetching model list from URL:', 'https://api.example.com/models');
        expect(mockLogger.debug).toHaveBeenCalledWith('Successfully fetched model list');
    });

    it('should successfully fetch model list with token', async () => {
        const mockData = { models: ['model1', 'model2'] };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockData)
        });

        const result = await fetcher.fetchModelList('https://api.example.com/models', 'test-token');

        expect(result).toEqual(mockData);
        expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/models', {
            headers: {
                'Authorization': 'Bearer test-token'
            }
        });
    });

    it('should throw error when response is not ok', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            statusText: 'Unauthorized'
        });

        await expect(fetcher.fetchModelList('https://api.example.com/models'))
            .rejects
            .toThrow('Failed to fetch models: Unauthorized');

        expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch models:', {
            status: 401,
            statusText: 'Unauthorized'
        });
    });

    it('should handle network errors', async () => {
        const networkError = new Error('Network error');
        mockFetch.mockRejectedValueOnce(networkError);

        await expect(fetcher.fetchModelList('https://api.example.com/models'))
            .rejects
            .toThrow('Network error');

        expect(mockLogger.error).toHaveBeenCalledWith('Error fetching model list:', {
            error: networkError
        });
    });
}); 