# 04 – Backend CLI Spec

This document defines the **CLI surface** of the backend. The entire v1 system is controlled through terminal commands that wrap SpoonOS agents and Neo contract calls.

All CLI entrypoints live under `scripts/`, with a single main module `cli.py` exposing subcommands.

---

## 1. CLI Goals

- Allow a human or script to exercise the entire end‑to‑end flow:
  - Register participants.
  - Create + list invoices.
  - Fund invoices.
  - Settle invoices.
  - Query state for demo and debugging.
- Be easy for a hackathon judge to follow in a live demo.

---

## 2. CLI Design

Use Python’s `argparse` or `typer` for ergonomic commands. Suggested entrypoint:

```bash
python scripts/cli.py <command> [OPTIONS]
```

### Supported Commands (v1)

1. `register-exporter`
2. `register-investor`
3. `create-invoice`
4. `list-invoice`
5. `fund-invoice`
6. `settle-invoice`
7. `get-invoice`
8. `demo-flow` (scripted happy path)

---

## 3. Command Specifications

### 3.1 `register-exporter`

Registers an exporter off‑chain.

**Usage**:

```bash
python scripts/cli.py register-exporter   --wallet-address NEO_WALLET_ADDRESS   --name "Acme Exporters Ltd"   --country "Peru"
```

**Behaviour**:

- Calls `OnboardingAgent.register_exporter` with provided data.
- Writes/updates record in `data/participants.json`.

### 3.2 `register-investor`

Registers an investor off‑chain.

**Usage**:

```bash
python scripts/cli.py register-investor   --wallet-address INVESTOR_WALLET   --name "Alpha Credit Fund"   --type "fund"
```

---

### 3.3 `create-invoice`

Creates invoice metadata, hashes it, and calls `InvoiceAsset.create_invoice`.

**Usage**:

```bash
python scripts/cli.py create-invoice   --invoice-id INV001   --seller-wallet SELLER_WALLET   --amount 500000   --currency "USD"   --due-date 1736204800   --debtor-name "First Brands Group"   --debtor-country "US"
```

**Steps**:

1. Build `invoice_metadata` dict.
2. Persist to `data/invoices.json` keyed by `invoice_id`.
3. Compute `metadata_hash = sha256(json.dumps(metadata))`.
4. Call `ListingAgent.create_and_list` **only for `create` part**, or just `create_invoice` if separated.

(Depending on architecture: `create-invoice` and `list-invoice` may be separate commands.)

---

### 3.4 `list-invoice`

Runs risk model and lists invoice.

**Usage**:

```bash
python scripts/cli.py list-invoice   --invoice-id INV001
```

**Steps**:

1. Load invoice metadata from `data/invoices.json`.  
2. Call `RiskAgent.evaluate(metadata)` → `risk_score`, `yield_bps`.  
3. Call `ListingAgent.create_and_list(...)` (if not created on‑chain yet) or `list_invoice(...)` if already created.  
4. Print risk and yield summary.

---

### 3.5 `fund-invoice`

Funds invoice from investor.

**Usage**:

```bash
python scripts/cli.py fund-invoice   --invoice-id INV001   --investor-wallet INVESTOR_WALLET   --amount 250000
```

**Steps**:

1. Read contract hash for `InvoiceAsset`.  
2. Invoke `FundingAgent.fund(invoice_id, investor_wallet, amount)`.  
3. Print transaction hash and updated funded amount (if available).

---

### 3.6 `settle-invoice`

Settles invoice at or after maturity.

**Usage**:

```bash
python scripts/cli.py settle-invoice   --invoice-id INV001   --actual-paid 520000
```

**Steps**:

1. Invoke `SettlementAgent.settle(...)`.  
2. Print new status (`SETTLED` or `DEFAULTED`) and payout breakdown summary (as returned by agent or read via `get-invoice`).

---

### 3.7 `get-invoice`

Fetches invoice state for inspection.

**Usage**:

```bash
python scripts/cli.py get-invoice   --invoice-id INV001
```

**Steps**:

1. Call `InvoiceAsset.get_invoice(invoice_id)` via `BaseAgent.invoke_contract`.  
2. Pretty print the dict as JSON.

---

### 3.8 `demo-flow`

Run a single end‑to‑end scenario using fixed test data.

**Usage**:

```bash
python scripts/cli.py demo-flow
```

**Steps**:

1. Register exporter & investor (if not already).  
2. Create invoice (using canned metadata).  
3. Run `list-invoice`.  
4. Run `fund-invoice` (partial or full).  
5. Run `settle-invoice` with simulated payment.  
6. At each step, log key state transitions and print short explanation.

This command is crucial for a live hackathon demo.

---

## 4. Error Handling

- All CLI commands must:
  - Exit with non‑zero code on failure.
  - Print human‑readable error message.
  - Optionally print underlying exception for debugging (when `--verbose` flag is provided).

- Example:
  - If `create-invoice` is called with an existing `invoice_id`, handle gracefully, indicate duplication, and suggest `get-invoice`.

---

## 5. Configuration

- The CLI must load from `.env`:
  - `RPC_URL`
  - `NEO_WALLET_PRIVATE_KEY` (for default wallet)
  - Contract hashes from `contracts/addresses.json` or equivalent.

- Optional flags:
  - `--config path/to/config.json` to override defaults.
