/**
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import { streamText as _streamText, convertToCoreMessages, type LanguageModelV1 } from 'ai';
import { getModel } from '~/lib/.server/llm/model';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';
import {
  MODEL_LIST,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  MODEL_REGEX,
  PROVIDER_REGEX,
  PROVIDER_LIST,
} from '~/utils/constants';

interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
  state: 'result';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
  model?: string;
}

// add this adapter function
function adaptModelToLanguageModelV1(model: any): LanguageModelV1 {
  return {
    specificationVersion: 'v1',
    provider: 'unknown',
    modelId: model.modelId ?? 'unknown',
    defaultObjectGenerationMode: 'json',
    doGenerate: async (options) => {
      return model.doGenerate(options);
    },
    doStream: async (options) => {
      return model.doStream(options);
    },
  };
}

export type Messages = Message[];

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'> & {
  apiKeys?: Record<string, string>;
};

function extractPropertiesFromMessage(message: Message): { model: string; provider: string; content: string } {
  // extract model
  const modelMatch = message.content.match(MODEL_REGEX);
  const model = modelMatch ? modelMatch[1] : DEFAULT_MODEL;

  // extract provider
  const providerMatch = message.content.match(PROVIDER_REGEX);
  const provider = providerMatch ? providerMatch[1] : DEFAULT_PROVIDER;

  // remove model and provider lines from content
  const cleanedContent = message.content.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '').trim();

  return { model, provider: provider as string, content: cleanedContent };
}

export function streamText(messages: Messages, env: Env, options?: StreamingOptions, apiKeys?: Record<string, string>) {
  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER;

  const processedMessages = messages.map((message) => {
    if (message.role === 'user') {
      const { model, provider: providerName, content } = extractPropertiesFromMessage(message);

      if (MODEL_LIST.find((m) => m.name === model)) {
        currentModel = model;
      }

      currentProvider = PROVIDER_LIST.find((p) => p.name === providerName) ?? DEFAULT_PROVIDER;

      return { ...message, content };
    }

    return message;
  });

  const modelDetails = MODEL_LIST.find((m) => m.name === currentModel);

  const dynamicMaxTokens = modelDetails && modelDetails.maxTokenAllowed ? modelDetails.maxTokenAllowed : MAX_TOKENS;

  return _streamText({
    model: adaptModelToLanguageModelV1(getModel(currentProvider.name, currentModel, env, apiKeys)),
    system: getSystemPrompt(),
    maxTokens: dynamicMaxTokens,
    messages: convertToCoreMessages(processedMessages),
    ...options,
  });
}
