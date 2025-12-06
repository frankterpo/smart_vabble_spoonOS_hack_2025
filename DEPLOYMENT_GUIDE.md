# ReceivableRegistryV1 Deployment Guide

## Quick Manual Deployment (Fastest - ~2 minutes)

Since public Neo N3 TestNet RPC nodes don't accept raw deployment transactions without policy plugins, use a wallet UI for the initial deployment.

### Step 1: Prepare Files

Your compiled contract files are already ready:
- `build/ReceivableRegistryV1.nef`
- `build/ReceivableRegistryV1.manifest.json`

InvoiceAsset artifacts (compile first):
- `build/InvoiceAsset.nef`
- `build/InvoiceAsset.manifest.json`

InvestorShare artifacts (compile first):
- `build/InvestorShare.nef`
- `build/InvestorShare.manifest.json`

ReceivableRegistryV2 artifacts (compile first):
- `build/ReceivableRegistryV2.nef`
- `build/ReceivableRegistryV2.manifest.json`

InvestorShare artifacts (compile first):
- `build/InvestorShare.nef`
- `build/InvestorShare.manifest.json`

### Step 2: Deploy via NeoLine Wallet

1. **Install NeoLine Extension** (if not already installed)
   - Chrome: https://chrome.google.com/webstore/detail/neoline/cphhlgmgameodnhkjdmkrap
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/neoline/

2. **Connect to Neo N3 TestNet**
   - Open NeoLine extension
   - Switch network to "Neo N3 TestNet"
   - Import your wallet using the WIF from `.env` (or create a new one)

3. **Deploy Contract**
   - Click "Contract" → "Deploy Contract"
   - Upload NEF + manifest (ReceivableRegistryV1 or InvoiceAsset)
   - Click "Deploy"
   - Confirm transaction

4. **Copy Script Hash**
   - After deployment succeeds, copy the contract script hash
   - It will look like: `0x1234567890abcdef...`

### Step 3: Update .env

```bash
RECEIVABLE_REGISTRY_CONTRACT_HASH=0x<your_script_hash_here>
INVOICE_ASSET_CONTRACT_HASH=0x<your_script_hash_here>
INVESTOR_SHARE_CONTRACT_HASH=0x<your_script_hash_here>
RECEIVABLE_REGISTRY_V2_CONTRACT_HASH=0x<your_script_hash_here>
```

### Step 4: Test Invocation

```bash
npm run invoke
```

You should see:
```
✅ Register transaction sent
✅ get_record() returns the receivable data
```

---

## Local Development with neo-express (Recommended for Development)

For reliable automated deployments during development, use neo-express (local Neo N3 node with full policy plugins).

### Step 1: Install neo-express

```bash
npm install -g neo-express
```

Or using npx (no global install):
```bash
npx neo-express --version
```

### Step 2: Create Local Chain

```bash
cd /Users/franciscoterpolilli/Projects/vabs_v2
neo-express create --count 1
```

This creates:
- `.neo-express/` directory
- A local blockchain with 1 node
- Default wallet with GAS

### Step 3: Get Network Magic

```bash
cat .neo-express/data/protocol.json | grep -A 1 "Network"
```

Or check `.neo-express/data/settings.json` for the magic number.

### Step 4: Start Local Node

```bash
neo-express run
```

This starts the RPC server at `http://localhost:5000`

### Step 5: Fund Your Account (if needed)

```bash
neo-express transfer --from genesis --to <your_address> --amount 1000 --asset GAS
```

### Step 6: Deploy Locally

```bash
# ReceivableRegistryV1
npm run deploy:local

# InvoiceAsset
npm run deploy:invoice:local

# InvestorShare
npm run deploy:investor:local

# ReceivableRegistryV2
npm run deploy:registry:local

# Settlement (orchestration script, no deploy)
npm run invoke:settlement
```

Deployment will succeed because the local node has full policy plugins enabled.

---

## Alternative: COZ Wallet Deployment

If you prefer COZ Wallet:

1. Go to https://neotube.io/testnet
2. Connect wallet
3. Navigate to "Deploy Contract"
4. Upload NEF and manifest files
5. Deploy and copy script hash

---

## Troubleshooting

### "Invalid params" or "Invalid signature"
- ✅ Use manual deployment (wallet UI) for TestNet
- ✅ Use neo-express for local development
- ❌ Don't use raw RPC deployment on public TestNet nodes

### Contract already deployed
- If you try to deploy the same contract twice, it will fail
- Use a different account or update the contract name/version

### Script hash mismatch
- Ensure you're using the correct script hash from the deployment transaction
- Check the explorer link to verify the contract address

---

## Next Steps After Deployment

1. ✅ Contract deployed (manual or neo-express)
2. ✅ Script hash added to `.env`
3. ✅ Run `npm run invoke` to test
4. ✅ Integrate with your agents/CLI tools
5. ✅ Build frontend/API on top of the deployed contract

