# Ants — Live Deployment Guide

## You Now Have

- ✅ Beautiful frontend (React/Next.js)
- ✅ Gamification system (XP, achievements, streaks)
- ✅ Analytics (risk, benchmarks, watchlist, alerts)
- ✅ Complete backend API (26 endpoints)
- ✅ Real price data (yfinance)
- ✅ Database ready (Supabase)

**What this guide does**: Gets your app **live on the internet** in 15 minutes with real data.

---

## Step 1: Create Supabase Account (3 mins)

1. Go to **https://supabase.com/dashboard**
2. Sign up with Google (easiest)
3. Create a new project
   - Name: `ants`
   - Region: `Asia Pacific (Singapore)` (for India)
   - Password: Save it (you won't need it again)
4. Wait for it to initialize (~1 min)

---

## Step 2: Get Your Database Credentials (1 min)

1. In Supabase dashboard, go to **Settings → API**
2. Copy these two values:
   - `Project URL` (looks like `https://xyz.supabase.co`)
   - `anon public` key (long string starting with `eyJ`)
3. Save them for Step 4

---

## Step 3: Create Database Tables (Copy-Paste SQL)

1. In Supabase, go to **SQL Editor**
2. Click **New Query**
3. Copy-paste this entire SQL:

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Portfolios
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Holdings
CREATE TABLE holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID REFERENCES portfolios(id),
  ticker TEXT NOT NULL,
  qty FLOAT NOT NULL,
  buy_price FLOAT NOT NULL,
  sector TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Gamification
CREATE TABLE gamification (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  xp INT DEFAULT 0,
  level INT DEFAULT 1,
  streak_count INT DEFAULT 0,
  achievements TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Watchlist
CREATE TABLE watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  ticker TEXT NOT NULL,
  fit_score INT DEFAULT 0,
  added_at TIMESTAMP DEFAULT now()
);

-- Price Alerts
CREATE TABLE price_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  ticker TEXT NOT NULL,
  buy_target FLOAT,
  sell_target FLOAT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now()
);
```

4. Click **Run** (green button)
5. Done! ✅

---

## Step 4: Configure Backend `.env`

1. On your machine, open `/Users/dakshjain/Desktop/ANTS/Ants/backend/.env`
2. Update these two lines:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-public-key
   ```
   (Paste the values from Step 2)

3. Save the file

---

## Step 5: Test Backend Locally (2 mins)

```bash
cd ~/Desktop/ANTS/Ants
source venv/bin/activate
cd backend
uvicorn main:app --reload --port 8000
```

You should see:
```
✓ Application startup complete
Local:        http://localhost:8000
```

Go to **http://localhost:8000/docs** and you'll see all 26 API endpoints with examples.

---

## Step 6: Deploy Backend to Railway (3 mins)

1. Go to **https://railway.app**
2. Sign up with GitHub
3. Create new project → **Deploy from GitHub repo**
4. Connect your GitHub repo (`Desktop/ANTS/Ants`)
5. Railway auto-detects it's a Python app
6. Add these **Environment Variables** (in Railway dashboard):
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-public-key
   JWT_SECRET=any-random-string-here
   ENVIRONMENT=production
   ```
7. Click **Deploy**
8. Wait 30 seconds, you'll get a URL like: `https://ants-production-xxxx.railway.app`
9. **Save this URL** - you'll use it in the frontend

---

## Step 7: Configure Frontend API URL

1. Open `/Users/dakshjain/Desktop/ANTS/Ants/.env.local`
2. Replace:
   ```
   NEXT_PUBLIC_API_URL=https://ants-production-xxxx.railway.app
   ```
   (Use the URL from Step 6)
3. Save

---

## Step 8: Deploy Frontend to Vercel (2 mins)

1. Go to **https://vercel.com/new**
2. Import your GitHub repo
3. Framework: `Next.js` (auto-detected)
4. **Environment Variables** → Add:
   ```
   NEXT_PUBLIC_API_URL=https://ants-production-xxxx.railway.app
   ```
5. Click **Deploy**
6. Wait 2 minutes, you'll get a URL like: `https://ants-xxxxx.vercel.app`

---

## Step 9: Test Your App

Go to: **https://your-frontend-url.vercel.app**

You should see:
- ✅ Frontend loads
- ✅ Can sign up / login
- ✅ Can upload portfolio CSV
- ✅ See real stock prices
- ✅ XP, achievements, streaks work
- ✅ Analytics show real data

---

## Test Flow (2 mins)

1. Sign up: `your-name@example.com` / `Password123`
2. Upload portfolio CSV (create a file with content from below)
3. See analysis with real Nifty/Sensex data
4. Complete missions to earn XP
5. See level progress

**Sample portfolio.csv**:
```
ticker,qty,buy_price,sector
TCS,10,3500.50,IT
INFY,5,2100.00,IT
RELIANCE,8,2850.75,Energy
ICICIBANK,20,1050.00,Banking
```

---

## You're Live! 🎉

Your app is now:
- ✅ On the internet
- ✅ Real database (Supabase)
- ✅ Real backend (Railway)
- ✅ Real frontend (Vercel)
- ✅ Real stock prices
- ✅ Real users can sign up

---

## Next: Customize Your Domain

Optional: Instead of `ants-xxxxx.vercel.app`, use your own domain:

1. Buy domain (Namecheap, GoDaddy, etc.)
2. In Vercel: Settings → Domains → Add
3. Update DNS (Vercel will show instructions)

**Cost**: Domain = ₹500-1000/year. Everything else: **FREE** (within free tier limits).

---

## Troubleshooting

**"Connection refused"**
- Backend not running? Check if Railway deploy succeeded
- Check that `NEXT_PUBLIC_API_URL` in `.env.local` matches Railway URL

**"Can't sign up"**
- Supabase database not created? Re-run SQL from Step 3
- Check `.env` values are correct (no extra spaces)

**"Prices not showing"**
- yfinance might need internet
- Check ticker symbols are correct (TCS, INFY, RELIANCE, etc.)

**Still stuck?**
- Check Railway logs: Dashboard → Logs
- Check Vercel logs: Project → Logs

---

## What Happens Now?

Your app is **production-ready**:
- Users can sign up and create accounts
- Upload portfolios via CSV
- See real stock prices (live from yfinance)
- Earn XP and unlock achievements
- View risk metrics, benchmarks, insights

**You can share this URL with anyone** — it's live on the internet.

---

## Cost Breakdown (Monthly)

- Supabase: Free (up to 500MB)
- Railway: Free (up to 100 hours/month)
- Vercel: Free (up to 1000 deployments/month)
- Domain: ₹50/month (optional)

**Total: ₹0-50/month** for your first 1000+ users.

---

## Next Steps (Optional)

1. **Add real broker integration** (Zerodha, Angel One API)
2. **Add real news API** (replace hardcoded insights)
3. **Add Stripe for monetization**
4. **Set up analytics** (Vercel + Railway have built-in)
5. **Add more features** (portfolio replay, thesis builder, etc.)

---

**Questions?** Everything is documented. You're good to launch. 🚀
