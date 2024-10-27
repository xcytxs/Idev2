import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { StreamingTextResponse, parseStreamPart } from 'ai';
import { streamText } from '~/lib/.server/llm/stream-text';
import { stripIndents } from '~/utils/stripIndent';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function action(args: ActionFunctionArgs) {
  return enhancerAction(args);
}

async function enhancerAction({ context, request }: ActionFunctionArgs) {
  const { message } = await request.json<{ message: string }>();

  try {
    const result = await streamText(
      [
        {
          role: 'user',
          content: stripIndents`
          Enhance and expand this prompt to be more specific and detailed. Add requirements, features, and technical specifications that would help create a better application.
          
          Consider:
          - UI/UX requirements
          - Data management
          - Features and functionality
          - Technical stack specifics
          - Error handling
          
          Original prompt:
          "${message}"
          
          Respond only with the enhanced prompt, no explanations or additional text.
          `,
        },
      ],
      context.cloudflare.env,
    );

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk);
        const lines = text.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const parsed = parseStreamPart(line);
            if (parsed && typeof parsed.value === 'string') {
              controller.enqueue(encoder.encode(parsed.value));
            }
          } catch {
            // If parsing fails, just send the line directly
            controller.enqueue(encoder.encode(line));
          }
        }
      }
    });

    const transformedStream = result.toAIStream().pipeThrough(transformStream);
    return new StreamingTextResponse(transformedStream);
  } catch (error) {
    console.error('Enhancer action error:', error);
    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}