import pkg from "@cityofzion/neon-js";
const { experimental, sc, wallet, u } = pkg;
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// TestNet Config
const RPC_URL = process.env.NEO_LOCAL_RPC_URL || "https://testnet1.neo.coz.io:443";
const MAGIC = parseInt(process.env.NEO_LOCAL_MAGIC || "844378958");
const WIF = process.env.NEO_WALLET_WIF;

if (!WIF) throw new Error("Missing NEO_WALLET_WIF in .env");

const account = new wallet.Account(WIF);

// Helper to reverse hex (Little Endian -> Big Endian)
function reverseHex(hex) {
  return hex.match(/.{1,2}/g).reverse().join("");
}

// Helper to compute contract hash from NEF + Manifest + Sender (standard Neo method)
// Note: experimental.deployContract returns the transaction hash, not the contract hash directly in some versions.
// We calculate it manually to be sure.
function computeContractHash(senderScriptHash, nefChecksum, contractName) {
  const sb = new sc.ScriptBuilder();
  sb.emit(sc.OpCode.ABORT);
  sb.emitPush(senderScriptHash);
  sb.emitPush(nefChecksum);
  sb.emitPush(contractName);
  const assembled = sb.build();
  return u.reverseHex(u.hash160(assembled));
}

async function deployContract(name, nefFile, manifestFile) {
  console.log(`\n🚀 Deploying ${name}...`);
  
  const projectRoot = path.resolve("./");
  const nefPath = path.join(projectRoot, "build", nefFile);
  const manifestPath = path.join(projectRoot, "build", manifestFile);

  if (!fs.existsSync(nefPath) || !fs.existsSync(manifestPath)) {
    throw new Error(`Missing build artifacts for ${name}. Run 'npm run compile:${name.toLowerCase()}' first.`);
  }

  const nefBuffer = fs.readFileSync(nefPath);
  const manifestJson = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  
  const nef = sc.NEF.fromBuffer(nefBuffer);
  const manifest = sc.ContractManifest.fromJson(manifestJson);

  try {
    const result = await experimental.deployContract(
      nef,
      manifest,
      {
        networkMagic: MAGIC,
        rpcAddress: RPC_URL,
        account: account
      }
    );

    console.log(`   ✅ Sent! TXID: ${result}`);
    console.log(`   🔗 Explorer: https://testnet.neotube.io/transaction/${result}`);

    const scriptHash = computeContractHash(account.scriptHash, nef.checksum, manifest.name);
    console.log(`   📦 Contract Hash (LE): 0x${scriptHash}`);
    
    return scriptHash;
  } catch (e) {
    console.error(`   ❌ Failed to deploy ${name}:`, e.message);
    if (e.message.includes("Contract Already Exists")) {
       const scriptHash = computeContractHash(account.scriptHash, nef.checksum, manifest.name);
       console.log(`   ⚠️  Contract already exists. Hash: 0x${scriptHash}`);
       return scriptHash;
    }
    throw e;
  }
}

async function main() {
  console.log("==========================================");
  console.log("   SCOOP HACKATHON - TESTNET DEPLOYER");
  console.log("==========================================");
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Magic: ${MAGIC}`);
  console.log(`Deployer: ${account.address}`);

  try {
    const invoiceHash = await deployContract("InvoiceAsset", "InvoiceAsset.nef", "InvoiceAsset.manifest.json");
    const investorHash = await deployContract("InvestorShare", "InvestorShare.nef", "InvestorShare.manifest.json");
    const registryHash = await deployContract("ReceivableRegistryV2", "ReceivableRegistryV2.nef", "ReceivableRegistryV2.manifest.json");

    console.log("\n==========================================");
    console.log("✅ DEPLOYMENT COMPLETE");
    console.log("==========================================");
    console.log("Update your .env with these values:\n");
    console.log(`INVOICE_ASSET_CONTRACT_HASH=0x${invoiceHash}`);
    console.log(`INVESTOR_SHARE_CONTRACT_HASH=0x${investorHash}`);
    console.log(`RECEIVABLE_REGISTRY_V2_CONTRACT_HASH=0x${registryHash}`);
    console.log("\nThen run: node scripts/neo-workflow/demo-testnet.js");

  } catch (e) {
    console.error("\n❌ Deployment failed:", e);
  }
}

main();

