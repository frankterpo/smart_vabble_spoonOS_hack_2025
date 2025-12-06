# 07 – Test & Demo Spec

This document defines how to **prove** that the backend v1 works and how to **demo** it live.

---

## 1. Test Objectives

- Verify each contract function behaves as expected.
- Verify each agent performs its responsibilities correctly.
- Verify CLI commands chain together to create → list → fund → settle an invoice.
- Capture a clean, repeatable demo flow.

---

## 2. Test Data

Use a minimal but realistic invoice:

```text
invoice_id: INV001
seller_wallet: <SELLER_WALLET_ADDR>
investor_wallet: <INVESTOR_WALLET_ADDR>
amount: 500000        # e.g. 5,000.00 if 2 decimal
currency: USD
due_date: <timestamp 30 days from now>
debtor_name: "First Brands Group"
debtor_country: "US"
```

---

## 3. Unit Tests

### 3.1 Contracts

Use Boa test framework or simple Python harness to test:

- `create_invoice`:
  - Rejects duplicate IDs.
  - Rejects `amount <= 0`.
- `list_invoice`:
  - Only after `create_invoice`.
  - Fails if invoice already listed.
- `fund_invoice`:
  - Fails if > notional.
  - Succeeds if cumulative funding == notional.
- `settle_invoice`:
  - Fails if before `due_date`.
  - Correctly sets `STATUS_SETTLED` or `STATUS_DEFAULTED` depending on `actual_paid`.

### 3.2 Agents

- `RiskAgent.evaluate` returns `risk_score` and `yield_bps` within expected ranges.
- `ListingAgent.create_and_list` calls both create + list without error (can be mocked).
- `FundingAgent.fund` handles partial and full funding.
- `SettlementAgent.settle` triggers status update and logs.

---

## 4. Integration Test (Local)


1. Start from a clean deployment (contracts deployed; addresses stored).
2. Run a Python integration script `scripts/test_flow.py` that:

```python
async def main():
    # 1) create metadata
    # 2) risk.evaluate
    # 3) listing.create_and_list
    # 4) funding.fund
    # 5) settlement.settle
    # 6) retrieve invoice and assert final status
```

3. The script should exit with code 0 on success.

Run via:

```bash
python scripts/test_flow.py
```

---

## 5. Demo Script (For Hackathon)

### 5.1 Pre‑Demo Setup

- `.env` configured for seller & investor test wallets.
- Contracts deployed and hashes stored.
- `data/participants.json` empty or freshly initialised.
- `data/invoices.json` empty.

### 5.2 Live Demo Flow

1. **Show .env (redacted)** to explain configuration.
2. **Register exporter**:

```bash
python scripts/cli.py register-exporter   --wallet-address $SELLER_WALLET   --name "Andes Agro Export"   --country "Peru"
```

3. **Register investor**:

```bash
python scripts/cli.py register-investor   --wallet-address $INVESTOR_WALLET   --name "Summit Credit Fund"   --type "fund"
```

4. **Create invoice**:

```bash
python scripts/cli.py create-invoice   --invoice-id INV001   --seller-wallet $SELLER_WALLET   --amount 500000   --currency "USD"   --due-date <TIMESTAMP_30_DAYS>   --debtor-name "First Brands Group"   --debtor-country "US"
```

5. **List invoice & show risk/yield**:

```bash
python scripts/cli.py list-invoice --invoice-id INV001
```

Explain output briefly:
- `risk_score`
- `yield_bps` (e.g. 800 → 8.00%)

6. **Fund invoice** (investor):

```bash
python scripts/cli.py fund-invoice   --invoice-id INV001   --investor-wallet $INVESTOR_WALLET   --amount 500000
```

7. **Settle invoice** (simulate repayment):

```bash
python scripts/cli.py settle-invoice   --invoice-id INV001   --actual-paid 520000
```

8. **Inspect invoice**:

```bash
python scripts/cli.py get-invoice --invoice-id INV001
```

Show final status and key fields.

### 5.3 Optional Voice Demo

If `VoiceAgent` is implemented, simulate:

```bash
python scripts/voice_demo.py --command   "Create invoice INV002 for 300000 dollars due in 45 days for debtor Acme Retail in Mexico"
```

Explain that in production, a non‑technical exporter could do this via voice from mobile.

---

## 6. Debugging Tips

- If smart contract calls fail:
  - Check RPC URL.
  - Check NEF and manifest are correctly deployed.
  - Check that contract hashes in `.env` / `addresses.json` match actual chain.

- If agents fail:
  - Run with `--verbose` CLI flag.
  - Print raw RPC responses.

- If funding exceeds notional:
  - Ensure the guard in `fund_invoice` is implemented and tested.

---

## 7. Acceptance Criteria

The backend v1 is considered **ready** when:

1. You can run `demo-flow` and the script completes without error.  
2. The final invoice status is `SETTLED` in the happy path.  
3. A separate test can simulate insufficient `actual_paid` and result in `DEFAULTED`.  
4. CI passes (lint + tests + compile).  
5. A hackathon judge can follow the demo script and see each step’s terminal output without needing to understand the underlying code.
