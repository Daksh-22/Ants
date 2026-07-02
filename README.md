# Ants 🐜

**Honest portfolio breakdowns for Indian Gen Z.**

Upload a screenshot of your holdings (Groww, Zerodha, Kuvera, INDmoney) and get a brutally honest, personalized breakdown of what your money is *actually* doing — not what you want to hear. Then fix it, one tap at a time, and watch your portfolio health score climb.

It works for a single user with zero community. Community comes later — the app is designed to feel alive even when you're the first one here.

> Design DNA: **Groww** (approachable, removes the intimidation of finance) · **Instagram** (content is the UI, chrome disappears) · **Snapchat** (one distinctive gold nobody else owns, streaks that mean something) · **Subway Surfers** (constant forward momentum — you're always being rewarded in small ways).

---

## Tech stack

- **Frontend:** Next.js 14 (App Router), TypeScript strict, Tailwind (custom tokens), Framer Motion, Plus Jakarta Sans. Mobile-first 390px, dark mode only, no UI library — every component custom.
- **Backend:** FastAPI (Python 3.12) — a real portfolio analysis engine, Claude AI (vision OCR, copy, chat), BM25 **RAG** over a curated knowledge base, WebSocket feed, Dockerized.
- **AI surface:** screenshot → holdings via Claude vision · analysis copy punched up by Claude · **Ask Ants** RAG chat · an **MCP server** exposing the engine to Claude Desktop/agents.

## Getting started

```bash
# 1. backend (terminal A)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env            # add ANTHROPIC_API_KEY to enable AI (optional)
.venv/bin/uvicorn main:app --reload --port 8000

# 2. frontend (terminal B, repo root)
npm install
npm run dev
# open http://localhost:3000  (redirects to /home)
```

No API key? Everything still works: OCR falls back to the demo portfolio, chat answers from the knowledge base, analysis copy uses the built-in voice. The key just makes it smarter.

Other scripts: `npm run build`, `npm run typecheck`, `npm run lint`. **Deploying: see [DEPLOYMENT.md](DEPLOYMENT.md)** (Railway + Vercel, ~10 min).

## The flow

| Screen | What it is |
| --- | --- |
| `/home` | The hero. A state machine: **onboarding** (link broker / upload screenshot / enter manually) → **processing** (~2.4s while the backend analyzes) → **results** (your honest breakdown + the Ask Ants AI chat). The bottom nav appears only after results exist. |
| `/portfolio` | Holdings (winners-first, weight bars), an honest audit, and SIPs. |
| `/rank` | Where you stand in your cohort — a leaderboard strip + a live "climb faster" projection slider. |
| `/tribes` | Community (intentionally early — "you're early" is a feature). |
| `/profile` | Identity + investing streak. |

The **results breakdown** is the core loop: a health score ring, red/amber "here's the truth" cards, teal "what's working" cards, and numbered "your move" actions. Tapping any action opens a **fix sheet** with a concrete before→after; marking it done climbs the score ring, flips the card to teal, and persists your progress.

> Analysis is **real**: the backend engine prices your positions against a reference table, computes weights/returns/concentration, scores the portfolio, and generates flags with actionable fixes. With `ANTHROPIC_API_KEY` set, Claude reads screenshots (vision OCR), rewrites the copy in the Ants voice, and powers the chat. Without it, deterministic fallbacks keep the demo fully working.

## Project structure

```
app/                   # Next.js screens (home = onboarding → processing → results)
components/
  home/                # UploadEmptyState, ManualEntry, Processing, Results, FixSheet, AskAnts, HealthRing
  ui/  layout/  app/   # design system · Header/BottomNav · AppState (localStorage-persisted)
  tribes/              # SwarmRadar (live WebSocket), MirrorModal
lib/
  analysis/            # Analysis types + generated demo analysis (default.ts)
  api/portfolio.ts     # typed client for every backend call (NEXT_PUBLIC_API_URL)
  data/  utils/  hooks/
backend/
  main.py              # FastAPI: /api/analyze, /api/ocr/screenshot, /api/chat, /api/rag/search,
                       #          /api/aa/* (AA mock), /api/execution/order, /ws/swarm-radar, /healthz
  engine.py            # the real portfolio math: pricing, weights, score, flags, fixes
  ai.py                # Claude: vision OCR, copy polish, RAG chat (all optional-key)
  rag.py + knowledge/  # BM25 retrieval over curated investing docs
  mcp_server.py        # MCP tools: analyze_portfolio, demo_portfolio, search_knowledge, ask_ants
  Dockerfile + railway.json + requirements.txt
```

## Design rules (for contributors & AI tools)

- **Colors never cross roles:** `gold` = brand / CTA / milestones · `teal` = gains · `red` = losses · `purple` = community · `amber` = caution. Every color comes from a CSS-variable-backed Tailwind token — **no hardcoded hex in components**.
- **The big number is the design.** Every screen has one dominant number that counts up on mount (`useCountUp` / `AnimatedNumber`).
- **Everything tappable** gives scale-0.97 spring feedback. Cards enter staggered via `Reveal`.
- **Copy voice** = a smart, slightly irreverent friend who knows finance — never corporate. ("You say AI infra. Your money says boomer index.")
- **Rupees** are always Indian-formatted (`₹1,87,420`, not `₹187,420`) via `formatINR`.

## Status

Deployable beta. **Real:** analysis engine, AI OCR/copy/chat (with key), RAG, MCP server. **Still mocked/sandboxed:** Account Aggregator consent (swap in Setu/Finvu sandbox), order execution (broker API + compliance), Swarm Radar feed, reference prices (swap for a live quotes API). Serving real customers with AA/execution requires SEBI/RBI compliance work — see the honesty table in [DEPLOYMENT.md](DEPLOYMENT.md).

## Contributing

Issues and PRs welcome. Keep to the design rules above — the whole point is that it feels like *one* coherent product, not a Dribbble shot.
