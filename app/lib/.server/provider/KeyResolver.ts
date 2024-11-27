import type { ProviderConfig } from "~/types/provider";

export interface IKeyResolver {
    resolveKey(provider: string, config: ProviderConfig): string | undefined;
}

export class KeyResolver implements IKeyResolver {
    resolveKey(provider: string, config: ProviderConfig): string | undefined {
        // Priority: User provided > Environment > Default
        return config.apiKeys[provider] ||
            process.env[`${provider.toUpperCase()}_API_KEY`];
    }
}