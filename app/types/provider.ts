export interface ModelListMapping {
    arrayPath: string;
    fields: {
        id: string | { static: string };
        name: string | { static: string };
        maxTokens: string | { static: number };
        capabilities?: {
            static?: string[];
            conditional?: {
                if: string;
                then: string;
            }[];
        };
    };
}

export interface ProviderInfo {
  id: string;
  name: string;
  capabilities: ProviderCapabilities;
  staticModels: ModelInfo[];
  baseUrl?: string;
  modelListUrl?: string;
  apiKeyLink?: string;
  modelListMapping?: ModelListMapping;
}

export interface ProviderCapabilities {
  supportsDynamicModels: boolean;
  supportsVision: boolean;
  requiresApiKey: boolean;
  maxTokens: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
  capabilities: string[];
}

export interface ProviderConfig {
  selectedProvider: string;
  selectedModel: string;
  apiKeys: Record<string, string>;
}

export type ProviderMap = Map<string, ProviderInfo>;
