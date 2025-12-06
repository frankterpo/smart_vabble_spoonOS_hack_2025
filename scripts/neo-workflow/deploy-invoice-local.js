import pkg from "@cityofzion/neon-js";
const { experimental, sc, wallet, u } = pkg;
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Local neo-express RPC (with full policy plugins)
const RPC_URL = process.env.NEO_LOCAL_RPC_URL || "http://localhost:50012";
const NETWORK_MAGIC = parseInt(process.env.NEO_LOCAL_MAGIC || "672132064"); // neo-express default

function computeContractHash(senderScriptHash, nefChecksum, contractName) {
  const sb = new sc.ScriptBuilder();
  sb.emit(sc.OpCode.ABORT);
  sb.emitPush(senderScriptHash);
  sb.emitPush(nefChecksum);
  sb.emitPush(contractName);
  const assembled = sb.build();
  return u.reverseHex(u.hash160(assembled));
}

async function deploy() {
  try {
    console.log("🚀 Deploying InvoiceAsset to LOCAL neo-express node...");
    console.log(`   RPC: ${RPC_URL}`);
    console.log(`   Magic: ${NETWORK_MAGIC}`);

    const wif = process.env.NEO_WALLET_WIF;
    if (!wif) throw new Error("Missing NEO_WALLET_WIF in .env");

    const account = new wallet.Account(wif);

    const scriptDir = path.dirname(new URL(import.meta.url).pathname);
    const projectRoot = path.resolve(scriptDir, "../..");
    const nefPath = path.join(projectRoot, "build", "InvoiceAsset.nef");
    const manifestPath = path.join(projectRoot, "build", "InvoiceAsset.manifest.json");

    const nefBuffer = fs.readFileSync(nefPath);
    const manifestJson = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    const nef = sc.NEF.fromBuffer(nefBuffer);
    const manifest = sc.ContractManifest.fromJson(manifestJson);

    const result = await experimental.deployContract(
      nef,
      manifest,
      {
        rpcAddress: RPC_URL,
        account,
        networkMagic: NETWORK_MAGIC,
        signers: [{ account: account.scriptHash, scopes: "CalledByEntry" }]
      }
    );

    if (!result) {
      throw new Error(`Deployment failed: ${JSON.stringify(result)}`);
    }

    console.log(`✅ Transaction broadcast!`);
    console.log(`📄 TXID: ${result}`);
    console.log(`🔗 Local Explorer (neo-express RPC): ${RPC_URL}/transaction/${result}`);

    const scriptHash = computeContractHash(account.scriptHash, nef.checksum, manifest.name);

    console.log("📦 InvoiceAsset Script Hash:", scriptHash);

    const deploymentPath = path.join(projectRoot, "build", "invoice-deployment.json");
    fs.writeFileSync(
      deploymentPath,
      JSON.stringify({
        contract: "InvoiceAsset",
        txid: result,
        scriptHash: scriptHash,
        nefPath: nefPath,
        manifestPath: manifestPath,
        deployedAt: new Date().toISOString(),
        network: "Local (neo-express)",
        rpcNode: RPC_URL
      }, null, 2)
    );

    console.log("💾 Saved invoice-deployment.json");
    console.log("");
    console.log("➡️  Add to .env: INVOICE_ASSET_CONTRACT_HASH=" + scriptHash);
    console.log("");
    console.log("🎉 Deployment successful (LOCAL)!");

  } catch (err) {
    console.error("❌ Error deploying contract:", err);
    if (err.message) console.error("Message:", err.message);
    if (err.stack) console.error(err.stack);
    console.log("");
    console.log("💡 Make sure neo-express is running: neo-express run");
    process.exit(1);
  }
}

deploy();
