import type { LanguageModelV1, LanguageModelV1CallOptions } from 'ai';

export function getMockParrotModel() {
  return {
    specificationVersion: 'v1',
    provider: 'MockParrot',
    modelId: 'mock-parrot-model',
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportsStructuredOutputs: false,
    async doGenerate(options: LanguageModelV1CallOptions) {
      const text = options.prompt
        .map((message) => {
          if (message.role === 'user' && Array.isArray(message.content)) {
            return message.content.map((part) => (part.type === 'text' ? part.text : '')).join('');
          }

          return '';
        })
        .join('');
      return {
        text,
        finishReason: 'stop',
        usage: {
          promptTokens: text.length,
          completionTokens: text.length,
        },
        rawCall: {
          rawPrompt: options.prompt,
          rawSettings: options,
        },
      };
    },
    async doStream(options: LanguageModelV1CallOptions) {
      const text = options.prompt
        .map((message) => {
          if (message.role === 'user' && Array.isArray(message.content)) {
            return message.content.map((part) => (part.type === 'text' ? part.text : '')).join('');
          }

          return '';
        })
        .join('');
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'text-delta', textDelta: text });
          controller.close();
        },
      });

      return {
        stream,
        rawCall: {
          rawPrompt: options.prompt,
          rawSettings: options,
        },
      };
    },
  } as LanguageModelV1;
}
