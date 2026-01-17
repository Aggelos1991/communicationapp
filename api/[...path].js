// Vercel serverless function to proxy ALL API requests
export default async function handler(req, res) {
  const API_BASE = 'http://46.62.134.239:3001';

  // Get the path from the request (everything after /api/)
  const path = req.url;
  const targetUrl = `${API_BASE}${path}`;

  console.log('Proxying request:', req.method, targetUrl);

  try {
    // Forward the request to the backend
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization && { 'Authorization': req.headers.authorization }),
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' && req.body
        ? JSON.stringify(req.body)
        : undefined,
    });

    // Get response data
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    // Return the response
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Proxy error',
      message: error.message,
      target: targetUrl
    });
  }
}
