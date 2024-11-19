import type { ToolConfig } from "./tools";

/**
 * Configuration interface for an agent's capabilities and behavior
 * @interface AgentConfig
 */
export interface AgentConfig {
    /** Name of the agent */
    name: string;
    /** Unique identifier for the agent */
    agentId: string;
    /** Description of the agent's role and capabilities */
    description: string;
    /** The primary purpose or objective of the agent */
    purpose: string;
    /** Array of tools available to the agent */
    tools: ToolConfig[];
    /** Categorized rules that govern the agent's behavior */
    rules: {
        /** Category name for a group of rules */
        category: string;
        /** Array of rule statements in this category */
        items: string[];
    }[];
    /** Optional template variables that can be used in prompt generation */
    templateVariables?: {
        /** Name of the template variable */
        name: string;
        /** Data type of the template variable */
        type: string;
        /** Description of the template variable's purpose */
        description: string;
    }[];
}
