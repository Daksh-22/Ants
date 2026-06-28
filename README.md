# Ants 🐜

**Honest portfolio breakdowns for Indian Gen Z.**

Upload a screenshot of your holdings (Groww, Zerodha, Kuvera, INDmoney) and get a brutally honest, personalized breakdown of what your money is *actually* doing — not what you want to hear. Then fix it, one tap at a time, and watch your portfolio health score climb.

It works for a single user with zero community. Community comes later — the app is designed to feel alive even when you're the first one here.

> Design DNA: **Groww** (approachable, removes the intimidation of finance) · **Instagram** (content is the UI, chrome disappears) · **Snapchat** (one distinctive gold nobody else owns, streaks that mean something) · **Subway Surfers** (constant forward momentum — you're always being rewarded in small ways).

---

## Tech stack

- **Next.js 14** (App Router) + **TypeScript** (strict)
- **Tailwind CSS** with custom design tokens (CSS-variable backed)
- **Framer Motion** for animation
- **Recharts**, **lucide-react**
- **Plus Jakarta Sans** via `next/font`
- Mobile-first, **390px** viewport, **dark mode only**

No UI component library — every component is custom.

## Getting started

```bash
npm install
npm run dev
# open http://localhost:3000  (redirects to /home)
```

Other scripts: `npm run build`, `npm run start`, `npm run typecheck`, `npm run lint`.

## The flow

| Screen | What it is |
| --- | --- |
| `/home` | The hero. A state machine: **empty onboarding** (upload your screenshot) → **processing** (mocked OCR, ~2.4s) → **results** (your honest breakdown). The bottom nav appears only after results exist. |
| `/portfolio` | Holdings (winners-first, weight bars), an honest audit, and SIPs. |
| `/rank` | Where you stand in your cohort — a leaderboard strip + a live "climb faster" projection slider. |
| `/tribes` | Community (intentionally early — "you're early" is a feature). |
| `/profile` | Identity + investing streak. |

The **results breakdown** is the core loop: a health score ring, red/amber "here's the truth" cards, teal "what's working" cards, and numbered "your move" actions. Tapping any action opens a **fix sheet** with a concrete before→after; marking it done climbs the score ring, flips the card to teal, and persists your progress.

> The OCR is **mocked** — any uploaded image (or the "add manually" link) runs the same demo analysis on the built-in Arjun Mehta portfolio.

## Project structure

```
app/
  home/        # state machine: empty → processing → results
  portfolio/  rank/  tribes/  profile/
  layout.tsx   # dark theme, fonts, AppState provider, bottom-nav wrapper
components/
  home/        # UploadEmptyState, Processing, Results, FixSheet, HealthRing, fixes.ts
  ui/          # design system: Card, Button, Avatar, Badge, Slider, AnimatedNumber, Reveal, ...
  layout/      # Header, BottomNav
  app/         # AppState (analyzed + doneFixes, localStorage-persisted)
lib/
  data/mock.ts        # single source of truth for all data (Arjun Mehta, Bengaluru)
  utils/              # formatINR (Indian grouping ₹1,87,420), formatPercent, cn
  hooks/              # useCountUp (scoreboard count-ups), useInView
styles/globals.css    # CSS variables / color tokens
tailwind.config.ts    # token → utility mapping
```

## Design rules (for contributors & AI tools)

- **Colors never cross roles:** `gold` = brand / CTA / milestones · `teal` = gains · `red` = losses · `purple` = community · `amber` = caution. Every color comes from a CSS-variable-backed Tailwind token — **no hardcoded hex in components**.
- **The big number is the design.** Every screen has one dominant number that counts up on mount (`useCountUp` / `AnimatedNumber`).
- **Everything tappable** gives scale-0.97 spring feedback. Cards enter staggered via `Reveal`.
- **Copy voice** = a smart, slightly irreverent friend who knows finance — never corporate. ("You say AI infra. Your money says boomer index.")
- **Rupees** are always Indian-formatted (`₹1,87,420`, not `₹187,420`) via `formatINR`.

## Status

Prototype with mocked data and a mocked OCR pipeline. Natural next steps: a real screenshot→holdings parser, wiring the action CTAs to real broker/AMC flows, and the community layer.

## Contributing

Issues and PRs welcome. Keep to the design rules above — the whole point is that it feels like *one* coherent product, not a Dribbble shot.
