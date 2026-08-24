"""
Ants analysis engine — pure-python portfolio math.

Takes raw positions (ticker, qty, avg buy price), prices them against a
reference table, and produces the full Analysis object the frontend renders:
summary, health score, red/amber flags (each with an actionable fix), what's
working, and next moves. The copy here is the deterministic fallback voice;
ai.polish_analysis() punches it up with Claude when a key is configured.

Prices come from quotes.py (live, from Yahoo). Anything it cannot resolve is
marked unpriced and held flat at the user's own average, so a 0% return means
"we don't know" and never "flat". There is deliberately no stale-snapshot
pricing tier — see the note on KNOWN_STOCKS.
"""

from __future__ import annotations

import datetime as _dt
from typing import Any, Optional

# ticker -> (display name, sector)
#
# Metadata ONLY. This table used to carry a third element, a hardcoded "reference
# CMP", used to price any holding the live fetch missed. That snapshot went ~2
# years stale: RELIANCE sat at 2943 against a live ~1329, TCS at 4127 against
# ~2349. A position was then valued and its return computed off that number and
# returned with priceSource "reference" and known: true — and the frontend only
# ever branched on "unpriced", so a holding genuinely down 21.7% rendered as up
# 37.6% with nothing marking it. The prices are gone rather than refreshed: a
# hand-maintained price table cannot help going stale, and a confidently wrong
# valuation is worse than an admitted missing one. Names and sectors don't drift,
# so those stay.
KNOWN_STOCKS: dict[str, tuple[str, str]] = {
    "TCS": ("TCS", "IT"),
    "INFY": ("Infosys", "IT"),
    "INFOSYS": ("Infosys", "IT"),
    "WIPRO": ("Wipro", "IT"),
    "HCLTECH": ("HCL Tech", "IT"),
    "HDFCBANK": ("HDFC Bank", "Banking"),
    "HDFC": ("HDFC Bank", "Banking"),
    "ICICIBANK": ("ICICI Bank", "Banking"),
    "SBIN": ("SBI", "Banking"),
    "KOTAKBANK": ("Kotak Bank", "Banking"),
    "BAJFINANCE": ("Bajaj Finance", "NBFC"),
    "RELIANCE": ("Reliance", "Energy"),
    "ONGC": ("ONGC", "Energy"),
    "TATAPOWER": ("Tata Power", "Power"),
    "NTPC": ("NTPC", "Power"),
    "DIXON": ("Dixon Technologies", "Electronics"),
    "KAYNES": ("Kaynes Technology", "Electronics"),
    "SYRMA": ("Syrma SGS", "Electronics"),
    "HAL": ("HAL", "Defense"),
    "BEL": ("Bharat Electronics", "Defense"),
    "RVNL": ("RVNL", "Railways"),
    "IRFC": ("IRFC", "Railways"),
    "TATAMOTORS": ("Tata Motors", "Auto"),
    "M&M": ("Mahindra & Mahindra", "Auto"),
    "MARUTI": ("Maruti Suzuki", "Auto"),
    "ITC": ("ITC", "FMCG"),
    "HINDUNILVR": ("HUL", "FMCG"),
    "SUNPHARMA": ("Sun Pharma", "Pharma"),
    "CIPLA": ("Cipla", "Pharma"),
    "ZOMATO": ("Zomato", "Consumer Tech"),
    "PAYTM": ("Paytm", "Consumer Tech"),
    "ADANIENT": ("Adani Enterprises", "Conglomerate"),
    "MIRAEFANG": ("Mirae FANG+ ETF", "International ETF"),
    "FANG": ("Mirae FANG+ ETF", "International ETF"),
    "MON100": ("Motilal Nasdaq 100 ETF", "International ETF"),
    "NIFTYBEES": ("Nifty BeES", "Index ETF"),
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
    """Normalise user input to an NSE-style symbol.

    Hyphens are preserved: several real NSE symbols contain one (BAJAJ-AUTO,
    M&M-FIN, L&T-FH). Stripping them turned BAJAJ-AUTO into BAJAJAUTO, which
    resolves to nothing, so the position silently priced at the user's own
    average. Spaces and everything else still go.
    """
    return "".join(
        ch for ch in ticker.upper().strip() if ch.isalnum() or ch in "&-"
    ).strip("-")


def price_position(
    ticker: str,
    qty: float,
    avg: float,
    quote: Any | None = None,
) -> dict[str, Any]:
    """Price one position. `quote` is an optional quotes.Quote resolved live;
    without one the position is marked unpriced and held at the user's own avg,
    so its 0% return reads as "we don't know" and the UI can say so."""
    key = _norm(ticker)

    if quote is not None:
        name, sector, cmp_ = quote.name, quote.sector, float(quote.price)
        price_source = quote.source
    else:
        # No live quote. The curated table still supplies a real name and sector,
        # but it no longer carries a price, so this position is unpriced: valued
        # at the user's own average and labelled as such. It is NOT "reference"
        # priced — that tier is gone.
        name, sector = KNOWN_STOCKS.get(key, (ticker.strip() or key, "Other"))
        cmp_ = avg
        price_source = "unpriced"

    if cmp_ <= 0:
        # No usable price. Fall back to the user's own average so the position
        # doesn't value at zero and wreck the portfolio total — but keep it
        # clearly marked "unpriced". A 0% return here means "we don't know",
        # not "flat", and the UI must not present it as a measured result.
        cmp_ = avg
        price_source = "unpriced"

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
        "known": price_source != "unpriced",
        # live | unpriced — the UI tells the user which it got. "reference" was
        # a third state backed by the stale snapshot above; it no longer exists.
        "priceSource": price_source,
    }


def analyze(positions: list[dict[str, Any]], source: str = "manual") -> dict[str, Any]:
    """positions: [{ticker, qty, avg}] → full Analysis object.

    Resolves live quotes for every ticker up front (one concurrent batch), so
    any Indian stock gets a real price — not just the ~37 curated ones.
    """
    valid = [
        p for p in positions
        if str(p.get("ticker", "")).strip() and float(p.get("qty") or 0) > 0 and float(p.get("avg") or 0) > 0
    ]

    # one batched, concurrent, deadline-bounded quote fetch for the whole book
    quote_map: dict[str, Any] = {}
    if valid:
        try:
            import quotes
            avg_by_ticker = {
                _norm(str(p.get("ticker", ""))): float(p.get("avg") or 0) for p in valid
            }
            quote_map = quotes.resolve_quotes(list(avg_by_ticker.keys()), avg_by_ticker)
        except Exception:
            quote_map = {}  # network/import trouble → static fallback below

    holdings = [
        price_position(
            str(p.get("ticker", "")),
            float(p.get("qty") or 0),
            float(p.get("avg") or 0),
            quote_map.get(_norm(str(p.get("ticker", "")))),
        )
        for p in valid
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
        # The rupee amount actually lost so far — not the percentage, the
        # money. "Down 34%" is an abstraction; "down ₹11,980" is a gut punch,
        # and it's the number that should make someone actually act.
        loss_rupees = worst["invested"] - worst["value"]
        flags.append({
            "id": "deep-loser",
            "severity": "red",
            "label": f"{worst['name']} is down {abs(worst['returnPct']):.0f}%",
            "body": (
                f"Holding a {abs(worst['returnPct']):.0f}% loser isn't a strategy, it's avoidance. "
                f"Decide: would you buy {worst['name']} today at this price? If not, why are you holding it?"
            ),
            "cost_of_inaction": (
                f"You are down ₹{loss_rupees:,.0f} on this position. "
                f"Hoping it recovers is not a strategy."
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
        # True median. rets[len//2] is the upper-middle element on an
        # even-length book, and this number is quoted verbatim to the user
        # ("your median pick sits at ..."), so it has to be the real one.
        mid = len(rets) // 2
        median_ret = rets[mid] if len(rets) % 2 else (rets[mid - 1] + rets[mid]) / 2
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

    # be explicit about how well we could price this book — the UI says so
    live_count = sum(1 for h in holdings if h["priceSource"] == "live")
    unpriced = [h["ticker"] for h in holdings if h["priceSource"] == "unpriced"]
    if live_count == len(holdings):
        pricing_note = None
    elif not live_count:
        # Every lookup missed — usually Yahoo throttling or the fetch deadline.
        # Say so at the top, because in this state every return on the screen is
        # 0% and the total is just what the user paid.
        pricing_note = (
            "We couldn't reach live prices just now, so every holding is shown at "
            "your own buy price and all returns read 0%. Refresh in a minute."
        )
    else:
        pricing_note = (
            f"Couldn't find a live price for {', '.join(unpriced[:3])}"
            + (f" +{len(unpriced) - 3} more" if len(unpriced) > 3 else "")
            + " — those show 0% return, so the totals understate reality."
        )

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
        "pricing": {
            "livePriced": live_count,
            "total": len(holdings),
            "unpricedTickers": unpriced,
            "note": pricing_note,
            # When these prices were actually fetched. The analysis is cached in
            # the browser and nothing re-prices it, so a returning user saw
            # "Live prices" over quotes that could be days old. The UI needs a
            # timestamp to tell the truth about staleness.
            "pricedAt": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        },
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

    # resolve the tipped ticker live so ANY Indian stock can be checked, not
    # just the ~37 curated ones; fall back to the snapshot, then to unknown
    name, sector, cmp_ = ticker.strip().upper() or key, "Other", 0.0
    known = False
    try:
        import quotes
        q = quotes.resolve_quotes([key]).get(key)
        if q and q.source != "unpriced" and q.price > 0:
            name, sector, cmp_ = q.name, q.sector, float(q.price)
            known = True
    except Exception:
        pass
    if not known and key in KNOWN_STOCKS:
        # We recognise the company well enough to reason about sector weight,
        # but we have no price for it. cmp_ stays 0, which the reply renders as
        # a null CMP rather than a stale one.
        name, sector = KNOWN_STOCKS[key]
        known = True

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
    elif matching_holdings and own_weight >= 15:
        tone = "warn"
        verdict = (
            f"You already hold {name} at {own_weight:.0f}% of your portfolio "
            f"({ownReturnPct:+.1f}% so far). This tip isn't conviction, it's a rerun — "
            f"adding more makes one stock your whole story."
        )
    elif sector_after > 45:
        tone = "warn"
        verdict = (
            f"{name} would push {sector} to {sector_after:.0f}% of your money "
            f"(from {sector_now:.0f}%). That's not a new idea — it's more of the same bet "
            f"wearing a different name. Skip, or trim the sector first."
        )
    elif matching_holdings:
        tone = "caution"
        verdict = (
            f"You already own {name} ({own_weight:.0f}%, {ownReturnPct:+.1f}%). Averaging "
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
