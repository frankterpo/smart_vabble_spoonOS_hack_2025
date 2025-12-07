/**
 * Deploy ALL contracts to local neo-express
 * Usage: node scripts/neo-workflow/deploy-all-local.js
 */

import pkg from "@cityofzion/neon-js";
const { experimental, sc, wallet, u } = pkg;
import fs from "fs";
import path from "path";
import os from "os";
import dotenv from "dotenv";

dotenv.config();

// LOCAL neo-express config
const RPC_URL = "http://localhost:50012";

// Auto-detect magic from neo-express config
let MAGIC = 677225975;
try {
    const configPath = path.join(os.homedir(), '.neo-express', 'default.neo-express');
    const neoExpressConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    MAGIC = neoExpressConfig.magic;
    console.log(`📡 Detected neo-express magic: ${MAGIC}`);
} catch (e) {
    console.log(`⚠️  Using default magic: ${MAGIC}`);
}
const WIF = process.env.NEO_WALLET_WIF;

if (!WIF) throw new Error("Missing NEO_WALLET_WIF in .env");

const account = new wallet.Account(WIF);

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
    const projectRoot = path.resolve("./");
    const nefPath = path.join(projectRoot, "build", nefFile);
    const manifestPath = path.join(projectRoot, "build", manifestFile);

    if (!fs.existsSync(nefPath)) {
        console.log(`⚠️  Skipping ${name} - NEF not found`);
        return null;
    }

    const nefBuffer = fs.readFileSync(nefPath);
    const manifestJson = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    const nef = sc.NEF.fromBuffer(nefBuffer);
    const manifest = sc.ContractManifest.fromJson(manifestJson);

    try {
        console.log(`🚀 Deploying ${name}...`);
        
        const result = await experimental.deployContract(
            nef,
            manifest,
            {
                networkMagic: MAGIC,
                rpcAddress: RPC_URL,
                account: account
            }
        );

        const scriptHash = computeContractHash(account.scriptHash, nef.checksum, manifest.name);
        console.log(`✅ ${name} deployed!`);
        console.log(`   TXID: ${result}`);
        console.log(`   Hash: 0x${scriptHash}`);
        console.log("");
        
        return { name, txid: result, hash: `0x${scriptHash}` };
    } catch (e) {
        if (e.message.includes("Contract Already Exists")) {
            const scriptHash = computeContractHash(account.scriptHash, nef.checksum, manifest.name);
            console.log(`⚠️  ${name} already exists. Hash: 0x${scriptHash}`);
            return { name, hash: `0x${scriptHash}`, existing: true };
        } else {
            console.error(`❌ ${name} failed:`, e.message);
            return null;
        }
    }
}

async function main() {
    console.log("==========================================");
    console.log("   VABBLE - LOCAL NEO-EXPRESS DEPLOY");
    console.log("==========================================");
    console.log(`RPC: ${RPC_URL}`);
    console.log(`Magic: ${MAGIC}`);
    console.log(`Deployer: ${account.address}`);
    console.log("");

    const contracts = [
        { name: "InvoiceAsset", nef: "InvoiceAsset.nef", manifest: "InvoiceAsset.manifest.json" },
        { name: "InvestorShare", nef: "InvestorShare.nef", manifest: "InvestorShare.manifest.json" },
        { name: "ReceivableRegistryV2", nef: "ReceivableRegistryV2.nef", manifest: "ReceivableRegistryV2.manifest.json" },
        { name: "ExporterRegistry", nef: "ExporterRegistry.nef", manifest: "ExporterRegistry.manifest.json" },
        { name: "ImporterTerms", nef: "ImporterTerms.nef", manifest: "ImporterTerms.manifest.json" },
        { name: "DDRegistry", nef: "DDRegistry.nef", manifest: "DDRegistry.manifest.json" },
    ];

    const results = [];
    for (const c of contracts) {
        const result = await deployContract(c.name, c.nef, c.manifest);
        if (result) results.push(result);
        await new Promise(r => setTimeout(r, 1000)); // Wait for block
    }

    console.log("");
    console.log("==========================================");
    console.log("   DEPLOYMENT SUMMARY");
    console.log("==========================================");
    console.log("");
    console.log("Add to .env.local:");
    console.log("");
    console.log("NEO_LOCAL_RPC_URL=http://localhost:50012");
    console.log("NEO_LOCAL_MAGIC=677225975");
    console.log("");
    
    for (const r of results) {
        const envKey = r.name.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '') + "_CONTRACT_HASH";
        console.log(`${envKey}=${r.hash}`);
    }

    // Save to file
    fs.writeFileSync(
        "./build/local-deployment.json",
        JSON.stringify(results, null, 2)
    );
    console.log("");
    console.log("💾 Saved to build/local-deployment.json");
}

main();

