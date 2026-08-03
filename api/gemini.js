// api/gemini.js
// Vercel Serverless function to proxy requests to an external Gemini/LLM API
// - Keeps the API key out of client-side code
// - Configure these environment variables in Vercel:
//   - GEMINI_API_URL = full target URL (e.g. https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generate)
//   - GEMINI_API_KEY = your API key / bearer token
//   - GEMINI_USE_QUERY = '1' if the target expects the key as ?key=... instead of Authorization header

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed, use POST' });
  }

  const apiUrl = process.env.GEMINI_API_URL;
  const apiKey = process.env.GEMINI_API_KEY;
  const useQuery = (process.env.GEMINI_USE_QUERY || '') === '1';

  if (!apiUrl || !apiKey) {
    return res.status(500).json({ error: 'Server not configured. Set GEMINI_API_URL and GEMINI_API_KEY in environment.' });
  }

  try {
    // Forward the incoming JSON body to the target API
    const forwardUrl = useQuery ? `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}` : apiUrl;

    const headers = {
      'Content-Type': 'application/json',
    };
    if (!useQuery) {
      // Most APIs accept Authorization: Bearer <token>
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const upstream = await fetch(forwardUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
    });

    const contentType = upstream.headers.get('content-type') || '';
    // Relay status and body
    res.status(upstream.status);
    if (contentType.includes('application/json')) {
      const json = await upstream.json();
      return res.json(json);
    } else {
      const text = await upstream.text();
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(text);
    }
  } catch (err) {
    console.error('Proxy error', err);
    return res.status(502).json({ error: 'Proxy error', message: err.message });
  }
}
