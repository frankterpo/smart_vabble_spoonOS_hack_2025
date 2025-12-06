"""
FundingAgent - Handles investor funding transactions
Processes funding requests and calls InvoiceAsset.fund_invoice.
"""

from typing import Dict, Any
from .base_agent import BaseAgent


class FundingAgent(BaseAgent):
    """
    Agent for processing invoice funding from investors.
    """
    
    def __init__(self):
        super().__init__("FundingAgent")
        if not self.invoice_asset_hash:
            self.log("InvoiceAsset contract hash not configured", "warning")
    
    async def fund(
        self,
        invoice_id: str,
        investor: str,
        amount: int
    ) -> Dict[str, Any]:
        """
        Fund an invoice from an investor.
        
        Args:
            invoice_id: Invoice identifier
            investor: Investor wallet address (hex string or bytes)
            amount: Funding amount in base units
        
        Returns:
            Dictionary with transaction result
        """
        self.log(f"Funding invoice {invoice_id} with {amount} from {investor}")
        
        # Convert investor address to bytes if needed
        if isinstance(investor, str):
            investor_bytes = bytes.fromhex(investor.replace('0x', ''))
        else:
            investor_bytes = investor
        
        args = [
            invoice_id,
            investor_bytes,
            amount
        ]
        
        result = await self.invoke_contract(
            self.invoice_asset_hash,
            "fund_invoice",
            args
        )
        
        self.log(f"Funding transaction submitted: {result.get('tx_hash', 'N/A')}")
        
        return result
    
    async def get_funding_status(
        self,
        invoice_id: str
    ) -> Dict[str, Any]:
        """
        Get current funding status for an invoice.
        
        Args:
            invoice_id: Invoice identifier
        
        Returns:
            Dictionary with funding information
        """
        self.log(f"Getting funding status for invoice {invoice_id}")
        
        args = [invoice_id]
        
        result = await self.call_contract(
            self.invoice_asset_hash,
            "get_invoice",
            args
        )
        
        invoice_data = result.get("result", {})
        
        return {
            "invoice_id": invoice_id,
            "amount": invoice_data.get("amount", 0),
            "funded_amount": invoice_data.get("funded_amount", 0),
            "status": invoice_data.get("status", 0),
            "remaining": invoice_data.get("amount", 0) - invoice_data.get("funded_amount", 0)
        }

