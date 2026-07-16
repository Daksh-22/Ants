# Ants Backend — Production Setup Guide

## Overview

The Ants backend is a **FastAPI** server that powers the frontend with:
- **Authentication** (JWT-based user accounts)
- **Portfolio management** (CRUD, CSV import)
- **Real-time stock prices** (yfinance)
- **Gamification** (XP, achievements, streaks)
- **Watchlist & Alerts** (price targets, notifications)
- **AI features** (Ask Ants chat, screenshot OCR)

---

## Quick Start (Local Development)

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Create `.env` File

Copy the example and fill in your keys:

```bash
cp .env.example .env
```

**Required for MVP**:
- `SUPABASE_URL` + `SUPABASE_KEY` — free database at [supabase.com](https://supabase.com)
- `JWT_SECRET` — use any random string for dev

**Optional**:
- `ANTHROPIC_API_KEY` — enables Ask Ants + Screenshot OCR (get key at [console.anthropic.com](https://console.anthropic.com))

### 3. Set Up Supabase (Free)

1. Create account at [supabase.com](https://supabase.com)
2. Create a new project
3. In project settings → API, copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon public key` → `SUPABASE_KEY`
4. Run migrations (SQL below) to create tables

### 4. Create Database Tables

In Supabase SQL Editor, run:

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Portfolios table
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Holdings table
CREATE TABLE holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID REFERENCES portfolios(id),
  ticker TEXT NOT NULL,
  qty FLOAT NOT NULL,
  buy_price FLOAT NOT NULL,
  sector TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Gamification table
CREATE TABLE gamification (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  xp INT DEFAULT 0,
  level INT DEFAULT 1,
  streak_count INT DEFAULT 0,
  achievements TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Watchlist table
CREATE TABLE watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  ticker TEXT NOT NULL,
  fit_score INT DEFAULT 0,
  added_at TIMESTAMP DEFAULT now()
);

-- Price alerts table
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

### 5. Run Development Server

```bash
uvicorn main:app --reload --port 8000
```

Server runs at `http://localhost:8000`

API docs: `http://localhost:8000/docs`

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/profile` | Get current user |

**Example: Sign up**
```bash
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123",
    "name": "Arjun"
  }'
```

Response:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user_id": "user_123456",
  "email": "user@example.com"
}
```

### Portfolio Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/portfolios` | Create portfolio |
| GET | `/api/portfolios` | List portfolios |
| POST | `/api/portfolios/import-csv` | Import CSV |
| GET | `/api/portfolios/{id}/holdings` | Get holdings |
| POST | `/api/portfolios/{id}/holdings` | Add holding |
| GET | `/api/portfolios/{id}/analysis` | Analyze portfolio |

**Example: Import CSV**
```bash
curl -X POST http://localhost:8000/api/portfolios/import-csv \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "portfolio_name=My Portfolio" \
  -F "file=@portfolio.csv"
```

CSV format:
```
ticker,qty,buy_price,sector
TCS,10,3500.50,IT
INFY,5,2100.00,IT
RELIANCE,8,2850.75,Energy
```

### Gamification

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/gamification/xp` | Award XP |
| GET | `/api/gamification/state` | Get progress |
| POST | `/api/gamification/achievements/{id}` | Unlock achievement |

**Example: Earn 25 XP**
```bash
curl -X POST http://localhost:8000/api/gamification/xp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"xp_earned": 25}'
```

### Stock Prices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prices/{ticker}` | Get current price |
| POST | `/api/prices/batch` | Get multiple prices |

**Example: Get TCS price**
```bash
curl http://localhost:8000/api/prices/TCS
```

Response:
```json
{
  "ticker": "TCS",
  "cmp": 3580.45,
  "change_pct": 2.5,
  "high_52w": 3890.00,
  "low_52w": 2900.00,
  "pe_ratio": 24.5,
  "fetched_at": "2026-07-11T10:30:00Z"
}
```

### Watchlist & Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/watchlist` | Add to watchlist |
| GET | `/api/watchlist` | Get watchlist |
| POST | `/api/price-alerts` | Create alert |
| GET | `/api/price-alerts` | Get alerts |

---

## CSV Import Formats

The CSV importer auto-detects column names. Examples:

**Zerodha Export**:
```
ticker,qty,avg_price
TCS,10,3500.50
INFY,5,2100.00
```

**Angel One Export**:
```
symbol,quantity,avg_cost
TCS,10,3500.50
INFY,5,2100.00
```

**Generic**:
```
ticker,qty,buy_price,sector
TCS,10,3500.50,IT
INFY,5,2100.00,IT
RELIANCE,8,2850.75,Energy
```

---

## Stock Price Data

Prices are fetched from **yfinance** (Yahoo Finance), which provides:
- Real-time quotes (with ~15min delay)
- 52-week highs/lows
- P/E ratios
- Market cap, volume

**Supported**:
- All NSE/BSE listed stocks
- Mutual funds (in progress)
- Indices (Nifty, Sensex)

**Fallback**: If yfinance unavailable, uses cached prices from `.price_cache.json`

---

## Deployment

### To Railway (Recommended for MVP)

1. Create account at [railway.app](https://railway.app)
2. Connect your GitHub repo
3. Set environment variables in Railway dashboard
4. Deploy

Backend will be available at `https://your-app.railway.app`

### To Heroku (Legacy)

```bash
heroku create your-app-name
heroku config:set SUPABASE_URL=...
heroku config:set SUPABASE_KEY=...
heroku config:set JWT_SECRET=...
git push heroku main
```

### To AWS / Docker

```bash
# Build Docker image
docker build -t ants-backend .
docker run -p 8000:8000 -e SUPABASE_URL=... ants-backend

# Or deploy to AWS ECS, Lambda, etc.
```

---

## Security Checklist (Before Production)

- [ ] Change `JWT_SECRET` to a strong random string
- [ ] Enable HTTPS everywhere
- [ ] Set `ENVIRONMENT=production`
- [ ] Enable row-level security (RLS) on Supabase tables
- [ ] Add rate limiting to API
- [ ] Implement CORS properly
- [ ] Use bcrypt for password hashing (not SHA-256)
- [ ] Add request logging & monitoring
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Backup database regularly

---

## Common Issues

### "SUPABASE_URL not set"
Add `.env` file with `SUPABASE_URL=...`

### "ModuleNotFoundError: No module named 'supabase'"
Run `pip install -r requirements.txt`

### "Connection refused on localhost:8000"
Server not running. Run `uvicorn main:app --reload`

### "Price fetch fails for ticker"
yfinance may be rate-limited. Check internet connection. Falls back to cached prices.

---

## Next Steps

1. ✅ Backend API running locally
2. → Update frontend to call these endpoints
3. → Deploy to Railway/Heroku
4. → Connect custom domain
5. → Set up monitoring (Sentry, LogRocket)
6. → Add real broker integrations (Zerodha, Angel One)

---

**Questions?** Check API docs at `/docs` or contact team.
