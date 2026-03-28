import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      // Dev-only API proxy — mirrors the Vercel serverless function locally
      {
        name: 'api-proxy',
        configureServer(server) {
          server.middlewares.use('/api/groq', async (req, res) => {
            if (req.method === 'OPTIONS') {
              res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' });
              return res.end();
            }

            if (req.method !== 'POST') {
              res.writeHead(405, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: 'Method not allowed' }));
            }

            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
              try {
                const { messages, system } = JSON.parse(body);
                const apiKey = env.GROQ_API_KEY;

                if (!apiKey) {
                  res.writeHead(401, { 'Content-Type': 'application/json' });
                  return res.end(JSON.stringify({ error: 'GROQ_API_KEY not set. Check your .env file.' }));
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
                  if (status === 401) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Invalid API key. Check your .env file.' }));
                  }
                  if (status === 429) {
                    res.writeHead(429, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Rate limited. Wait a moment and try again.' }));
                  }
                  res.writeHead(status, { 'Content-Type': 'application/json' });
                  return res.end(JSON.stringify({ error: data.error?.message || `API error (${status})` }));
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
              } catch (err) {
                console.error('Dev proxy error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Server error: ' + err.message }));
              }
            });
          });
        },
      },
    ],
  };
});
