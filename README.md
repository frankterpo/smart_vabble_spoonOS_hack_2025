# Vabble Receivables Registry v1 — Neo N3 CLI Workflow

Complete CLI-only workflow for developing, compiling, deploying, and invoking Neo N3 smart contracts on TestNet.

**Main Contract**: `ReceivableRegistryV1` — A minimal receivables registry for trade finance.

## Prerequisites

- macOS or Linux
- **Python 3.10** installed (required - neo3-boa v1.4.1 does NOT support Python 3.11+)
- Node.js 16+ installed
- Neo N3 TestNet wallet with GAS (for deployment)

**⚠️ Important:** neo3-boa v1.4.1 only supports Python 3.8-3.10. Python 3.11, 3.12, and 3.13 will cause compilation errors.

**Install Python 3.10:**
- Homebrew: `brew install python@3.10`
- pyenv: `pyenv install 3.10.13 && pyenv local 3.10.13`

## Project Structure

```
vabs_v2/
├── contracts/
│   ├── ReceivableRegistryV1.py   # Main contract (v1)
│   └── SimpleStorage.py          # Demo contract (reference)
├── build/                        # Compiled artifacts (auto-created)
│   ├── ReceivableRegistryV1.nef
│   ├── ReceivableRegistryV1.manifest.json
│   └── deployment.json
├── scripts/neo-workflow/
│   ├── compile.sh                # Compilation script
│   ├── generate-wallet.sh        # Wallet generation script
│   ├── deploy.js                 # Deployment script
│   └── invoke.js                 # Invocation script
├── .env                          # Environment variables
├── package.json                  # Node.js dependencies
└── README.md                     # This file
```

## Contract: ReceivableRegistryV1

A minimal receivables registry contract with two public methods:

| Method       | Parameters                                              | Returns | Description                                      |
| ------------ | ------------------------------------------------------- | ------- | ------------------------------------------------ |
| `register`   | `id, buyer, seller, amount, currency, due_date, meta`   | `bool`  | Creates a receivable record; `False` if exists.  |
| `get_record` | `id`                                                    | `str`   | Pipe-delimited record, empty string if not found.|

### Storage Format

Records are stored as pipe-delimited strings:

```
buyer|seller|amount|currency|due_date|registered|meta
```

Example:
```
Walmart|PeruvianAvocadosCo|100000|USD|20251231|registered|{"po": "PO-123"}
```

## Installation

```bash
# Install Python dependencies
pip3 install neo3-boa

# Install Node.js dependencies
npm install
```

## Quick Start

```bash
# 1. Compile contract
npm run compile

# 2. Deploy to TestNet (manual) or local (neo-express)
# Manual (TestNet): use NeoLine wallet with build/ReceivableRegistryV1.nef + manifest
# Local: start neo-express (neo-express create --count 1 && neo-express run)
npm run deploy:local

# 3. Add script hash to .env (from deploy output)
# RECEIVABLE_REGISTRY_CONTRACT_HASH=0x<your_hash>

# 4. Invoke contract methods
npm run invoke
```

## Step-by-Step Workflow

### Step 1: Generate Wallet (Optional)

If you need a new wallet:

```bash
npm run generate-wallet
```

Copy the WIF to `.env`:

```env
NEO_WALLET_WIF=<your_wif_here>
```

### Step 2: Configure Environment

Edit `.env`:

```env
NEO_WALLET_WIF=L4W2zHU2q8DLi6yEMLasvVLNoBrZEzUCXjcXnWvbEoHntt7SDWMs
RECEIVABLE_REGISTRY_CONTRACT_HASH=
INVOICE_ASSET_CONTRACT_HASH=
```

### Step 3: Compile Contract

```bash
npm run compile
```

**Expected Output:**
```
📦 Installing neo3-boa if missing...
🛠  Compiling ReceivableRegistryV1 contract...
✅ Compilation complete!
NEF:      ../../build/ReceivableRegistryV1.nef
MANIFEST: ../../build/ReceivableRegistryV1.manifest.json
```

### Step 4: Deploy Contract

**⚠️ Important:** Public Neo N3 TestNet RPC nodes don't accept raw deployment transactions. You have two options:

#### Option A: Manual Deployment (Recommended for TestNet - Fastest)

1. Use NeoLine wallet extension (Chrome/Firefox)
2. Switch to Neo N3 TestNet network
3. Go to "Contract" → "Deploy Contract"
4. Upload `build/ReceivableRegistryV1.nef` and `build/ReceivableRegistryV1.manifest.json`
5. Deploy and copy the script hash

See `DEPLOYMENT_GUIDE.md` for detailed instructions.

#### Option B: Local Development (Recommended for Development)

```bash
# Install neo-express
npm install -g neo-express

# Create local chain
neo-express create --count 1

# Start local node
neo-express run

# Deploy to local chain
npm run deploy:local
```

Copy the script hash and add it to `.env`:
```env
RECEIVABLE_REGISTRY_CONTRACT_HASH=0x<your_hash>
```

**Note:** `npm run deploy` (TestNet) will fail with "Invalid params" - this is expected. Use manual deployment or `deploy:local` instead.

### InvoiceAsset Workflow (Local recommended)

```bash
# Compile
npm run compile:invoice

# Deploy locally (neo-express)
neo-express create --count 1   # first time only
neo-express run                # keep running in another shell
npm run deploy:invoice:local

# Invoke InvoiceAsset methods
npm run invoke:invoice
```

Set in `.env`:
```env
INVOICE_ASSET_CONTRACT_HASH=0x<hash_from_deploy>
```

### InvestorShare Workflow (Local recommended)

```bash
# Compile
npm run compile:investor

# Deploy locally (neo-express)
neo-express create --count 1   # first time only
neo-express run                # keep running in another shell
npm run deploy:investor:local

# Invoke InvestorShare methods
npm run invoke:investor
```

Set in `.env`:
```env
INVESTOR_SHARE_CONTRACT_HASH=0x<hash_from_deploy>
```

### ReceivableRegistryV2 Workflow (Local recommended)

```bash
# Compile
npm run compile:registry

# Deploy locally (neo-express)
neo-express create --count 1   # first time only
neo-express run                # keep running in another shell
npm run deploy:registry:local

# Invoke registry methods
npm run invoke:registry
```

Set in `.env`:
```env
RECEIVABLE_REGISTRY_V2_CONTRACT_HASH=0x<hash_from_deploy>
```

### Settlement Workflow (Local recommended)

```bash
# Prereq: invoice + investor + registry deployed and hashes in .env

# Orchestrate settlement (redeem investors, settle invoice, mark registry)
npm run invoke:settlement

# Optional: set different invoice/investors via env
SETTLEMENT_INVOICE_ID=INV-5001 SETTLEMENT_INVESTORS=INVESTOR-A,INVESTOR-B npm run invoke:settlement
```

### Step 5: Invoke Contract Methods

```bash
npm run invoke
```

This will:
1. **Register** a receivable with ID `INV-001`
2. **Read back** the receivable and display parsed fields

**Expected Output:**
```
==========================================
ReceivableRegistryV1 Contract Invocation
==========================================
Contract: 0x...
Account:  NQ...

1️⃣  Registering receivable INV-001...
📡 Called register → tx=0x...
   ✅ Register transaction sent

   ⏳ Waiting 5s for tx confirmation...

2️⃣  Reading back receivable INV-001...
   Raw record: Walmart|PeruvianAvocadosCo|100000|USD|20251231|registered|{"po": "PO-123", "notes": "demo"}
   Parsed record:
     buyer:    Walmart
     seller:   PeruvianAvocadosCo
     amount:   100000
     currency: USD
     due_date: 20251231
     status:   registered
     meta:     {"po": "PO-123", "notes": "demo"}

==========================================
Done!
==========================================
```

## npm Scripts

| Command                | Description                          |
| ---------------------- | ------------------------------------ |
| `npm run compile`      | Compile ReceivableRegistryV1         |
| `npm run deploy`       | Deploy to Neo N3 TestNet             |
| `npm run invoke`       | Invoke register + get_record         |
| `npm run generate-wallet` | Generate a new Neo N3 wallet      |

## Environment Variables

| Variable                          | Description                       |
| --------------------------------- | --------------------------------- |
| `NEO_WALLET_WIF`                  | WIF private key for TestNet       |
| `RECEIVABLE_REGISTRY_CONTRACT_HASH` | Deployed contract script hash   |
| `INVOICE_ASSET_CONTRACT_HASH`     | Deployed InvoiceAsset script hash |
| `INVESTOR_SHARE_CONTRACT_HASH`    | Deployed InvestorShare script hash |
| `RECEIVABLE_REGISTRY_V2_CONTRACT_HASH` | Deployed RegistryV2 script hash |

## Troubleshooting

### Compilation Errors

- **"boa command not found"**: Run `pip3 install neo3-boa`
- **"Contract file not found"**: Ensure `ReceivableRegistryV1.py` exists in `contracts/`

### Deployment Errors

- **"Missing NEO_WALLET_WIF"**: Add WIF to `.env`
- **"Insufficient GAS"**: Fund wallet at https://neotube.io/testnet
- **"Invalid params" or "Invalid signature"**: Public TestNet RPC nodes don't accept raw deployment transactions. Use manual wallet deployment (see `DEPLOYMENT_GUIDE.md`) or local neo-express node (`npm run deploy:local`)

### Invocation Errors

- **"Missing RECEIVABLE_REGISTRY_CONTRACT_HASH"**: Add hash to `.env` after deployment
- **Record not found**: Wait for tx confirmation (15-30 seconds on TestNet)

## Network Information

- **RPC Endpoint**: https://testnet1.neo.coz.io
- **Explorer**: https://testnet.neotube.io
- **Network**: Neo N3 TestNet
- **Network Magic**: 844378958
- **Faucet**: https://neotube.io/testnet

## Next Steps

After successful deployment:

1. Add more receivable methods (update status, transfer ownership)
2. Integrate with SpoonOS agents for automated workflows
3. Add NeoFS storage for invoice documents
4. Implement multi-party approvals

---

**CLI-only** • **Neo N3 TestNet** • **ReceivableRegistryV1**
