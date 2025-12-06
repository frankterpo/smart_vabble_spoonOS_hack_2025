import pkg from "@cityofzion/neon-js";
const { experimental, sc, wallet, u } = pkg;
import dotenv from "dotenv";
dotenv.config();

const rpcNode = process.env.NEO_LOCAL_RPC_URL || "http://localhost:50012";
const WIF = process.env.NEO_WALLET_WIF;
const INVOICE_HASH_STR = process.env.INVOICE_ASSET_CONTRACT_HASH;

if (!WIF) throw new Error("Missing NEO_WALLET_WIF in .env!");
if (!INVOICE_HASH_STR) throw new Error("Missing INVOICE_ASSET_CONTRACT_HASH in .env!");

// Convert LE hash from .env to BE for neon-js
function toBigEndian(hex) {
  return hex.replace(/^0x/, "").match(/.{1,2}/g).reverse().join("");
}
const contractHash = toBigEndian(INVOICE_HASH_STR);

const account = new wallet.Account(WIF);
const magic = parseInt(process.env.NEO_LOCAL_MAGIC || "672132064");

const config = {
  networkMagic: magic,
  rpcAddress: rpcNode,
  account: account
};

const contract = new experimental.SmartContract(u.HexString.fromHex(contractHash), config);

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

(async () => {
  console.log("==========================================");
  console.log("InvoiceAsset Contract Invocation");
  console.log("==========================================");
  console.log(`Contract: ${INVOICE_HASH_STR}`);
  console.log(`Account:  ${account.address}`);
  console.log("");

  try {
    // 1. Register invoice
    console.log("1️⃣  Registering invoice INV-1001...");
    const tx1 = await contract.invoke("register_invoice", [
      sc.ContractParam.byteArray(Buffer.from("INV-1001", "utf-8").toString("hex")),
      sc.ContractParam.string("AcmeBuyer"),
      sc.ContractParam.string("AcmeSeller"),
      sc.ContractParam.integer(10000),
      sc.ContractParam.string("USD"),
      sc.ContractParam.integer(20251231),
      sc.ContractParam.string(JSON.stringify({po:"PO-123"}))
    ]);
    console.log("   ✅ register_invoice sent:", tx1);
    console.log("");

    // 2. Get invoice
    console.log("2️⃣  Getting invoice INV-1001...");
    const resGet = await contract.testInvoke("get_invoice", [
      sc.ContractParam.byteArray(Buffer.from("INV-1001", "utf-8").toString("hex"))
    ]);
    if (resGet.state === "HALT" && resGet.stack && resGet.stack.length > 0) {
      const invoiceData = decodeResult(resGet.stack[0].value);
      console.log("   Invoice data:", invoiceData);
    }
    console.log("");

    // 3. Update status to verified
    console.log("3️⃣  Updating status to 'verified'...");
    const tx2 = await contract.invoke("update_status", [
      sc.ContractParam.byteArray(Buffer.from("INV-1001", "utf-8").toString("hex")),
      sc.ContractParam.string("verified")
    ]);
    console.log("   ✅ update_status sent:", tx2);
    console.log("");

    // 4. Settle invoice
    console.log("4️⃣  Settling invoice...");
    const tx3 = await contract.invoke("settle_invoice", [
      sc.ContractParam.byteArray(Buffer.from("INV-1001", "utf-8").toString("hex"))
    ]);
    console.log("   ✅ settle_invoice sent:", tx3);
    console.log("");

    // 5. Final read
    console.log("5️⃣  Final invoice status...");
    const finalResult = await contract.testInvoke("get_invoice", [
      sc.ContractParam.byteArray(Buffer.from("INV-1001", "utf-8").toString("hex"))
    ]);
    if (finalResult.state === "HALT" && finalResult.stack && finalResult.stack.length > 0) {
      const finalData = decodeResult(finalResult.stack[0].value);
      console.log("   Final invoice:", finalData);
    }

    console.log("");
    console.log("✅ InvoiceAsset demo complete!");
  } catch (e) {
    console.error("❌ Failed:", e);
  }
  console.log("==========================================");
})();
