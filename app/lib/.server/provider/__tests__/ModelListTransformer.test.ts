import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelListTransformer } from '../ModelListTransformer';
import type { ProviderInfo } from '~/types/provider';

describe('ModelListTransformer', () => {
    let transformer: ModelListTransformer;
    let mockLogger: { error: any };

    beforeEach(() => {
        mockLogger = {
            error: vi.fn()
        };
        transformer = new ModelListTransformer(mockLogger as any);
    });

    describe('transformModelList', () => {
        it('should transform API response to ModelInfo array', () => {
            const apiResponse = {
                models: [
                    { id: 'model1', name: 'Model One', tokens: 1000, feature: true },
                    { id: 'model2', name: 'Model Two', tokens: 2000, feature: false }
                ]
            };

            const providerInfo: ProviderInfo = {
                name: 'test-provider',
                modelListMapping: {
                    arrayPath: '$.models[*]',
                    fields: {
                        id: '$.id',
                        name: '$.name',
                        maxTokens: '$.tokens',
                        capabilities: {
                            static: ['basic'],
                            conditional: [
                                { if: '$.feature', then: 'advanced' }
                            ]
                        }
                    }
                }
            } as ProviderInfo;

            const result = transformer.transformModelList(apiResponse, providerInfo);

            expect(result).toEqual([
                {
                    id: 'model1',
                    name: 'Model One',
                    provider: 'test-provider',
                    maxTokens: 1000,
                    capabilities: ['basic', 'advanced']
                },
                {
                    id: 'model2',
                    name: 'Model Two',
                    provider: 'test-provider',
                    maxTokens: 2000,
                    capabilities: ['basic']
                }
            ]);
        });

        it('should handle static values in field mappings', () => {
            const apiResponse = {
                models: [{ id: 'model1' }]
            };

            const providerInfo: ProviderInfo = {
                name: 'test-provider',
                modelListMapping: {
                    arrayPath: '$.models[*]',
                    fields: {
                        id: '$.id',
                        name: { static: 'Static Name' },
                        maxTokens: { static: 4000 },
                        capabilities: {
                            static: ['basic']
                        }
                    }
                }
            } as ProviderInfo;

            const result = transformer.transformModelList(apiResponse, providerInfo);

            expect(result[0]).toEqual({
                id: 'model1',
                name: 'Static Name',
                provider: 'test-provider',
                maxTokens: 4000,
                capabilities: ['basic']
            });
        });

        it('should throw error when mapping is not configured', () => {
            const providerInfo = {
                name: 'test-provider',
                modelListMapping: null
            } as any;

            expect(() => 
                transformer.transformModelList({}, providerInfo)
            ).toThrow('Model list mapping not configured');
            
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should handle empty conditional capabilities', () => {
            const apiResponse = {
                models: [{ id: 'model1' }]
            };

            const providerInfo = {
                name: 'test-provider',
                modelListMapping: {
                    arrayPath: '$.models',
                    fields: {
                        id: '$.id',
                        name: { static: 'Test' },
                        maxTokens: { static: 1000 },
                        capabilities: {
                            static: ['basic'],
                            conditional: []
                        }
                    }
                }
            } as any

            const result = transformer.transformModelList(apiResponse, providerInfo);

            expect(result[0].capabilities).toEqual(['basic']);
        });

        it('should handle capabilities without static values', () => {
            const apiResponse = {
                models: [{ id: 'model1', feature: true }]
            };

            const providerInfo: ProviderInfo = {
                name: 'test-provider',
                modelListMapping: {
                    arrayPath: '$.models[*]',
                    fields: {
                        id: '$.id',
                        name: { static: 'Test' },
                        maxTokens: { static: 1000 },
                        capabilities: {
                            conditional: [
                                { if: '$.feature', then: 'advanced' }
                            ]
                        }
                    }
                }
            } as ProviderInfo;

            const result = transformer.transformModelList(apiResponse, providerInfo);

            expect(result[0].capabilities).toEqual(['advanced']);
        });
    });
}); 