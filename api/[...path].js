// Vercel serverless function to proxy ALL API requests
export default async function handler(req, res) {
  const API_BASE = 'http://46.62.134.239:3001';

  // Set CORS headers first
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Get the path from the request (everything after /api/)
  const path = req.url;
  const targetUrl = `${API_BASE}${path}`;

  console.log('Proxying request:', req.method, targetUrl);

  try {
    // Prepare request body
    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    // Forward the request to the backend
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization && { 'Authorization': req.headers.authorization }),
      },
      body,
    });

    // Get response data
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
      return res.status(response.status).json(data);
    } else {
      data = await response.text();
      return res.status(response.status).send(data);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Proxy error',
      message: error.message,
      target: targetUrl
    });
  }
}
