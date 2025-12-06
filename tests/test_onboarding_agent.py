"""
Unit tests for OnboardingAgent.
"""

import pytest
import os
import json
import tempfile
from agents.onboarding_agent import OnboardingAgent


@pytest.mark.asyncio
async def test_register_exporter():
    """Test exporter registration."""
    # Use temporary file for testing
    with tempfile.TemporaryDirectory() as tmpdir:
        agent = OnboardingAgent()
        agent.participants_file = os.path.join(tmpdir, "participants.json")
        agent._ensure_participants_file()
        
        result = await agent.register_exporter(
            "0x1234567890abcdef",
            "Test Exporter",
            "US"
        )
        
        assert result["success"] is True
        assert "data" in result
        
        # Verify it's saved
        with open(agent.participants_file, 'r') as f:
            data = json.load(f)
            assert "0x1234567890abcdef" in data["exporters"]


@pytest.mark.asyncio
async def test_register_investor():
    """Test investor registration."""
    with tempfile.TemporaryDirectory() as tmpdir:
        agent = OnboardingAgent()
        agent.participants_file = os.path.join(tmpdir, "participants.json")
        agent._ensure_participants_file()
        
        result = await agent.register_investor(
            "0xabcdef1234567890",
            "Test Fund",
            "fund"
        )
        
        assert result["success"] is True
        assert "data" in result
        
        # Verify it's saved
        with open(agent.participants_file, 'r') as f:
            data = json.load(f)
            assert "0xabcdef1234567890" in data["investors"]


@pytest.mark.asyncio
async def test_duplicate_registration():
    """Test that duplicate registration is handled gracefully."""
    with tempfile.TemporaryDirectory() as tmpdir:
        agent = OnboardingAgent()
        agent.participants_file = os.path.join(tmpdir, "participants.json")
        agent._ensure_participants_file()
        
        # First registration
        result1 = await agent.register_exporter(
            "0x1111111111111111",
            "First",
            "US"
        )
        assert result1["success"] is True
        
        # Duplicate registration
        result2 = await agent.register_exporter(
            "0x1111111111111111",
            "Second",
            "CA"
        )
        assert result2["success"] is True
        assert "already registered" in result2["message"].lower()

