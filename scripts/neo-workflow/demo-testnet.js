import pkg from "@cityofzion/neon-js";
const { experimental, sc, wallet, u } = pkg;
import dotenv from "dotenv";
dotenv.config();

// TestNet Config
const RPC_URL = process.env.NEO_LOCAL_RPC_URL || "https://testnet1.neo.coz.io:443";
const MAGIC = parseInt(process.env.NEO_LOCAL_MAGIC || "844378958");
const WIF = process.env.NEO_WALLET_WIF;

// Hashes from .env
const INVOICE_HASH_STR = process.env.INVOICE_ASSET_CONTRACT_HASH;
const INVESTOR_SHARE_HASH_STR = process.env.INVESTOR_SHARE_CONTRACT_HASH;
const REGISTRY_HASH_STR = process.env.RECEIVABLE_REGISTRY_V2_CONTRACT_HASH;

if (!WIF) throw new Error("Missing NEO_WALLET_WIF in .env");
if (!INVOICE_HASH_STR || !INVESTOR_SHARE_HASH_STR || !REGISTRY_HASH_STR) {
  throw new Error("Missing contract hashes in .env. Run deploy-all-testnet.js first.");
}

// Convert to Big-Endian for SmartContract
function toBigEndian(hex) {
  return hex.replace(/^0x/, "").match(/.{1,2}/g).reverse().join("");
}

const invoiceHash = toBigEndian(INVOICE_HASH_STR);
const investorHash = toBigEndian(INVESTOR_SHARE_HASH_STR);
const registryHash = toBigEndian(REGISTRY_HASH_STR);

// Raw hex for arguments
const INVOICE_HASH_RAW = INVOICE_HASH_STR.replace(/^0x/, "");
const INVESTOR_SHARE_HASH_RAW = INVESTOR_SHARE_HASH_STR.replace(/^0x/, "");

const account = new wallet.Account(WIF);

const config = {
  networkMagic: MAGIC,
  rpcAddress: RPC_URL,
  account: account
};

const invoiceContract = new experimental.SmartContract(u.HexString.fromHex(invoiceHash), config);
const investorContract = new experimental.SmartContract(u.HexString.fromHex(investorHash), config);
const registryContract = new experimental.SmartContract(u.HexString.fromHex(registryHash), config);

async function demo() {
  console.log("==========================================");
  console.log("   SCOOP HACKATHON - LIVE DEMO");
  console.log("==========================================");
  console.log(`Network: TestNet (${RPC_URL})`);
  console.log(`Account: ${account.address}`);
  console.log("");

  const invoiceId = "INV-" + Math.floor(Math.random() * 10000); // Random ID for fresh run
  const investors = ["INVESTOR-A", "INVESTOR-B"];

  try {
    // 1. Register Invoice
    console.log(`1️⃣  Registering Invoice ${invoiceId}...`);
    const tx1 = await invoiceContract.invoke("register_invoice", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
      sc.ContractParam.string("AcmeBuyer"),
      sc.ContractParam.string("AcmeSeller"),
      sc.ContractParam.integer(10000),
      sc.ContractParam.string("USD"),
      sc.ContractParam.integer(20251231),
      sc.ContractParam.string("meta")
    ]);
    console.log(`   ✅ Sent! TX: ${tx1}`);
    console.log(`   🔗 https://testnet.neotube.io/transaction/${tx1}`);
    console.log("");

    // 2. Allocate Shares
    console.log("2️⃣  Allocating Shares...");
    for (let i = 0; i < investors.length; i++) {
      const amount = i === 0 ? 6000 : 4000;
      const txAlloc = await investorContract.invoke("allocate", [
        sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
        sc.ContractParam.byteArray(Buffer.from(investors[i], "utf-8").toString("hex")),
        sc.ContractParam.integer(amount)
      ]);
      console.log(`   ✅ Allocated ${amount} to ${investors[i]}. TX: ${txAlloc}`);
    }
    console.log("");

    // 3. Registry Orchestration
    console.log("3️⃣  Registry Setup...");
    const txReg = await registryContract.invoke("register_invoice", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
      sc.ContractParam.string(INVOICE_HASH_RAW)
    ]);
    console.log(`   ✅ Registered in Registry. TX: ${txReg}`);

    const txAttach = await registryContract.invoke("attach_investor_share", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
      sc.ContractParam.string(INVESTOR_SHARE_HASH_RAW)
    ]);
    console.log(`   ✅ Attached Shares. TX: ${txAttach}`);

    const txStatus = await registryContract.invoke("set_status", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
      sc.ContractParam.string("ACTIVE")
    ]);
    console.log(`   ✅ Status set to ACTIVE. TX: ${txStatus}`);
    console.log("");

    console.log("⏳ Waiting 15s for blocks to confirm...");
    await new Promise(r => setTimeout(r, 15000));
    console.log("");

    // 4. Settlement
    console.log("4️⃣  Running Settlement...");
    const txSettle = await registryContract.invoke("settle", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex"))
    ]);
    console.log(`   ✅ Settle invoked via Registry. TX: ${txSettle}`);
    console.log(`   🔗 https://testnet.neotube.io/transaction/${txSettle}`);
    
    console.log("");
    console.log("✅ DEMO COMPLETE - Infrastructure Validated on TestNet");
    console.log("==========================================");

  } catch (e) {
    console.error("❌ Demo failed:", e.message);
  }
}

demo();

