import { rpc, sc, wallet, tx, u } from "@cityofzion/neon-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Local neo-express RPC (with full policy plugins)
const RPC_URL = process.env.NEO_LOCAL_RPC_URL || "http://localhost:5000";
const NETWORK_MAGIC = parseInt(process.env.NEO_LOCAL_MAGIC || "56753"); // Default neo-express magic

async function deploy() {
  try {
    console.log("🚀 Deploying ReceivableRegistryV1 to LOCAL neo-express node...");
    console.log(`   RPC: ${RPC_URL}`);
    console.log(`   Magic: ${NETWORK_MAGIC}`);

    // 1. Load WIF
    const wif = process.env.NEO_WALLET_WIF;
    if (!wif) throw new Error("Missing NEO_WALLET_WIF in .env");

    const account = new wallet.Account(wif);

    // 2. Resolve paths
    const scriptDir = path.dirname(new URL(import.meta.url).pathname);
    const projectRoot = path.resolve(scriptDir, '../..');
    const nefPath = path.join(projectRoot, 'build', 'ReceivableRegistryV1.nef');
    const manifestPath = path.join(projectRoot, 'build', 'ReceivableRegistryV1.manifest.json');

    // 3. Read compiled contract artefacts
    const nefBuffer = fs.readFileSync(nefPath);
    const manifestJson = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    const nef = sc.NEF.fromBuffer(nefBuffer);
    const manifest = sc.ContractManifest.fromJson(manifestJson);

    // 4. Build deployment script
    const sb = new sc.ScriptBuilder();
    sb.emitContractCall({
      scriptHash: u.HexString.fromHex("d2a4cff31913016155e38e474a2c6d7b", true), // ManagementContract
      operation: "deploy",
      callFlags: sc.CallFlags.All,
      args: [
        sc.ContractParam.byteArray(u.HexString.fromHex(nef.serialize(), true)),
        sc.ContractParam.string(JSON.stringify(manifest.toJson()))
      ]
    });

    const script = sb.build();
    const provider = new rpc.RPCClient(RPC_URL);
    const height = await provider.getBlockCount();

    // 5. Create and sign transaction
    const transaction = new tx.Transaction({
      signers: [{ account: account.scriptHash, scopes: tx.WitnessScope.CalledByEntry }],
      script: script,
      validUntilBlock: height + 50
    });

    transaction.sign(account, NETWORK_MAGIC);

    // 6. Broadcast transaction (local node accepts this)
    await provider.sendRawTransaction(transaction.serialize(true));
    
    console.log(`✅ Transaction broadcast!`);
    console.log(`📄 TXID: ${transaction.hash}`);
    console.log(`🔗 Local Explorer: http://localhost:5000/transaction/${transaction.hash}`);

    // 7. Calculate script hash
    const scriptHash = sc.Contract.getContractHash(
      account.scriptHash,
      nefBuffer,
      manifest.name
    );

    console.log("📦 ReceivableRegistryV1 Script Hash:", scriptHash);

    // 8. Save deployment info
    const deploymentPath = path.join(projectRoot, 'build', 'deployment.json');
    fs.writeFileSync(
      deploymentPath,
      JSON.stringify({
        contract: "ReceivableRegistryV1",
        txid: transaction.hash,
        scriptHash: scriptHash,
        nefPath: nefPath,
        manifestPath: manifestPath,
        deployedAt: new Date().toISOString(),
        network: "Local (neo-express)",
        rpcNode: RPC_URL
      }, null, 2)
    );

    console.log("💾 Saved deployment.json");
    console.log("");
    console.log("➡️  Add to .env: RECEIVABLE_REGISTRY_CONTRACT_HASH=" + scriptHash);
    console.log("");
    console.log("🎉 Deployment successful!");
    console.log("");
    console.log("💡 Note: This is deployed to your LOCAL neo-express node.");
    console.log("   For TestNet deployment, use manual wallet UI method (see DEPLOYMENT_GUIDE.md)");

  } catch (err) {
    console.error("❌ Error deploying contract:", err);
    if (err.message) console.error("Message:", err.message);
    if (err.stack) console.error(err.stack);
    console.log("");
    console.log("💡 Make sure neo-express is running:");
    console.log("   neo-express run");
    process.exit(1);
  }
}

deploy();

