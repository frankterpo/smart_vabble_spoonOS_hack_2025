"""
Integration Test Flow
End-to-end test of create → list → fund → settle invoice lifecycle.
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents import (
    OnboardingAgent,
    RiskAgent,
    ListingAgent,
    FundingAgent,
    SettlementAgent,
    BaseAgent
)


async def main():
    """Run integration test flow."""
    print("=" * 60)
    print("Vabble Integration Test Flow")
    print("=" * 60)
    print()
    
    # Test configuration
    seller_wallet = os.getenv("NEO_WALLET_ADDRESS", "0x" + "0" * 40)
    investor_wallet = os.getenv("NEO_WALLET_ADDRESS", "0x" + "1" * 40)
    
    invoice_id = "TEST_INV_001"
    amount = 500000
    due_date = int((datetime.now() + timedelta(days=30)).timestamp())
    
    errors = []
    
    try:
        # Step 1: Register exporter
        print("Step 1: Registering exporter...")
        onboarding = OnboardingAgent()
        result = await onboarding.register_exporter(
            seller_wallet,
            "Test Exporter Ltd",
            "US"
        )
        if not result.get("success"):
            errors.append("Exporter registration failed")
        print(f"  ✓ Exporter registered")
        
        # Step 2: Register investor
        print("Step 2: Registering investor...")
        result = await onboarding.register_investor(
            investor_wallet,
            "Test Credit Fund",
            "fund"
        )
        if not result.get("success"):
            errors.append("Investor registration failed")
        print(f"  ✓ Investor registered")
        
        # Step 3: Create invoice metadata
        print("Step 3: Creating invoice metadata...")
        metadata = {
            "invoice_id": invoice_id,
            "seller": seller_wallet,
            "amount": amount,
            "currency": "USD",
            "due_date": due_date,
            "debtor_name": "Test Debtor Inc",
            "debtor_country": "US"
        }
        
        invoices_file = "data/invoices.json"
        os.makedirs(os.path.dirname(invoices_file), exist_ok=True)
        if os.path.exists(invoices_file):
            with open(invoices_file, 'r') as f:
                invoices = json.load(f)
        else:
            invoices = {}
        invoices[invoice_id] = metadata
        with open(invoices_file, 'w') as f:
            json.dump(invoices, f, indent=2)
        print(f"  ✓ Invoice metadata saved")
        
        # Step 4: Risk evaluation
        print("Step 4: Evaluating risk...")
        risk_agent = RiskAgent()
        risk_result = await risk_agent.evaluate(metadata)
        risk_score = risk_result["risk_score"]
        yield_bps = risk_result["yield_bps"]
        print(f"  ✓ Risk Score: {risk_score}/5, Yield: {yield_bps/100:.2f}%")
        
        # Step 5: Create invoice on-chain (mock)
        print("Step 5: Creating invoice on-chain...")
        listing_agent = ListingAgent()
        # Note: This will use mock mode if Neo libraries aren't configured
        result = await listing_agent.create_invoice(
            invoice_id,
            seller_wallet,
            amount,
            due_date,
            metadata
        )
        if not result.get("success"):
            errors.append("Invoice creation failed")
        print(f"  ✓ Invoice created (tx: {result.get('tx_hash', 'mock')})")
        
        # Step 6: List invoice
        print("Step 6: Listing invoice...")
        result = await listing_agent.list_invoice(
            invoice_id,
            yield_bps,
            risk_score
        )
        if not result.get("success"):
            errors.append("Invoice listing failed")
        print(f"  ✓ Invoice listed (tx: {result.get('tx_hash', 'mock')})")
        
        # Step 7: Fund invoice
        print("Step 7: Funding invoice...")
        funding_agent = FundingAgent()
        result = await funding_agent.fund(
            invoice_id,
            investor_wallet,
            amount
        )
        if not result.get("success"):
            errors.append("Invoice funding failed")
        print(f"  ✓ Invoice funded (tx: {result.get('tx_hash', 'mock')})")
        
        # Step 8: Settle invoice
        print("Step 8: Settling invoice...")
        yield_amount = (amount * yield_bps) // 10000
        actual_paid = amount + yield_amount
        
        settlement_agent = SettlementAgent()
        result = await settlement_agent.settle(invoice_id, actual_paid)
        if not result.get("success"):
            errors.append("Invoice settlement failed")
        
        status_name = result.get("status_name", "UNKNOWN")
        print(f"  ✓ Invoice settled: {status_name}")
        
        # Step 9: Verify final state
        print("Step 9: Verifying final state...")
        base_agent = BaseAgent("Test")
        result = await base_agent.call_contract(
            base_agent.invoice_asset_hash,
            "get_invoice",
            [invoice_id]
        )
        invoice_data = result.get("result", {})
        final_status = invoice_data.get("status", 0)
        
        # Status 3 = SETTLED
        if final_status != 3:
            errors.append(f"Expected status SETTLED (3), got {final_status}")
        
        print(f"  ✓ Final status verified: {final_status}")
        
        print()
        print("=" * 60)
        if errors:
            print(f"TEST FAILED with {len(errors)} error(s):")
            for error in errors:
                print(f"  - {error}")
            return False
        else:
            print("TEST PASSED - All steps completed successfully")
            return True
        
    except Exception as e:
        print()
        print("=" * 60)
        print(f"TEST FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)

