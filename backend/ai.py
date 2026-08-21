"""
Ants AI layer — every Claude call in one place, all optional.

Set ANTHROPIC_API_KEY and the app gets: vision OCR of holdings screenshots,
analysis copy rewritten in the Ants voice, and a RAG-grounded chat assistant.
Without a key every function degrades to a deterministic fallback, so the
product always works — the key just makes it smarter.
"""

from __future__ import annotations

import base64
import json
import os
import re
from typing import Any, Optional

import rag

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-5")

_client = None

# Last AI failure, surfaced by /healthz. A configured-but-rejected key looks
# identical to a working one from the outside — every call just silently
# degrades — so we remember why the last call failed and say so.
_last_error: Optional[str] = None


def have_ai() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def last_error() -> Optional[str]:
    return _last_error


def _note_failure(exc: Exception) -> None:
    """Record an AI failure. AuthenticationError means the key is bad, not absent."""
    global _last_error
    name = type(exc).__name__
    if name == "AuthenticationError":
        _last_error = "ANTHROPIC_API_KEY is set but rejected by the API (401). Check or regenerate the key."
    elif name == "NotFoundError":
        _last_error = f"Model '{MODEL}' was not found. Check ANTHROPIC_MODEL."
    elif name == "RateLimitError":
        _last_error = "Rate limited by the Anthropic API (429)."
    else:
        _last_error = f"{name}: {exc}"


def _note_success() -> None:
    global _last_error
    _last_error = None


def _get_client():
    global _client
    if _client is None and have_ai():
        from anthropic import Anthropic
        _client = Anthropic()
    return _client


def _call(client, **kwargs):
    """Single funnel for every Claude call, so success clears the error too.

    Nothing ever reset _last_error. One transient 429 therefore pinned
    /healthz red for the rest of the process lifetime and kept rewording
    unrelated user-facing copy: main.py words the OCR reply from last_error(),
    so a user whose vision call succeeded but found no holdings was told
    "screenshot reading is down" instead of "couldn't read any holdings".

    It also broke the repair loop this field exists for — after an operator
    replaced a rejected key, /healthz kept reporting the old 401 until the
    service was restarted, so the fix looked like it had not worked.
    """
    try:
        msg = client.messages.create(model=MODEL, **kwargs)
    except Exception as exc:
        _note_failure(exc)
        raise
    _note_success()
    return msg


def _text_of(msg) -> str:
    """Text from a response, guarding the refusal stop reason.

    Current models can decline a request: HTTP 200, stop_reason 'refusal',
    empty or partial content. Reading content[0] blindly breaks on those.
    """
    if getattr(msg, "stop_reason", None) == "refusal":
        return ""
    return "".join(b.text for b in msg.content if b.type == "text")


VOICE = (
    "You write for Ants, a fintech app for Indian Gen Z. Voice: a smart, slightly "
    "irreverent friend who knows finance — direct, specific, never corporate, never "
    "preachy. Rupees formatted Indian style (₹1,87,420). Short sentences that land."
)


# ─── 1. Screenshot OCR → holdings ───────────────────────────────────────────

_OCR_TOOL = {
    "name": "report_holdings",
    "description": "Report every holding visible in the portfolio screenshot.",
    "input_schema": {
        "type": "object",
        "properties": {
            "holdings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "ticker": {"type": "string", "description": "NSE ticker or best-guess symbol, uppercase"},
                        "qty": {"type": "number", "description": "quantity/units held"},
                        "avg": {"type": "number", "description": "average buy price in ₹"},
                    },
                    "required": ["ticker", "qty", "avg"],
                },
            },
        },
        "required": ["holdings"],
    },
}


def extract_holdings(image_b64: str, media_type: str) -> Optional[list[dict[str, Any]]]:
    """Claude vision → [{ticker, qty, avg}]. None when AI unavailable or unreadable."""
    client = _get_client()
    if client is None:
        return None
    try:
        msg = _call(
            client,
            max_tokens=1500,
            tools=[_OCR_TOOL],
            tool_choice={"type": "tool", "name": "report_holdings"},
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
                    {"type": "text", "text": (
                        "This is a screenshot of an Indian broker/investment app (Growth, Zerodha Kite/Console, Kuvera, INDmoney, ET Money, Shoonya, Angel, 5Paisa, or similar). "
                        "CAREFULLY extract EVERY equity/ETF/mutual fund holding visible. For each:\n"
                        "1. TICKER: NSE symbol in UPPERCASE (e.g., TCS, INFY, SBIN, RELIANCE). For mutual funds use the fund's short code.\n"
                        "2. QUANTITY: Number of shares/units held. Look for columns labeled 'Qty', 'Shares', 'Units', 'Quantity', 'Holdings'.\n"
                        "3. AVERAGE BUY PRICE: Price per unit in ₹. Look for 'Avg Price', 'Avg Cost', 'Buy Price', 'Cost Price', 'Avg Buy'. "
                        "If not visible, calculate: Total Invested Value ÷ Quantity = Average Price.\n"
                        "\n"
                        "CRITICAL RULES:\n"
                        "- Skip header rows, footer rows, total rows, and summary rows.\n"
                        "- Skip rows that show portfolio totals (like 'Total: ₹...', 'Overall P&L', 'Net Value').\n"
                        "- Only extract positions where all three values (ticker, qty, avg) are present or calculable.\n"
                        "- If you see duplicate tickers, sum the quantities.\n"
                        "- Ensure prices are per unit, not total value.\n"
                        "- For fractional holdings, round to 2 decimal places.\n"
                        "- If any value is missing or unclear, skip that row entirely.\n"
                        "\n"
                        "Return ONLY valid holdings. Better to extract 5 correct holdings than 10 with errors."
                    )},
                ],
            }],
        )
        for block in msg.content:
            if block.type == "tool_use" and block.name == "report_holdings":
                holdings = block.input.get("holdings", [])
                clean = [
                    h for h in holdings
                    if str(h.get("ticker", "")).strip() and float(h.get("qty") or 0) > 0 and float(h.get("avg") or 0) > 0
                ]
                return clean or None
    except Exception as exc:
        _note_failure(exc)
        return None
    return None


# ─── 2. Generate the analysis narrative ─────────────────────────────────────
#
# This used to only rewrite the wording of flags engine.py had already decided
# with fixed thresholds (>25% in one name, >40% in one sector, <4 holdings, and
# so on). Those rules fire the same way on a ₹20k first portfolio and a ₹2Cr
# book, they cannot see an interaction between two holdings, and anything the
# thresholds do not cover was invisible no matter how obvious.
#
# Now the model decides WHICH problems are worth raising, given the whole
# portfolio. What it does NOT get to do is invent facts: every number it may use
# is computed here first and passed in, and validation below rejects any output
# that references a holding we did not send or that fails the contract. On any
# failure the deterministic engine analysis is returned unchanged — a fintech
# screen must not go blank because a model call timed out.

_ANALYSIS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "scoreLabel": {
            "type": "string",
            "description": "Five words or fewer, verdict on the portfolio's health.",
        },
        "flags": {
            "type": "array",
            "description": (
                "Problems worth the user's attention, most serious first. Zero to five. "
                "Only raise something the supplied numbers actually support."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "kebab-case, stable, describes the problem e.g. 'single-concentration'",
                    },
                    "severity": {"type": "string", "enum": ["red", "amber"]},
                    "label": {"type": "string", "description": "Under 40 characters."},
                    "body": {
                        "type": "string",
                        "description": (
                            "Two sentences max. Cite the real figure from the data. "
                            "Never state a number that is not in the supplied facts."
                        ),
                    },
                    "tickers": {
                        "type": "array",
                        "description": "Tickers this concerns; must all appear in the supplied holdings.",
                        "items": {"type": "string"},
                    },
                    "scoreDelta": {
                        "type": "integer",
                        "description": "Points 1-15 the health score should recover if fixed.",
                    },
                    "fix": {
                        "type": "object",
                        "properties": {
                            "sheetTitle": {"type": "string", "description": "Under 50 characters."},
                            "metricLabel": {"type": "string", "description": "What improves, e.g. 'Top holding weight'."},
                            "metricBefore": {"type": "string", "description": "Current value with unit, e.g. '38%'."},
                            "metricAfter": {"type": "string", "description": "Target value with unit, e.g. 'under 25%'."},
                            "steps": {
                                "type": "array",
                                "description": "Two to four concrete actions.",
                                "items": {"type": "string"},
                            },
                            "effort": {"type": "string", "description": "e.g. '10 minutes'."},
                        },
                        "required": ["sheetTitle", "metricLabel", "metricBefore", "metricAfter", "steps", "effort"],
                        "additionalProperties": False,
                    },
                },
                "required": ["id", "severity", "label", "body", "tickers", "scoreDelta", "fix"],
                "additionalProperties": False,
            },
        },
        "working": {
            "type": "array",
            "description": "One to three things this portfolio genuinely gets right. Never invent praise.",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "kebab-case"},
                    "label": {"type": "string", "description": "Under 40 characters."},
                    "body": {"type": "string", "description": "Two sentences max, citing a real figure."},
                },
                "required": ["id", "label", "body"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["scoreLabel", "flags", "working"],
    "additionalProperties": False,
}

ANALYST_BRIEF = (
    "You are the analysis engine behind Ants, an honest portfolio review app for "
    "Indian retail investors. You are given a portfolio whose every figure has "
    "already been computed from live market prices. Your job is to decide what "
    "actually matters about THIS portfolio and say it.\n\n"
    "What to look for — judge these against the portfolio's size and shape, not "
    "fixed thresholds:\n"
    "- Concentration in one holding, and separately in one sector. A 30% position "
    "in a diversified large cap is not the same risk as 30% in a single micro cap.\n"
    "- Correlated bets the user may not see as correlated: several PSU banks, "
    "several defence names, several new-age loss-making tech listings.\n"
    "- Positions deep underwater, and whether the rest of the book can carry them.\n"
    "- A single winner carrying the whole portfolio's return.\n"
    "- No international or index exposure at all.\n"
    "- Too few holdings to be diversified, or so many that nothing moves the needle.\n"
    "- Cash-like or debt exposure entirely absent in a book this size.\n\n"
    "Hard rules:\n"
    "1. NEVER state a number that is not in the supplied facts. Do not estimate, "
    "annualise, or extrapolate. If you want to describe a magnitude you have no "
    "figure for, use words, not digits.\n"
    "2. Holdings marked unpriced have NO known current price. Their 0% return is "
    "missing data, not a flat result. Never describe one as flat, and never "
    "include one in a return-based claim.\n"
    "3. Only reference tickers present in the holdings you are given.\n"
    "4. Raise a flag only if the data supports it. A genuinely sound portfolio "
    "should get zero or one flag. Padding the list to look thorough is a failure.\n"
    "5. You are not a SEBI-registered adviser. Frame fixes as portfolio "
    "construction — weights, diversification, position sizing — never as a "
    "buy/sell instruction on a specific security.\n\n"
    "Voice: a smart, direct friend who knows finance. Short sentences. Rupees in "
    "Indian format. No corporate hedging, no preaching."
)

# A model-proposed fix cannot move the score more than this, and the total
# recoverable score is capped too — otherwise one generous run could hand a
# portfolio a 40-point swing that means nothing next time.
_MAX_FLAG_DELTA = 15
_MAX_TOTAL_DELTA = 40
_MAX_FLAGS = 5
_MAX_WORKING = 3


def _analysis_facts(analysis: dict[str, Any]) -> dict[str, Any]:
    """Everything the model is allowed to reason from — all computed, none guessed."""
    holdings = analysis.get("holdings", [])

    by_sector: dict[str, dict[str, float]] = {}
    for h in holdings:
        bucket = by_sector.setdefault(h["sector"], {"weightPct": 0.0, "count": 0})
        bucket["weightPct"] = round(bucket["weightPct"] + float(h.get("weightPct") or 0), 1)
        bucket["count"] += 1

    priced = [h for h in holdings if h.get("priceSource") != "unpriced"]

    return {
        "summary": analysis.get("summary"),
        "engineScore": analysis.get("score"),
        "holdings": [
            {
                "ticker": h["ticker"],
                "name": h["name"],
                "sector": h["sector"],
                "weightPct": h.get("weightPct"),
                "returnPct": h.get("returnPct"),
                "value": h.get("value"),
                "invested": h.get("invested"),
                # So the model can honour rule 2 rather than guessing.
                "priced": h.get("priceSource") != "unpriced",
            }
            for h in holdings
        ],
        "sectorWeights": by_sector,
        "holdingCount": len(holdings),
        "pricedHoldingCount": len(priced),
        "unpricedTickers": [
            h["ticker"] for h in holdings if h.get("priceSource") == "unpriced"
        ],
        "pricingNote": (analysis.get("pricing") or {}).get("note"),
    }


def _validate_flag(raw: dict[str, Any], known_tickers: set[str]) -> dict[str, Any] | None:
    """Turn one model-proposed flag into a contract-shaped flag, or reject it."""
    flag_id = str(raw.get("id") or "").strip()
    label = str(raw.get("label") or "").strip()
    body = str(raw.get("body") or "").strip()
    severity = raw.get("severity")

    if not flag_id or not label or not body or severity not in ("red", "amber"):
        return None

    # A flag about a holding we never sent is a hallucination — drop it whole
    # rather than render a warning about a stock the user does not own.
    tickers = [str(t).strip().upper() for t in (raw.get("tickers") or [])]
    if any(t and t not in known_tickers for t in tickers):
        return None

    delta = raw.get("scoreDelta")
    try:
        delta = int(delta)
    except (TypeError, ValueError):
        return None
    delta = max(1, min(_MAX_FLAG_DELTA, delta))

    raw_fix = raw.get("fix") or {}
    steps = [str(x).strip() for x in (raw_fix.get("steps") or []) if str(x).strip()]
    if not steps:
        return None

    return {
        "id": flag_id,
        "severity": severity,
        "label": label[:80],
        "body": body,
        "fix": {
            "id": flag_id,
            "sheetTitle": str(raw_fix.get("sheetTitle") or label)[:90],
            "scoreDelta": delta,
            "metricLabel": str(raw_fix.get("metricLabel") or "Impact")[:60],
            "metricBefore": str(raw_fix.get("metricBefore") or "—")[:30],
            "metricAfter": str(raw_fix.get("metricAfter") or "—")[:30],
            "steps": steps[:4],
            "effort": str(raw_fix.get("effort") or "A few minutes")[:40],
        },
    }


def polish_analysis(analysis: dict[str, Any]) -> dict[str, Any]:
    """Replace the engine's rule-derived narrative with a model-generated one.

    The engine's MATH is untouched — summary, holdings, weights, returns and
    pricing all stay exactly as computed. Only the interpretation (which flags,
    which fixes, what's working, the score label) comes from the model, and only
    if it survives validation. Returns the input unchanged on any failure.
    """
    client = _get_client()
    if client is None:
        return analysis

    holdings = analysis.get("holdings") or []
    if not holdings:
        return analysis

    try:
        facts = _analysis_facts(analysis)
        msg = _call(
            client,
            max_tokens=4000,
            system=ANALYST_BRIEF,
            output_config={"format": {"type": "json_schema", "schema": _ANALYSIS_SCHEMA}},
            messages=[{
                "role": "user",
                "content": (
                    "Review this portfolio. Every figure here is already computed from "
                    "live prices — use these numbers and no others.\n\n"
                    + json.dumps(facts, ensure_ascii=False)
                ),
            }],
        )

        text = _text_of(msg).strip()
        if not text:
            return analysis
        payload = json.loads(text)

        known_tickers = {str(h["ticker"]).upper() for h in holdings}

        flags: list[dict[str, Any]] = []
        seen_ids: set[str] = set()
        total_delta = 0
        for raw in (payload.get("flags") or [])[:_MAX_FLAGS]:
            flag = _validate_flag(raw, known_tickers)
            if flag is None or flag["id"] in seen_ids:
                continue
            # Cap the cumulative recoverable score so the ring stays comparable
            # between runs instead of moving with the model's generosity.
            if total_delta + flag["fix"]["scoreDelta"] > _MAX_TOTAL_DELTA:
                flag["fix"]["scoreDelta"] = max(0, _MAX_TOTAL_DELTA - total_delta)
                if flag["fix"]["scoreDelta"] == 0:
                    flag["fix"] = None
            if flag["fix"]:
                total_delta += flag["fix"]["scoreDelta"]
            seen_ids.add(flag["id"])
            flags.append(flag)

        working: list[dict[str, Any]] = []
        for raw in (payload.get("working") or [])[:_MAX_WORKING]:
            w_id = str(raw.get("id") or "").strip()
            label = str(raw.get("label") or "").strip()
            body = str(raw.get("body") or "").strip()
            if w_id and label and body:
                working.append({"id": w_id, "label": label[:80], "body": body})

        # Nothing usable survived validation — keep the deterministic analysis
        # rather than shipping an empty results screen.
        if not flags and not working:
            return analysis

        # Score from the model's own severity assessment: start high and subtract
        # what it flagged. This is what makes the score responsive to the actual
        # portfolio instead of to which fixed thresholds happened to trip.
        score = 88 - sum(
            (f["fix"]["scoreDelta"] if f.get("fix") else 4) for f in flags
        )
        score = max(5, min(100, score))

        label = str(payload.get("scoreLabel") or analysis.get("scoreLabel") or "").strip()

        analysis["flags"] = flags
        analysis["working"] = working
        analysis["moves"] = [
            {"title": f["fix"]["sheetTitle"], "cta": "See how", "fixId": f["fix"]["id"]}
            for f in flags
            if f.get("fix")
        ][:3]
        analysis["score"] = score
        analysis["scoreLabel"] = label[:60] or analysis.get("scoreLabel", "")
        analysis["attentionCount"] = len(flags)
        analysis["generatedBy"] = "ai"
        return analysis
    except Exception as exc:
        _note_failure(exc)
        return analysis


# ─── 2b. Punch up a Tip Check verdict ───────────────────────────────────────

def polish_verdict(check: dict[str, Any], holdings: list[dict[str, Any]]) -> dict[str, Any]:
    """Rewrite the tip-check verdict with full portfolio context. Facts and
    tone are computed by the engine and must not change; AI only sharpens the
    words. Returns input unchanged on any failure."""
    client = _get_client()
    if client is None:
        return check
    try:
        slim = [{k: h[k] for k in ("name", "sector", "weightPct", "returnPct")} for h in holdings]
        msg = _call(
            client,
            max_tokens=300,
            system=VOICE,
            messages=[{
                "role": "user",
                "content": (
                    "A user asked whether to buy a tipped stock. Engine facts (all true, keep them):\n"
                    + json.dumps({k: v for k, v in check.items() if k != "verdict"})
                    + "\nTheir holdings:\n" + json.dumps(slim)
                    + "\n\nCurrent verdict:\n" + check["verdict"]
                    + "\n\nRewrite the verdict — same conclusion and tone class "
                    f"('{check['tone']}'), sharper and more personal to their book. Max 3 "
                    "sentences. Return ONLY the rewritten verdict text."
                ),
            }],
        )
        text = _text_of(msg).strip()
        if 20 < len(text) < 600:
            check["verdict"] = text
    except Exception:
        pass
    return check


# ─── 3. Ask Ants — RAG-grounded chat ────────────────────────────────────────

OFFLINE_ANSWER = (
    "The AI brain is offline right now (no ANTHROPIC_API_KEY on the server), but here's "
    "what the knowledge base says:\n\n{digest}\n\nSet the API key and I'll give you a real, "
    "personalized answer."
)


def chat(question: str, analysis: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """Answer grounded in the RAG knowledge base + the user's analysis context."""
    chunks = rag.retrieve(question, k=3)
    sources = [{"source": c["source"], "title": c["title"]} for c in chunks]

    client = _get_client()
    if client is None:
        digest = "\n\n".join(f"**{c['title']}** — " + re.sub(r"^#.*\n", "", c["text"]).strip()[:300] for c in chunks[:2]) \
            or "No matching notes found."
        return {"answer": OFFLINE_ANSWER.format(digest=digest), "sources": sources, "aiUsed": False}

    context_parts = []
    if chunks:
        context_parts.append("KNOWLEDGE BASE (cite facts from here):\n" + "\n---\n".join(c["text"] for c in chunks))
    if analysis:
        slim = {
            "summary": analysis.get("summary"),
            "score": analysis.get("score"),
            "flags": [{"label": f["label"]} for f in analysis.get("flags", [])],
            "holdings": [
                {k: h.get(k) for k in ("name", "sector", "weightPct", "returnPct")}
                for h in analysis.get("holdings", [])
            ],
        }
        context_parts.append("THE USER'S PORTFOLIO ANALYSIS:\n" + json.dumps(slim))

    try:
        msg = _call(
            client,
            max_tokens=700,
            system=VOICE + (
                " Answer the user's investing question using the knowledge base and their portfolio "
                "context when relevant. Be concrete and short (under 150 words). You are not a SEBI-"
                "registered advisor — for buy/sell calls on specific securities, give the framework, "
                "not the order."
            ),
            messages=[{"role": "user", "content": "\n\n".join(context_parts + [f"QUESTION: {question}"])}],
        )
        answer = _text_of(msg).strip()
        return {"answer": answer, "sources": sources, "aiUsed": True}
    except Exception as exc:  # key set but call failed — degrade, don't 500
        return {"answer": f"AI call failed ({type(exc).__name__}). Try again in a moment.", "sources": sources, "aiUsed": False}
