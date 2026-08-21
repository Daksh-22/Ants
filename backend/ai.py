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


# ─── 2. Punch up analysis copy ──────────────────────────────────────────────

def polish_analysis(analysis: dict[str, Any]) -> dict[str, Any]:
    """Rewrite flag/working bodies in the Ants voice. Returns input unchanged on any failure."""
    client = _get_client()
    if client is None:
        return analysis
    try:
        editable = {
            "flags": [{"id": f["id"], "label": f["label"], "body": f["body"]} for f in analysis["flags"]],
            "working": [{"id": w["id"], "label": w["label"], "body": w["body"]} for w in analysis["working"]],
        }
        context = {
            "summary": analysis["summary"],
            "score": analysis["score"],
            "holdings": [
                {k: h[k] for k in ("name", "sector", "weightPct", "returnPct")}
                for h in analysis["holdings"]
            ],
        }
        msg = _call(
            client,
            max_tokens=1800,
            system=VOICE,
            messages=[{
                "role": "user",
                "content": (
                    "Here is a portfolio analysis context:\n" + json.dumps(context) +
                    "\n\nRewrite ONLY the label and body strings below to be sharper, more personal "
                    "and more specific to these holdings, keeping every fact and number accurate. "
                    "2 sentences max per body. Return the SAME JSON structure, nothing else:\n" +
                    json.dumps(editable)
                ),
            }],
        )
        text = _text_of(msg)
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return analysis
        polished = json.loads(match.group(0))
        by_id_f = {f["id"]: f for f in polished.get("flags", [])}
        by_id_w = {w["id"]: w for w in polished.get("working", [])}
        for f in analysis["flags"]:
            if f["id"] in by_id_f:
                f["label"] = by_id_f[f["id"]].get("label", f["label"])
                f["body"] = by_id_f[f["id"]].get("body", f["body"])
        for w in analysis["working"]:
            if w["id"] in by_id_w:
                w["label"] = by_id_w[w["id"]].get("label", w["label"])
                w["body"] = by_id_w[w["id"]].get("body", w["body"])
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
