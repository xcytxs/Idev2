import { streamText as _streamText, convertToCoreMessages, generateText } from 'ai';
import { getModel } from '~/lib/.server/llm/model';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';
import { MODEL_LIST, DEFAULT_MODEL, DEFAULT_PROVIDER, MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';
import { agentRegistry, prebuiltAgents } from '~/utils/agentFactory';
import { AgentOutputParser } from '~/lib/agents/agent-output-parser';
import type { IToolsConfig } from '~/utils/types';

interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  state: 'call' | 'partial-call' | 'result';
  args: Args;
  result: Result;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
  model?: string;
}

export type Messages = Message[];

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;

function extractPropertiesFromMessage(message: Message): { model: string; provider: string; content: string } {
  // Extract model
  const modelMatch = message.content.match(MODEL_REGEX);
  const model = modelMatch ? modelMatch[1] : DEFAULT_MODEL;

  // Extract provider
  const providerMatch = message.content.match(PROVIDER_REGEX);
  const provider = providerMatch ? providerMatch[1] : DEFAULT_PROVIDER;

  // Remove model and provider lines from content
  const cleanedContent = message.content
    .replace(MODEL_REGEX, '')
    .replace(PROVIDER_REGEX, '')
    .trim();

  return { model, provider, content: cleanedContent };
}

async function generateSystemPrompt(messages: Messages,
  env: Env,
  currentProvider: string, currentModel: string,
  options?: StreamingOptions,
  apiKeys?: Record<string, string>,
) {
  const coordinatorAgent = prebuiltAgents.coordinatorAgent
  let coordSystemPrompt = coordinatorAgent.generatePrompt()


  let { text: coordResp } = await generateText({
    model: getModel(currentProvider, currentModel, env, apiKeys) as any,
    system: coordSystemPrompt,
    maxTokens: MAX_TOKENS,
    messages: convertToCoreMessages(messages),
    ...options,
  })
  console.log({ coordResp });
  let agentOutputParser = new AgentOutputParser();
  let coordOutput = agentOutputParser.parse(`${Date.now()}`, coordResp)

  let agentSystemPrompt = getSystemPrompt();
  if (coordOutput.event && coordOutput.event.type == 'toolCallComplete') {
    let { name, parameters } = coordOutput.event
    if (name == 'routeToAgent') {
      try {
        let confidence = parseFloat(parameters?.confidence || '0')
        if (confidence > 0.5 && parameters?.agentId) {
          let agent = agentRegistry[parameters?.agentId]
          if (agent) return agent.generatePrompt()
        }
      } catch (e) {
      }
    }
  }
  return agentSystemPrompt
}

export async function streamText(
  messages: Messages,
  env: Env,
  options?: StreamingOptions,
  apiKeys?: Record<string, string>,
  toolConfig?: IToolsConfig
) {
  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER;

  const processedMessages = messages.map((message) => {
    if (message.role === 'user') {
      const { model, provider, content } = extractPropertiesFromMessage(message);

      if (MODEL_LIST.find((m) => m.name === model)) {
        currentModel = model;
      }

      currentProvider = provider;

      return { ...message, content };
    }

    return message; // No changes for non-user messages
  });
  
  let systemPrompt = getSystemPrompt();
  if (toolConfig&&toolConfig.enabled) {
   systemPrompt= await generateSystemPrompt(processedMessages, env, currentProvider, currentModel, options, apiKeys) 
  }
  
  return await _streamText({
    model: getModel(currentProvider, currentModel, env, apiKeys) as any,
    system: systemPrompt,
    maxTokens: MAX_TOKENS,
    messages: convertToCoreMessages(processedMessages),
    ...options,
  });
}
