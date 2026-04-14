"""agents package — Google ADK-based agent definitions.

All agents are defined in adk_agents.py using google.adk.agents.Agent.
The root agent auto-delegates to sub-agents (sql, trends, rca, conversational).
"""

from agents.adk_agents import run_agent

__all__ = ["run_agent"]
