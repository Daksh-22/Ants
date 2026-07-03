"""
Ants analysis engine — pure-python portfolio math.

Takes raw positions (ticker, qty, avg buy price), prices them against a
reference table, and produces the full Analysis object the frontend renders:
summary, health score, red/amber flags (each with an actionable fix), what's
working, and next moves. The copy here is the deterministic fallback voice;
ai.polish_analysis() punches it up with Claude when a key is configured.

Prices are a static reference snapshot (documented, easily swapped for a live
quotes API). Unknown tickers price flat at their avg — honest about what we
don't know rather than inventing a return.
"""

from __future__ import annotations

from typing import Any, Optional

# ticker -> (display name, sector, reference CMP ₹)
KNOWN_STOCKS: dict[str, tuple[str, str, float]] = {
    "TCS": ("TCS", "IT", 4127.0),
    "INFY": ("Infosys", "IT", 1612.0),
    "INFOSYS": ("Infosys", "IT", 1612.0),
    "WIPRO": ("Wipro", "IT", 545.0),
    "HCLTECH": ("HCL Tech", "IT", 1710.0),
    "HDFCBANK": ("HDFC Bank", "Banking", 1628.0),
    "HDFC": ("HDFC Bank", "Banking", 1628.0),
    "ICICIBANK": ("ICICI Bank", "Banking", 1145.0),
    "SBIN": ("SBI", "Banking", 815.0),
    "KOTAKBANK": ("Kotak Bank", "Banking", 1790.0),
    "BAJFINANCE": ("Bajaj Finance", "NBFC", 6890.0),
    "RELIANCE": ("Reliance", "Energy", 2943.0),
    "ONGC": ("ONGC", "Energy", 267.0),
    "TATAPOWER": ("Tata Power", "Power", 437.0),
    "NTPC": ("NTPC", "Power", 362.0),
    "DIXON": ("Dixon Technologies", "Electronics", 14340.0),
    "KAYNES": ("Kaynes Technology", "Electronics", 4120.0),
    "SYRMA": ("Syrma SGS", "Electronics", 512.0),
    "HAL": ("HAL", "Defense", 4510.0),
    "BEL": ("Bharat Electronics", "Defense", 297.0),
    "RVNL": ("RVNL", "Railways", 415.0),
    "IRFC": ("IRFC", "Railways", 142.0),
    "TATAMOTORS": ("Tata Motors", "Auto", 985.0),
    "M&M": ("Mahindra & Mahindra", "Auto", 2870.0),
    "MARUTI": ("Maruti Suzuki", "Auto", 12400.0),
    "ITC": ("ITC", "FMCG", 465.0),
    "HINDUNILVR": ("HUL", "FMCG", 2380.0),
    "SUNPHARMA": ("Sun Pharma", "Pharma", 1710.0),
    "CIPLA": ("Cipla", "Pharma", 1520.0),
    "ZOMATO": ("Zomato", "Consumer Tech", 265.0),
    "PAYTM": ("Paytm", "Consumer Tech", 415.0),
    "ADANIENT": ("Adani Enterprises", "Conglomerate", 3120.0),
    "MIRAEFANG": ("Mirae FANG+ ETF", "International ETF", 94.0),
    "FANG": ("Mirae FANG+ ETF", "International ETF", 94.0),
    "MON100": ("Motilal Nasdaq 100 ETF", "International ETF", 172.0),
    "NIFTYBEES": ("Nifty BeES", "Index ETF", 285.0),
}

INTERNATIONAL_SECTORS = {"International ETF"}
SCORE_LABELS = [
    (90, "You're crushing it."),
    (80, "Strong portfolio."),
    (60, "Decent start."),
    (40, "Needs work."),
    (0, "Let's fix this."),
]


def _score_label(score: int) -> str:
    for floor, label in SCORE_LABELS:
        if score >= floor:
            return label
    return "Let's fix this."


def _norm(ticker: str) -> str:
    return "".join(ch for ch in ticker.upper().strip() if ch.isalnum() or ch == "&")


def price_position(ticker: str, qty: float, avg: float) -> dict[str, Any]:
    key = _norm(ticker)
    name, sector, cmp_ = KNOWN_STOCKS.get(key, (ticker.strip() or key, "Other", avg))
    if cmp_ <= 0:
        cmp_ = avg
    value = qty * cmp_
    invested = qty * avg
    ret = ((cmp_ - avg) / avg * 100) if avg > 0 else 0.0
    return {
        "ticker": key,
        "name": name,
        "sector": sector,
        "qty": qty,
        "avg": round(avg, 2),
        "cmp": round(cmp_, 2),
        "value": round(value, 2),
        "invested": round(invested, 2),
        "returnPct": round(ret, 1),
        "known": key in KNOWN_STOCKS,
    }


def analyze(positions: list[dict[str, Any]], source: str = "manual") -> dict[str, Any]:
    """positions: [{ticker, qty, avg}] → full Analysis object."""
    holdings = [
        price_position(str(p.get("ticker", "")), float(p.get("qty") or 0), float(p.get("avg") or 0))
        for p in positions
        if str(p.get("ticker", "")).strip() and float(p.get("qty") or 0) > 0 and float(p.get("avg") or 0) > 0
    ]
    holdings = [h for h in holdings if h["value"] > 0]
    if not holdings:
        raise ValueError("No valid positions. Each needs a ticker, qty > 0 and avg > 0.")

    total = sum(h["value"] for h in holdings)
    invested = sum(h["invested"] for h in holdings)
    returns_abs = total - invested
    returns_pct = (returns_abs / invested * 100) if invested > 0 else 0.0
    for h in holdings:
        h["weightPct"] = round(h["value"] / total * 100, 1)
    holdings.sort(key=lambda h: h["returnPct"], reverse=True)

    flags: list[dict[str, Any]] = []
    working: list[dict[str, Any]] = []
    score = 88  # everyone starts near-strong; problems subtract

    # ---- concentration: single position too heavy
    heaviest = max(holdings, key=lambda h: h["weightPct"])
    if heaviest["weightPct"] > 25 and len(holdings) > 1:
        score -= 12
        flags.append({
            "id": "single-concentration",
            "severity": "red",
            "label": "Concentration risk",
            "body": (
                f"{heaviest['name']} alone is {heaviest['weightPct']:.0f}% of your money. "
                f"One bad quarter there and your whole portfolio feels it. That's not conviction, that's exposure."
            ),
            "fix": {
                "id": "single-concentration",
                "sheetTitle": f"Trim {heaviest['name']}",
                "scoreDelta": 8,
                "metricLabel": f"In {heaviest['name']}",
                "metricBefore": f"{heaviest['weightPct']:.0f}%",
                "metricAfter": "15%",
                "steps": [
                    f"Sell {heaviest['name']} down toward 15% of your portfolio.",
                    "Redeploy into names that spread the same thesis.",
                    "Keep any single stock under 15–20%.",
                ],
                "effort": "1–2 sell orders",
            },
        })

    # ---- sector concentration
    sector_weight: dict[str, float] = {}
    for h in holdings:
        sector_weight[h["sector"]] = sector_weight.get(h["sector"], 0) + h["weightPct"]
    top_sector, top_sector_w = max(sector_weight.items(), key=lambda kv: kv[1])
    if top_sector_w > 45 and len(holdings) > 2 and top_sector != "Other":
        score -= 8
        flags.append({
            "id": "sector-concentration",
            "severity": "amber",
            "label": f"{top_sector} is carrying everything",
            "body": (
                f"{top_sector_w:.0f}% of your portfolio is {top_sector}. Sector bets are fine — "
                f"sector portfolios are how people give back two years of gains in one cycle."
            ),
            "fix": {
                "id": "sector-concentration",
                "sheetTitle": f"Diversify beyond {top_sector}",
                "scoreDelta": 6,
                "metricLabel": f"In {top_sector}",
                "metricBefore": f"{top_sector_w:.0f}%",
                "metricAfter": "35%",
                "steps": [
                    f"Cap {top_sector} at about a third of the portfolio.",
                    "Add 1–2 positions from unrelated sectors.",
                    "Rebalance quarterly, not daily.",
                ],
                "effort": "2–3 orders",
            },
        })

    # ---- thin portfolio
    if len(holdings) < 4:
        score -= 7
        flags.append({
            "id": "thin-portfolio",
            "severity": "amber",
            "label": f"Only {len(holdings)} position{'s' if len(holdings) > 1 else ''}",
            "body": (
                "With this few names, every position is a make-or-break bet. "
                "You don't need 30 stocks. You do need more than this."
            ),
            "fix": {
                "id": "thin-portfolio",
                "sheetTitle": "Broaden the base",
                "scoreDelta": 6,
                "metricLabel": "Positions",
                "metricBefore": str(len(holdings)),
                "metricAfter": "6–8",
                "steps": [
                    "Add positions until you hold 6–8 names or funds.",
                    "An index ETF counts — it's instant breadth.",
                    "Add on your schedule, not on tips.",
                ],
                "effort": "SIP or 2–3 buys",
            },
        })

    # ---- no international exposure
    intl_w = sum(w for s, w in sector_weight.items() if s in INTERNATIONAL_SECTORS)
    if intl_w < 5:
        score -= 5
        flags.append({
            "id": "no-international",
            "severity": "amber",
            "label": "100% India",
            "body": (
                "Everything you own trades in one country and one currency. "
                "A global ETF is the cheapest insurance you can buy against a purely local decade."
            ),
            "fix": {
                "id": "no-international",
                "sheetTitle": "Add an international ETF",
                "scoreDelta": 5,
                "metricLabel": "Global exposure",
                "metricBefore": f"{intl_w:.0f}%",
                "metricAfter": "10%",
                "steps": [
                    "Start a small SIP into a global / US ETF.",
                    "Target ~10% of the portfolio over time.",
                    "This diversifies you out of India-only risk.",
                ],
                "effort": "1 new SIP",
            },
        })

    # ---- big unrealized loss position
    worst = min(holdings, key=lambda h: h["returnPct"])
    if worst["returnPct"] < -20:
        score -= 6
        flags.append({
            "id": "deep-loser",
            "severity": "red",
            "label": f"{worst['name']} is down {abs(worst['returnPct']):.0f}%",
            "body": (
                f"Holding a {abs(worst['returnPct']):.0f}% loser isn't a strategy, it's avoidance. "
                f"Decide: would you buy {worst['name']} today at this price? If not, why are you holding it?"
            ),
            "fix": {
                "id": "deep-loser",
                "sheetTitle": f"Decide on {worst['name']}",
                "scoreDelta": 5,
                "metricLabel": "Dead weight",
                "metricBefore": f"{worst['weightPct']:.0f}%",
                "metricAfter": "0%",
                "steps": [
                    "Re-underwrite the thesis from scratch.",
                    "If it fails: sell, book the loss, move on.",
                    "If it holds: average down deliberately, not emotionally.",
                ],
                "effort": "1 honest decision",
            },
        })

    # ---- winner dispersion: one pick carrying the whole book (observation, framed positive)
    if len(holdings) >= 3:
        top_ret = holdings[0]["returnPct"]
        rets = sorted(h["returnPct"] for h in holdings)
        median_ret = rets[len(rets) // 2]
        if top_ret - median_ret > 25 and top_ret > 15:
            working.append({
                "id": "one-man-army",
                "label": f"{holdings[0]['name']} is carrying the team",
                "body": (
                    f"Your top pick is +{top_ret:.1f}% while your median pick sits at "
                    f"{median_ret:+.1f}%. Study what you got right there — then ask the rest of "
                    f"your portfolio why it's just watching."
                ),
            })

    # ---- what's working
    winners = [h for h in holdings if h["returnPct"] >= 15]
    if winners:
        top_two = winners[:2]
        gained = sum(h["value"] - h["invested"] for h in top_two)
        names = " and ".join(h["name"] for h in top_two)
        working.append({
            "id": "winners",
            "label": "Your picks are printing",
            "body": (
                f"{names} — " + ", ".join(f"+{h['returnPct']:.1f}%" for h in top_two) +
                f". Together they've added ₹{gained:,.0f}. Whatever you did there, do it again."
            ),
        })
        score += 3
    if returns_pct > 0:
        working.append({
            "id": "green-overall",
            "label": "You're up overall",
            "body": (
                f"+{returns_pct:.1f}% across the book. Most people your age are still 'planning to start'. "
                f"You started. That's the hard part."
            ),
        })
    if len(holdings) >= 5 and top_sector_w <= 45:
        working.append({
            "id": "spread",
            "label": "Genuinely spread out",
            "body": f"{len(holdings)} positions across {len(sector_weight)} sectors. This is what diversification actually looks like.",
        })
        score += 2

    score = max(25, min(95, score))
    red_amber = [f for f in flags if f["severity"] in ("red", "amber")]

    moves = [
        {"title": f["fix"]["sheetTitle"], "cta": "See how", "fixId": f["fix"]["id"]}
        for f in flags if f.get("fix")
    ][:3]

    return {
        "source": source,
        "generatedBy": "engine",
        "summary": {
            "totalValue": round(total, 2),
            "invested": round(invested, 2),
            "returnsAbs": round(returns_abs, 2),
            "returnsPct": round(returns_pct, 1),
        },
        "score": score,
        "scoreLabel": _score_label(score),
        "attentionCount": len(red_amber),
        "flags": flags,
        "working": working,
        "moves": moves,
        "holdings": holdings,
    }


# ─── The Arjun Mehta demo portfolio — used by the broker mock + keyless OCR ───
DEMO_POSITIONS = [
    {"ticker": "TCS", "qty": 3, "avg": 3680},
    {"ticker": "INFY", "qty": 8, "avg": 1445},
    {"ticker": "DIXON", "qty": 2, "avg": 10200},
    {"ticker": "KAYNES", "qty": 5, "avg": 2890},
    {"ticker": "MIRAEFANG", "qty": 15, "avg": 68},
    {"ticker": "HDFCBANK", "qty": 10, "avg": 1590},
    {"ticker": "RELIANCE", "qty": 4, "avg": 2890},
]


def demo_analysis(source: str = "demo") -> dict[str, Any]:
    return analyze(DEMO_POSITIONS, source=source)


# ─── Tip Check — "should I buy this?" answered against YOUR portfolio ───────

SIM_BUY_PCT = 10.0  # simulate the tip as a 10%-of-portfolio buy


def check_ticker(analysis: dict[str, Any], ticker: str) -> dict[str, Any]:
    """The pre-buy gut check. Given the user's analysis and a tipped ticker,
    return what the buy actually does to THEIR portfolio — plus a verdict in
    the Ants voice. tone: ok | caution | warn."""
    holdings = analysis["holdings"]
    total = analysis["summary"]["totalValue"]

    key = _norm(ticker)
    name, sector, cmp_ = KNOWN_STOCKS.get(key, (ticker.strip().upper() or key, "Other", 0.0))
    known = key in KNOWN_STOCKS

    # Canonicalize: find all holdings of the same company by matching to the display name
    # This handles aliases like HDFC↔HDFCBANK which both map to "HDFC Bank"
    canon_name = name if known else None
    matching_holdings = [h for h in holdings if canon_name and h["name"] == canon_name] if known else []
    own_weight = sum(h["weightPct"] for h in matching_holdings) if matching_holdings else 0.0
    ownReturnPct = None
    if matching_holdings:
        # value-weighted average return across all matching holdings
        total_value = sum(h["value"] for h in matching_holdings)
        if total_value > 0:
            ownReturnPct = sum(h["value"] * h["returnPct"] for h in matching_holdings) / total_value

    sector_now = sum(h["weightPct"] for h in holdings if h["sector"] == sector) if known else 0.0
    # buying SIM_BUY_PCT of current total: new total = 1.1×, sector gains the new slug
    sector_after = ((sector_now / 100 * total) + (SIM_BUY_PCT / 100 * total)) / (total * (1 + SIM_BUY_PCT / 100)) * 100 if known else 0.0

    facts = {
        "ticker": key,
        "name": name,
        "sector": sector if known else None,
        "known": known,
        "cmp": cmp_ if known else None,
        "alreadyOwnWeightPct": round(own_weight, 1) if matching_holdings else None,
        "ownReturnPct": round(ownReturnPct, 1) if ownReturnPct is not None else None,
        "sectorWeightNow": round(sector_now, 1) if known else None,
        "sectorWeightAfter": round(sector_after, 1) if known else None,
        "simulatedBuyPct": SIM_BUY_PCT,
    }

    # verdict ladder — most damning condition wins
    if not known:
        tone = "warn"
        verdict = (
            f"Can't price {facts['name']} — it's not in our coverage. If this tip came from a "
            f"Telegram group or a YouTube thumbnail, that's already your answer. Unlisted, "
            f"micro-cap, or misspelled: none of those deserve your money today."
        )
    elif own and own_weight >= 15:
        tone = "warn"
        verdict = (
            f"You already hold {name} at {own_weight:.0f}% of your portfolio "
            f"({own['returnPct']:+.1f}% so far). This tip isn't conviction, it's a rerun — "
            f"adding more makes one stock your whole story."
        )
    elif sector_after > 45:
        tone = "warn"
        verdict = (
            f"{name} would push {sector} to {sector_after:.0f}% of your money "
            f"(from {sector_now:.0f}%). That's not a new idea — it's more of the same bet "
            f"wearing a different name. Skip, or trim the sector first."
        )
    elif own:
        tone = "caution"
        verdict = (
            f"You already own {name} ({own_weight:.0f}%, {own['returnPct']:+.1f}%). Averaging "
            f"into a position you hold is fine — if it's a plan, not a dopamine buy. "
            f"Decide the target weight before you tap buy."
        )
    elif sector_after > 30:
        tone = "caution"
        verdict = (
            f"{name} is a real company, but {sector} would hit {sector_after:.0f}% of your "
            f"portfolio. Buy it if you believe the sector thesis — just size it small and "
            f"know you're doubling down, not diversifying."
        )
    elif sector_now > 10:
        tone = "ok"
        verdict = (
            f"{name} is a new name in a sector you already hold — {sector} goes "
            f"{sector_now:.0f}% → {sector_after:.0f}%. Reasonable spread within the theme; "
            f"just make sure it's the better company, not just the newer tip."
        )
    else:
        tone = "ok"
        verdict = (
            f"{name} ({sector}) would be genuinely new exposure — {sector} goes "
            f"{sector_now:.0f}% → {sector_after:.0f}%. If you've done more homework than "
            f"'someone said so', size it under {SIM_BUY_PCT:.0f}% and welcome aboard."
        )

    return {**facts, "tone": tone, "verdict": verdict}
