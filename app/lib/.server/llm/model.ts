/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import { getAPIKey, getBaseURL } from '~/lib/.server/llm/api-key';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ollama } from 'ollama-ai-provider';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createMistral } from '@ai-sdk/mistral';
import { createCohere } from '@ai-sdk/cohere';
import { createAzure } from '@ai-sdk/azure';
import type { LanguageModelV1 } from 'ai';

export const DEFAULT_NUM_CTX = process.env.DEFAULT_NUM_CTX ? parseInt(process.env.DEFAULT_NUM_CTX, 10) : 32768;

type OptionalApiKey = string | undefined;

export function getAnthropicModel(apiKey: OptionalApiKey, model: string) {
  const anthropic = createAnthropic({
    apiKey,
  });

  return anthropic(model);
}
export function getOpenAILikeModel(baseURL: string, apiKey: OptionalApiKey, model: string) {
  const openai = createOpenAI({
    baseURL,
    apiKey,
  });

  return openai(model);
}

export function getCohereAIModel(apiKey: OptionalApiKey, model: string) {
  const cohere = createCohere({
    apiKey,
  });

  return cohere(model);
}

export function getOpenAIModel(apiKey: OptionalApiKey, model: string) {
  const openai = createOpenAI({
    apiKey,
  });

  return openai(model);
}

export function getMistralModel(apiKey: OptionalApiKey, model: string) {
  const mistral = createMistral({
    apiKey,
  });

  return mistral(model);
}

export function getGoogleModel(apiKey: OptionalApiKey, model: string) {
  const google = createGoogleGenerativeAI({
    apiKey,
  });

  return google(model);
}

export function getGroqModel(apiKey: OptionalApiKey, model: string) {
  const openai = createOpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey,
  });

  return openai(model);
}

export function getHuggingFaceModel(apiKey: OptionalApiKey, model: string) {
  const openai = createOpenAI({
    baseURL: 'https://api-inference.huggingface.co/v1/',
    apiKey,
  });

  return openai(model);
}

export function getOllamaModel(baseURL: string, model: string) {
  const ollamaInstance = ollama(model, {
    numCtx: DEFAULT_NUM_CTX,
  }) as LanguageModelV1 & { config: any };

  ollamaInstance.config.baseURL = `${baseURL}/api`;

  return ollamaInstance;
}

export function getDeepseekModel(apiKey: OptionalApiKey, model: string) {
  const openai = createOpenAI({
    baseURL: 'https://api.deepseek.com/beta',
    apiKey,
  });

  return openai(model);
}

export function getOpenRouterModel(apiKey: OptionalApiKey, model: string) {
  const openRouter = createOpenRouter({
    apiKey,
  });

  return openRouter.chat(model);
}

export function getLMStudioModel(baseURL: string, model: string) {
  const lmstudio = createOpenAI({
    baseUrl: `${baseURL}/v1`,
    apiKey: '',
  });

  return lmstudio(model);
}

export function getXAIModel(apiKey: OptionalApiKey, model: string) {
  const openai = createOpenAI({
    baseURL: 'https://api.x.ai/v1',
    apiKey,
  });

  return openai(model);
}


export function getNovitaModel(apiKey: string, model: string) {
  const novita = createOpenAI({
    baseURL: 'https://api.novita.ai/v3/openai',
    apiKey,
  });

  return novita(model);
}

export function getTogetherAIModel(apiKey: string, model: string) {

  const together = createOpenAI({
    baseURL: 'https://api.together.xyz/v1',
    apiKey,
  });
  return together(model);
}

export function getAzureAIModel(resourcekey: string, model: string){
  if(resourcekey.split(":").length != 2)
  {
    console.error("azure requires resouce name and api key");
  }
  const azmodel = createAzure({
    resourceName: resourcekey.split(':')[0],
    apiKey: resourcekey.split(':')[1],
  });
  return azmodel(model);
}

export function getModel(provider: string, model: string, env: Env, apiKeys?: Record<string, string>) {
  const apiKey = getAPIKey(env, provider, apiKeys);
  const baseURL = getBaseURL(env, provider);

  switch (provider) {
    case 'Anthropic':
      return getAnthropicModel(apiKey, model);
    case 'OpenAI':
      return getOpenAIModel(apiKey, model);
    case 'Groq':
      return getGroqModel(apiKey, model);
    case 'HuggingFace':
      return getHuggingFaceModel(apiKey, model);
    case 'OpenRouter':
      return getOpenRouterModel(apiKey, model);
    case 'Google':
      return getGoogleModel(apiKey, model);
    case 'OpenAILike':
      return getOpenAILikeModel(baseURL, apiKey, model);
    case 'Deepseek':
      return getDeepseekModel(apiKey, model);
    case 'Mistral':
      return getMistralModel(apiKey, model);
    case 'LMStudio':
      return getLMStudioModel(baseURL, model);
    case 'xAI':
      return getXAIModel(apiKey, model);
    case 'Cohere':
      return getCohereAIModel(apiKey, model);
    case 'NovitaAI':
      return getNovitaModel(apiKey, model);
    case 'TogetherAI':
      return getTogetherAIModel(apiKey, model);
    case 'Azure':
      return getAzureAIModel(apiKey, model);
    default:
      return getOllamaModel(baseURL, model);
  }
}
