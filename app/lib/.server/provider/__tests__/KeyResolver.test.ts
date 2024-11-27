import { describe, it, expect } from 'vitest';
import { KeyResolver } from '../KeyResolver';
import type { ProviderConfig } from '~/types/provider';

describe('KeyResolver', () => {
    const resolver = new KeyResolver();

    it('should return user-provided API key when available', () => {
        const config: ProviderConfig = {
            apiKeys: {
                'openai': 'user-key'
            },
            selectedProvider: '',
            selectedModel: ''
        };

        const key = resolver.resolveKey('openai', config);
        expect(key).toBe('user-key');
    });

    it('should return environment API key when user key is not available', () => {
        const originalEnv = process.env.OPENAI_API_KEY;
        process.env.OPENAI_API_KEY = 'env-key';

        const config: ProviderConfig = {
            apiKeys: {},
            selectedProvider: '',
            selectedModel: ''
        };

        const key = resolver.resolveKey('openai', config);
        expect(key).toBe('env-key');

        // Cleanup
        if (originalEnv) {
            process.env.OPENAI_API_KEY = originalEnv;
        } else {
            delete process.env.OPENAI_API_KEY;
        }
    });

    it('should return undefined when no key is available', () => {
        const config: ProviderConfig = {
            apiKeys: {},
            selectedProvider: '',
            selectedModel: ''
        };

        const key = resolver.resolveKey('openai', config);
        expect(key).toBeUndefined();
    });
}); 