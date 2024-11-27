import type { ProviderInfo, ProviderConfig, ModelInfo, ProviderMap } from "~/types/provider";
import { ModelCache, type IModelCache } from "./ModelCache"
import { KeyResolver, type IKeyResolver } from "./KeyResolver";
import { createScopedLogger, type Logger } from "~/utils/logger";
import { ModelListTransformer } from "./ModelListTransformer";
import { ModelListFetcher } from "./ModelListFetcher";

export interface IModelListFetcher {
    fetchModelList(url: string, token?: string): Promise<any>
}

export interface IModelListTransformer {
    transformModelList(apiResponse: any, providerInfo: ProviderInfo): ModelInfo[];
}

export class ProviderManager {
    constructor(
        private providers: ProviderMap = new Map<string, ProviderInfo>(),
        private modelCache: IModelCache = new ModelCache(),
        private keyResolver: IKeyResolver = new KeyResolver(),
        private modelListFetcher: IModelListFetcher = new ModelListFetcher(),
        private modelListTransformer: IModelListTransformer = new ModelListTransformer(),
        private logger: Logger = createScopedLogger('ProviderManager')
    ) {
        this.logger.trace('ProviderManager constructor');
    }

    async initialize(providersConfigPath: string = "~/assets/providers/providers-config.json") {
        try {
            this.logger.debug('Initializing ProviderManager with arguments:', { providersConfigPath });

            const { default: config } = await import(providersConfigPath) as { default: ProviderInfo[] };
            this.logger.debug('Imported providers config:', config);

            config.forEach((provider) => {
                this.logger.debug('Adding provider to map:', provider.id);
                this.providers.set(provider.id, provider);
            });

            this.logger.debug('Initialized provider map:', this.providers);
        } catch (error) {
            this.logger.error('Failed to initialize ProviderManager:', error);
            throw error;
        }
    }

    async getProviderModels(provider: string, config: ProviderConfig): Promise<ModelInfo[]> {
        try {
            this.logger.debug('Getting models for provider:', { provider, config });

            const providerInfo = this.providers.get(provider);
            if (!providerInfo) {
                this.logger.error('Provider not found:', provider);
                throw new Error(`Provider ${provider} not found`);
            }

            // Check cache first
            this.logger.debug('Checking cache for provider models:', provider);
            const cached = await this.modelCache.get(provider);
            if (cached) {
                this.logger.debug('Found cached models for provider:', { provider, modelCount: cached.length });
                return cached;
            }

            if (providerInfo.capabilities.supportsDynamicModels && !providerInfo?.modelListUrl) {
                this.logger.error('Model list URL not configured for provider:', provider);
                throw new Error('Model list URL not configured');
            }

            // Get model list
            if (providerInfo.capabilities.supportsDynamicModels && providerInfo.modelListUrl) {
                this.logger.debug('Fetching dynamic models for provider:', provider);
                const apiKey = this.keyResolver.resolveKey(providerInfo.id, config);
                const apiResponse = await this.modelListFetcher.fetchModelList(providerInfo.modelListUrl, apiKey);
                const models = this.modelListTransformer.transformModelList(apiResponse, providerInfo);
                await this.modelCache.set(provider, models);
                this.logger.debug('Cached dynamic models for provider:', { provider, modelCount: models.length });
                return models;
            }

            this.logger.debug('Returning static models for provider:', { provider, modelCount: providerInfo.staticModels.length });
            return providerInfo.staticModels;
        } catch (error) {
            this.logger.error('Failed to get provider models:', { provider, error });
            throw error;
        }
    }

}
