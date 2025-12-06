# 05 – MCP Integrations Spec (Optional Enhancements)

MCP (Model Context Protocol) and similar tool frameworks allow the platform to dynamically:
- Discover tools (e.g., data providers, credit APIs)
- Route requests to them
- Use vector search for semantic retrieval

For v1, MCP integrations are **optional** but the architecture should allow them to be plugged in without major refactors.

---

## 1. MCP Use Cases

1. **Risk Data Enrichment**
   - Use MCP tools to pull country risk, sector risk, or company‑specific signals.

2. **Invoice Metadata Search**
   - Vector search over invoice descriptions, counterparties, and historical defaults.

3. **Tool Discovery**
   - Automatically find tools that can price risk for certain asset classes.

---

## 2. Integration Points

MCP lives primarily around **RiskAgent**, but can also support:

- `ListingAgent` – for pricing guidance.
- `SettlementAgent` – for default probability analysis (future).

For now, focus on:

- `RiskAgent` → `MCPToolClient`
- `VectorSearch` for invoice metadata (optional).

---

## 3. RiskAgent MCP Pattern

### 3.1 Interface

```python
class RiskAgent(BaseAgent):
    def __init__(self):
        super().__init__("RiskAgent")
        # init MCP clients here

    async def evaluate(self, invoice_metadata: dict) -> dict:
        # 1) compute base heuristic
        # 2) optionally call MCP tools for enrichment
        # 3) combine and return risk_score, yield_bps, rationale
```

### 3.2 Dynamic Tool Discovery (Conceptual)

Pseudocode:

```python
tool = await self.tool_discovery.find_tool("country credit risk")
if tool:
    country = invoice_metadata.get("debtor_country")
    country_result = await self.router.call(tool, {"country": country})
    # incorporate into risk_score
```

The goal is to **not** hard‑wire specific APIs into the spec, but leave the door open to use MCP‑registered tools when available.

---

## 4. Vector Search Use Case

- You may store historical invoices and their default outcomes.
- Use an MCP vector store to:
  - Embed invoice descriptions.
  - Query `K` nearest neighbours to guide yield.

This is not required for v1 but can be used if the team has time and appetite.

---

## 5. Design Constraints

- MCP integrations must be **non‑blocking**:
  - If MCP calls fail or tools are unavailable, `RiskAgent` should fall back to a deterministic heuristic.
- MCP logic must:
  - Not break testability.
  - Not be required to deploy contracts or core backend.

---

## 6. Future Directions

Beyond v1, MCP may power:

- Automated KYC checks
- Sanctions list screening
- News/event‑driven risk adjustments
- Portfolio optimisation tools for investors

This spec defines only the **hooks**; implementation is optional until core flows are stable.
