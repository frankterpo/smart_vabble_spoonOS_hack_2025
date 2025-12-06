"""
RiskAgent - Computes risk scores and yield for invoices
Uses deterministic heuristics for v1, with optional MCP enhancement hooks.
"""

from typing import Dict, Any
from .base_agent import BaseAgent


class RiskAgent(BaseAgent):
    """
    Agent for risk assessment and yield calculation.
    v1 uses simple deterministic logic based on amount and term.
    """
    
    def __init__(self):
        super().__init__("RiskAgent")
        # Base yield parameters (basis points)
        self.base_yield_bps = 300  # 3% base yield
        self.risk_spread_bps = 100  # 1% per risk point
    
    async def evaluate(self, invoice_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate invoice risk and calculate yield.
        
        Args:
            invoice_metadata: Dictionary with:
                - debtor_country: str
                - debtor_name: str
                - amount: int
                - due_date: int (Unix timestamp)
                - currency: str (optional)
        
        Returns:
            Dictionary with:
                - risk_score: int (1-5)
                - yield_bps: int (basis points)
                - rationale: str
        """
        self.log(f"Evaluating risk for invoice: {invoice_metadata.get('debtor_name', 'Unknown')}")
        
        amount = invoice_metadata.get("amount", 0)
        due_date = invoice_metadata.get("due_date", 0)
        debtor_country = invoice_metadata.get("debtor_country", "")
        
        # Calculate days until due (simplified)
        import time
        current_time = int(time.time())
        days_until_due = max(0, (due_date - current_time) // 86400)  # Days
        
        # Risk scoring logic (1-5 scale)
        risk_score = 1  # Start with lowest risk
        
        # Amount-based risk (higher amount = higher risk)
        if amount > 1000000:  # > 1M
            risk_score += 2
        elif amount > 500000:  # > 500K
            risk_score += 1
        
        # Term-based risk (longer term = higher risk)
        if days_until_due > 90:  # > 3 months
            risk_score += 2
        elif days_until_due > 60:  # > 2 months
            risk_score += 1
        
        # Country-based risk (simplified - could use MCP data)
        high_risk_countries = []  # Could be populated from external data
        if debtor_country.upper() in high_risk_countries:
            risk_score += 1
        
        # Cap risk score at 5
        risk_score = min(risk_score, 5)
        risk_score = max(risk_score, 1)  # Ensure at least 1
        
        # Calculate yield (basis points)
        yield_bps = self.base_yield_bps + (risk_score * self.risk_spread_bps)
        
        # Generate rationale
        rationale = (
            f"Risk score {risk_score}/5 based on: "
            f"amount={amount:,}, term={days_until_due} days, "
            f"country={debtor_country}. "
            f"Yield: {yield_bps/100:.2f}% ({yield_bps} bps)"
        )
        
        self.log(f"Risk evaluation complete: score={risk_score}, yield={yield_bps}bps")
        
        return {
            "risk_score": risk_score,
            "yield_bps": yield_bps,
            "rationale": rationale
        }

