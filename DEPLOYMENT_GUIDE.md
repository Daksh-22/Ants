# Ants Deployment Guide

## Prerequisites
- Anthropic API Key: `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`
- Vercel account (for frontend)
- Render account (for backend)

---

## Step 1: Deploy Backend on Render

### 1a. Go to Render Dashboard
- Visit https://dashboard.render.com
- Click **New** → **Web Service**

### 1b. Configure the Service
- **Name**: `ants-backend`
- **Root Directory**: `backend`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Runtime**: Python 3
- **Plan**: Free (sufficient for testing)

### 1c. Set Environment Variables (IMPORTANT!)
After creating the service, go to **Settings** → **Environment**

Add these variables:
```
ANTHROPIC_API_KEY = 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
ANTHROPIC_MODEL = claude-opus-4-8
ENVIRONMENT = production
JWT_SECRET = prod-secret-key-change-this-later
ALLOWED_ORIGINS = https://ants-delta.vercel.app,https://ants.vercel.app
```

### 1d. Deploy
- Click **Deploy**
- Wait 5-10 minutes
- You'll get a URL like: `https://ants-backend-xxx.onrender.com`
- **Save this URL** ← You need it for the next step

### 1e. Test the Backend
Once deployed, test it with:
```bash
curl https://ants-backend-xxx.onrender.com/healthz
```

Should return:
```json
{"status": "ok", "aiEnabled": true, "knowledgeChunks": 24}
```

---

## Step 2: Update Frontend API URL

### 2a. Update Environment Variable
In your code, the file `.env.local` already points to `http://localhost:8000`.

For production on Vercel, you need to set it in the Vercel dashboard:

1. Go to https://vercel.com
2. Select your "Ants" project
3. Go to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://ants-backend-xxx.onrender.com` (replace xxx with your actual Render service name)
   - **Environments**: Production, Preview, Development (select all)
5. Click **Save**

### 2b. Redeploy Frontend
- Go back to **Deployments**
- Click **Redeploy** on the latest deployment
- Wait for it to finish (should be 1-2 minutes)

---

## Step 3: Verify Everything Works

### 3a. Test Backend API Directly
```bash
curl -X POST https://ants-backend-xxx.onrender.com/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "positions": [
      {"ticker": "TCS", "qty": 10, "avg": 3500},
      {"ticker": "INFY", "qty": 5, "avg": 2100}
    ]
  }'
```

Should return real analysis with flags and fixes.

### 3b. Test Frontend
1. Go to your Vercel frontend URL (e.g., `https://ants-delta.vercel.app`)
2. You should see the portfolio analysis page
3. Click **"Scan a different portfolio"**
4. Upload a screenshot of any Indian broker portfolio
5. System should:
   - Extract holdings from the screenshot using Claude vision
   - Show the extracted holdings for review
   - Run analysis on those holdings
   - Display **unique analysis** (not generic demo data)

---

## Step 4: What's Different Now?

### Before (Broken)
- Frontend always showed the same demo analysis
- Every screenshot upload returned generic data
- Backend wasn't running

### After (Fixed)
- Screenshot → Claude OCR extracts holdings
- Holdings sent to real analysis engine
- Returns **genuine, portfolio-specific feedback**
- Different portfolios get different analysis
- AI polishes the copy in the "Ants voice"

---

## Common Issues & Fixes

### Issue: Backend returns `"aiEnabled": false`
- **Cause**: API key not set
- **Fix**: Go to Render dashboard → Settings → Environment → Add `ANTHROPIC_API_KEY`

### Issue: Frontend still showing demo analysis
- **Cause**: Frontend URL not pointing to backend
- **Fix**: Check Vercel Environment Variables → `NEXT_PUBLIC_API_URL` is correct

### Issue: CORS errors in browser console
- **Cause**: Frontend URL not in `ALLOWED_ORIGINS`
- **Fix**: Go to Render backend → Settings → Environment → Update `ALLOWED_ORIGINS` to include your Vercel URL

### Issue: Uploads fail / "Could not reach backend"
- **Cause**: Render backend URL is wrong or service is down
- **Fix**: Test backend with curl command above; check Render dashboard for errors

---

## Local Development (For Testing)

To run locally:

### Terminal 1: Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set the API key (MacOS/Linux)
export ANTHROPIC_API_KEY="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"

uvicorn main:app --reload --port 8000
```

### Terminal 2: Frontend
```bash
npm run dev
```

Then visit http://localhost:3000

---

## Security Notes

1. **NEVER commit API key to git** ✅ Already doing this (set in environment)
2. **Regenerate the API key after this deployment** - You shared it in chat
3. **Set API key spending limits** on console.anthropic.com
4. **Use different secrets for production** - Change `JWT_SECRET` in Render

---

## Next Steps

1. [ ] Deploy backend to Render (follow Step 1)
2. [ ] Update Vercel environment (follow Step 2)
3. [ ] Test the APIs (follow Step 3)
4. [ ] Upload a real screenshot to verify end-to-end
5. [ ] Share with friends to get feedback

Done! Your app is now fully functional. ✨
