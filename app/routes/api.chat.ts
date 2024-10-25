// @ts-nocheck
// Preventing TS checks with files presented in the video for a better presentation.
import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';

// Export the action function for the chat API route
export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

// Main chat action function to handle incoming requests
async function chatAction({ context, request }: ActionFunctionArgs) {
  // Extract messages from the request body
  const { messages } = await request.json<{ messages: Messages }>();

  // Create a new SwitchableStream for handling the response
  const stream = new SwitchableStream();

  try {
    // Define options for the streaming text function
    const options: StreamingOptions = {
      toolChoice: 'none',
      onFinish: async ({ text: content, finishReason }) => {
        // If the response is complete, close the stream
        if (finishReason !== 'length') {
          return stream.close();
        }

        // Check if maximum response segments have been reached
        if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
          throw new Error('Cannot continue message: Maximum segments reached');
        }

        // Calculate remaining switches
        const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

        console.log(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

        // Append the assistant's response and continue prompt to messages
        messages.push({ role: 'assistant', content });
        messages.push({ role: 'user', content: CONTINUE_PROMPT });

        // Generate a new stream of text based on updated messages
        const result = await streamText(messages, context.cloudflare.env, options);

        // Switch the stream source to the new result
        return stream.switchSource(result.toAIStream());
      },
    };

    // Initial call to streamText with the original messages
    const result = await streamText(messages, context.cloudflare.env, options);

    // Set the initial stream source
    stream.switchSource(result.toAIStream());

    // Return the response with the readable stream
    return new Response(stream.readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    // Log and handle any errors that occur during processing
    console.error('Error in chatAction:', error);

    // Return an error response
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
