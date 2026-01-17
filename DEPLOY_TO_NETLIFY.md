# Deploy to Netlify - EASY STEPS

## Quick Deploy (Drag & Drop)

### Step 1: Open the dist folder
```bash
cd /Users/angeloskeramaris/Downloads/fincomms---invoice-tracker\(2\)/dist
```

### Step 2: Deploy
1. Go to: https://app.netlify.com/drop
2. Drag EVERYTHING from the `dist` folder (index.html + assets folder)
3. Drop it on the Netlify zone

**Your site:** https://apcommunicationsaniikos.netlify.app/

---

## What's Configured

✅ **API URL:** https://residents-vcr-councils-killing.trycloudflare.com
✅ **Redirects:** Configured for SPA
✅ **Build:** Ready to deploy
✅ **CORS:** Backend allows Netlify

---

## Files Ready for Netlify

- ✅ `dist/index.html` - Main HTML
- ✅ `dist/assets/` - All JS/CSS bundles
- ✅ `dist/_redirects` - SPA routing
- ✅ `netlify.toml` - Config file
- ✅ `.env` - HTTPS API URL

---

## After Deploy

1. Go to: https://apcommunicationsaniikos.netlify.app/
2. Hard refresh: **CMD + SHIFT + R**
3. Login with: aggelosmc@gmail.com / Password123

---

## Current Setup

**Backend:** https://residents-vcr-councils-killing.trycloudflare.com
**Database:** 46.62.134.239:3306 (MySQL)
**Frontend:** Netlify (HTTPS)

Everything uses HTTPS now - no more mixed content errors!
