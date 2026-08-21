# Ants Deployment Guide

The one accurate deploy path. `QUICK_START.md` is the short version of this
file; the older `DEPLOY_NOW.md`, `START_HERE.md`, `NEXT_STEPS.txt` and
`DEPLOYMENT.md` predate the current backend and disagree with it — trust this
file over those.

Two services:

| Part     | Host   | Config source            |
| -------- | ------ | ------------------------ |
| Frontend | Vercel | Vercel dashboard env     |
| Backend  | Render | `render.yaml` (Docker)   |

---

## Before you start: three secrets

You need these in hand. None belong in git.

1. **`ANTHROPIC_API_KEY`** — from https://console.anthropic.com.
   The key currently in `backend/.env` returns **401 (invalid)**; it has to be
   replaced, not reused. Verify a new one before deploying:

   ```bash
   curl -s https://api.anthropic.com/v1/messages -H "x-api-key: PASTE_KEY_HERE" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" -d '{"model":"claude-opus-5","max_tokens":4,"messages":[{"role":"user","content":"hi"}]}'
   ```

   A JSON reply with `"content"` means the key is good. `"authentication_error"`
   means it is still wrong — fix that before touching Render.

2. **`JWT_SECRET`** — this signs every user's login token. Earlier drafts of
   this guide said to use `prod-secret`, which would let anyone who has read the
   repo mint a token for any account. Generate a real one:

   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

3. **`SUPABASE_URL` + `SUPABASE_KEY`** — from your Supabase project settings.
   Without them the app still runs, but signup, login and saved portfolios stay
   disabled (`/healthz` reports `"accountsEnabled": false`).

---

## Step 1 — Deploy the backend to Render

The repo has a `render.yaml`, so use a **Blueprint**, not a manual Web Service.
This matters: the backend shells out to the `tesseract` binary for the free OCR
fallback, and only `backend/Dockerfile` installs it. A manual "Python 3" service
with `pip install -r requirements.txt` builds fine and then fails at runtime the
first time someone uploads a screenshot without AI vision available.

1. Push this branch first — Render reads `render.yaml` from the repo:

   ```bash
   git push origin main
   ```

2. Go to https://dashboard.render.com → **New** → **Blueprint**.
3. Pick the `Daksh-22/Ants` repo. Render detects `render.yaml` and proposes one
   service, `ants-backend`.
4. It will prompt for the four variables marked `sync: false`. Paste them:

   | Variable            | Value                                   |
   | ------------------- | --------------------------------------- |
   | `ANTHROPIC_API_KEY` | your new, verified key                  |
   | `JWT_SECRET`        | the generated string from above         |
   | `SUPABASE_URL`      | from Supabase                           |
   | `SUPABASE_KEY`      | from Supabase                           |

   `ALLOWED_ORIGINS` and `ENVIRONMENT` are already set in `render.yaml`.

5. Click **Apply**. First build takes 5–10 minutes (it installs tesseract).
6. Copy the service URL, e.g. `https://ants-backend-xxxx.onrender.com`.

### Confirm it actually came up

```bash
curl -s https://ants-backend-xxxx.onrender.com/healthz
```

Read the reply carefully — this endpoint is the whole diagnostic surface:

```json
{
  "status": "ok",
  "aiEnabled": true,
  "aiModel": "claude-opus-5",
  "aiLastError": null,
  "knowledgeChunks": 24,
  "accountsEnabled": true,
  "brokerLinkEnabled": false,
  "executionEnabled": false
}
```

- `aiEnabled: false` → `ANTHROPIC_API_KEY` never reached the service.
- `aiLastError` non-null → the key **is** set but the API rejected it. The
  message says whether that was a bad key (401), an unknown model, or a rate
  limit. This is the field that tells the invalid-key case apart from the
  not-configured case; check it before regenerating anything.
- `accountsEnabled: false` → Supabase vars missing. Expected if you skipped them.
- `brokerLinkEnabled` / `executionEnabled` are `false` on purpose. Broker
  linking and order execution are not implemented and return 503 rather than
  inventing data.

Then confirm the analysis engine returns real math:

```bash
curl -s -X POST https://ants-backend-xxxx.onrender.com/api/analyze -H "Content-Type: application/json" -d '{"positions":[{"ticker":"TCS","qty":10,"avg":3500},{"ticker":"INFY","qty":5,"avg":2100}],"source":"manual"}'
```

---

## Step 2 — Point the frontend at it

`NEXT_PUBLIC_API_URL` is inlined into the JavaScript bundle **at build time**,
not read at runtime. Setting the variable without rebuilding changes nothing —
this is the single most common way this step silently fails.

1. https://vercel.com → your **Ants** project → **Settings** → **Environment Variables**.
2. Add:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://ants-backend-xxxx.onrender.com` — no trailing slash
   - **Environments**: Production, Preview, Development
3. **Save**.
4. **Deployments** → latest → ⋯ → **Redeploy**. Without this the old bundle,
   with the old value baked in, keeps serving.

If you forget, the app now says so out loud instead of failing as a generic
network error: it detects a page served from a real host whose API base is
loopback and reports that `NEXT_PUBLIC_API_URL` is unset or still local.

---

## Step 3 — Verify end to end

1. Open https://ants-delta.vercel.app.
2. Upload a broker screenshot.
3. Expect: extracted holdings shown **for review and editing** before any
   analysis runs — that confirmation step is deliberate, because the free
   tesseract path is materially less accurate than AI vision.
4. Correct anything misread, then run the analysis.
5. Run a second, different portfolio and confirm the output differs.

Open the browser console and confirm there are no CORS errors. If there are,
`ALLOWED_ORIGINS` on Render does not include the exact origin you are browsing
from — including a Vercel preview URL, which differs per deployment.

---

## Local development

`backend/main.py` loads `backend/.env.local`, then `backend/.env`, and neither
overrides a variable already present in the real process environment. So a local
file is enough for dev, and the hosting dashboard still wins in production. You
no longer need to `export` anything by hand.

```bash
# Terminal 1 — backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The service refuses to boot without `JWT_SECRET` — deliberately, so a missing
signing key fails loudly at startup instead of quietly at the first login. Put
it in `backend/.env`.

```bash
# Terminal 2 — frontend
npm run dev
```

Then http://localhost:3000. Root `.env.local` already points at
`http://localhost:8000`; leave it that way. Production reads Vercel's value, not
this file.

Note: `tesseract` must be on your PATH for the free OCR fallback locally
(`brew install tesseract`). Docker handles it in deployment.

---

## Security checklist

> **The previous key was published and is already dead.** A real
> `ANTHROPIC_API_KEY` was committed in `819558a3` ("Add deployment and quick
> start guides") inside `DEPLOYMENT_GUIDE.md` and `QUICK_START.md`. `c7d2845`
> replaced it with a placeholder in the working tree, but a later commit does
> not remove a value from history — and both commits are on `origin/main` at
> `github.com/Daksh-22/Ants`, which is **public**.
>
> That is the most likely explanation for the 401: GitHub secret scanning
> reports leaked Anthropic keys to Anthropic, which revokes them. The key did
> not expire or break; it was published and killed.
>
> Consequences to act on:
> - Treat that key as compromised regardless of its current status. Revoke it
>   explicitly rather than assuming the auto-revoke covered it.
> - The new key must never enter a tracked file. It belongs only in the Render
>   dashboard and, locally, in the gitignored `backend/.env`.
> - Scrubbing history (`git filter-repo`, or GitHub support for cached views)
>   is optional here **only because the key is already dead**. Do it if you
>   want the repo clean; it is not what protects you. Revocation is.

- [ ] Old `ANTHROPIC_API_KEY` **revoked** at console.anthropic.com, not just replaced.
- [ ] Spending limit set on the new key.
- [ ] `JWT_SECRET` is a generated random string, unique to production.
- [ ] `backend/.env` is gitignored (it is) and excluded from the Docker image
      via `backend/.dockerignore` (it is) — otherwise the key ships inside an
      image layer, where rotating it in the dashboard does not remove it.
- [ ] Supabase key is the anon/public key, not the service-role key.

---

## Known limitations

State these plainly rather than letting a user discover them:

- **Price alerts do not fire on live price moves.** They are evaluated in the
  browser against the prices from your last analysis, so an alert only resolves
  when you reopen the app and re-run it. Real alerting needs a server-side
  price watcher plus push delivery — unbuilt. The UI labels price age
  ("Prices from 3h ago") and offers Refresh so this is visible, not hidden.
- **Prices are not streamed.** A stored analysis keeps the quotes it was built
  with until re-run.
- **Broker linking and order execution are not implemented** and return 503.
- **Risk metrics cover only holdings with enough price history.** The response
  carries a `coveragePct`; a portfolio of recent listings yields little.
