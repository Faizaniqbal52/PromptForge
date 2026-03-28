export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, system } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Server misconfigured — GROQ_API_KEY not set.' });
    }

    const groqMessages = [
      { role: 'system', content: system },
      ...messages
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        temperature: 0.5,
        response_format: { type: "json_object" }
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const status = response.status;
      if (status === 401) return res.status(401).json({ error: 'Invalid Groq API key configured on server.' });
      if (status === 429) return res.status(429).json({ error: 'Rate limited. Please wait a moment and try again.' });
      return res.status(status).json({ error: data.error?.message || `API error (${status})` });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
}
