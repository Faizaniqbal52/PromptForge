// Vercel Serverless Function — proxies requests to Anthropic API
// This keeps the API key server-side (via Vercel env var) or accepts a user-provided key.

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, system, apiKey: userApiKey } = req.body;

    // Prefer user-provided key, fall back to server env var
    const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(401).json({
        error: 'No API key configured. Please add your Anthropic API key in settings.',
      });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system,
        messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const status = response.status;

      if (status === 401) {
        return res.status(401).json({ error: 'Invalid API key. Please check your Anthropic API key.' });
      }
      if (status === 429) {
        return res.status(429).json({ error: 'Rate limited. Please wait a moment and try again.' });
      }
      return res.status(status).json({
        error: errorData.error?.message || `Anthropic API error (${status})`,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
}
