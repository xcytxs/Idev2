import type { ModelInfo } from "~/types/provider";
import { createScopedLogger, renderLogger, type Logger } from "~/utils/logger";

export interface IModelCache {
    get(provider: string): Promise<ModelInfo[] | null>;
    set(provider: string, models: ModelInfo[]): Promise<void>;
}

export class ModelCache implements IModelCache {
    private cache: Map<string, { models: ModelInfo[]; timestamp: number }>;
    private readonly TTL = 1000 * 60 * 5; // 5 minutes

    constructor(private logger: Logger = createScopedLogger('ModelCache')) {
        this.logger.trace('ModelCache');
        this.cache = new Map();
    }

    async get(provider: string): Promise<ModelInfo[] | null> {
        this.logger.debug(`Getting cached models for provider: ${provider}`);
        const cached = this.cache.get(provider);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > this.TTL) {
            this.cache.delete(provider);
            return null;
        }
        this.logger.debug(`Returning cached models for provider:`, cached.models);
        return cached.models;
    }

    async set(provider: string, models: ModelInfo[]): Promise<void> {
        this.cache.set(provider, {
            models,
            timestamp: Date.now()
        });
    }
}
