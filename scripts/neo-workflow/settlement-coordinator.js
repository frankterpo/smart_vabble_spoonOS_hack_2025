import pkg from "@cityofzion/neon-js";
const { experimental, sc, wallet, u } = pkg;
import dotenv from "dotenv";
dotenv.config();

const rpcNode = process.env.NEO_LOCAL_RPC_URL || "http://localhost:50012";
const WIF = process.env.NEO_WALLET_WIF;
const INVOICE_HASH_STR = process.env.INVOICE_ASSET_CONTRACT_HASH;
const INVESTOR_SHARE_HASH_STR = process.env.INVESTOR_SHARE_CONTRACT_HASH;
const REGISTRY_HASH_STR = process.env.RECEIVABLE_REGISTRY_V2_CONTRACT_HASH;

if (!WIF) throw new Error("Missing NEO_WALLET_WIF in .env!");
if (!INVOICE_HASH_STR) throw new Error("Missing INVOICE_ASSET_CONTRACT_HASH in .env!");
if (!INVESTOR_SHARE_HASH_STR) throw new Error("Missing INVESTOR_SHARE_CONTRACT_HASH in .env!");
if (!REGISTRY_HASH_STR) throw new Error("Missing RECEIVABLE_REGISTRY_V2_CONTRACT_HASH in .env!");

// Convert hashes from LE to BE for SmartContract
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
const magic = parseInt(process.env.NEO_LOCAL_MAGIC || "672132064");

const config = {
  networkMagic: magic,
  rpcAddress: rpcNode,
  account: account
};

const invoiceContract = new experimental.SmartContract(u.HexString.fromHex(invoiceHash), config);
const investorContract = new experimental.SmartContract(u.HexString.fromHex(investorHash), config);
const registryContract = new experimental.SmartContract(u.HexString.fromHex(registryHash), config);

function decodeResult(rawValue) {
  if (rawValue == null) return "";
  let decoded = rawValue;
  if (typeof rawValue === 'string' && rawValue.length > 0) {
    try { decoded = Buffer.from(rawValue, 'base64').toString('utf8'); }
    catch (e) { decoded = rawValue; }
  } else if (Buffer.isBuffer(rawValue)) {
    decoded = rawValue.toString('utf8');
  }
  return decoded;
}

async function getShare(invoiceId, investorId) {
  const res = await investorContract.testInvoke("get_share", [
    sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
    sc.ContractParam.byteArray(Buffer.from(investorId, "utf-8").toString("hex"))
  ]);
  if (res.state === "HALT" && res.stack && res.stack.length > 0) {
    return decodeResult(res.stack[0].value); // "alloc|redeemed|available"
  }
  return "";
}

async function settleInvoice(invoiceId, investors) {
  console.log("==========================================");
  console.log("Settlement Coordinator - End-to-End Demo");
  console.log("==========================================");
  console.log(`Invoice: ${invoiceId}`);
  console.log(`Account: ${account.address}`);
  console.log("");

  try {
    // ==========================================
    // PHASE 1: Setup Test Data
    // ==========================================
    console.log("📋 PHASE 1: Setting up test data...");
    console.log("");

    // 1. Register invoice in InvoiceAsset
    console.log("1️⃣  Registering invoice in InvoiceAsset...");
    const tx1 = await invoiceContract.invoke("register_invoice", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
      sc.ContractParam.string("AcmeBuyer"),
      sc.ContractParam.string("AcmeSeller"),
      sc.ContractParam.integer(10000),
      sc.ContractParam.string("USD"),
      sc.ContractParam.integer(20251231),
      sc.ContractParam.string("meta")
    ]);
    console.log("   ✅ register_invoice sent:", tx1);

    // 2. Allocate shares in InvestorShare
    console.log("2️⃣  Allocating shares in InvestorShare...");
    for (let i = 0; i < investors.length; i++) {
      const amount = i === 0 ? 6000 : 4000; // First investor gets 6000, second gets 4000
      console.log(`   Allocating ${amount} to ${investors[i]}...`);
      const txAlloc = await investorContract.invoke("allocate", [
        sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
        sc.ContractParam.byteArray(Buffer.from(investors[i], "utf-8").toString("hex")),
        sc.ContractParam.integer(amount)
      ]);
      console.log("   ✅ allocated:", txAlloc);
    }

    // 3. Register invoice in RegistryV2
    console.log("3️⃣  Registering invoice in ReceivableRegistryV2...");
    const txReg = await registryContract.invoke("register_invoice", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
      sc.ContractParam.string(INVOICE_HASH_RAW)
    ]);
    console.log("   ✅ registered in registry:", txReg);

    // 4. Attach investor share contract
    console.log("4️⃣  Attaching investor share contract...");
    const txAttach = await registryContract.invoke("attach_investor_share", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
      sc.ContractParam.string(INVESTOR_SHARE_HASH_RAW)
    ]);
    console.log("   ✅ attached shares:", txAttach);

    // 5. Set status to ACTIVE
    console.log("5️⃣  Setting registry status to ACTIVE...");
    const txStatus = await registryContract.invoke("set_status", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
      sc.ContractParam.string("ACTIVE")
    ]);
    console.log("   ✅ status active:", txStatus);

    console.log("");
    console.log("✅ Test data setup complete! Waiting for blocks...");
    // Wait a bit for persistence (neo-express is fast but let's be safe)
    await new Promise(r => setTimeout(r, 2000));
    console.log("");

    // ==========================================
    // PHASE 2: Settlement Orchestration
    // ==========================================
    console.log("💰 PHASE 2: Running settlement orchestration...");
    console.log("");

    // 1. Read allocations/available per investor
    console.log("1️⃣  Reading investor allocations...");
    const payouts = [];
    for (const inv of investors) {
      const share = await getShare(invoiceId, inv);
      let available = 0;
      if (share && share.indexOf("|") >= 0) {
        const parts = share.split("|");
        if (parts.length >= 3) {
          available = parseInt(parts[2]) || 0;
        }
      }
      payouts.push({ investor: inv, available });
    }

    console.log("   Planned payouts:");
    payouts.forEach(p => console.log(`   - ${p.investor}: ${p.available}`));
    console.log("");

    // 2. Redeem for each investor
    console.log("2️⃣  Redeeming shares for investors...");
    for (const p of payouts) {
      if (p.available > 0) {
        console.log(`   Redeeming ${p.available} for ${p.investor}...`);
        const txRedeem = await investorContract.invoke("redeem", [
          sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
          sc.ContractParam.byteArray(Buffer.from(p.investor, "utf-8").toString("hex")),
          sc.ContractParam.integer(p.available)
        ]);
        console.log("   ✅ redeemed:", txRedeem);
      }
    }
    console.log("");

    // 3. Settle invoice asset
    console.log("3️⃣  Settling invoice asset...");
    const txSettleInv = await invoiceContract.invoke("settle_invoice", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex"))
    ]);
    console.log("   ✅ invoice settled:", txSettleInv);
    console.log("");

    // 4. Settle registry
    console.log("4️⃣  Settling registry...");
    const txSettleReg = await registryContract.invoke("settle", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex"))
    ]);
    console.log("   ✅ registry settled:", txSettleReg);
    console.log("");

    await new Promise(r => setTimeout(r, 2000));

    // ==========================================
    // PHASE 3: Final Status Report
    // ==========================================
    console.log("📊 PHASE 3: Final status report...");
    console.log("");

    // Get final invoice status
    // Note: get_invoice returns raw bytes, need to decode or check logic
    // Assuming it returns the status string or struct. 
    // InvoiceAsset.py: get_invoice returns storage.get(key) -> bytes.
    // We might not be able to easily decode unless we know the format.
    // Let's just call get_status if available, or rely on registry status.
    
    // Registry status
    const registryStatusRes = await registryContract.testInvoke("get_status", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex"))
    ]);
    if (registryStatusRes.state === "HALT" && registryStatusRes.stack && registryStatusRes.stack.length > 0) {
      console.log("   RegistryV2 status:", decodeResult(registryStatusRes.stack[0].value));
    }

    // Get final share statuses
    console.log("   Final investor shares:");
    for (const inv of investors) {
      const share = await getShare(invoiceId, inv);
      console.log(`   - ${inv}: ${share || "N/A"}`);
    }

    console.log("");
    console.log("✅ Settlement complete!");
  } catch (e) {
    console.error("❌ Failed:", e);
  }
  console.log("==========================================");
}

(async () => {
  const invoiceId = process.env.SETTLEMENT_INVOICE_ID || "INV-4001";
  const investorsEnv = process.env.SETTLEMENT_INVESTORS || "INVESTOR-A,INVESTOR-B";
  const investors = investorsEnv.split(",").map(s => s.trim()).filter(Boolean);
  await settleInvoice(invoiceId, investors);
})();
