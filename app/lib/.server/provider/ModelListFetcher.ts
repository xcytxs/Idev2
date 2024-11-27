import { createScopedLogger, type Logger } from "~/utils/logger";
import { type IModelListFetcher } from "./ProviderManager";

export class ModelListFetcher implements IModelListFetcher {
    constructor(
        private logger: Logger = createScopedLogger('ModelListFetcher')
    ) {}

    async fetchModelList(url: string, token?: string): Promise<any> {
        try {
            this.logger.debug('Fetching model list from URL:', url);

            const headers: Record<string, string> = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(url, { headers });

            if (!response.ok) {
                this.logger.error('Failed to fetch models:', {
                    status: response.status,
                    statusText: response.statusText
                });
                throw new Error(`Failed to fetch models: ${response.statusText}`);
            }

            const data = await response.json();
            this.logger.debug('Successfully fetched model list');
            return data;
        } catch (error) {
            this.logger.error('Error fetching model list:', { error });
            throw error;
        }
    }
} 