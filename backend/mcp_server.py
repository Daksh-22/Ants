"""
Ants MCP server — exposes the Ants analysis engine as MCP tools, so Claude
Desktop / Claude Code / any MCP client can analyze portfolios directly.

Run standalone (stdio):
    python mcp_server.py

Claude Desktop config (claude_desktop_config.json):
    {
      "mcpServers": {
        "ants": {
          "command": "/path/to/Ants/backend/.venv/bin/python",
          "args": ["/path/to/Ants/backend/mcp_server.py"]
        }
      }
    }
"""

from __future__ import annotations

import json

from mcp.server.fastmcp import FastMCP

import ai
import engine
import rag

mcp = FastMCP("ants")


@mcp.tool()
def analyze_portfolio(positions_json: str) -> str:
    """Analyze an Indian equity portfolio. positions_json is a JSON array of
    {"ticker": str, "qty": number, "avg": number} (avg = average buy price in ₹).
    Returns the full Ants analysis: value, returns, health score, red/amber
    flags with fixes, and what's working."""
    try:
        positions = json.loads(positions_json)
        analysis = engine.analyze(positions, source="mcp")
        return json.dumps(analysis, ensure_ascii=False)
    except (ValueError, json.JSONDecodeError) as exc:
        return json.dumps({"error": str(exc)})


@mcp.tool()
def demo_portfolio() -> str:
    """The Arjun Mehta demo portfolio run through the real Ants analysis engine.
    Useful to see the analysis shape without real positions."""
    return json.dumps(engine.demo_analysis(source="mcp"), ensure_ascii=False)


@mcp.tool()
def search_knowledge(query: str) -> str:
    """Search the Ants investing knowledge base (direct vs regular plans, fund
    overlap, concentration risk, SIP discipline, international diversification,
    Account Aggregator framework). Returns the top matching passages."""
    return json.dumps(rag.retrieve(query, k=4), ensure_ascii=False)


@mcp.tool()
def ask_ants(question: str) -> str:
    """Ask the Ants assistant an investing question. Grounded in the knowledge
    base; uses Claude when ANTHROPIC_API_KEY is set, otherwise returns the
    relevant knowledge-base passages."""
    return json.dumps(ai.chat(question), ensure_ascii=False)


if __name__ == "__main__":
    mcp.run()
