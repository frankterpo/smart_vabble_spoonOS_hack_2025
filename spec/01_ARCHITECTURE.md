# 01 – Architecture Spec (Vabble Decentralised Receivables v1)

## 1. Objective

Design a **backend‑only**, **agent‑driven**, **Neo‑based** platform that replicates Vabble.io’s core business model on‑chain:

- Exporters (sellers) create and sell **trade receivables** (invoices) for early liquidity.
- Investors fund those receivables in exchange for yield based on buyer (importer) credit quality.
- Importers (buyers/debtors) pay invoices at maturity, and proceeds are distributed to investors and exporters.
- All financing contracts and cashflows are represented on **Neo** and orchestrated via **SpoonOS agents**.
- All interactions for v1 happen via **CLI / terminal commands**, no web UI.

The v1 must be:
- Minimal but **fully working** end‑to‑end.
- Built so that later: UI, more sophisticated risk models, real KYC/AML, and institutional‑grade features can be added.

---

## 2. Actors & Roles

### 2.1 Exporter (Seller)
- Owns receivables (invoices) owed by Importers.
- Wants early liquidity by selling all/part of the invoice to Investors.
- Identified primarily by Neo wallet address (for v1).

### 2.2 Importer (Debtor / Buyer)
- Underlying counterparty that owes the invoice payment.
- For v1: importer identity and credit quality are **metadata only** (off‑chain, stored in JSON/DB), referenced by hash on‑chain.

### 2.3 Investor (Funder)
- Provides capital to fund invoices.
- Receives on‑chain representation of their share (`InvestorShare` tokens).
- Receives principal + yield at settlement.

### 2.4 Platform (Vabble Protocol)
- Owns & maintains smart contracts:
  - `InvoiceAsset`
  - `InvestorShare`
  - `PlatformFee`
- Sets base fee levels (hard‑coded for v1 or simple config).
- Does **not** take custody of user keys in v1; all interactions are signed by user wallets.

### 2.5 Agents (SpoonOS)
Autonomous components that orchestrate workflows, call smart contracts, and (optionally) external data sources:

- `OnboardingAgent`
- `RiskAgent`
- `ListingAgent`
- `FundingAgent`
- `SettlementAgent`
- `VoiceAgent` (optional)

Agents are implemented in Python using `spoon-sdk` and optional `spoon-toolkits`.

---

## 3. High‑Level Data Flow

### 3.1 Core Flow: Receivable Financing

1. **Exporter Onboards**
   - Provides wallet address (= identity in v1).
   - Optional off‑chain metadata (company name, jurisdiction).

2. **Exporter Creates Invoice**
   - Calls CLI: `create_invoice` with:
     - `invoice_id`
     - `amount`
     - `currency` (string label only)
     - `due_date` (Unix timestamp)
     - `debtor_name`
     - `debtor_country`
   - Backend:
     - Builds `invoice_metadata` JSON.
     - Hashes metadata (e.g. SHA‑256).
     - Calls `InvoiceAsset.create_invoice` with:
       - `invoice_id`, `seller`, `amount`, `due_date`, `metadata_hash`.

3. **Risk Assessment & Listing**
   - `RiskAgent` computes `risk_score` and `yield_bps`.
     - v1: simple static logic (e.g., AAA importer → lower yield).
   - `ListingAgent` calls `InvoiceAsset.list_invoice` with:
     - `invoice_id`, `yield_bps`, `risk_score`.

4. **Investor Funding**
   - Investor chooses invoice (for v1: via CLI, referencing `invoice_id`).
   - Calls `fund_invoice` CLI:
     - `invoice_id`, `amount` (<= remaining notional).
   - `FundingAgent`:
     - Sends transaction to `InvoiceAsset.fund_invoice`.
     - `InvoiceAsset` verifies capacity and then calls `InvestorShare.mint` for the investor.

5. **Settlement**
   - At/after `due_date`, CLI call `settle_invoice`:
     - `invoice_id`, `actual_paid_amount`.
   - `SettlementAgent` sends tx to `InvoiceAsset.settle_invoice`.
   - `InvoiceAsset` distributes:
     - Principal + yield to Investors (via on‑chain accounting logic).
     - Remainder (if any) to Exporter.
     - Fee to `PlatformFee` contract.

---

## 4. Component Overview

### 4.1 Smart Contracts (On‑Chain)

1. **InvoiceAsset**
   - Master registry and lifecycle manager for invoices/receivables.
   - Stores:
     - Mapping `invoice_id → InvoiceRecord`.
   - Key states:
     - `CREATED`, `LISTED`, `FUNDED`, `SETTLED`, `DEFAULTED`.

2. **InvestorShare**
   - NEP‑17‑like token representing investor exposure to specific invoices.
   - Simplification for v1:
     - 1 share unit = 1 smallest currency unit of notional (or another abstraction).

3. **PlatformFee**
   - Simple account for protocol fees.
   - Owner can withdraw.
   - Fee logic triggered by `InvoiceAsset`.

### 4.2 Off‑Chain Backend

- Python + SpoonOS environment.
- Agents as orchestrators, not business owners.
- Off‑chain store:
  - Option A: JSON files in `data/` directory.
  - Option B: SQLite DB (via SQLAlchemy).
- Off‑chain responsibilities:
  - Metadata storage (debtor identity, invoice documents, etc.).
  - Logging of agent operations.
  - CLI command parsing.

### 4.3 External APIs (Optional in v1)

- Chainbase, DeSearch, other data sources (via MCP) for:
  - Debtor risk profile.
  - Country risk.
  - Sector risk.

These are **not required** to ship v1 but should be kept in mind in interfaces.

---

## 5. Technology Stack

### 5.1 Blockchain Layer
- **Network**: Neo N3 TestNet.
- **Compiler**: `neo3-boa` (Python smart-contract compiler).
- **RPC Endpoint**: e.g. `https://testnet1.neo.org:443` (configurable via env).

### 5.2 Agent Layer
- **Library**: `spoon-sdk`
- **Toolkits** (optional use):
  - `spoon-toolkits[crypto,data,github,social,storage]`

### 5.3 Language & Runtime
- Python 3.12+
- Dependencies:
  - `neo3-boa`
  - `web3` (if EVM chains are used later)
  - `python-dotenv`
  - `requests`

### 5.4 Process Model

- All interactions are via CLI commands which:
  - Parse arguments.
  - Instantiate the appropriate agent.
  - Call its methods.
  - Agent prepares tx, signs with wallet private key from `.env`, sends via RPC.

- Node environment:
  - Single command process per operation for simplicity.
  - No long‑running daemon required for v1.

---

## 6. Security & Trust Assumptions

1. **Private Keys**
   - For v1, private key is read from `.env` for:
     - Exporter test accounts.
     - Investor test accounts.
   - This is **only acceptable for testnet and hackathon demo**.

2. **Oracles**
   - Payment confirmation (`actual_paid_amount`) is manually input.
   - No external oracle; the operator is assumed honest for v1.

3. **KYC/AML**
   - Not implemented in v1.
   - Off‑chain metadata is informational only.

4. **Protocol Invariants**
   - `funded_amount ≤ invoice_notional` always.
   - Settlement cannot be called before `due_date` (enforced on‑chain).
   - `InvestorShare` balance must exactly reflect funded positions.

---

## 7. Directory & Module Layout

At repo root:

- `spec/` – this folder with spec files.  
- `contracts/` – Neo contract code and compiled NEF/artifacts.  
- `agents/` – all SpoonOS agents.  
- `scripts/` – CLI entrypoints and helper scripts.  
- `ci/` – CI/CD configuration.  
- `data/` – sample JSON/SQLite DB for v1.  
- `.env` – local environment configuration (ignored by git).  

Example:

```text
vabble-backend/
  spec/
    00_README_INDEX.md
    01_ARCHITECTURE.md
    02_SMART_CONTRACTS.md
    03_AGENTS.md
    04_BACKEND_CLI.md
    05_MCP_INTEGRATIONS.md
    06_CI_CD.md
    07_TEST_AND_DEMO.md
  contracts/
    InvoiceAsset.py
    InvestorShare.py
    PlatformFee.py
  agents/
    base_agent.py
    onboarding_agent.py
    risk_agent.py
    listing_agent.py
    funding_agent.py
    settlement_agent.py
    voice_agent.py
  scripts/
    cli.py
    deploy_contracts.sh
    test_flow.py
  data/
    invoices.json
  ci/
    github-actions.yml
  requirements.txt
  .env.example
```

---

## 8. Non‑Goals for v1

The following are explicitly **out of scope** for this v1 spec (but should be enabled by the architecture):

- Real‑world KYC/AML, document verification, or compliance workflows.
- Real banking integrations (JP Morgan, etc.).
- Multi‑jurisdiction tax and FX handling.
- UI (web or mobile).
- Secondary trading market for `InvestorShare` tokens.
- Complex fee tiers or dynamic protocol governance.
- Institutional custodians, SPVs, or true‑sale structuring.

These belong to future iterations once the v1 protocol and agents are working end‑to‑end.
