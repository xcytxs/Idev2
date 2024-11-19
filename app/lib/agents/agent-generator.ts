import type { AgentConfig } from "~/types/agent";
import type { ParameterConfig, ToolConfig } from "~/types/tools";

/**
 * Generates structured prompts for AI agents based on their configuration
 * @class AgentPromptGenerator
 */
class AgentPromptGenerator {
    /** Configuration object for the agent */
    private config: AgentConfig;
    /** Storage for template variable values */
    private templateValues: Record<string, any> = {};

    /**
     * Creates a new instance of AgentPromptGenerator
     * @param config - The configuration object for the agent
     */
    constructor(config: AgentConfig) {
        this.config = config;
    }


    /**
     * Sets a value for a template variable
     * @param name - Name of the template variable
     * @param value - Value to set for the template variable
     * @throws Error if the template variable is not defined in the agent config
     */
    setTemplateValue(name: string, value: any): void {
        if (!this.config.templateVariables?.some(v => v.name === name)) {
            throw new Error(`Template variable ${name} not defined in agent config`);
        }
        this.templateValues[name] = value;
    }

    /**
     * Generates a complete prompt string based on the agent's configuration
     * @returns A formatted string containing the complete agent prompt
     */
    generatePrompt(): string {
        // Build the complete prompt with all sections
        return `
You are a ${this.config.description} with ONE purpose: ${this.config.purpose}. 
You MUST respond ONLY with a toolCall tag structure.
Your agentId is: ${this.config.agentId}

${this.generateTemplateVariablesSection()}

## Available Tools

${this.generateToolsSection()}

## Response Format

You MUST respond using ONLY this exact structure:
<toolCall name="{tool_name}" agentId="${this.config.agentId}">
    <parameter name="{parameter_name}">{parameter_value}</parameter>
</toolCall>

Where:
- tool_name must be one of: ${this.config.tools.map(t => `"${t.name}"`).join(', ')}
- agentId must always be "${this.config.agentId}"

${this.generateRulesSection()}

## Example Valid Responses

${this.generateExamplesSection()}

## STRICT RULES

1. Tag Structure Rules:
   - MUST use exactly one toolCall tag as the root
   - MUST set name attribute to one of the available tool names
   - MUST include agentId="${this.config.agentId}" in every toolCall tag
   - MUST include all required parameters for the chosen tool
   - MUST use proper tag nesting and indentation
   - MUST NOT add any additional tags or attributes besides name and agentId
   - MUST NOT modify tag names or structure

2. Parameter Rules:
   - MUST include all required parameters for the selected tool
   - MUST use exact parameter names as specified
   - MUST provide values of the correct type
   - MUST NOT add additional parameters

3. Format Rules:
   - MUST NOT include XML declaration
   - MUST NOT include any other content outside the toolCall tag
   - MUST use proper XML escaping for special characters
   - MUST maintain consistent indentation

4. AgentId Rules:
   - MUST always include agentId="${this.config.agentId}"
   - MUST NOT modify or change the agentId
   - MUST NOT omit the agentId

NO EXCEPTIONS TO THESE RULES ARE ALLOWED.`;
    }

    /**
     * Generates the tools section of the prompt
     * @returns Formatted string containing tool descriptions and parameters
     * @private
     */
    private generateToolsSection(): string {
        return this.config.tools.map(tool => `
### ${tool.name}
${tool.description}

Parameters:
${tool.parameters.map(param =>
            `- ${param.name}: ${param.type}
    ${param.description}`
        ).join('\n\n')}`
        ).join('\n\n');
    }

    /**
     * Generates the template variables section of the prompt
     * @returns Formatted string containing template variable values
     * @private
     */
    private generateTemplateVariablesSection(): string {
        let sections = [];

        for (const variable of this.config.templateVariables || []) {
            const value = this.templateValues[variable.name];
            if (value) {
                sections.push(`
<<${variable.name.toUpperCase()}>>
${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
<</${variable.name.toUpperCase()}>>`);
            }
        }

        if (sections.length > 0) {
            let sectionHeader = '## Context Variables';
            sections = [sectionHeader, ...sections];
        }
        return sections.join('\n\n');
    }

    /**
     * Generates the rules section of the prompt
     * @returns Formatted string containing categorized rules
     * @private
     */
    private generateRulesSection(): string {
        return this.config.rules
            .map(category => `## ${category.category}\n\n${category.items.map(rule => `- ${rule}`).join('\n')}`)
            .join('\n\n');
    }

    /**
     * Generates example responses for each tool
     * @returns Formatted string containing example tool calls
     * @private
     */
    private generateExamplesSection(): string {
        return this.config.tools.map(tool =>
            `Example using ${tool.name}:
<toolCall name="${tool.name}">
${tool.parameters.map(param =>
                `    <parameter name="${param.name}">${param.example}</parameter>`
            ).join('\n')}
</toolCall>`
        ).join('\n\n');
    }
}



/**
 * Represents the response from a tool execution
 * @interface ToolResponse
 */
interface ToolResponse {
    /** Status of the tool execution */
    status: 'success' | 'error';
    /** Result message from the tool */
    message: string;
    /** Any additional data returned by the tool */
    data?: any;
}

/**
 * Configuration interface for agent initialization
 * @interface AgentInitConfig
 */
interface AgentInitConfig {
    /** Template values to be set during initialization */
    templateValues?: Record<string, any>;
}

/**
 * Main Agent class that encapsulates prompt generation and tool execution
 * @class Agent
 */
export class Agent {
    /** Agent configuration */
    private config: AgentConfig;
    /** Prompt generator instance */
    private promptGenerator: AgentPromptGenerator;
    /** Map of tool implementations */
    private tools: Map<string, ToolConfig>;

    /**
     * Creates a new Agent instance
     * @param config - Agent configuration
     * @param initConfig - Optional initialization configuration
     */
    constructor(config: AgentConfig, initConfig: AgentInitConfig = {}) {
        this.validateConfig(config);
        this.config = config;
        this.promptGenerator = new AgentPromptGenerator(config);
        this.tools = new Map(config.tools.map(tool => [tool.name, tool]));

        // Set any initial template values
        if (initConfig.templateValues) {
            for (const [key, value] of Object.entries(initConfig.templateValues)) {
                this.setTemplateValue(key, value);
            }
        }
    }

    /**
     * Validates the agent configuration
     * @param config - Configuration to validate
     * @throws Error if configuration is invalid
     * @private
     */
    private validateConfig(config: AgentConfig): void {
        if (!config.agentId) {
            throw new Error('Agent ID is required');
        }
        if (!config.tools || config.tools.length === 0) {
            throw new Error('At least one tool must be configured');
        }

        // Validate tools
        const toolNames = new Set<string>();
        for (const tool of config.tools) {
            if (!tool.name || !tool.execute) {
                throw new Error('Tool name and execute function are required');
            }
            if (toolNames.has(tool.name)) {
                throw new Error(`Duplicate tool name: ${tool.name}`);
            }
            toolNames.add(tool.name);

            // Validate parameters
            if (tool.parameters) {
                for (const param of tool.parameters) {
                    if (!param.name || !param.type) {
                        throw new Error(`Invalid parameter configuration in tool ${tool.name}`);
                    }
                }
            }
        }
    }

    /**
     * Sets a template value for prompt generation
     * @param name - Template variable name
     * @param value - Template variable value
     */
    setTemplateValue(name: string, value: any): void {
        this.promptGenerator.setTemplateValue(name, value);
    }

    /**
     * Generates the agent's prompt
     * @returns Generated prompt string
     */
    generatePrompt(): string {
        return this.promptGenerator.generatePrompt();
    }

    /**
     * Executes a tool with the given name and parameters
     * @param toolName - Name of the tool to execute
     * @param parameters - Parameters for the tool
     * @returns Promise resolving to tool execution result
     */
    async executeTool(toolName: string, parameters: Record<string, string>): Promise<ToolResponse> {
        const tool = this.tools.get(toolName);
        if (!tool) {
            return {
                status: 'error',
                message: `Tool not found: ${toolName}`
            };
        }

        // Validate parameters
        const validation = this.validateToolParameters(toolName, parameters);
        if (!validation.valid) {
            return {
                status: 'error',
                message: `Parameter validation failed: ${validation.errors?.join(', ')}`
            };
        }

        try {
            const result = await tool.execute(parameters);
            return {
                status: 'success',
                message: result
            };
        } catch (error) {
            return {
                status: 'error',
                message: error instanceof Error ? error.message : 'Tool execution failed'
            };
        }
    }

    /**
     * Validates tool parameters against their configuration
     * @param toolName - Name of the tool
     * @param parameters - Parameters to validate
     * @returns Validation result object
     */
    validateToolParameters(toolName: string, parameters: Record<string, string>): {
        valid: boolean;
        errors?: string[];
    } {
        const tool = this.tools.get(toolName);
        if (!tool) {
            return { valid: false, errors: [`Tool not found: ${toolName}`] };
        }

        const errors: string[] = [];
        const providedParams = new Set(Object.keys(parameters));
        const requiredParams = new Set(tool.parameters.map(p => p.name));

        // Check for required parameters
        for (const param of tool.parameters) {
            if (!providedParams.has(param.name)) {
                errors.push(`Missing required parameter: ${param.name}`);
            }
        }

        // Check for unknown parameters
        for (const paramName of providedParams) {
            if (!requiredParams.has(paramName)) {
                errors.push(`Unknown parameter: ${paramName}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    /**
     * Returns the tool configuration for a given tool name
     * @param toolName - Name of the tool
     * @returns Tool configuration or undefined if not found
     */
    getTool(toolName: string): ToolConfig | undefined {
        return this.tools.get(toolName);
    }

    /**
     * Returns all configured tools
     * @returns Array of tool configurations
     */
    getTools(): ToolConfig[] {
        return Array.from(this.tools.values());
    }

    /**
     * Returns the agent's configuration
     * @returns Agent configuration
     */
    getConfig(): AgentConfig {
        return this.config;
    }

    /**
     * Checks if a tool exists
     * @param toolName - Name of the tool
     * @returns boolean indicating if the tool exists
     */
    hasTool(toolName: string): boolean {
        return this.tools.has(toolName);
    }

    /**
     * Gets a list of all tool names
     * @returns Array of tool names
     */
    getToolNames(): string[] {
        return Array.from(this.tools.keys());
    }

    /**
     * Gets the parameters configuration for a specific tool
     * @param toolName - Name of the tool
     * @returns Array of parameter configurations or undefined if tool not found
     */
    getToolParameters(toolName: string): ParameterConfig[] | undefined {
        return this.tools.get(toolName)?.parameters;
    }
}