# Vabble Agent V2 — 3-Sided Marketplace Roadmap

> **Goal:** Transform the current single-flow invoice agent into a full 3-sided marketplace where Exporters onboard invoices, Importers confirm/negotiate terms, and Investors browse/finance/track repayments.

---

## Current State (V1 ✅ Complete)

### What We Have

| Layer | Component | Status |
|-------|-----------|--------|
| **Contracts** | `InvoiceAsset` | ✅ Deployed (TestNet) |
| | `InvestorShare` | ✅ Deployed (TestNet) |
| | `ReceivableRegistryV2` | ✅ Deployed (TestNet) |
| **Backend** | Node.js/Express @ port 4000 | ✅ Running |
| | 6 API endpoints | ✅ Working |
| **Agent** | Python + OpenAI-compatible (Ollama/DeepSeek) | ✅ Working |
| | 6 tools | ✅ Integrated |

### Current Tools (6)

```python
register_invoice     # InvoiceAsset.register_invoice()
allocate_shares      # InvestorShare.allocate()
registry_register    # ReceivableRegistryV2.register_invoice()
set_status           # ReceivableRegistryV2.set_status()
settle_invoice       # ReceivableRegistryV2.settle()
query_invoice_status # ReceivableRegistryV2.get_status()
```

---

## V2 Architecture: 3-Sided Marketplace

### New Contracts Required

| Contract | Purpose | Key Methods |
|----------|---------|-------------|
| `ExporterRegistry` | KYC-lite exporter profiles | `register_profile`, `get_profile`, `update_profile` |
| `ImporterTerms` | Buyer confirmations + term sheets | `confirm_invoice`, `propose_terms`, `sign_terms`, `get_terms` |
| `InvestorMarketplace` | Deal discovery + funding tracking | `list_invoice`, `get_listings`, `update_funding`, `close_listing` |

### New Backend Endpoints (11 additional)

#### Exporter Flow (3 endpoints)
```
POST /exporter/profile         → register_exporter_profile
POST /exporter/invoice-request → exporter_create_invoice_request  
POST /exporter/docs            → exporter_upload_supporting_docs (optional)
```

#### Importer Flow (3 endpoints)
```
POST /importer/confirm         → importer_confirm_invoice
POST /importer/terms           → importer_propose_terms
POST /importer/sign            → importer_sign_financing_terms
```

#### Investor/Marketplace Flow (5 endpoints)
```
POST /marketplace/list         → marketplace_list_invoice
GET  /marketplace/invoices     → investor_list_deals
POST /investor/invest          → investor_commit_to_invoice
GET  /investor/portfolio/:id   → investor_view_positions
POST /investor/withdraw        → investor_withdraw_repayment
```

### New Agent Tools (11 additional)

```python
# Exporter Mode
register_exporter_profile
exporter_create_invoice_request
exporter_upload_supporting_docs

# Importer Mode
importer_confirm_invoice
importer_propose_terms
importer_sign_financing_terms

# Investor Mode
marketplace_list_invoice
investor_list_deals
investor_commit_to_invoice
investor_view_positions
investor_withdraw_repayment
```

---

## SpoonOS Integration Strategy

Based on the SpoonOS API docs, we should leverage:

### 1. CustomAgent Class
```python
from spoon_ai.agents.custom_agent import CustomAgent

class VabbleAgent(CustomAgent):
    def __init__(self):
        super().__init__(
            name="vabble_agent",
            description="3-sided marketplace for invoice financing"
        )
        # Add all 17 tools
        self.add_tools([
            RegisterInvoiceTool(),
            AllocateSharesTool(),
            # ... all tools
        ])
```

### 2. Tool Structure (SpoonOS Compatible)
```python
from spoon_ai.tools import BaseTool

class RegisterExporterProfileTool(BaseTool):
    name = "register_exporter_profile"
    description = "Register a new exporter with KYC-lite profile"
    
    parameters = {
        "type": "object",
        "properties": {
            "exporter_id": {"type": "string"},
            "company_name": {"type": "string"},
            "country": {"type": "string"},
            "sector": {"type": "string"}
        },
        "required": ["exporter_id", "company_name", "country"]
    }
    
    async def execute(self, **kwargs):
        response = requests.post(f"{BACKEND_URL}/exporter/profile", json=kwargs)
        return response.json()
```

### 3. Multi-Mode Agent with Context Detection
```python
SYSTEM_PROMPT = """
You are Vabble Agent - operating in one of three modes:

**EXPORTER MODE** (detected when user mentions: exporter, seller, invoice, financing request)
- Tools: register_exporter_profile, exporter_create_invoice_request, register_invoice, registry_register, marketplace_list_invoice

**IMPORTER MODE** (detected when user mentions: buyer, importer, confirm, terms, sign)
- Tools: importer_confirm_invoice, importer_propose_terms, importer_sign_financing_terms

**INVESTOR MODE** (detected when user mentions: invest, fund, portfolio, deals, yield)
- Tools: investor_list_deals, investor_commit_to_invoice, investor_view_positions, investor_withdraw_repayment

Auto-detect the user's role from their first message and confirm before proceeding.
"""
```

### 4. GraphAgent for Complex Workflows (Optional Enhancement)
```python
from spoon_ai.agents.graph_agent import GraphAgent
from spoon_ai.graph import StateGraph

# Define workflow graph for invoice lifecycle
invoice_graph = StateGraph()
invoice_graph.add_node("register", register_invoice_node)
invoice_graph.add_node("confirm", importer_confirm_node)
invoice_graph.add_node("list", marketplace_list_node)
invoice_graph.add_node("fund", investor_fund_node)
invoice_graph.add_node("settle", settlement_node)

# Add edges
invoice_graph.add_edge("register", "confirm")
invoice_graph.add_edge("confirm", "list")
invoice_graph.add_edge("list", "fund")
invoice_graph.add_edge("fund", "settle")

agent = GraphAgent(graph=invoice_graph)
```

---

## Implementation Phases

### Phase 1: Exporter Flow (2-3 days)

**Day 1: Contract + Backend**
- [ ] Create `ExporterRegistry.py` (neo3-boa)
- [ ] Compile and deploy to TestNet
- [ ] Add 3 backend endpoints
- [ ] Test via curl

**Day 2: Agent Integration**
- [ ] Create 3 tool classes
- [ ] Update agent system prompt
- [ ] Add exporter mode detection
- [ ] Test end-to-end

**Day 3: Polish**
- [ ] Error handling
- [ ] Validation
- [ ] Documentation

### Phase 2: Importer Flow (2-3 days)

**Day 1: Contract + Backend**
- [ ] Create `ImporterTerms.py`
- [ ] Methods: `confirm_invoice`, `propose_terms`, `sign_terms`
- [ ] Events: `InvoiceConfirmed`, `TermsProposed`, `TermsSigned`
- [ ] Deploy to TestNet

**Day 2: Backend + Agent**
- [ ] Add 3 backend endpoints
- [ ] Create 3 tool classes
- [ ] Add importer mode detection
- [ ] Test confirmation flow

**Day 3: Linking**
- [ ] Wire importer confirmation to registry status
- [ ] Block financing until confirmed
- [ ] Test full exporter → importer flow

### Phase 3: Investor Marketplace (3-4 days)

**Day 1: Contract**
- [ ] Create `InvestorMarketplace.py`
- [ ] Storage: `listings`, `funding_progress`, `closed`
- [ ] Methods: `list_invoice`, `update_funding`, `close_listing`
- [ ] Deploy to TestNet

**Day 2: Backend**
- [ ] Add 5 marketplace endpoints
- [ ] Implement portfolio aggregation logic
- [ ] Add filtering/search for listings

**Day 3: Agent**
- [ ] Create 5 tool classes
- [ ] Add investor mode
- [ ] Natural language deal discovery
- [ ] Portfolio summary formatting

**Day 4: Integration**
- [ ] Wire marketplace to InvestorShare
- [ ] Auto-close listings when fully funded
- [ ] Test full exporter → importer → investor flow

### Phase 4: Advanced Features (Optional)

- [ ] On-chain term sheet NFTs
- [ ] NEP-17 investor share tokens
- [ ] Risk scoring oracle integration
- [ ] On-chain activity feed
- [ ] Voice interface (ElevenLabs)
- [ ] Cross-chain NeoX settlement

---

## Contract Designs

### ExporterRegistry.py
```python
from boa3.builtin.compile_time import public, CreateNewEvent
from boa3.builtin.interop import storage

PROFILE_PREFIX = b'exp:'

ExporterRegistered = CreateNewEvent([
    ('exporter_id', bytes),
    ('company_name', str),
    ('country', str),
    ('sector', str)
], 'ExporterRegistered')

@public
def register_profile(exporter_id: bytes, company_name: str, country: str, sector: str) -> bool:
    key = PROFILE_PREFIX + exporter_id
    if storage.get(key) != b'':
        return False  # Already registered
    
    data = company_name + '|' + country + '|' + sector
    storage.put(key, data.encode())
    ExporterRegistered(exporter_id, company_name, country, sector)
    return True

@public
def get_profile(exporter_id: bytes) -> bytes:
    key = PROFILE_PREFIX + exporter_id
    return storage.get(key)

@public
def update_profile(exporter_id: bytes, company_name: str, country: str, sector: str) -> bool:
    key = PROFILE_PREFIX + exporter_id
    if storage.get(key) == b'':
        return False  # Not registered
    
    data = company_name + '|' + country + '|' + sector
    storage.put(key, data.encode())
    return True
```

### ImporterTerms.py
```python
from boa3.builtin.compile_time import public, CreateNewEvent
from boa3.builtin.interop import storage

CONFIRM_PREFIX = b'imp:confirm:'
TERMS_PREFIX = b'imp:terms:'
SIGNED_PREFIX = b'imp:signed:'

InvoiceConfirmed = CreateNewEvent([
    ('invoice_id', bytes),
    ('buyer_id', bytes),
    ('is_valid', bool)
], 'InvoiceConfirmed')

TermsProposed = CreateNewEvent([
    ('invoice_id', bytes),
    ('buyer_id', bytes),
    ('payment_date', int),
    ('max_discount_rate', int)
], 'TermsProposed')

TermsSigned = CreateNewEvent([
    ('invoice_id', bytes),
    ('buyer_id', bytes)
], 'TermsSigned')

@public
def confirm_invoice(invoice_id: bytes, buyer_id: bytes, is_valid: bool) -> bool:
    key = CONFIRM_PREFIX + invoice_id
    if storage.get(key) != b'':
        return False  # Already confirmed
    
    storage.put(key, buyer_id + (b'1' if is_valid else b'0'))
    InvoiceConfirmed(invoice_id, buyer_id, is_valid)
    return True

@public
def propose_terms(invoice_id: bytes, buyer_id: bytes, payment_date: int, max_discount_rate: int, early_payment: bool) -> bool:
    key = TERMS_PREFIX + invoice_id
    # Store terms as: buyer_id|payment_date|max_discount_rate|early_payment
    data = str(payment_date) + '|' + str(max_discount_rate) + '|' + ('1' if early_payment else '0')
    storage.put(key, data.encode())
    TermsProposed(invoice_id, buyer_id, payment_date, max_discount_rate)
    return True

@public
def sign_terms(invoice_id: bytes, buyer_id: bytes) -> bool:
    terms_key = TERMS_PREFIX + invoice_id
    if storage.get(terms_key) == b'':
        return False  # No terms to sign
    
    signed_key = SIGNED_PREFIX + invoice_id
    storage.put(signed_key, buyer_id)
    TermsSigned(invoice_id, buyer_id)
    return True

@public
def is_signed(invoice_id: bytes) -> bool:
    signed_key = SIGNED_PREFIX + invoice_id
    return storage.get(signed_key) != b''

@public
def get_terms(invoice_id: bytes) -> bytes:
    return storage.get(TERMS_PREFIX + invoice_id)
```

### InvestorMarketplace.py
```python
from boa3.builtin.compile_time import public, CreateNewEvent
from boa3.builtin.interop import storage
from boa3.builtin.interop.stdlib import serialize, deserialize

LISTING_PREFIX = b'mkt:list:'
FUNDING_PREFIX = b'mkt:fund:'
STATUS_PREFIX = b'mkt:status:'  # OPEN | FUNDED | CLOSED

InvoiceListed = CreateNewEvent([
    ('invoice_id', bytes),
    ('target_yield', int),
    ('min_investment', int),
    ('max_allocation', int)
], 'InvoiceListed')

FundingUpdated = CreateNewEvent([
    ('invoice_id', bytes),
    ('current_funding', int),
    ('max_allocation', int)
], 'FundingUpdated')

ListingClosed = CreateNewEvent([
    ('invoice_id', bytes),
    ('reason', str)
], 'ListingClosed')

@public
def list_invoice(invoice_id: bytes, target_yield: int, min_investment: int, max_allocation: int) -> bool:
    key = LISTING_PREFIX + invoice_id
    if storage.get(key) != b'':
        return False  # Already listed
    
    # Store listing data
    data = str(target_yield) + '|' + str(min_investment) + '|' + str(max_allocation)
    storage.put(key, data.encode())
    storage.put(STATUS_PREFIX + invoice_id, b'OPEN')
    storage.put(FUNDING_PREFIX + invoice_id, serialize(0))
    
    InvoiceListed(invoice_id, target_yield, min_investment, max_allocation)
    return True

@public
def update_funding(invoice_id: bytes, amount: int) -> bool:
    funding_key = FUNDING_PREFIX + invoice_id
    listing_key = LISTING_PREFIX + invoice_id
    
    current_raw = storage.get(funding_key)
    if current_raw == b'':
        return False
    
    current: int = deserialize(current_raw)
    new_total = current + amount
    storage.put(funding_key, serialize(new_total))
    
    # Get max allocation from listing
    listing = storage.get(listing_key)
    # Parse max_allocation (third field)
    # ... parsing logic
    
    FundingUpdated(invoice_id, new_total, 0)  # max_allocation placeholder
    return True

@public
def close_listing(invoice_id: bytes, reason: str) -> bool:
    status_key = STATUS_PREFIX + invoice_id
    storage.put(status_key, b'CLOSED')
    ListingClosed(invoice_id, reason)
    return True

@public
def get_listing(invoice_id: bytes) -> bytes:
    return storage.get(LISTING_PREFIX + invoice_id)

@public
def get_status(invoice_id: bytes) -> bytes:
    return storage.get(STATUS_PREFIX + invoice_id)

@public
def get_funding(invoice_id: bytes) -> int:
    raw = storage.get(FUNDING_PREFIX + invoice_id)
    if raw == b'':
        return 0
    return deserialize(raw)
```

---

## Backend Endpoint Specifications

### Exporter Endpoints

```typescript
// POST /exporter/profile
app.post('/exporter/profile', async (req, res) => {
    const { exporterId, companyName, country, sector } = req.body;
    const contract = getContract(CONTRACTS.EXPORTER_REGISTRY);
    const txid = await contract.invoke("register_profile", [
        sc.ContractParam.byteArray(Buffer.from(exporterId, "utf-8").toString("hex")),
        sc.ContractParam.string(companyName),
        sc.ContractParam.string(country),
        sc.ContractParam.string(sector)
    ]);
    res.json({ success: true, txid, explorer: `https://testnet.neotube.io/transaction/${txid}` });
});

// POST /exporter/invoice-request
app.post('/exporter/invoice-request', async (req, res) => {
    const { exporterId, invoiceId, buyerName, buyerCountry, faceValue, currency, dueDate, minYield, maxTenorDays } = req.body;
    
    // 1. Register invoice in InvoiceAsset
    const invoiceContract = getContract(CONTRACTS.INVOICE);
    const tx1 = await invoiceContract.invoke("register_invoice", [/* params */]);
    
    // 2. Register in Registry
    const registryContract = getContract(CONTRACTS.REGISTRY);
    const tx2 = await registryContract.invoke("register_invoice", [/* params */]);
    
    res.json({ 
        success: true, 
        invoiceAssetTxid: tx1,
        registryTxid: tx2
    });
});
```

### Importer Endpoints

```typescript
// POST /importer/confirm
app.post('/importer/confirm', async (req, res) => {
    const { invoiceId, buyerId, isValid } = req.body;
    const contract = getContract(CONTRACTS.IMPORTER_TERMS);
    const txid = await contract.invoke("confirm_invoice", [
        sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
        sc.ContractParam.byteArray(Buffer.from(buyerId, "utf-8").toString("hex")),
        sc.ContractParam.boolean(isValid)
    ]);
    res.json({ success: true, txid });
});

// POST /importer/terms
app.post('/importer/terms', async (req, res) => {
    const { invoiceId, buyerId, proposedPaymentDate, maxDiscountRate, earlyPaymentAllowed } = req.body;
    const contract = getContract(CONTRACTS.IMPORTER_TERMS);
    const txid = await contract.invoke("propose_terms", [/* params */]);
    res.json({ success: true, txid });
});

// POST /importer/sign
app.post('/importer/sign', async (req, res) => {
    const { invoiceId, buyerId } = req.body;
    const contract = getContract(CONTRACTS.IMPORTER_TERMS);
    const txid = await contract.invoke("sign_terms", [/* params */]);
    res.json({ success: true, txid });
});
```

### Marketplace Endpoints

```typescript
// POST /marketplace/list
app.post('/marketplace/list', async (req, res) => {
    const { invoiceId, minInvestment, targetYield, maxAllocation } = req.body;
    const contract = getContract(CONTRACTS.MARKETPLACE);
    const txid = await contract.invoke("list_invoice", [/* params */]);
    res.json({ success: true, txid });
});

// GET /marketplace/invoices
app.get('/marketplace/invoices', async (req, res) => {
    // Query listings from contract or off-chain DB
    // Filter by query params: minYield, maxMaturityDays, buyerId, country
    const listings = await queryListings(req.query);
    res.json({ success: true, listings });
});

// POST /investor/invest
app.post('/investor/invest', async (req, res) => {
    const { invoiceId, investorId, amount } = req.body;
    
    // 1. Allocate shares
    const shareContract = getContract(CONTRACTS.INVESTOR_SHARE);
    const tx1 = await shareContract.invoke("allocate", [/* params */]);
    
    // 2. Update marketplace funding
    const marketContract = getContract(CONTRACTS.MARKETPLACE);
    const tx2 = await marketContract.invoke("update_funding", [/* params */]);
    
    res.json({ success: true, allocateTxid: tx1, fundingTxid: tx2 });
});

// GET /investor/portfolio/:investorId
app.get('/investor/portfolio/:investorId', async (req, res) => {
    // Aggregate from InvestorShare + Registry + ImporterTerms
    const portfolio = await aggregatePortfolio(req.params.investorId);
    res.json({ success: true, portfolio });
});

// POST /investor/withdraw
app.post('/investor/withdraw', async (req, res) => {
    const { invoiceId, investorId } = req.body;
    const shareContract = getContract(CONTRACTS.INVESTOR_SHARE);
    const txid = await shareContract.invoke("redeem", [/* params */]);
    res.json({ success: true, txid });
});
```

---

## Agent Tool JSON Schemas

### Exporter Tools

```json
{
    "type": "function",
    "function": {
        "name": "register_exporter_profile",
        "description": "Register a new exporter with KYC-lite profile on-chain",
        "parameters": {
            "type": "object",
            "properties": {
                "exporter_id": {"type": "string", "description": "Unique exporter ID or tax ID"},
                "company_name": {"type": "string"},
                "country": {"type": "string", "description": "ISO country code (e.g., VE, CO, PE)"},
                "sector": {"type": "string", "description": "Industry sector (e.g., cacao, coffee, metals)"}
            },
            "required": ["exporter_id", "company_name", "country"]
        }
    }
}
```

```json
{
    "type": "function",
    "function": {
        "name": "exporter_create_invoice_request",
        "description": "Create a full financing request for an invoice",
        "parameters": {
            "type": "object",
            "properties": {
                "exporter_id": {"type": "string"},
                "invoice_id": {"type": "string"},
                "buyer_name": {"type": "string"},
                "buyer_country": {"type": "string"},
                "face_value": {"type": "integer", "description": "Invoice amount in cents"},
                "currency": {"type": "string", "default": "USD"},
                "due_date": {"type": "integer", "description": "YYYYMMDD format"},
                "min_yield": {"type": "number", "description": "Minimum acceptable yield %"},
                "max_tenor_days": {"type": "integer"}
            },
            "required": ["exporter_id", "invoice_id", "buyer_name", "face_value"]
        }
    }
}
```

### Importer Tools

```json
{
    "type": "function",
    "function": {
        "name": "importer_confirm_invoice",
        "description": "Importer confirms that a receivable is valid",
        "parameters": {
            "type": "object",
            "properties": {
                "invoice_id": {"type": "string"},
                "buyer_id": {"type": "string"},
                "is_valid": {"type": "boolean"}
            },
            "required": ["invoice_id", "buyer_id", "is_valid"]
        }
    }
}
```

```json
{
    "type": "function",
    "function": {
        "name": "importer_propose_terms",
        "description": "Importer proposes payment terms for financing",
        "parameters": {
            "type": "object",
            "properties": {
                "invoice_id": {"type": "string"},
                "buyer_id": {"type": "string"},
                "proposed_payment_date": {"type": "integer", "description": "YYYYMMDD"},
                "max_discount_rate": {"type": "number", "description": "Max acceptable yield for investors (%)"},
                "early_payment_allowed": {"type": "boolean"}
            },
            "required": ["invoice_id", "buyer_id", "proposed_payment_date"]
        }
    }
}
```

```json
{
    "type": "function",
    "function": {
        "name": "importer_sign_financing_terms",
        "description": "Importer signs and locks the financing terms on-chain",
        "parameters": {
            "type": "object",
            "properties": {
                "invoice_id": {"type": "string"},
                "buyer_id": {"type": "string"}
            },
            "required": ["invoice_id", "buyer_id"]
        }
    }
}
```

### Investor Tools

```json
{
    "type": "function",
    "function": {
        "name": "marketplace_list_invoice",
        "description": "List an invoice for investor financing",
        "parameters": {
            "type": "object",
            "properties": {
                "invoice_id": {"type": "string"},
                "target_yield": {"type": "number", "description": "Target yield %"},
                "min_investment": {"type": "integer"},
                "max_allocation": {"type": "integer", "description": "Max total funding"}
            },
            "required": ["invoice_id", "target_yield"]
        }
    }
}
```

```json
{
    "type": "function",
    "function": {
        "name": "investor_list_deals",
        "description": "Browse available investment opportunities",
        "parameters": {
            "type": "object",
            "properties": {
                "min_yield": {"type": "number"},
                "max_maturity_days": {"type": "integer"},
                "buyer_id": {"type": "string"},
                "country": {"type": "string"}
            },
            "required": []
        }
    }
}
```

```json
{
    "type": "function",
    "function": {
        "name": "investor_commit_to_invoice",
        "description": "Invest in an invoice by allocating capital",
        "parameters": {
            "type": "object",
            "properties": {
                "invoice_id": {"type": "string"},
                "investor_id": {"type": "string"},
                "amount": {"type": "integer"}
            },
            "required": ["invoice_id", "investor_id", "amount"]
        }
    }
}
```

```json
{
    "type": "function",
    "function": {
        "name": "investor_view_positions",
        "description": "View investor's portfolio and positions",
        "parameters": {
            "type": "object",
            "properties": {
                "investor_id": {"type": "string"}
            },
            "required": ["investor_id"]
        }
    }
}
```

```json
{
    "type": "function",
    "function": {
        "name": "investor_withdraw_repayment",
        "description": "Withdraw repayment after settlement",
        "parameters": {
            "type": "object",
            "properties": {
                "invoice_id": {"type": "string"},
                "investor_id": {"type": "string"}
            },
            "required": ["invoice_id", "investor_id"]
        }
    }
}
```

---

## Multi-Mode Agent System Prompt (V2)

```
You are Vabble Agent – an autonomous operator for a 3-sided invoice financing marketplace on Neo N3.

## Role Detection

Detect the user's role from their first message:

**EXPORTER** (keywords: exporter, seller, invoice, financing request, list invoice)
- You help exporters onboard invoices and get financing
- Available tools: register_exporter_profile, exporter_create_invoice_request, register_invoice, registry_register, marketplace_list_invoice

**IMPORTER** (keywords: buyer, importer, confirm, terms, sign, approve)
- You help importers confirm invoices and negotiate terms
- Available tools: importer_confirm_invoice, importer_propose_terms, importer_sign_financing_terms

**INVESTOR** (keywords: invest, fund, portfolio, deals, yield, returns, positions)
- You help investors discover deals and manage investments
- Available tools: investor_list_deals, investor_commit_to_invoice, investor_view_positions, investor_withdraw_repayment

## Workflow Rules

1. **Exporter Flow:**
   - First register profile if new exporter
   - Then create invoice request (registers in InvoiceAsset + Registry automatically)
   - List on marketplace after importer confirms

2. **Importer Flow:**
   - Can only confirm invoices where they are the buyer
   - Must propose terms before signing
   - Signing locks terms on-chain

3. **Investor Flow:**
   - Can only invest in OPEN marketplace listings
   - Check importer terms are signed before recommending
   - Show yield calculations in portfolio view

## Response Format

- Always confirm role at session start
- Output transaction IDs with explorer links
- Summarize actions taken in bullet points
- For investors: include yield/return calculations
```

---

## Success Metrics

After V2 implementation, we should be able to:

1. ✅ **Exporter demo**: "I'm an exporter, I want to finance a $50k invoice to Walmart"
   - Agent registers profile
   - Creates invoice request
   - Shows on marketplace

2. ✅ **Importer demo**: "I'm Walmart, confirm invoice INV-123 and propose 60-day terms at 8% max"
   - Agent confirms invoice
   - Proposes terms
   - Signs terms

3. ✅ **Investor demo**: "Show me deals with >7% yield, then invest $20k in the best one"
   - Agent queries marketplace
   - Recommends best deal
   - Allocates capital

4. ✅ **Full lifecycle**: Invoice created → Confirmed → Listed → Funded → Settled
   - All on-chain
   - All via natural language

---

## Files to Create/Modify

### New Files
- `contracts/ExporterRegistry.py`
- `contracts/ImporterTerms.py`
- `contracts/InvestorMarketplace.py`
- `scripts/neo-workflow/compile-exporter.sh`
- `scripts/neo-workflow/compile-importer.sh`
- `scripts/neo-workflow/compile-marketplace.sh`
- `scripts/neo-workflow/deploy-exporter-testnet.js`
- `scripts/neo-workflow/deploy-importer-testnet.js`
- `scripts/neo-workflow/deploy-marketplace-testnet.js`
- `scripts/agent/tools_v2.py` (11 new tools)
- `scripts/agent/vabble_agent_v2.py` (multi-mode agent)

### Modified Files
- `services/neo-backend/server.ts` (add 11 endpoints)
- `.env` (add 3 new contract hashes)
- `README.md` (update docs)
- `package.json` (add new scripts)

---

## Next Steps

1. **Confirm scope** with ChatGPT/team
2. **Start Phase 1** (Exporter flow)
3. **Test incrementally**
4. **Deploy to TestNet** as each phase completes
5. **Demo the full flow**

---

*Generated: December 7, 2025*
*Based on: SpoonOS API docs + ChatGPT marketplace design*

