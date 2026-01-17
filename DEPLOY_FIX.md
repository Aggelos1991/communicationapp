# Vercel Deployment Fix - Mixed Content Error Resolved

## Problem
The app was failing with "NetworkError when attempting to fetch resource" because:
- Vercel serves the app over HTTPS
- The backend API was at `http://46.62.134.239:3001` (HTTP)
- Browsers block mixed content (HTTPS → HTTP requests)
- The nginx HTTPS endpoint uses a self-signed certificate (browsers reject it)

## Solution
Configured Vercel to proxy API requests through its servers, avoiding mixed content issues.

## Changes Made

### 1. Updated `vercel.json`
Added API proxy rewrite rule that routes `/api/*` requests through Vercel to your backend:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "http://46.62.134.239:3001/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "env": {
    "VITE_API_BASE_URL": ""
  }
}
```

### 2. API Configuration
Set `VITE_API_BASE_URL` to empty string so the app makes relative API calls to `/api/*`, which Vercel will proxy.

## Deploy to Vercel

### Option 1: Vercel Dashboard (Recommended)
1. Go to https://vercel.com/dashboard
2. Find your project `fincomms-invoice-tracker` or `communicationapp`
3. Click on the project
4. Go to "Settings" → "Git"
5. If connected to Git, push your changes and it will auto-deploy
6. If NOT connected to Git:
   - Click "Deployments" tab
   - Click "Redeploy" → "Redeploy with existing Build Cache" OR
   - Delete the project and create new:
     - Go to https://vercel.com/new
     - Click "Upload" and drag the entire project folder
     - Click "Deploy"

### Option 2: Install Vercel CLI
```bash
npm install -g vercel
cd /Users/angeloskeramaris/Downloads/fincomms---invoice-tracker\(2\)
vercel --prod
```

## After Deployment

1. Visit your Vercel URL (e.g., `https://communicationapp-oro6sab3m-aggelos1991s-projects.vercel.app`)
2. The app should now successfully connect to the backend
3. Login with: aggelosmc@gmail.com / Password123

## How It Works

```
Browser → Vercel HTTPS → /api/auth/login
                ↓
        Vercel Proxy (server-side)
                ↓
        http://46.62.134.239:3001/api/auth/login
```

The browser only sees HTTPS requests to Vercel. Vercel's servers make the HTTP request to your backend, avoiding mixed content errors.

## Alternative: Get Real SSL Certificate

For production, consider getting a real SSL certificate for 46.62.134.239:
- Use Let's Encrypt (free)
- Use Cloudflare (free SSL + DDoS protection)
- Then update `VITE_API_BASE_URL` to `https://46.62.134.239`
