/**
 * Represents the current state of the XML parser
 * @type ParserState
 */
type ParserState = 'IDLE' | 'IN_TOOL_CALL' | 'IN_PARAMETER' | 'COLLECTING_TAG';

/**
 * Represents an event that occurs during tool call parsing
 * @interface ToolCallEvent
 */
interface ToolCallEvent {
    /** Unique identifier for the message being parsed */
    messageId: string;
    /** Type of the event - either start or completion of a tool call */
    type: 'toolCallStart' | 'toolCallComplete';
    /** Unique identifier for the tool call */
    id: string;
    /** Name of the tool being called */
    name: string;
    /** Identifier of the agent making the tool call */
    agentId: string;
    /** Optional parameters passed to the tool */
    parameters?: Record<string, string>;

    processed?:boolean;
}

/**
 * Callback functions for handling tool call events
 * @interface ParserCallbacks
 */
interface ParserCallbacks {
    /** Callback for when a tool call starts */
    onToolCallStart?: (event: ToolCallEvent) => void;
    /** Callback for when a tool call completes */
    onToolCallComplete?: (event: ToolCallEvent) => void;
}

/**
 * Maintains the state of the parser for a specific message
 * @interface ParserCursor
 */
interface ParserCursor {
    /** Current position in the input string */
    position: number;
    /** Current state of the parser */
    state: ParserState;
    /** ID of the current tool call being processed */
    currentToolCallId: string | null;
    /** Buffer for collecting tag content */
    tagBuffer: string;
    /** Name of the current attribute being processed */
    currentAttributeName: string;
    /** Value of the current attribute being processed */
    currentAttributeValue: string;
    /** Collected parameters for the current tool call */
    parameters: Record<string, string>;
    /** Name of the current tool call */
    name?: string;
    /** Agent ID for the current tool call */
    agentId?: string;
    /** Current nesting depth of XML tags */
    depth: number;
    /** Current index of the current action */
    actionIndex: number;
}

/**
 * Parser for processing XML-formatted agent output containing tool calls
 * Implements a streaming parser that can process input incrementally
 * @class AgentOutputParser
 */
export class AgentOutputParser {
    /** Map of message IDs to their corresponding parser cursors */
    private cursors: Map<string, ParserCursor>;
    /** Callback functions for parser events */
    private callbacks: ParserCallbacks;

    /**
     * Creates a new instance of AgentOutputParser
     * @param callbacks - Optional callback functions for parser events
     */
    constructor(callbacks: ParserCallbacks = {}) {
        this.callbacks = callbacks;
        this.cursors = new Map();
    }

    /**
     * Returns the opening tag string for tool calls
     * @returns The tool call opening tag
     */
    getToolCallTagOpen(): string {
        return "<toolCall";
    }

    /**
     * Creates a new parser cursor with initial state
     * @returns A new ParserCursor object
     * @private
     */
    private getInitialCursor(): ParserCursor {
        return {
            position: 0,
            state: 'IDLE',
            currentToolCallId: null,
            tagBuffer: '',
            currentAttributeName: '',
            currentAttributeValue: '',
            parameters: {},
            actionIndex: 0,
            depth: 0
        };
    }

    /**
     * Parses a chunk of input text and updates the parser state
     * @param messageId - Unique identifier for the message being parsed
     * @param fullBuffer - The complete input text to parse
     * @returns Object containing updated cursor and optional event
     */
    parse(messageId: string, fullBuffer: string, processed:boolean=false): { cursor: ParserCursor, event?: ToolCallEvent } {
        // Get or create cursor for this message
        let cursor = this.cursors.get(messageId);
        if (!cursor) {
            cursor = this.getInitialCursor();
            this.cursors.set(messageId, cursor);
        }

        // Process input character by character
        while (cursor.position < fullBuffer.length) {
            const char = fullBuffer[cursor.position];

            switch (cursor.state) {
                case 'IDLE':
                    // Look for opening angle bracket to start tag collection
                    if (char === '<') {
                        cursor.state = 'COLLECTING_TAG';
                        cursor.tagBuffer = char;
                    }
                    break;

                case 'COLLECTING_TAG':
                    cursor.tagBuffer += char;

                    // Check for specific tag types
                    if (cursor.tagBuffer === '<toolCall') {
                        cursor.state = 'IN_TOOL_CALL';
                        cursor.depth++;
                        cursor.tagBuffer = '';
                        cursor.currentToolCallId = this.generateToolCallId(cursor);
                    } else if (cursor.tagBuffer === '<parameter') {
                        cursor.state = 'IN_PARAMETER';
                        cursor.tagBuffer = '';
                    } else if (cursor.tagBuffer === '</toolCall>') {
                        let { cursor: newCursor, event } = this.handleToolCallEnd(messageId, cursor, processed);
                        return { cursor:newCursor, event };
                    } else if (cursor.tagBuffer === '</parameter>') {
                        this.handleParameterEnd(cursor);
                    } else if (cursor.tagBuffer.length > 15) {
                        // Reset if tag is too long to be valid
                        cursor.state = 'IDLE';
                        cursor.tagBuffer = '';
                    }
                    break;

                case 'IN_TOOL_CALL':
                    // Collect and process tool call attributes
                    if (char === '>') {
                        const attributes = this.processAttributes(cursor.tagBuffer);
                        if (attributes.name && attributes.agentId) {
                            this.handleToolCallStart(messageId, cursor, { name: attributes.name, agentId: attributes.agentId, ...attributes });
                        }
                        cursor.tagBuffer = '';
                        cursor.state = 'IDLE';
                    } else {
                        cursor.tagBuffer += char;
                    }
                    break;

                case 'IN_PARAMETER':
                    // Process parameter name and value
                    if (cursor.currentAttributeName.trim()=='') {
                        if (char === '>' && cursor.tagBuffer.includes('name=')) {
                            const paramName = this.extractAttributeValue(cursor.tagBuffer, 'name');
                            if (paramName) {
                                cursor.currentAttributeName = paramName;
                                cursor.currentAttributeValue = '';
                            }
                            cursor.tagBuffer = '';
                            // cursor.state = 'IDLE';
                        } else {
                            cursor.tagBuffer += char;
                        }
                    } else {
                        if (char === '<') {
                            cursor.tagBuffer = char;
                            cursor.state = 'COLLECTING_TAG';
                            break;
                        } else {
                            cursor.currentAttributeValue += char;
                        }
                    }
                    break;
            }

            cursor.position++;
        }

        return { cursor };
    }

    /**
     * Handles the start of a tool call
     * @param messageId - ID of the current message
     * @param cursor - Current parser cursor
     * @param attributes - Tool call attributes
     * @returns ToolCallEvent for the start of the tool call
     * @private
     */
    private handleToolCallStart(messageId: string, cursor: ParserCursor, attributes: { name: string; agentId: string }) {
        cursor.name = attributes.name;
        cursor.agentId = attributes.agentId;
        if (cursor.currentToolCallId == null) {
            return { cursor };
        }
        let event: ToolCallEvent = {
            messageId,
            type: 'toolCallStart',
            id:cursor.currentToolCallId,
            name: attributes.name,
            agentId: attributes.agentId
        }
        if (this.callbacks.onToolCallStart) {
            this.callbacks.onToolCallStart(event);
        }
        return event;
    }

    /**
     * Handles the end of a tool call
     * @param messageId - ID of the current message
     * @param cursor - Current parser cursor
     * @returns ToolCallEvent for the completion of the tool call
     * @private
     */
    private handleToolCallEnd(messageId: string, cursor: ParserCursor, processed:boolean=false) {
        if (cursor.currentToolCallId == null) {
            return{cursor};
        }
        let event: ToolCallEvent = {
            messageId,
            type: 'toolCallComplete',
            id: cursor.currentToolCallId,
            name: cursor.name!,
            agentId: cursor.agentId!,
            parameters: cursor.parameters,
            processed
        }
        if (this.callbacks.onToolCallComplete) {
            this.callbacks.onToolCallComplete(event);
        }

        // Reset cursor state but maintain the position
        const position = cursor.position;
        const newCursor = this.getInitialCursor();
        newCursor.position = position+
        newCursor.position++;
        this.cursors.set(messageId, newCursor);
        return { cursor:newCursor,event};
    }

    /**
     * Handles the end of a parameter tag
     * @param cursor - Current parser cursor
     * @private
     */
    private handleParameterEnd(cursor: ParserCursor) {
        if (cursor.currentAttributeName) {
            cursor.parameters[cursor.currentAttributeName] =
                cursor.currentAttributeValue.trim();
            cursor.currentAttributeName = '';
            cursor.currentAttributeValue = '';
        }
        cursor.state = 'IDLE';
        cursor.tagBuffer = '';
    }

    /**
     * Processes attributes from a tag buffer
     * @param buffer - Buffer containing tag attributes
     * @returns Object containing extracted name and agentId
     * @private
     */
    private processAttributes(buffer: string): { name?: string; agentId?: string } {
        const nameMatch = buffer.match(/name="([^"]+)"/);
        const agentIdMatch = buffer.match(/agentId="([^"]+)"/);

        return {
            name: nameMatch?.[1],
            agentId: agentIdMatch?.[1]
        };
    }

    /**
     * Extracts an attribute value from a tag buffer
     * @param buffer - Buffer containing tag attributes
     * @param attributeName - Name of the attribute to extract
     * @returns Extracted attribute value or null if not found
     * @private
     */
    private extractAttributeValue(buffer: string, attributeName: string): string | null {
        const match = buffer.match(new RegExp(`${attributeName}="([^"]+)"`));
        return match?.[1] || null;
    }

    /**
     * Generates a unique ID for a tool call
     * @returns Unique tool call ID
     * @private
     */
    private generateToolCallId(cursor:ParserCursor): string {
        return `${cursor.actionIndex++}`;
    }

    /**
     * Resets the parser state for a specific message while maintaining position
     * @param messageId - ID of the message to reset
     */
    resetMessage(messageId: string): void {
        const cursor = this.cursors.get(messageId);
        if (cursor) {
            const position = cursor.position;
            const newCursor = this.getInitialCursor();
            newCursor.position = position;
            this.cursors.set(messageId, newCursor);
        }
    }

    /**
     * Removes all parser state for a specific message
     * @param messageId - ID of the message to remove
     */
    removeMessage(messageId: string): void {
        this.cursors.delete(messageId);
    }
    reset() {
        this.cursors.clear();
    }
}