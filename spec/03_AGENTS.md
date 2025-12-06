# 03 – SpoonOS Agents Spec

This document defines the **SpoonOS agent layer**. Agents orchestrate workflows between:
- Users (via CLI)
- Neo smart contracts
- Optional external data/MCP tools

All agents are implemented in Python using `spoon-sdk` in the `agents/` directory.

---

## 1. BaseAgent

### 1.1 Purpose
Provide shared functionality:
- Env loading
- Neo RPC client
- Logging
- Optional MCP clients

### 1.2 Responsibilities
- Initialize on construction with:
  - `name: str`
  - RPC URL
  - Wallet private key
- Provide helper methods:
  - `invoke_contract(contract_hash, operation, args) -> dict`
  - `log(message: str)`

### 1.3 Skeleton

```python
# agents/base_agent.py
import os
from spoon_sdk import SpoonAgent

class BaseAgent(SpoonAgent):
    def __init__(self, name: str):
        super().__init__(name=name)
        self.rpc_url = os.getenv("RPC_URL")
        self.private_key = os.getenv("NEO_WALLET_PRIVATE_KEY")
        self.address = os.getenv("NEO_WALLET_ADDRESS")

    async def log(self, msg: str):
        print(f"[{self.name}] {msg}")

    async def invoke_contract(self, contract_hash: str, operation: str, args: list):
        # TODO: implement RPC call to Neo contract (build script, sign, send, await confirmation)
        ...
```

---

## 2. OnboardingAgent

### 2.1 Purpose
- “Register” exporters and investors for the backend’s off‑chain view.
- For v1, this is mostly maintaining a local JSON/SQLite DB of known participants.

### 2.2 Operations
- `register_exporter(wallet_address, name, country)`
- `register_investor(wallet_address, name, type)` (type = individual, fund, etc.)

### 2.3 Inputs & Outputs
- **Input**: CLI arguments from `cli.py`.
- **Output**: Updated records in `data/participants.json` or DB.

No on‑chain call is strictly required for v1 onboarding.

---

## 3. RiskAgent

### 3.1 Purpose
Compute simple risk scores and suggested yields for invoices.

### 3.2 v1 Logic
- Accept `invoice_metadata` (dict) with fields:
  - `debtor_country`
  - `debtor_name`
  - `amount`
  - `due_date`
- Compute `risk_score` (1–5) based on simple heuristics, e.g.:
  - Higher amount + longer term → higher risk score.
- Compute `yield_bps` = base + spread * risk_score.

### 3.3 Optional LLM/MCP Enhancement
- Pass metadata into LLM prompt or MCP tool to suggest yield in natural language, then parse result.

### 3.4 API

```python
class RiskAgent(BaseAgent):
    async def evaluate(self, invoice_metadata: dict) -> dict:
        """Return { 'risk_score': int, 'yield_bps': int, 'rationale': str }"""
```

---

## 4. ListingAgent

### 4.1 Purpose
Bridge off‑chain invoice creation and on‑chain listing.

### 4.2 Responsibilities
- Call `InvoiceAsset.create_invoice` after local metadata is hashed.
- Call `InvoiceAsset.list_invoice` with `risk_score` and `yield_bps` from `RiskAgent`.

### 4.3 API

```python
class ListingAgent(BaseAgent):
    def __init__(self, invoice_asset_hash: str):
        super().__init__("ListingAgent")
        self.invoice_asset_hash = invoice_asset_hash

    async def create_and_list(self, invoice_id: str, seller: str, amount: int,
                              due_date: int, metadata_hash: str,
                              risk_score: int, yield_bps: int) -> dict:
        # 1. call create_invoice
        # 2. call list_invoice
        # 3. return result info
```

---

## 5. FundingAgent

### 5.1 Purpose
Handle investor funding transactions.

### 5.2 Responsibilities
- Accept parameters:
  - `invoice_id`
  - `investor_wallet`
  - `amount`
- Invoke `InvoiceAsset.fund_invoice`.

### 5.3 API

```python
class FundingAgent(BaseAgent):
    def __init__(self, invoice_asset_hash: str):
        super().__init__("FundingAgent")
        self.invoice_asset_hash = invoice_asset_hash

    async def fund(self, invoice_id: str, investor: str, amount: int) -> dict:
        # call contract, return tx hash / result
```

---

## 6. SettlementAgent

### 6.1 Purpose
Settle invoices post‑maturity.

### 6.2 Responsibilities
- Accept parameters:
  - `invoice_id`
  - `actual_paid` (int)
- Call `InvoiceAsset.settle_invoice`.

### 6.3 API

```python
class SettlementAgent(BaseAgent):
    def __init__(self, invoice_asset_hash: str):
        super().__init__("SettlementAgent")
        self.invoice_asset_hash = invoice_asset_hash

    async def settle(self, invoice_id: str, actual_paid: int) -> dict:
        # call contract and return settlement outcome
```

---

## 7. VoiceAgent (Optional)

### 7.1 Purpose
- Convert voice commands into backend actions.
- Demo the ElevenLabs + LLM angle for less technical users.

### 7.2 Responsibilities
- Take in audio file or stream (for v1: path to WAV/MP3).
- Send to ElevenLabs for transcription (or use text input to simulate).
- Parse intent:
  - `create invoice INV123 amount 5000 due 30 days`
  - `fund invoice INV123 amount 1000`
- Forward structured intent to corresponding agent.

### 7.3 API

```python
class VoiceAgent(BaseAgent):
    async def handle_voice_command(self, audio_path: str) -> dict:
        """Transcribe, parse intent, dispatch to other agents"""
```

Implementation of transcription and NLP can be minimal or stubbed for hackathon.

---

## 8. Agent Orchestration

### 8.1 Simple Procedural Orchestration

For v1, orchestration can happen in `scripts/test_flow.py`:

1. `OnboardingAgent` registers exporter & investor (off‑chain).
2. CLI builds `invoice_metadata` and stores off‑chain.
3. `RiskAgent.evaluate` → `risk_score`, `yield_bps`.
4. `ListingAgent.create_and_list`.
5. `FundingAgent.fund`.
6. `SettlementAgent.settle`.

### 8.2 Future Graph‑Based Orchestration

SpoonOS supports graph pipelines (e.g. Graph Crypto Analysis example). In the future, define a graph:

- Nodes: `risk → listing → funding → settlement`
- Edges: triggered by status/completion.

For v1, keep orchestration explicit and procedural to reduce moving parts.
