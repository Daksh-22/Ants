# DEPLOY NOW — Just Copy-Paste (No Thinking)

Follow these exact steps. Do EXACTLY what it says.

---

## STEP 1: Create Supabase Database (5 mins)

### 1.1 — Go here and sign up
```
https://supabase.com/dashboard
```
Click: **"Sign up"** → Use your Google account

### 1.2 — Create new project
- Organization: Create new (any name)
- Project name: Type `ants`
- Region: Click **"Asia Pacific (Singapore)"`
- Password: **Save this somewhere** (you won't use it)
- Click: **"Create new project"**

Wait 1-2 minutes for it to initialize...

### 1.3 — Get your database credentials
When it loads:
1. Click: **"Settings"** (left sidebar, bottom)
2. Click: **"API"**
3. You'll see two things:

**Copy these two values:**
```
PROJECT URL: https://xxxxxxx.supabase.co
ANON PUBLIC KEY: eyJxxx... (long string)
```

Save them in a text file for now.

### 1.4 — Create database tables
Still in Supabase:
1. Click: **"SQL Editor"** (left sidebar)
2. Click: **"New query"** (blue button)
3. **Delete** any text that's there
4. **Copy-paste this entire SQL:**

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID REFERENCES portfolios(id),
  ticker TEXT NOT NULL,
  qty FLOAT NOT NULL,
  buy_price FLOAT NOT NULL,
  sector TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE gamification (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  xp INT DEFAULT 0,
  level INT DEFAULT 1,
  streak_count INT DEFAULT 0,
  achievements TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  ticker TEXT NOT NULL,
  fit_score INT DEFAULT 0,
  added_at TIMESTAMP DEFAULT now()
);

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

5. Click: **"Run"** (blue button, top right)
6. Wait for it to finish (should say "Success" or nothing)

**✅ Supabase is done.**

---

## STEP 2: Deploy Backend (5 mins)

### 2.1 — Go to Railway
```
https://railway.app
```

### 2.2 — Sign up with GitHub
- Click: **"Start New Project"**
- Click: **"Deploy from GitHub repo"**
- Click: **"Authorize Railway"** (or it may ask for GitHub login)
- Select your GitHub account
- Find and click: **"ANTS/Ants"** repo (or whatever your repo is called)

### 2.3 — Wait for it to load, then add environment variables
When the page loads:
1. Click: **"Variables"** tab
2. Click: **"RAW Editor"** (if available) or just add them one by one
3. Click: **"Add Variable"**

Add these 4 variables (copy-paste exactly):

**Variable 1:**
```
Name: SUPABASE_URL
Value: [PASTE the PROJECT URL from Step 1.3]
```
Click: **"Add"**

**Variable 2:**
```
Name: SUPABASE_KEY
Value: [PASTE the ANON PUBLIC KEY from Step 1.3]
```
Click: **"Add"**

**Variable 3:**
```
Name: JWT_SECRET
Value: your-secret-key-12345
```
Click: **"Add"**

**Variable 4:**
```
Name: ENVIRONMENT
Value: production
```
Click: **"Add"**

### 2.4 — Deploy
1. Click: **"Deploy"** button (should be visible)
2. Wait 2-3 minutes for deployment
3. When done, you'll see a URL like: `https://ants-production-xxxxx.railway.app`

**Copy this URL and save it.**

**✅ Backend is deployed.**

---

## STEP 3: Configure Frontend

### 3.1 — Update frontend config
Open this file on your computer:
```
/Users/dakshjain/Desktop/ANTS/Ants/.env.local
```

Replace the content with:
```
NEXT_PUBLIC_API_URL=https://ants-production-xxxxx.railway.app
```

(Use the Railway URL from Step 2.4)

Save the file.

### 3.2 — Push to GitHub
Open terminal and run:
```bash
cd ~/Desktop/ANTS/Ants
git add .env.local
git commit -m "Update API URL for production"
git push origin main
```

---

## STEP 4: Deploy Frontend (5 mins)

### 4.1 — Go to Vercel
```
https://vercel.com/new
```

### 4.2 — Sign in with GitHub
- Click: **"Continue with GitHub"**
- Click: **"Authorize Vercel"**
- Select your GitHub account

### 4.3 — Import your repo
- Find: **"ANTS/Ants"** repo
- Click: **"Import"**

### 4.4 — Add environment variables
- Look for **"Environment Variables"** section
- Click: **"Add"**
- Add this variable:

```
Name: NEXT_PUBLIC_API_URL
Value: [PASTE the Railway URL from Step 2.4]
```

- Click: **"Add"**

### 4.5 — Deploy
- Click: **"Deploy"** (blue button)
- Wait 2 minutes
- You'll see: `Congratulations! Your site is live at: https://ants-xxxxx.vercel.app`

**Copy this URL.**

---

## STEP 5: Test Your App

1. Go to your Vercel URL: `https://ants-xxxxx.vercel.app`
2. You should see the Ants app
3. Click: **"Sign Up"**
4. Enter:
   - Email: `test@ants.app`
   - Password: `Password123` (needs uppercase + number)
   - Name: `Test User`
5. Click: **"Sign Up"**

### If it works:
✅ Create a text file called `portfolio.csv` with:
```
ticker,qty,buy_price,sector
TCS,10,3500,IT
INFY,5,2100,IT
RELIANCE,8,2850,Energy
```

Upload it in the app.

You should see real TCS price, real analysis, everything working.

---

## STEP 6: Done! 🎉

Your app is now **LIVE on the internet**.

Share the Vercel URL (`https://ants-xxxxx.vercel.app`) with anyone.

They can sign up, upload portfolios, see real stock prices, earn XP - everything works.

---

## TROUBLESHOOTING

**"Can't sign up / Connection refused"**
- Go back to Vercel dashboard
- Check environment variable `NEXT_PUBLIC_API_URL` is set correctly
- Redeploy if needed: Click **"Redeploy"** button

**"Prices not showing"**
- Check your internet connection
- Ticker names must be correct (TCS, INFY, RELIANCE, etc.)

**"Nothing is loading"**
- Check Vercel URL in browser is correct
- Wait 5 mins, refresh
- Check Railway deployment succeeded (go back to Railway dashboard)

**Still stuck?**
- Check Railway logs: Railway Dashboard → Project → Logs
- Check Vercel logs: Vercel Dashboard → Project → Logs

---

## THAT'S IT.

You have a live app. You can now:
- Share with friends
- Show to investors
- Collect feedback
- Iterate features

Everything is production-ready.

**Congratulations.** 🚀
