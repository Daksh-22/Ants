"""
Portfolio risk metrics calculation.
Volatility, Sharpe ratio, max drawdown, beta vs Nifty.
For MVP: Generate synthetic historical returns based on sector volatility patterns.
For v2: Integrate live price history from Zerodha/Angel One API.
"""

import math
from typing import List, Dict, Tuple
from dataclasses import dataclass

# Sector volatility baselines (annualized %)
# These are realistic India market sector volatilities
SECTOR_VOLATILITY = {
    "IT": 22.5,
    "Banking": 20.0,
    "NBFC/Finance": 24.0,
    "Energy": 28.0,
    "Power": 18.5,
    "Electronics": 26.0,
    "Defense": 19.0,
    "Railways": 17.0,
    "Auto": 25.0,
    "FMCG": 16.0,
    "Pharma": 21.0,
    "Consumer Tech": 35.0,
    "Conglomerate": 23.0,
}

# Nifty 50 historical volatility (annualized %)
NIFTY_VOLATILITY = 16.5


@dataclass
class RiskMetrics:
    """Portfolio-level risk metrics"""

    volatility_pct: float  # Annualized volatility %
    sharpe_ratio: float  # Return / volatility (using 6% risk-free rate)
    max_drawdown_pct: float  # Worst peak-to-trough decline %
    beta_vs_nifty: float  # Portfolio beta vs Nifty 50
    risk_score: int  # 0-100 (0=high risk, 100=low risk)


@dataclass
class HoldingVolatility:
    """Per-holding volatility estimate"""

    ticker: str
    sector: str
    volatility_pct: float
    contribution_to_portfolio_risk: float  # %


def calculate_portfolio_volatility(holdings: List[Dict]) -> float:
    """
    Calculate portfolio-level volatility from holdings.

    For MVP: Use sector volatility as proxy weighted by position size.
    In production: Use historical price data correlation matrix.

    Args:
        holdings: List of {ticker, sector, weightPct}

    Returns:
        Annualized volatility as percentage
    """
    if not holdings:
        return 0.0

    # Weight each holding's sector volatility by portfolio weight
    portfolio_vol_squared = 0.0
    for holding in holdings:
        sector = holding.get("sector", "IT")
        weight = holding.get("weightPct", 0) / 100.0

        sector_vol = SECTOR_VOLATILITY.get(sector, 22.0)  # Default 22% if unknown
        # Simplified: assume no correlation (worst case); real model uses correlation matrix
        portfolio_vol_squared += (weight * sector_vol) ** 2

    # Add small diversification benefit (~80% of weighted sum)
    portfolio_volatility = math.sqrt(portfolio_vol_squared) * 0.8

    return portfolio_volatility


def calculate_sharpe_ratio(
    returns_pct: float, volatility_pct: float, risk_free_rate: float = 6.0
) -> float:
    """
    Calculate Sharpe ratio.

    Sharpe = (Return - RiskFreeRate) / Volatility
    Interpretation:
    - > 1.0 = Excellent (return well compensates for risk)
    - 0.5 to 1.0 = Good
    - < 0.5 = Poor (not enough return for the risk taken)

    Args:
        returns_pct: Portfolio return %
        volatility_pct: Portfolio volatility %
        risk_free_rate: Assumed risk-free rate (default 6% for India savings account)

    Returns:
        Sharpe ratio (float)
    """
    if volatility_pct <= 0:
        return 0.0

    return (returns_pct - risk_free_rate) / volatility_pct


def calculate_max_drawdown(returns_series: List[float]) -> float:
    """
    Calculate maximum drawdown from a series of returns.

    Max Drawdown = (Lowest Point - Peak Before It) / Peak × 100

    For MVP: Estimate from portfolio return volatility
    (more negative = more drawdown probability)

    Args:
        returns_series: List of daily/monthly returns as %

    Returns:
        Max drawdown as percentage (negative)
    """
    if not returns_series or len(returns_series) < 2:
        return 0.0

    peak = returns_series[0]
    max_dd = 0.0

    for ret in returns_series[1:]:
        if ret > peak:
            peak = ret
        drawdown = (ret - peak) / peak if peak != 0 else 0
        max_dd = min(max_dd, drawdown)

    return max_dd * 100


def estimate_max_drawdown_from_volatility(volatility_pct: float) -> float:
    """
    Estimate max drawdown from volatility (for MVP without historical data).

    Rough heuristic: Max drawdown ≈ 2-3× volatility during normal markets
    This is conservative; actual depends on distribution.

    Args:
        volatility_pct: Annual volatility %

    Returns:
        Estimated max drawdown % (negative number)
    """
    # Conservative estimate: worst case is ~2.5 sigma move
    return -(volatility_pct * 2.5)


def calculate_beta_vs_nifty(
    portfolio_volatility: float, correlation_with_nifty: float = 0.85
) -> float:
    """
    Calculate portfolio beta vs Nifty 50.

    Beta = (Correlation × Portfolio Volatility) / Nifty Volatility

    Interpretation:
    - Beta = 1.0 → Moves with market
    - Beta > 1.0 → More volatile than market
    - Beta < 1.0 → Less volatile than market

    Args:
        portfolio_volatility: Portfolio volatility %
        correlation_with_nifty: Assumed correlation (0.85 for typical Indian portfolio)

    Returns:
        Beta (float)
    """
    if NIFTY_VOLATILITY <= 0:
        return 1.0

    beta = (correlation_with_nifty * portfolio_volatility) / NIFTY_VOLATILITY
    return round(beta, 2)


def calculate_risk_score(sharpe_ratio: float, volatility_pct: float) -> int:
    """
    Calculate composite risk score (0-100).

    0 = High risk (negative Sharpe, high volatility)
    50 = Moderate risk
    100 = Low risk (positive Sharpe, low volatility)

    Args:
        sharpe_ratio: Portfolio Sharpe ratio
        volatility_pct: Portfolio volatility %

    Returns:
        Risk score 0-100
    """
    # Normalize Sharpe: map -1 to 2 range to 0-100
    sharpe_score = max(0, min(100, (sharpe_ratio + 1) * 33.33))

    # Normalize Volatility: lower vol = higher score
    # 10% vol = 100, 40% vol = 0
    vol_score = max(0, min(100, 100 - (volatility_pct - 10) * 2.5))

    # Weighted average (60% Sharpe, 40% Volatility)
    risk_score = int(sharpe_score * 0.6 + vol_score * 0.4)

    return max(0, min(100, risk_score))


def calculate_metrics(holdings: List[Dict], portfolio_return_pct: float) -> RiskMetrics:
    """
    Calculate all risk metrics for a portfolio.

    Args:
        holdings: List of {ticker, sector, weightPct, ...}
        portfolio_return_pct: Portfolio return %

    Returns:
        RiskMetrics object with volatility, Sharpe, drawdown, beta, risk_score
    """
    volatility = calculate_portfolio_volatility(holdings)
    sharpe = calculate_sharpe_ratio(portfolio_return_pct, volatility)
    max_dd = estimate_max_drawdown_from_volatility(volatility)
    beta = calculate_beta_vs_nifty(volatility)
    risk_score = calculate_risk_score(sharpe, volatility)

    return RiskMetrics(
        volatility_pct=round(volatility, 2),
        sharpe_ratio=round(sharpe, 2),
        max_drawdown_pct=round(max_dd, 2),
        beta_vs_nifty=beta,
        risk_score=risk_score,
    )


def get_holding_volatilities(holdings: List[Dict]) -> List[HoldingVolatility]:
    """
    Get per-holding volatility contributions.

    Args:
        holdings: List of holdings with ticker, sector, weightPct

    Returns:
        List of HoldingVolatility objects ranked by risk contribution
    """
    holding_vols = []

    for holding in holdings:
        ticker = holding.get("ticker", "")
        sector = holding.get("sector", "IT")
        weight = holding.get("weightPct", 0) / 100.0

        sector_vol = SECTOR_VOLATILITY.get(sector, 22.0)
        risk_contribution = sector_vol * weight

        holding_vols.append(
            HoldingVolatility(
                ticker=ticker,
                sector=sector,
                volatility_pct=round(sector_vol, 2),
                contribution_to_portfolio_risk=round(risk_contribution, 2),
            )
        )

    # Sort by risk contribution descending
    holding_vols.sort(key=lambda x: x.contribution_to_portfolio_risk, reverse=True)

    return holding_vols
