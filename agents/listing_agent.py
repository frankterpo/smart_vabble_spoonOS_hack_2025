"""
ListingAgent - Handles invoice creation and listing on-chain
Bridges off-chain invoice creation with on-chain listing.
"""

import hashlib
import json
from typing import Dict, Any
from .base_agent import BaseAgent


class ListingAgent(BaseAgent):
    """
    Agent for creating and listing invoices on-chain.
    """
    
    def __init__(self):
        super().__init__("ListingAgent")
        if not self.invoice_asset_hash:
            self.log("InvoiceAsset contract hash not configured", "warning")
    
    def _hash_metadata(self, metadata: Dict[str, Any]) -> str:
        """
        Hash invoice metadata for on-chain storage.
        
        Args:
            metadata: Invoice metadata dictionary
        
        Returns:
            Hex string of SHA-256 hash
        """
        metadata_str = json.dumps(metadata, sort_keys=True)
        metadata_bytes = metadata_str.encode('utf-8')
        hash_obj = hashlib.sha256(metadata_bytes)
        return hash_obj.hexdigest()
    
    async def create_invoice(
        self,
        invoice_id: str,
        seller: str,
        amount: int,
        due_date: int,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create invoice on-chain.
        
        Args:
            invoice_id: Unique invoice identifier
            seller: Seller wallet address (hex string or bytes)
            amount: Invoice amount in base units
            due_date: Unix timestamp
            metadata: Invoice metadata dictionary
        
        Returns:
            Dictionary with transaction result
        """
        self.log(f"Creating invoice {invoice_id} on-chain")
        
        # Hash metadata
        metadata_hash = self._hash_metadata(metadata)
        
        # Convert seller address to bytes if needed
        if isinstance(seller, str):
            # Assume hex string, convert to bytes
            seller_bytes = bytes.fromhex(seller.replace('0x', ''))
        else:
            seller_bytes = seller
        
        # Call InvoiceAsset.create_invoice
        args = [
            invoice_id,
            seller_bytes,
            amount,
            due_date,
            metadata_hash
        ]
        
        result = await self.invoke_contract(
            self.invoice_asset_hash,
            "create_invoice",
            args
        )
        
        self.log(f"Invoice {invoice_id} created: {result.get('tx_hash', 'N/A')}")
        
        return result
    
    async def list_invoice(
        self,
        invoice_id: str,
        yield_bps: int,
        risk_score: int
    ) -> Dict[str, Any]:
        """
        List invoice for funding with risk and yield parameters.
        
        Args:
            invoice_id: Invoice identifier
            yield_bps: Yield in basis points
            risk_score: Risk score (1-5)
        
        Returns:
            Dictionary with transaction result
        """
        self.log(f"Listing invoice {invoice_id} with yield={yield_bps}bps, risk={risk_score}")
        
        args = [
            invoice_id,
            yield_bps,
            risk_score
        ]
        
        result = await self.invoke_contract(
            self.invoice_asset_hash,
            "list_invoice",
            args
        )
        
        self.log(f"Invoice {invoice_id} listed: {result.get('tx_hash', 'N/A')}")
        
        return result
    
    async def create_and_list(
        self,
        invoice_id: str,
        seller: str,
        amount: int,
        due_date: int,
        metadata: Dict[str, Any],
        yield_bps: int,
        risk_score: int
    ) -> Dict[str, Any]:
        """
        Create and list invoice in one operation.
        
        Args:
            invoice_id: Unique invoice identifier
            seller: Seller wallet address
            amount: Invoice amount
            due_date: Unix timestamp
            metadata: Invoice metadata
            yield_bps: Yield in basis points
            risk_score: Risk score
        
        Returns:
            Dictionary with results from both operations
        """
        self.log(f"Creating and listing invoice {invoice_id}")
        
        # Create invoice
        create_result = await self.create_invoice(
            invoice_id,
            seller,
            amount,
            due_date,
            metadata
        )
        
        if not create_result.get("success", False):
            return create_result
        
        # List invoice
        list_result = await self.list_invoice(
            invoice_id,
            yield_bps,
            risk_score
        )
        
        return {
            "success": create_result.get("success") and list_result.get("success"),
            "create_tx": create_result.get("tx_hash"),
            "list_tx": list_result.get("tx_hash"),
            "message": "Invoice created and listed successfully"
        }

