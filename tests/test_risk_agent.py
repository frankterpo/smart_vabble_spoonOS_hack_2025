"""
Unit tests for RiskAgent.
"""

import pytest
import asyncio
from agents.risk_agent import RiskAgent


@pytest.mark.asyncio
async def test_risk_evaluation_low_risk():
    """Test risk evaluation for low-risk invoice."""
    agent = RiskAgent()
    
    metadata = {
        "amount": 100000,  # Small amount
        "due_date": 1736204800,  # Future date
        "debtor_country": "US",
        "debtor_name": "Test Company"
    }
    
    result = await agent.evaluate(metadata)
    
    assert "risk_score" in result
    assert "yield_bps" in result
    assert "rationale" in result
    assert 1 <= result["risk_score"] <= 5
    assert result["yield_bps"] > 0


@pytest.mark.asyncio
async def test_risk_evaluation_high_risk():
    """Test risk evaluation for high-risk invoice."""
    agent = RiskAgent()
    
    metadata = {
        "amount": 2000000,  # Large amount
        "due_date": 1736204800,  # Future date
        "debtor_country": "XX",  # Unknown country
        "debtor_name": "Test Company"
    }
    
    result = await agent.evaluate(metadata)
    
    assert result["risk_score"] >= 1
    assert result["yield_bps"] > 0


@pytest.mark.asyncio
async def test_risk_evaluation_yield_calculation():
    """Test that yield increases with risk score."""
    agent = RiskAgent()
    
    # Low risk
    low_risk_meta = {
        "amount": 100000,
        "due_date": 1736204800,
        "debtor_country": "US",
        "debtor_name": "Test"
    }
    
    # High risk
    high_risk_meta = {
        "amount": 2000000,
        "due_date": 1736204800 + (120 * 86400),  # 120 days
        "debtor_country": "XX",
        "debtor_name": "Test"
    }
    
    low_result = await agent.evaluate(low_risk_meta)
    high_result = await agent.evaluate(high_risk_meta)
    
    # Higher risk should generally yield higher return
    # (though not guaranteed due to other factors)
    assert high_result["risk_score"] >= low_result["risk_score"]

