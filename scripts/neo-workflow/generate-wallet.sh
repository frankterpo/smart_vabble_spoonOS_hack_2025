#!/bin/bash
set -e

echo "🔐 Generating Neo N3 wallet..."

node << 'EOF'
const { wallet } = require("@cityofzion/neon-js");

const acct = new wallet.Account();
console.log("Address:", acct.address);
console.log("Public Key:", acct.publicKey);
console.log("Private Key (HEX):", acct.privateKey);
console.log("WIF:", acct.WIF);
EOF

echo "➡️ Add the WIF to .env as NEO_WALLET_WIF="
