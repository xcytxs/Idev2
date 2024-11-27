import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProviderManager } from '../ProviderManager';
import type { ProviderInfo, ProviderConfig, ModelInfo } from '~/types/provider';

// Mock the config file at the top level
vi.mock('~/assets/providers/providers-config.json', () => ({
    default: [],
    __esModule: true
}));

describe('ProviderManager', () => {
    // Mock dependencies
    const mockModelCache = {
        get: vi.fn(),
        set: vi.fn(),
    };

    const mockKeyResolver = {
        resolveKey: vi.fn(),
    };

    const mockModelListFetcher = {
        fetchModelList: vi.fn(),
    };

    const mockModelListTransformer = {
        transformModelList: vi.fn(),
    };

    const mockLogger = {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        setLevel: vi.fn(),
    };

    let providerManager: ProviderManager;

    beforeEach(() => {
        vi.clearAllMocks();
        providerManager = new ProviderManager(
            new Map(),
            mockModelCache,
            mockKeyResolver,
            mockModelListFetcher,
            mockModelListTransformer,
            mockLogger
        );
    });

    describe('initialize', () => {
        it('should initialize providers from config file', async () => {
            const mockConfig: ProviderInfo[] = [{
                id: 'test-provider',
                name: 'Test Provider',
                capabilities: {
                    supportsDynamicModels: false,
                    supportsVision: false,
                    requiresApiKey: false,
                    maxTokens: 0
                },
                staticModels: [],
            }];

            vi.doMock('~/assets/providers/providers-config.json', () => ({
                default: mockConfig,
                __esModule: true
            }));

            await providerManager.initialize();
            const providers = (providerManager as any).providers;
            expect(providers.get('test-provider')).toEqual(mockConfig[0]);
        });

        it('should handle initialization errors', async () => {
            // Mock the config to be an invalid format
            vi.doMock('~/assets/providers/providers-config.json', () => ({
                default: null,
                __esModule: true
            }));

            await expect(providerManager.initialize())
                .rejects.toThrowError();

        });
    });

    afterEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    describe('getProviderModels', () => {
        const mockProviderInfo: ProviderInfo = {
            id: 'test-provider',
            name: 'Test Provider',
            capabilities: {
                supportsDynamicModels: true,
                supportsVision: false,
                requiresApiKey: false,
                maxTokens: 0
            },
            modelListUrl: 'https://api.test/models',
            staticModels: [],
        };
        const mockConfig: ProviderConfig = {
            apiKeys: { "test-provider": 'test-key' },
            selectedProvider: '',
            selectedModel: ''
        };

        beforeEach(() => {
            (providerManager as any).providers.set('test-provider', mockProviderInfo);
        });

        it('should return cached models if available', async () => {
            const cachedModels: ModelInfo[] = [{
                id: 'model1', name: 'Model 1',
                provider: '',
                maxTokens: 0,
                capabilities: []
            }];
            mockModelCache.get.mockResolvedValue(cachedModels);

            const result = await providerManager.getProviderModels('test-provider', mockConfig);

            expect(result).toEqual(cachedModels);
            expect(mockModelCache.get).toHaveBeenCalledWith('test-provider');
            expect(mockModelListFetcher.fetchModelList).not.toHaveBeenCalled();
        });

        it('should fetch and transform dynamic models if not cached', async () => {
            mockModelCache.get.mockResolvedValue(null);
            mockKeyResolver.resolveKey.mockReturnValue('resolved-key');
            mockModelListFetcher.fetchModelList.mockResolvedValue({ models: [] });

            const transformedModels: ModelInfo[] = [{
                id: 'model1', name: 'Model 1',
                provider: '',
                maxTokens: 0,
                capabilities: []
            }];
            mockModelListTransformer.transformModelList.mockReturnValue(transformedModels);

            const result = await providerManager.getProviderModels('test-provider', mockConfig);

            expect(result).toEqual(transformedModels);
            expect(mockModelCache.set).toHaveBeenCalledWith('test-provider', transformedModels);
        });

        it('should return static models for providers without dynamic models', async () => {
            const staticProvider: ProviderInfo = {
                id: 'static-provider',
                name: 'Static Provider',
                capabilities: {
                    supportsDynamicModels: false,
                    supportsVision: false,
                    requiresApiKey: false,
                    maxTokens: 0
                },
                staticModels: [{
                    id: 'static1', name: 'Static 1',
                    provider: '',
                    maxTokens: 0,
                    capabilities: []
                }],
            };
            (providerManager as any).providers.set('static-provider', staticProvider);
            mockModelCache.get.mockResolvedValue(null);

            const result = await providerManager.getProviderModels('static-provider', mockConfig);

            expect(result).toEqual(staticProvider.staticModels);
        });

        it('should throw error if provider not found', async () => {
            await expect(providerManager.getProviderModels('non-existent', mockConfig))
                .rejects.toThrow('Provider non-existent not found');
        });

        it('should throw error if modelListUrl not configured for dynamic provider', async () => {
            const invalidProvider: ProviderInfo = {
                id: 'invalid-provider',
                name: 'Invalid Provider',
                capabilities: {
                    supportsDynamicModels: true,
                    supportsVision: false,
                    requiresApiKey: false,
                    maxTokens: 0
                },
                staticModels: [],
            };
            (providerManager as any).providers.set('invalid-provider', invalidProvider);
            mockModelCache.get.mockResolvedValue(null);

            await expect(providerManager.getProviderModels('invalid-provider', mockConfig))
                .rejects.toThrow('Model list URL not configured');
        });

        it('should handle fetch errors gracefully', async () => {
            mockModelCache.get.mockResolvedValue(null);
            mockKeyResolver.resolveKey.mockReturnValue('resolved-key');
            mockModelListFetcher.fetchModelList.mockRejectedValue(new Error('API Error'));

            await expect(providerManager.getProviderModels('test-provider', mockConfig))
                .rejects.toThrow('API Error');
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });
}); 