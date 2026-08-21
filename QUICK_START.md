# Quick Start

The short version. Full detail, troubleshooting and the `/healthz` field
reference live in [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md).

## Get three secrets ready

```bash
# 1. A working Anthropic key — the one in backend/.env returns 401.
#    Replace it at https://console.anthropic.com, then check the new one:
curl -s https://api.anthropic.com/v1/messages -H "x-api-key: PASTE_KEY_HERE" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" -d '{"model":"claude-opus-5","max_tokens":4,"messages":[{"role":"user","content":"hi"}]}'

# 2. A real JWT signing secret — NOT "prod-secret".
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

3. `SUPABASE_URL` + `SUPABASE_KEY` from your Supabase project — optional, but
   signup/login and saved portfolios stay off without them.

## Deploy

```bash
git push origin main
```

**Backend** — https://dashboard.render.com → **New** → **Blueprint** → pick
`Daksh-22/Ants`. It reads `render.yaml` and asks for the four secret values.
Use Blueprint, **not** a manual Web Service: only `backend/Dockerfile` installs
the `tesseract` binary the free OCR fallback needs.

Copy the resulting URL, then confirm:

```bash
curl -s https://ants-backend-xxxx.onrender.com/healthz
```

Want `"aiEnabled": true` and `"aiLastError": null`. If `aiLastError` is set, the
key reached the service but was rejected — the message says why.

**Frontend** — https://vercel.com → Ants → **Settings** → **Environment
Variables** → add `NEXT_PUBLIC_API_URL` = your Render URL (no trailing slash),
all three environments. Then **Deployments** → latest → ⋯ → **Redeploy**.

The redeploy is not optional. `NEXT_PUBLIC_*` is baked into the bundle at build
time, so saving the variable alone changes nothing.

## Verify

Open https://ants-delta.vercel.app, upload a broker screenshot, confirm the
extracted holdings shown for review are right, then run the analysis. Run a
second, different portfolio and check the output actually differs.

## What is not built

Price alerts do not fire on live price moves — they are checked in the browser
against the prices from your last analysis. Broker linking and order execution
return 503 by design. See the Known limitations section of the full guide.
