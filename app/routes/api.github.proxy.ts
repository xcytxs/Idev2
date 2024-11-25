import type { ActionFunctionArgs } from '@remix-run/cloudflare';

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const targetEndpoint = url.searchParams.get('endpoint');
  const clientId = url.searchParams.get('client_id');
  const deviceCode = url.searchParams.get('device_code');
  const grantType = url.searchParams.get('grant_type');
  const scope = url.searchParams.get('scope');

  if (!targetEndpoint || !clientId) {
    return new Response('Missing required parameters', { status: 400 });
  }

  const githubUrl = `https://github.com${targetEndpoint}`;
  const body: Record<string, string> = { client_id: clientId };

  if (deviceCode) body.device_code = deviceCode;
  if (grantType) body.grant_type = grantType;
  if (scope) body.scope = scope;

  try {
    const response = await fetch(githubUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to proxy request' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

// Handle preflight requests
export async function options() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
