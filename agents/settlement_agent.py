"""
SettlementAgent - Handles invoice settlement
Processes settlement transactions after invoice maturity.
"""

from typing import Dict, Any
from .base_agent import BaseAgent


class SettlementAgent(BaseAgent):
    """
    Agent for settling invoices at or after maturity.
    """
    
    def __init__(self):
        super().__init__("SettlementAgent")
        if not self.invoice_asset_hash:
            self.log("InvoiceAsset contract hash not configured", "warning")
    
    async def settle(
        self,
        invoice_id: str,
        actual_paid: int
    ) -> Dict[str, Any]:
        """
        Settle an invoice with actual payment amount.
        
        Args:
            invoice_id: Invoice identifier
            actual_paid: Actual amount paid (may differ from expected)
        
        Returns:
            Dictionary with settlement result and final status
        """
        self.log(f"Settling invoice {invoice_id} with actual_paid={actual_paid}")
        
        args = [
            invoice_id,
            actual_paid
        ]
        
        result = await self.invoke_contract(
            self.invoice_asset_hash,
            "settle_invoice",
            args
        )
        
        # Get updated invoice status
        invoice_result = await self.call_contract(
            self.invoice_asset_hash,
            "get_invoice",
            [invoice_id]
        )
        
        invoice_data = invoice_result.get("result", {})
        final_status = invoice_data.get("status", 0)
        
        status_names = {
            0: "CREATED",
            1: "LISTED",
            2: "FUNDED",
            3: "SETTLED",
            4: "DEFAULTED"
        }
        
        status_name = status_names.get(final_status, "UNKNOWN")
        
        self.log(f"Settlement complete: {invoice_id} -> {status_name}")
        
        return {
            "success": result.get("success", False),
            "tx_hash": result.get("tx_hash"),
            "invoice_id": invoice_id,
            "actual_paid": actual_paid,
            "final_status": final_status,
            "status_name": status_name,
            "message": f"Invoice settled with status: {status_name}"
        }
    
    async def get_settlement_info(
        self,
        invoice_id: str
    ) -> Dict[str, Any]:
        """
        Get settlement information for an invoice.
        
        Args:
            invoice_id: Invoice identifier
        
        Returns:
            Dictionary with settlement details
        """
        self.log(f"Getting settlement info for invoice {invoice_id}")
        
        args = [invoice_id]
        
        result = await self.call_contract(
            self.invoice_asset_hash,
            "get_invoice",
            args
        )
        
        invoice_data = result.get("result", {})
        
        funded_amount = invoice_data.get("funded_amount", 0)
        yield_bps = invoice_data.get("yield_bps", 0)
        yield_amount = (funded_amount * yield_bps) // 10000
        total_expected = funded_amount + yield_amount
        
        return {
            "invoice_id": invoice_id,
            "funded_amount": funded_amount,
            "yield_bps": yield_bps,
            "yield_amount": yield_amount,
            "total_expected": total_expected,
            "status": invoice_data.get("status", 0),
            "due_date": invoice_data.get("due_date", 0)
        }

