# Deploying Ants

Two services: the **FastAPI backend** (Railway, Docker) and the **Next.js
frontend** (Vercel). Total time: ~10 minutes. Both free tiers work.

```
[ Vercel: Next.js frontend ]  ──HTTPS──▶  [ Railway: FastAPI backend ]
        NEXT_PUBLIC_API_URL                 ANTHROPIC_API_KEY (AI)
                                            ALLOWED_ORIGINS (CORS)
```

---

## 1. Backend → Railway

1. Push this repo to GitHub (see repo README).
2. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** → pick `Ants`.
3. In the service settings set **Root Directory = `backend`** — Railway then
   picks up `backend/railway.json` + `Dockerfile` automatically.
4. **Variables** tab — add:
   | Variable | Value |
   | --- | --- |
   | `ANTHROPIC_API_KEY` | your key from console.anthropic.com *(optional — enables OCR, AI copy, chat)* |
   | `ANTHROPIC_MODEL` | `claude-sonnet-5` |
   | `ALLOWED_ORIGINS` | your frontend URL, e.g. `https://ants.vercel.app` |
5. Deploy. Railway health-checks `/healthz`. Note your public URL, e.g.
   `https://ants-backend-production.up.railway.app`.

Verify: `curl https://<railway-url>/healthz` →
`{"status":"ok","aiEnabled":true,"knowledgeChunks":24}`.

CLI alternative: `npm i -g @railway/cli && railway login && cd backend && railway up`.

## 2. Frontend → Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → import the `Ants` repo.
   Framework auto-detects as Next.js; root stays the repo root.
2. **Environment Variables** — add:
   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | your Railway URL (no trailing slash) |
3. Deploy. Then go back to Railway and set `ALLOWED_ORIGINS` to the final
   Vercel URL (comma-separate to also keep localhost).

CLI alternative: `npm i -g vercel && vercel --prod`.

## 3. Smoke test in production

- Open the Vercel URL → onboarding chooser renders.
- **Manual entry** → type 2–3 positions → personalized analysis (source line
  says "from your entered positions").
- **Screenshot** → upload a holdings screenshot → with the API key set, Claude
  vision reads it (`aiUsed: true`); without it you get the demo with a note.
- **Ask Ants** → answers cite knowledge-base sources; `aiEnabled` on /healthz
  tells you which brain answered.
- **Tribes → Swarm Radar** shows LIVE (WebSocket connects through the same URL).

## 4. MCP server (optional, local)

Expose Ants to Claude Desktop / any MCP client:

```json
{
  "mcpServers": {
    "ants": {
      "command": "/ABS/PATH/Ants/backend/.venv/bin/python",
      "args": ["/ABS/PATH/Ants/backend/mcp_server.py"]
    }
  }
}
```

Tools: `analyze_portfolio`, `demo_portfolio`, `search_knowledge`, `ask_ants`.

---

## What is still mocked (honesty section)

| Feature | Status | Path to real |
| --- | --- | --- |
| Portfolio analysis engine | **Real** (computed) | Live quotes API for CMPs |
| Screenshot OCR | **Real with API key** | — |
| Ask Ants (RAG chat) | **Real with API key** | Swap BM25 → embeddings for scale |
| Account Aggregator | Mock consent flow | Setu/Finvu sandbox → production FIU license |
| Order execution | Mock | Angel One SmartAPI / broker OAuth |
| Swarm Radar feed | Simulated | Aggregated real order flow |

Anything involving real money movement or regulated data (AA, execution)
requires SEBI/RBI compliance work before serving actual customers — treat
those as sandboxed demos until then.
