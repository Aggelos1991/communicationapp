# Deploy to Vercel - EASY STEPS

## Quick Deploy

### Option 1: Vercel CLI (Fastest)

1. **Install Vercel CLI:**
```bash
npm install -g vercel
```

2. **Deploy:**
```bash
cd /Users/angeloskeramaris/Downloads/fincomms---invoice-tracker\(2\)
vercel
```

3. **Follow prompts:**
   - Login with your account (GitHub/Email)
   - Set up and deploy: YES
   - Which scope: (your account)
   - Link to existing project: NO
   - Project name: fincomms-invoice-tracker
   - Directory: ./
   - Deploy: YES

4. **Done!** Vercel will give you a URL like: `https://fincomms-invoice-tracker.vercel.app`

---

### Option 2: Vercel Dashboard (Easiest)

1. **Go to:** https://vercel.com/new
2. **Sign up/Login** with GitHub or Email
3. **Click:** "Add New" → "Project"
4. **Import from:** Upload folder
5. **Drag your project folder** to Vercel
6. **Click:** Deploy
7. **Done!**

---

## What's Configured

✅ **Build Command:** `npm run build`
✅ **Output:** `dist/`
✅ **Framework:** Vite detected automatically
✅ **API URL:** http://46.62.134.239:3001
✅ **SPA Routing:** Configured

---

## After Deploy

Your app will be at: `https://your-project-name.vercel.app`

**Login with:**
- Email: aggelosmc@gmail.com
- Password: Password123

---

## Current Setup

✅ **Frontend:** Vercel (Auto HTTPS)
✅ **Backend:** 46.62.134.239:3001 (HTTP - will work from Vercel)
✅ **Database:** 46.62.134.239:3306 (MySQL)
✅ **Localhost:** Works with http://localhost:3002

---

## Note

Vercel will automatically:
- Build your app on deploy
- Provide HTTPS
- Handle SPA routing
- Give you a free domain

Much easier than Netlify!
