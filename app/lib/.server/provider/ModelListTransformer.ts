import type { ModelInfo, ProviderInfo } from "~/types/provider";
import JSONPath from "jsonpath";
import { createScopedLogger, type Logger } from "~/utils/logger";
import type { IModelListTransformer } from "./ProviderManager";

export class ModelListTransformer implements IModelListTransformer {
    constructor(
        private logger: Logger = createScopedLogger('ModelListTransformer')
    ) {}

    transformModelList(apiResponse: any, providerInfo: ProviderInfo): ModelInfo[] {
        const mapping = providerInfo.modelListMapping;
        const provider = providerInfo.name;

        try {
            if (!mapping) {
                throw new Error('Model list mapping not configured');
            }

            const models = JSONPath.query(apiResponse, mapping.arrayPath);

            return models.map(model => ({
                id: this.extractValue(model, mapping.fields.id),
                name: this.extractValue(model, mapping.fields.name),
                provider,
                maxTokens: this.extractValue(model, mapping.fields.maxTokens),
                capabilities: this.extractCapabilities(model, mapping.fields.capabilities)
            }));
        } catch (error) {
            this.logger.error('Error transforming model list:', error);
            throw error;
        }
    }

    private extractValue(model: any, pathOrStatic: string | { static: any }): any {
        if (typeof pathOrStatic === 'object' && 'static' in pathOrStatic) {
            return pathOrStatic.static;
        }
        const result = JSONPath.query(model, pathOrStatic);
        return result[0];
    }

    private extractCapabilities(model: any, capConfig: any): string[] {
        const capabilities = [...(capConfig.static || [])];

        if (capConfig.conditional) {
            capConfig.conditional.forEach((condition: { if: string; then: string; }) => {
                const result = JSONPath.query(model, condition.if);
                if (result[0]) {
                    capabilities.push(condition.then);
                }
            });
        }

        return capabilities;
    }
} 