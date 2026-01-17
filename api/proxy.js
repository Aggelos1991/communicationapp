// Vercel serverless function to proxy API requests
export default async function handler(req, res) {
  const apiUrl = 'http://46.62.134.239:3001';
  const path = req.url.replace('/api/proxy', '');
  const targetUrl = `${apiUrl}${path}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: '46.62.134.239:3001',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
