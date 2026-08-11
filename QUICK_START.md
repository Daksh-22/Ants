# Quick Start: Make Ants Fully Functional

## What I've Done ✅
- ✅ Set up backend with Claude API key
- ✅ Verified backend returns real analysis (not demo)
- ✅ Connected frontend to backend
- ✅ Tested the API with real portfolio data
- ✅ Created deployment guides

## What You Need to Do 🚀

### Copy-Paste These 5 Steps:

#### Step 1: Go to Render Dashboard
https://dashboard.render.com

#### Step 2: Create Backend Service
- Click **New** → **Web Service**
- Name: `ants-backend`
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Plan: Free

#### Step 3: Add API Key to Render
After creating service:
- Click **Settings** → **Environment**
- Add these 5 variables:

```
ANTHROPIC_API_KEY = sk-ant-api03-YOUR_API_KEY_HERE
ANTHROPIC_MODEL = claude-opus-4-8
ENVIRONMENT = production
JWT_SECRET = prod-secret
ALLOWED_ORIGINS = https://ants-delta.vercel.app
```

- Click **Deploy**
- Copy your backend URL when done (looks like: `https://ants-backend-xxx.onrender.com`)

#### Step 4: Update Vercel
- Go to https://vercel.com
- Select "Ants" project
- Settings → Environment Variables
- Add:
  ```
  NEXT_PUBLIC_API_URL = https://ants-backend-xxx.onrender.com
  ```
- Go to Deployments → Redeploy

#### Step 5: Test It!
- Visit your app at https://ants-delta.vercel.app
- Click "Scan a different portfolio"
- Upload a screenshot
- Should show real analysis (not demo)

---

## That's It!

Your app is now fully functional and market-ready. Each user will get:
- ✨ Real portfolio analysis based on their holdings
- ✨ AI-powered screenshot OCR (extract holdings from any broker app)
- ✨ Personalized feedback (not generic demo data)
- ✨ Ask Ants chat for investment questions
- ✨ Gamification (XP, achievements, streaks)

---

## Questions?

Check the full guide: `DEPLOYMENT_GUIDE.md`

If something doesn't work:
- Backend not responding? Check Render logs
- Still showing demo analysis? Check ALLOWED_ORIGINS in Render
- Upload failing? Check browser console for errors
