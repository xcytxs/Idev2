// @ts-nocheck
// Preventing TS checks with files presented in the video for a better presentation.
import { streamText as _streamText, convertToCoreMessages } from 'ai';
import { getModel } from '~/lib/.server/llm/model';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';
import { MODEL_LIST, DEFAULT_MODEL, DEFAULT_PROVIDER } from '~/utils/constants';

// Define interface for tool results
interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

// Define interface for messages
interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
  model?: string;
}

// Define type for an array of messages
export type Messages = Message[];

// Define type for streaming options, omitting the 'model' parameter
export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;

// Helper function to extract model from message content
function extractModelFromMessage(message: Message): { model: string; content: string } {
  const modelRegex = /^\[Model: (.*?)\]\n\n/;
  const match = message.content.match(modelRegex);

  if (match) {
    const model = match[1];
    const content = message.content.replace(modelRegex, '');
    return { model, content };
  }

  // Default model if not specified
  return { model: DEFAULT_MODEL, content: message.content };
}

// Main function to stream text based on messages and environment
export function streamText(messages: Messages, env: Env, options?: StreamingOptions) {
  let currentModel = DEFAULT_MODEL;
  
  // Process messages and update current model
  const processedMessages = messages.map((message) => {
    if (message.role === 'user') {
      const { model, content } = extractModelFromMessage(message);
      if (model && MODEL_LIST.some((m) => m.name === model)) {
        currentModel = model;
      }
      return { ...message, content };
    }
    return message;
  });

  // Determine provider based on current model
  const provider = MODEL_LIST.find((model) => model.name === currentModel)?.provider || DEFAULT_PROVIDER;

  // Stream text with processed messages and determined model
  return _streamText({
    model: getModel(provider, currentModel, env),
    system: getSystemPrompt(),
    maxTokens: MAX_TOKENS,
    // headers: {
    //   'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
    // },
    messages: convertToCoreMessages(processedMessages),
    ...options,
  });
}