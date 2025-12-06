# 02 – Smart Contracts Spec (Neo N3)

This document specifies the **on‑chain contract suite** required for v1:

- `InvoiceAsset` – invoice lifecycle & funding
- `InvestorShare` – investor exposure token (NEP‑17‑like)
- `PlatformFee` – fee accounting

All contracts are implemented in **Python** using **neo3‑boa** and deployed on **Neo N3 TestNet**.

---

## 1. Shared Design Principles

1. **Deterministic Behaviour**
   - No network calls, randomness, or off‑chain dependencies within contracts.

2. **Minimal State**
   - Store only strictly necessary state on‑chain.
   - Store rich metadata off‑chain; store only hashes on‑chain.

3. **Upgradeability**
   - v1 contracts are **non‑upgradable** to reduce complexity.
   - Future versions can introduce proxy/upgrade patterns if needed.

4. **Error Handling**
   - Use explicit `raise Exception("...")` when invariants are violated.
   - Avoid silent failures.

5. **Types**
   - Use Boa‑compatible types: `int`, `str`, `bytes`, `bool`, `list`, `dict`.

---

## 2. Common Data Types

### 2.1 Invoice Status
Represented as integer constants within `InvoiceAsset`:

```python
STATUS_CREATED = 0
STATUS_LISTED = 1
STATUS_FUNDED = 2
STATUS_SETTLED = 3
STATUS_DEFAULTED = 4
```

### 2.2 Invoice Record

On‑chain stored as a serialized dict (or multiple keys) with at least:

- `invoice_id: str`
- `seller: bytes` (script hash)
- `amount: int` (base units)
- `funded_amount: int`
- `due_date: int` (Unix timestamp)
- `status: int`
- `yield_bps: int` (basis points = yield * 10,000)
- `risk_score: int` (1–10 for v1)
- `metadata_hash: str` (e.g. hex string of SHA‑256)

---

## 3. InvoiceAsset Contract

### 3.1 Responsibilities

- Maintain the registry of all invoices.
- Enforce that:
  - Only the seller creates & lists their invoices.
  - Total funded amount never exceeds `amount`.
  - Settlements respect investor positions.
- Trigger mint/burn operations on `InvestorShare`.

### 3.2 Storage Layout

Key‑value store using string prefixes:

- `b"inv:" + invoice_id` → serialized `InvoiceRecord`
- `b"funds:" + invoice_id + ":" + investor` → `int` (funded amount per investor)
- `b"owner"` → owner script hash (platform owner, optional)

### 3.3 Public Methods

#### 3.3.1 `create_invoice`

```python
@public
def create_invoice(invoice_id: str, seller: bytes, amount: int, due_date: int, metadata_hash: str) -> bool
```

**Preconditions:**  
- No existing invoice with same `invoice_id`.  
- `amount > 0`  
- `due_date > now`  

**Effects:**  
- Store new invoice with:
  - `funded_amount = 0`
  - `status = STATUS_CREATED`
  - `yield_bps = 0`
  - `risk_score = 0`  
- Emit `InvoiceCreated` event.

#### 3.3.2 `list_invoice`

```python
@public
def list_invoice(invoice_id: str, yield_bps: int, risk_score: int) -> bool
```

**Preconditions:**  
- Invoice exists.  
- `status == STATUS_CREATED`.  
- `yield_bps > 0`.  
- `risk_score >= 1`.

**Effects:**  
- Update `yield_bps` and `risk_score`.  
- Set `status = STATUS_LISTED`.  
- Emit `InvoiceListed` event.

#### 3.3.3 `fund_invoice`

```python
@public
def fund_invoice(invoice_id: str, investor: bytes, amount: int) -> bool
```

**Preconditions:**  
- Invoice exists.  
- `status == STATUS_LISTED`.  
- `amount > 0`.  
- `funded_amount + amount <= invoice.amount`.  

**Effects:**  
- Increase `funded_amount`.  
- Store per‑investor position.  
- Call `InvestorShare.mint(investor, invoice_id, amount)`.  
- If `funded_amount == amount` then set `status = STATUS_FUNDED`.  
- Emit `InvoiceFunded` event.

#### 3.3.4 `settle_invoice`

```python
@public
def settle_invoice(invoice_id: str, actual_paid: int) -> bool
```

**Preconditions:**  
- Invoice exists.  
- `status in (STATUS_FUNDED, STATUS_LISTED)` (allow partial default).  
- `now >= due_date`.  
- `actual_paid >= 0`.  

**Effects (simplified for v1):**  
- Calculate total investor payout (principal + yield) capped by `actual_paid`.  
- Call `InvestorShare.burn()` for each investor and log their payout.  
- If `actual_paid > total_investor_payout` the excess is sent (virtually) to seller.  
- Fee is calculated and recorded in `PlatformFee`.  
- Set status:
  - `STATUS_SETTLED` if `actual_paid >= funded_amount + yield`.  
  - `STATUS_DEFAULTED` otherwise.  
- Emit `InvoiceSettled` event.

> **Note**: v1 can implement payout accounting as events only, not actual asset transfers, to keep the flow simple for a hackathon. Future versions can wire real on‑chain transfers.

#### 3.3.5 `get_invoice`

```python
@public
def get_invoice(invoice_id: str) -> dict
```

Returns full invoice record as a Boa‑compatible dict.

---

## 4. InvestorShare Contract

### 4.1 Purpose
Represent investor positions as fungible units per invoice. For v1, we can use:

- Global balance mapping per investor **per invoice ID**.

### 4.2 Storage Layout

- `b"bal:" + invoice_id + ":" + investor` → `int`

### 4.3 Public Methods

#### 4.3.1 `balance_of`

```python
@public
def balance_of(invoice_id: str, investor: bytes) -> int
```

#### 4.3.2 `mint`

```python
@public
def mint(investor: bytes, invoice_id: str, amount: int) -> bool
```

- Only callable by `InvoiceAsset` (enforced by checking calling script hash).

#### 4.3.3 `burn`

```python
@public
def burn(investor: bytes, invoice_id: str, amount: int) -> bool
```

- Only callable by `InvoiceAsset`.

#### 4.3.4 (Optional) `transfer`

```python
@public
def transfer(invoice_id: str, from_addr: bytes, to_addr: bytes, amount: int) -> bool
```

- v1 can omit or stub this if secondary trading is out of scope.

---

## 5. PlatformFee Contract

### 5.1 Purpose
Track cumulative protocol fees and allow owner withdrawal (accounting only in v1).

### 5.2 Storage Layout

- `b"fee_balance"` → `int`
- `b"owner"` → owner script hash

### 5.3 Methods

#### 5.3.1 `record_fee`

```python
@public
def record_fee(amount: int) -> bool
```

- Only callable by `InvoiceAsset`.

#### 5.3.2 `get_fee_balance`

```python
@public
def get_fee_balance() -> int
```

#### 5.3.3 `withdraw`

```python
@public
def withdraw(recipient: bytes) -> bool
```

- Only owner can call.

---

## 6. Events

At minimum, emit:

- `InvoiceCreated(invoice_id, seller, amount, due_date)`
- `InvoiceListed(invoice_id, yield_bps, risk_score)`
- `InvoiceFunded(invoice_id, investor, amount)`
- `InvoiceSettled(invoice_id, actual_paid, status)`
- `ShareMinted(investor, invoice_id, amount)`
- `ShareBurned(investor, invoice_id, amount)`
- `FeeRecorded(amount)`

These events are crucial for off‑chain indexing and test scripts.

---

## 7. Compilation & Deployment Process

1. Activate venv.
2. Run `boa compile` for each contract.
3. Use `neoxp` or similar to deploy NEF to TestNet.
4. Store resulting contract hashes in a JSON file (e.g. `contracts/addresses.json`) and in `.env` for agents:

```json
{
  "InvoiceAsset": "0x...",
  "InvestorShare": "0x...",
  "PlatformFee": "0x..."
}
```

Agents will read these values at runtime.
