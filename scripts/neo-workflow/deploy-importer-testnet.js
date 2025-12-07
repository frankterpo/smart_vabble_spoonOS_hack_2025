import pkg from "@cityofzion/neon-js";
const { experimental, sc, wallet, u } = pkg;
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// TestNet Config
const RPC_URL = process.env.NEO_LOCAL_RPC_URL || "https://testnet1.neo.coz.io:443";
const MAGIC = parseInt(process.env.NEO_LOCAL_MAGIC || "894710606");
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

async function deploy() {
    console.log("==========================================");
    console.log("   IMPORTER TERMS - TESTNET DEPLOY");
    console.log("==========================================");
    console.log(`RPC: ${RPC_URL}`);
    console.log(`Magic: ${MAGIC}`);
    console.log(`Deployer: ${account.address}`);
    console.log("");

    const projectRoot = path.resolve("./");
    const nefPath = path.join(projectRoot, "build", "ImporterTerms.nef");
    const manifestPath = path.join(projectRoot, "build", "ImporterTerms.manifest.json");

    if (!fs.existsSync(nefPath) || !fs.existsSync(manifestPath)) {
        throw new Error("Missing build artifacts. Run 'npm run compile:importer' first.");
    }

    const nefBuffer = fs.readFileSync(nefPath);
    const manifestJson = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    const nef = sc.NEF.fromBuffer(nefBuffer);
    const manifest = sc.ContractManifest.fromJson(manifestJson);

    try {
        console.log("🚀 Deploying ImporterTerms...");
        
        const result = await experimental.deployContract(
            nef,
            manifest,
            {
                networkMagic: MAGIC,
                rpcAddress: RPC_URL,
                account: account
            }
        );

        console.log(`✅ Sent! TXID: ${result}`);
        console.log(`🔗 Explorer: https://testnet.neotube.io/transaction/${result}`);

        const scriptHash = computeContractHash(account.scriptHash, nef.checksum, manifest.name);
        console.log(`📦 Contract Hash (LE): 0x${scriptHash}`);

        console.log("");
        console.log("Add to your .env:");
        console.log(`IMPORTER_TERMS_CONTRACT_HASH=0x${scriptHash}`);

        fs.writeFileSync(
            "./build/importer-deployment.json",
            JSON.stringify({ txid: result, scriptHash: `0x${scriptHash}` }, null, 2)
        );
        console.log("💾 Saved to build/importer-deployment.json");

    } catch (e) {
        if (e.message.includes("Contract Already Exists")) {
            const scriptHash = computeContractHash(account.scriptHash, nef.checksum, manifest.name);
            console.log(`⚠️  Contract already exists. Hash: 0x${scriptHash}`);
            console.log(`IMPORTER_TERMS_CONTRACT_HASH=0x${scriptHash}`);
        } else {
            console.error("❌ Deploy failed:", e.message);
        }
    }
}

deploy();

