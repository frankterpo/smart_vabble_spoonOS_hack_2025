"""
OnboardingAgent - Handles participant registration
Registers exporters and investors in off-chain storage.
"""

import json
import os
from typing import Dict, Any
from .base_agent import BaseAgent


class OnboardingAgent(BaseAgent):
    """
    Agent for onboarding exporters and investors.
    Maintains off-chain registry in data/participants.json
    """
    
    def __init__(self):
        super().__init__("OnboardingAgent")
        self.participants_file = "data/participants.json"
        self._ensure_participants_file()
    
    def _ensure_participants_file(self):
        """Ensure participants.json exists with proper structure."""
        if not os.path.exists(self.participants_file):
            os.makedirs(os.path.dirname(self.participants_file), exist_ok=True)
            with open(self.participants_file, 'w') as f:
                json.dump({"exporters": {}, "investors": {}}, f, indent=2)
    
    def _load_participants(self) -> Dict[str, Any]:
        """Load participants from JSON file."""
        try:
            with open(self.participants_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            self.log(f"Error loading participants: {e}", "error")
            return {"exporters": {}, "investors": {}}
    
    def _save_participants(self, data: Dict[str, Any]):
        """Save participants to JSON file."""
        try:
            with open(self.participants_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            self.log(f"Error saving participants: {e}", "error")
            raise
    
    async def register_exporter(
        self,
        wallet_address: str,
        name: str,
        country: str
    ) -> Dict[str, Any]:
        """
        Register an exporter (seller).
        
        Args:
            wallet_address: Neo wallet address
            name: Company/individual name
            country: Country code or name
        
        Returns:
            Dictionary with registration result
        """
        self.log(f"Registering exporter: {name} ({wallet_address})")
        
        participants = self._load_participants()
        
        # Check if already registered
        if wallet_address in participants["exporters"]:
            self.log(f"Exporter {wallet_address} already registered", "warning")
            return {
                "success": True,
                "message": "Exporter already registered",
                "data": participants["exporters"][wallet_address]
            }
        
        # Register new exporter
        exporter_data = {
            "wallet_address": wallet_address,
            "name": name,
            "country": country,
            "registered_at": None  # Could add timestamp if needed
        }
        
        participants["exporters"][wallet_address] = exporter_data
        self._save_participants(participants)
        
        self.log(f"Successfully registered exporter: {name}")
        
        return {
            "success": True,
            "message": "Exporter registered successfully",
            "data": exporter_data
        }
    
    async def register_investor(
        self,
        wallet_address: str,
        name: str,
        investor_type: str
    ) -> Dict[str, Any]:
        """
        Register an investor (funder).
        
        Args:
            wallet_address: Neo wallet address
            name: Fund/individual name
            investor_type: Type (e.g., "fund", "individual", "institution")
        
        Returns:
            Dictionary with registration result
        """
        self.log(f"Registering investor: {name} ({wallet_address})")
        
        participants = self._load_participants()
        
        # Check if already registered
        if wallet_address in participants["investors"]:
            self.log(f"Investor {wallet_address} already registered", "warning")
            return {
                "success": True,
                "message": "Investor already registered",
                "data": participants["investors"][wallet_address]
            }
        
        # Register new investor
        investor_data = {
            "wallet_address": wallet_address,
            "name": name,
            "type": investor_type,
            "registered_at": None  # Could add timestamp if needed
        }
        
        participants["investors"][wallet_address] = investor_data
        self._save_participants(participants)
        
        self.log(f"Successfully registered investor: {name}")
        
        return {
            "success": True,
            "message": "Investor registered successfully",
            "data": investor_data
        }
    
    async def get_exporter(self, wallet_address: str) -> Dict[str, Any]:
        """Get exporter information."""
        participants = self._load_participants()
        return participants["exporters"].get(wallet_address, {})
    
    async def get_investor(self, wallet_address: str) -> Dict[str, Any]:
        """Get investor information."""
        participants = self._load_participants()
        return participants["investors"].get(wallet_address, {})

