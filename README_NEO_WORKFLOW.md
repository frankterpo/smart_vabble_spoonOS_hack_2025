# Neo N3 Smart Contract Development Workflow (CLI Only)

Complete CLI workflow for developing, compiling, deploying, and invoking Neo N3 smart contracts on TestNet.

## Prerequisites

- macOS or Linux
- Python 3.12+ installed
- Node.js 16+ installed
- Neo N3 TestNet wallet with GAS (for deployment)

## Project Structure

```
vabs_v2/
├── contracts/
│   └── SimpleStorage.py          # Contract source code
├── build/                        # Compiled artifacts (created automatically)
│   ├── SimpleStorage.nef
│   ├── SimpleStorage.manifest.json
│   └── deployment.json          # Deployment info (created after deploy)
├── scripts/neo-workflow/
│   ├── compile.sh               # Compilation script
│   ├── generate-wallet.sh       # Wallet generation script
│   ├── deploy.js                # Deployment script
│   └── invoke.js                # Invocation script
└── .env                         # Environment variables (create this)
```

## Step-by-Step Workflow

### Step 1: Install Dependencies

```bash
# Install Python dependencies
pip3 install neo3-boa python-dotenv

# Install Node.js dependencies
npm install @cityofzion/neon-js dotenv
```

### Step 2: Generate Wallet (Optional)

If you need a new wallet:

```bash
cd scripts/neo-workflow
chmod +x generate-wallet.sh
./generate-wallet.sh
```

Copy the WIF from the output and add it to `.env`:

```bash
# Add to .env file
NEO_WALLET_WIF=<your_wif_here>
```

**Note:** If you already have a wallet (like the one provided: `NQGop9Bnj21Zq8foruvzsa1v7vxHiiRZEb`), convert the private key to WIF format or use the existing WIF.

### Step 3: Configure Environment

Create or update `.env` file in project root:

```bash
# .env
NEO_WALLET_WIF=L4W2zHU2q8DLi6yEMLasvVLNoBrZEzUCXjcXnWvbEoHntt7SDWMs
SIMPLE_STORAGE_CONTRACT_HASH=  # Will be populated after deployment
```

### Step 4: Compile Contract

```bash
cd scripts/neo-workflow
chmod +x compile.sh
./compile.sh
```

This will:
- Install neo3-boa if needed
- Compile `SimpleStorage.py`
- Output `build/SimpleStorage.nef` and `build/SimpleStorage.manifest.json`
- Display file hashes and sizes

**Expected Output:**
```
✓ Compilation successful!
Output files:
  NEF:      /path/to/build/SimpleStorage.nef
  Manifest: /path/to/build/SimpleStorage.manifest.json
```

### Step 5: Deploy Contract

```bash
cd scripts/neo-workflow
chmod +x deploy.js
node deploy.js
```

This will:
- Load WIF from `.env`
- Load compiled contract files from `build/`
- Create and sign deployment transaction
- Broadcast to Neo N3 TestNet
- Display transaction ID and script hash
- Save deployment info to `build/deployment.json`

**Expected Output:**
```
Deployment Successful!
Transaction ID: 0x...
Script Hash: 0x...
Explorer Link: https://testnet.neotube.io/transaction/0x...
```

**Important:** Copy the script hash and add it to `.env`:
```bash
SIMPLE_STORAGE_CONTRACT_HASH=0x<your_script_hash>
```

### Step 6: Invoke Contract Methods

```bash
cd scripts/neo-workflow
chmod +x invoke.js
node invoke.js
```

This will call:
1. `store("foo", "bar")` - Store a key-value pair
2. `retrieve("foo")` - Retrieve the stored value
3. `increment()` - Increment the counter
4. `counter()` - Get current counter value

**Expected Output:**
```
1. Calling store("foo", "bar")...
   ✓ Success

2. Calling retrieve("foo")...
   ✓ Retrieved value: "bar"

3. Calling increment()...
   ✓ Counter incremented to: 1

4. Calling counter()...
   ✓ Current counter value: 1
```

## Complete Command Sequence

Here's the complete sequence from scratch:

```bash
# 1. Install dependencies
pip3 install neo3-boa python-dotenv
npm install @cityofzion/neon-js dotenv

# 2. Create .env file (if not exists)
cat > .env << EOF
NEO_WALLET_WIF=L4W2zHU2q8DLi6yEMLasvVLNoBrZEzUCXjcXnWvbEoHntt7SDWMs
SIMPLE_STORAGE_CONTRACT_HASH=
EOF

# 3. Compile contract
cd scripts/neo-workflow
chmod +x compile.sh
./compile.sh

# 4. Deploy contract
chmod +x deploy.js
node deploy.js

# 5. Update .env with script hash from deployment output
# Edit .env and add: SIMPLE_STORAGE_CONTRACT_HASH=0x<hash>

# 6. Invoke contract
chmod +x invoke.js
node invoke.js
```

## Troubleshooting

### Compilation Errors

- **"boa command not found"**: Install neo3-boa: `pip3 install neo3-boa`
- **"Contract file not found"**: Ensure `SimpleStorage.py` exists in `contracts/` directory
- **Python version error**: Ensure Python 3.12+ is installed

### Deployment Errors

- **"NEO_WALLET_WIF not found"**: Add WIF to `.env` file
- **"Insufficient GAS"**: Fund your wallet on TestNet: https://neotube.io/testnet
- **"Contract files not found"**: Run `compile.sh` first
- **RPC errors**: Check network connectivity and RPC endpoint availability

### Invocation Errors

- **"SIMPLE_STORAGE_CONTRACT_HASH not found"**: Add script hash to `.env` after deployment
- **"Contract not found"**: Ensure contract was successfully deployed and confirmed
- **Invocation failures**: Check contract method names and parameters match the contract code

## Contract Methods

The `SimpleStorage` contract provides:

- `store(key: str, value: str) -> bool`: Store a key-value pair
- `retrieve(key: str) -> str`: Retrieve value by key
- `increment() -> int`: Increment counter and return new value
- `counter() -> int`: Get current counter value

## Network Information

- **RPC Endpoint**: https://testnet1.neo.coz.io
- **Explorer**: https://testnet.neotube.io
- **Network**: Neo N3 TestNet
- **Faucet**: https://neotube.io/testnet (for GAS)

## Next Steps

After successful deployment and invocation:

1. Modify `SimpleStorage.py` to add your own methods
2. Recompile and redeploy
3. Update invocation script to test new methods
4. Integrate with your Vabble contracts workflow

## Notes

- All scripts assume contract files are in `build/` directory
- Scripts automatically compute script hashes - no manual calculation needed
- Deployment info is saved to `build/deployment.json` for reference
- All operations are read-only invocations (no state changes) unless you modify `invoke.js` to send transactions

