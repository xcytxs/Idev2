/**
 * Configuration interface for a parameter in a tool
 * @interface ParameterConfig
 */
export interface ParameterConfig {
    /** The name of the parameter */
    name: string;
    /** The data type of the parameter */
    type: string;
    /** Description explaining the parameter's purpose and usage */
    description: string;
    /** Example value for the parameter */
    example: string;
}

/**
 * Configuration interface for a tool that can be used by an agent
 * @interface ToolConfig
 */
export interface ToolConfig {
    /** Unique identifier for the tool */
    name: string;
    /** Display name for the tool */
    label: string;
    /** The type of tool - either 'action' for command execution or 'response' responding with text to user */
    type: 'action' | 'response';
    /** Detailed description of what the tool does */
    description: string;
    /** Array of parameters required by the tool */
    parameters: ParameterConfig[];
    /** Function to execute the tool with given arguments */
    execute: (args: { [key: string]: string }) => Promise<string>;
}