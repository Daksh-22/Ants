"""
CSV importer — Parse portfolio CSVs from brokers (manual entry, Excel exports).

Supports flexible formats:
  - Zerodha format: ticker, qty, avg_price
  - Angel One format: symbol, quantity, avg_cost
  - Generic: ticker, qty, buy_price, sector (optional)

Returns validated holdings list ready for analysis.
"""

import csv
from io import StringIO
from typing import List, Dict, Optional, Tuple
from datetime import datetime


# Map common sector names to canonical sectors
SECTOR_ALIASES = {
    "IT": ["IT", "INFOTECH", "INFORMATION TECHNOLOGY", "TECH"],
    "Banking": ["BANK", "BANKING", "FINANCE", "FINANCIAL SERVICES"],
    "Auto": ["AUTO", "AUTOMOBILE", "AUTOMOTIVE"],
    "Pharma": ["PHARMA", "PHARMACEUTICAL", "PHARMA"],
    "FMCG": ["FMCG", "CONSUMER GOODS", "FAST MOVING"],
    "Energy": ["ENERGY", "OIL", "OIL & GAS"],
    "Defense": ["DEFENSE", "AEROSPACE", "DEFENCE"],
    "Telecom": ["TELECOM", "TELECOMM", "COMMUNICATION"],
    "Power": ["POWER", "UTILITY", "UTILITIES"],
    "Real Estate": ["REAL ESTATE", "REALTY", "PROPERTY"],
    "Consumer Tech": ["ECOMMERCE", "FINTECH", "CONSUMER TECH"],
    "Electronics": ["ELECTRONICS", "SEMICONDUCTOR"],
    "Railways": ["RAILWAY", "RAILWAYS", "RAIL"],
    "Metals": ["METAL", "METALS", "STEEL"],
    "Chemical": ["CHEMICAL", "CHEMICALS"],
}


def normalize_sector(sector_str: str) -> str:
    """Map sector names to canonical list."""
    if not sector_str:
        return "Other"

    sector_upper = sector_str.strip().upper()

    for canonical, aliases in SECTOR_ALIASES.items():
        if sector_upper in [a.upper() for a in aliases]:
            return canonical

    # Return the original if no match found
    return sector_str.strip().title()


def parse_csv_holdings(csv_content: str) -> Tuple[List[Dict], List[str]]:
    """
    Parse CSV and return holdings list + warnings.

    Accepts multiple formats:
      Format 1 (Zerodha): ticker,qty,avg_price
      Format 2 (Angel One): symbol,quantity,avg_cost
      Format 3 (Generic): ticker,qty,buy_price,sector

    Returns: (holdings_list, warnings)
    """

    holdings = []
    warnings = []
    lines = csv_content.strip().split('\n')

    if not lines:
        return [], ["Empty CSV file"]

    # Try to parse CSV
    try:
        reader = csv.DictReader(lines)
        if not reader.fieldnames:
            return [], ["No headers found in CSV"]

        headers = [h.strip().lower() for h in reader.fieldnames] if reader.fieldnames else []

        # Map various column names
        ticker_col = next((h for h in headers if h in ["ticker", "symbol", "stock", "company"]), None)
        qty_col = next((h for h in headers if h in ["qty", "quantity", "shares", "units"]), None)
        price_col = next((h for h in headers if h in ["avg_price", "avg_cost", "buy_price", "cost", "price"]), None)
        sector_col = next((h for h in headers if h in ["sector", "industry", "segment"]), None)

        if not (ticker_col and qty_col and price_col):
            return [], [f"CSV must have columns: ticker, qty, buy_price. Found: {headers}"]

        row_num = 2
        for row in reader:
            try:
                ticker = (row.get(ticker_col, "") or "").strip().upper()
                qty_str = (row.get(qty_col, "") or "").strip()
                price_str = (row.get(price_col, "") or "").strip()
                sector = (row.get(sector_col, "") or "").strip() if sector_col else "Other"

                # Validation
                if not ticker:
                    warnings.append(f"Row {row_num}: Skipped (no ticker)")
                    row_num += 1
                    continue

                try:
                    qty = float(qty_str)
                except (ValueError, TypeError):
                    warnings.append(f"Row {row_num}: Invalid quantity '{qty_str}' for {ticker}")
                    row_num += 1
                    continue

                try:
                    buy_price = float(price_str)
                except (ValueError, TypeError):
                    warnings.append(f"Row {row_num}: Invalid price '{price_str}' for {ticker}")
                    row_num += 1
                    continue

                if qty <= 0 or buy_price <= 0:
                    warnings.append(f"Row {row_num}: {ticker} qty/price must be > 0")
                    row_num += 1
                    continue

                holdings.append({
                    "ticker": ticker,
                    "qty": qty,
                    "buy_price": buy_price,
                    "sector": normalize_sector(sector),
                })

                row_num += 1

            except Exception as e:
                warnings.append(f"Row {row_num}: Parse error — {str(e)}")
                row_num += 1
                continue

    except Exception as e:
        return [], [f"CSV parse error: {str(e)}"]

    if not holdings:
        return [], ["No valid holdings found in CSV"]

    return holdings, warnings


def validate_holdings(holdings: List[Dict]) -> Tuple[List[Dict], List[str]]:
    """Validate holdings list before analysis."""

    errors = []
    valid = []

    for i, h in enumerate(holdings):
        ticker = h.get("ticker", "").strip().upper()
        qty = h.get("qty", 0)
        buy_price = h.get("buy_price", 0)
        sector = h.get("sector", "Other")

        if not ticker or len(ticker) > 10:
            errors.append(f"Holding {i+1}: Invalid ticker '{ticker}'")
            continue

        if not (isinstance(qty, (int, float)) and qty > 0):
            errors.append(f"Holding {i+1} ({ticker}): Invalid quantity")
            continue

        if not (isinstance(buy_price, (int, float)) and buy_price > 0):
            errors.append(f"Holding {i+1} ({ticker}): Invalid buy price")
            continue

        valid.append({
            "ticker": ticker,
            "qty": float(qty),
            "buy_price": float(buy_price),
            "sector": normalize_sector(sector),
        })

    return valid, errors


def csv_to_holdings(csv_content: str) -> Tuple[List[Dict], List[str]]:
    """
    One-shot CSV → holdings validation.
    Returns: (validated_holdings, all_messages)
    """

    holdings, parse_warnings = parse_csv_holdings(csv_content)
    valid_holdings, validation_errors = validate_holdings(holdings)

    messages = parse_warnings + validation_errors

    return valid_holdings, messages


# Example CSV templates (for documentation)
EXAMPLE_CSV_TEMPLATES = {
    "zerodha": """ticker,qty,avg_price
TCS,10,3500.50
INFY,5,2100.00
RELIANCE,8,2850.75""",

    "angel_one": """symbol,quantity,avg_cost
TCS,10,3500.50
INFY,5,2100.00
RELIANCE,8,2850.75""",

    "generic": """ticker,qty,buy_price,sector
TCS,10,3500.50,IT
INFY,5,2100.00,IT
RELIANCE,8,2850.75,Energy
ICICIBANK,20,1050.00,Banking""",

    "excel": """Ticker,Quantity,Buy Price,Sector
TCS,10,3500.50,IT
INFY,5,2100.00,IT
RELIANCE,8,2850.75,Energy
ICICIBANK,20,1050.00,Banking
WIPRO,15,450.00,IT""",
}
