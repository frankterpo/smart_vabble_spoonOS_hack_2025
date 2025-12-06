"""
Vabble CLI - Command-line interface for trade receivables platform
Main entrypoint for all backend operations.
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Optional
import typer
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents import (
    OnboardingAgent,
    RiskAgent,
    ListingAgent,
    FundingAgent,
    SettlementAgent,
    BaseAgent
)

app = typer.Typer(help="Vabble Decentralised Receivables CLI")


@app.command()
def register_exporter(
    wallet_address: str = typer.Option(..., "--wallet-address", help="Neo wallet address"),
    name: str = typer.Option(..., "--name", help="Company/individual name"),
    country: str = typer.Option(..., "--country", help="Country code or name")
):
    """Register an exporter (seller)."""
    async def _register():
        agent = OnboardingAgent()
        result = await agent.register_exporter(wallet_address, name, country)
        print(json.dumps(result, indent=2))
        return result.get("success", False)
    
    success = asyncio.run(_register())
    sys.exit(0 if success else 1)


@app.command()
def register_investor(
    wallet_address: str = typer.Option(..., "--wallet-address", help="Neo wallet address"),
    name: str = typer.Option(..., "--name", help="Fund/individual name"),
    investor_type: str = typer.Option(..., "--type", help="Investor type (fund, individual, etc.)")
):
    """Register an investor (funder)."""
    async def _register():
        agent = OnboardingAgent()
        result = await agent.register_investor(wallet_address, name, investor_type)
        print(json.dumps(result, indent=2))
        return result.get("success", False)
    
    success = asyncio.run(_register())
    sys.exit(0 if success else 1)


@app.command()
def create_invoice(
    invoice_id: str = typer.Option(..., "--invoice-id", help="Unique invoice identifier"),
    seller_wallet: str = typer.Option(..., "--seller-wallet", help="Seller wallet address"),
    amount: int = typer.Option(..., "--amount", help="Invoice amount in base units"),
    currency: str = typer.Option(..., "--currency", help="Currency code (e.g., USD)"),
    due_date: int = typer.Option(..., "--due-date", help="Due date Unix timestamp"),
    debtor_name: str = typer.Option(..., "--debtor-name", help="Debtor/import company name"),
    debtor_country: str = typer.Option(..., "--debtor-country", help="Debtor country")
):
    """Create invoice metadata and call InvoiceAsset.create_invoice."""
    async def _create():
        # Build metadata
        metadata = {
            "invoice_id": invoice_id,
            "seller": seller_wallet,
            "amount": amount,
            "currency": currency,
            "due_date": due_date,
            "debtor_name": debtor_name,
            "debtor_country": debtor_country,
            "created_at": int(datetime.now().timestamp())
        }
        
        # Save metadata to data/invoices.json
        invoices_file = "data/invoices.json"
        if os.path.exists(invoices_file):
            with open(invoices_file, 'r') as f:
                invoices = json.load(f)
        else:
            invoices = {}
        
        invoices[invoice_id] = metadata
        
        with open(invoices_file, 'w') as f:
            json.dump(invoices, f, indent=2)
        
        # Create invoice on-chain
        listing_agent = ListingAgent()
        result = await listing_agent.create_invoice(
            invoice_id,
            seller_wallet,
            amount,
            due_date,
            metadata
        )
        
        print(json.dumps({
            "success": result.get("success", False),
            "invoice_id": invoice_id,
            "tx_hash": result.get("tx_hash"),
            "message": "Invoice created successfully"
        }, indent=2))
        
        return result.get("success", False)
    
    success = asyncio.run(_create())
    sys.exit(0 if success else 1)


@app.command()
def list_invoice(
    invoice_id: str = typer.Option(..., "--invoice-id", help="Invoice identifier")
):
    """Run risk assessment and list invoice for funding."""
    async def _list():
        # Load invoice metadata
        invoices_file = "data/invoices.json"
        if not os.path.exists(invoices_file):
            print(json.dumps({"success": False, "error": "Invoice not found"}, indent=2))
            return False
        
        with open(invoices_file, 'r') as f:
            invoices = json.load(f)
        
        if invoice_id not in invoices:
            print(json.dumps({"success": False, "error": f"Invoice {invoice_id} not found"}, indent=2))
            return False
        
        metadata = invoices[invoice_id]
        
        # Evaluate risk
        risk_agent = RiskAgent()
        risk_result = await risk_agent.evaluate(metadata)
        
        risk_score = risk_result["risk_score"]
        yield_bps = risk_result["yield_bps"]
        rationale = risk_result["rationale"]
        
        print(f"Risk Assessment:")
        print(f"  Risk Score: {risk_score}/5")
        print(f"  Yield: {yield_bps/100:.2f}% ({yield_bps} bps)")
        print(f"  Rationale: {rationale}")
        print()
        
        # List invoice on-chain
        listing_agent = ListingAgent()
        result = await listing_agent.list_invoice(
            invoice_id,
            yield_bps,
            risk_score
        )
        
        print(json.dumps({
            "success": result.get("success", False),
            "invoice_id": invoice_id,
            "risk_score": risk_score,
            "yield_bps": yield_bps,
            "tx_hash": result.get("tx_hash"),
            "message": "Invoice listed successfully"
        }, indent=2))
        
        return result.get("success", False)
    
    success = asyncio.run(_list())
    sys.exit(0 if success else 1)


@app.command()
def fund_invoice(
    invoice_id: str = typer.Option(..., "--invoice-id", help="Invoice identifier"),
    investor_wallet: str = typer.Option(..., "--investor-wallet", help="Investor wallet address"),
    amount: int = typer.Option(..., "--amount", help="Funding amount in base units")
):
    """Fund an invoice from an investor."""
    async def _fund():
        funding_agent = FundingAgent()
        result = await funding_agent.fund(invoice_id, investor_wallet, amount)
        
        print(json.dumps({
            "success": result.get("success", False),
            "invoice_id": invoice_id,
            "investor": investor_wallet,
            "amount": amount,
            "tx_hash": result.get("tx_hash"),
            "message": "Funding transaction submitted"
        }, indent=2))
        
        return result.get("success", False)
    
    success = asyncio.run(_fund())
    sys.exit(0 if success else 1)


@app.command()
def settle_invoice(
    invoice_id: str = typer.Option(..., "--invoice-id", help="Invoice identifier"),
    actual_paid: int = typer.Option(..., "--actual-paid", help="Actual amount paid")
):
    """Settle an invoice at or after maturity."""
    async def _settle():
        settlement_agent = SettlementAgent()
        result = await settlement_agent.settle(invoice_id, actual_paid)
        
        print(json.dumps(result, indent=2))
        
        return result.get("success", False)
    
    success = asyncio.run(_settle())
    sys.exit(0 if success else 1)


@app.command()
def get_invoice(
    invoice_id: str = typer.Option(..., "--invoice-id", help="Invoice identifier")
):
    """Get invoice state from on-chain contract."""
    async def _get():
        base_agent = BaseAgent("CLI")
        result = await base_agent.call_contract(
            base_agent.invoice_asset_hash,
            "get_invoice",
            [invoice_id]
        )
        
        invoice_data = result.get("result", {})
        
        status_names = {
            0: "CREATED",
            1: "LISTED",
            2: "FUNDED",
            3: "SETTLED",
            4: "DEFAULTED"
        }
        
        status = invoice_data.get("status", 0)
        status_name = status_names.get(status, "UNKNOWN")
        
        output = {
            "invoice_id": invoice_id,
            "seller": invoice_data.get("seller", ""),
            "amount": invoice_data.get("amount", 0),
            "funded_amount": invoice_data.get("funded_amount", 0),
            "due_date": invoice_data.get("due_date", 0),
            "status": status,
            "status_name": status_name,
            "yield_bps": invoice_data.get("yield_bps", 0),
            "risk_score": invoice_data.get("risk_score", 0)
        }
        
        print(json.dumps(output, indent=2))
        
        return True
    
    asyncio.run(_get())


@app.command()
def demo_flow():
    """Run end-to-end demo flow with test data."""
    async def _demo():
        print("=" * 60)
        print("Vabble Demo Flow - End-to-End Invoice Lifecycle")
        print("=" * 60)
        print()
        
        # Test data
        seller_wallet = os.getenv("NEO_WALLET_ADDRESS", "0x" + "0" * 40)
        investor_wallet = os.getenv("NEO_WALLET_ADDRESS", "0x" + "1" * 40)  # Different address
        
        invoice_id = "INV001"
        amount = 500000  # 5,000.00 if 2 decimals
        due_date = int((datetime.now() + timedelta(days=30)).timestamp())
        
        # Step 1: Register exporter
        print("Step 1: Registering exporter...")
        onboarding = OnboardingAgent()
        result = await onboarding.register_exporter(
            seller_wallet,
            "Andes Agro Export",
            "Peru"
        )
        print(f"  ✓ {result.get('message', 'Done')}")
        print()
        
        # Step 2: Register investor
        print("Step 2: Registering investor...")
        result = await onboarding.register_investor(
            investor_wallet,
            "Summit Credit Fund",
            "fund"
        )
        print(f"  ✓ {result.get('message', 'Done')}")
        print()
        
        # Step 3: Create invoice
        print("Step 3: Creating invoice...")
        metadata = {
            "invoice_id": invoice_id,
            "seller": seller_wallet,
            "amount": amount,
            "currency": "USD",
            "due_date": due_date,
            "debtor_name": "First Brands Group",
            "debtor_country": "US"
        }
        
        invoices_file = "data/invoices.json"
        if os.path.exists(invoices_file):
            with open(invoices_file, 'r') as f:
                invoices = json.load(f)
        else:
            invoices = {}
        invoices[invoice_id] = metadata
        with open(invoices_file, 'w') as f:
            json.dump(invoices, f, indent=2)
        
        listing_agent = ListingAgent()
        result = await listing_agent.create_invoice(
            invoice_id,
            seller_wallet,
            amount,
            due_date,
            metadata
        )
        print(f"  ✓ Invoice created: {result.get('tx_hash', 'N/A')}")
        print()
        
        # Step 4: Risk assessment and listing
        print("Step 4: Risk assessment and listing...")
        risk_agent = RiskAgent()
        risk_result = await risk_agent.evaluate(metadata)
        print(f"  Risk Score: {risk_result['risk_score']}/5")
        print(f"  Yield: {risk_result['yield_bps']/100:.2f}%")
        
        result = await listing_agent.list_invoice(
            invoice_id,
            risk_result['yield_bps'],
            risk_result['risk_score']
        )
        print(f"  ✓ Invoice listed: {result.get('tx_hash', 'N/A')}")
        print()
        
        # Step 5: Fund invoice
        print("Step 5: Funding invoice...")
        funding_agent = FundingAgent()
        result = await funding_agent.fund(invoice_id, investor_wallet, amount)
        print(f"  ✓ Funding transaction: {result.get('tx_hash', 'N/A')}")
        print()
        
        # Step 6: Settle invoice
        print("Step 6: Settling invoice...")
        # Simulate full payment with yield
        yield_amount = (amount * risk_result['yield_bps']) // 10000
        actual_paid = amount + yield_amount
        
        settlement_agent = SettlementAgent()
        result = await settlement_agent.settle(invoice_id, actual_paid)
        print(f"  ✓ Settlement complete: {result.get('status_name', 'N/A')}")
        print()
        
        # Step 7: Verify final state
        print("Step 7: Verifying final invoice state...")
        base_agent = BaseAgent("CLI")
        result = await base_agent.call_contract(
            base_agent.invoice_asset_hash,
            "get_invoice",
            [invoice_id]
        )
        invoice_data = result.get("result", {})
        print(f"  Final Status: {invoice_data.get('status', 'N/A')}")
        print(f"  Funded Amount: {invoice_data.get('funded_amount', 0)}")
        print()
        
        print("=" * 60)
        print("Demo flow completed successfully!")
        print("=" * 60)
        
        return True
    
    asyncio.run(_demo())


if __name__ == "__main__":
    app()

