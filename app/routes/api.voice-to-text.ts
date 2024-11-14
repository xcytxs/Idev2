import { env } from 'node:process';
import { json } from '@remix-run/cloudflare';

export async function loader() {
  const hasCredentials = !!(env.WHISPER_PROVIDER_API_URL && env.WHISPER_PROVIDER_API_KEY);

  return json({hasCredentials});
}

function checkWhisperCredentials() {
  if (!env.WHISPER_PROVIDER_API_URL || !env.WHISPER_PROVIDER_API_KEY) {
    return new Response(JSON.stringify({ error: 'Whisper API credentials not configured' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  return null;
}

export async function action({ request }: { request: Request }) {
  const credentialsError = checkWhisperCredentials();
  if (credentialsError) return credentialsError;

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile) {
      return new Response(JSON.stringify({ error: 'No audio file provided' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const fileDetails = {
      type: (audioFile as any).type,
      size: (audioFile as any).size,
      name: (audioFile as any).name,
      constructor: audioFile.constructor.name,
    };
    const formDataToSend = new FormData();
    formDataToSend.append('file', audioFile as Blob, 'audio.wav');
    formDataToSend.append('model', env.WHISPER_PROVIDER_MODEL || 'whisper-1');

    const baseUrl = env.WHISPER_PROVIDER_API_URL;
    const apiKey = env.WHISPER_PROVIDER_API_KEY;

    if (!baseUrl || !apiKey) {
      return new Response(JSON.stringify({ error: 'Missing Whisper provider API key or URL' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formDataToSend,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const result = (await response.json()) as { text: string };
    const transcribedText = result.text;

    return new Response(transcribedText, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message?.includes('API key')) {
      return new Response(JSON.stringify({ error: 'Invalid or missing API key' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(JSON.stringify({ error: 'Failed to process voice recording' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
