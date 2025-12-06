import pkg from "@cityofzion/neon-js";
const { experimental, sc, wallet, u } = pkg;
import dotenv from "dotenv";
dotenv.config();

const rpcNode = process.env.NEO_LOCAL_RPC_URL || "http://localhost:50012";
const WIF = process.env.NEO_WALLET_WIF;
const CONTRACT_STR = process.env.RECEIVABLE_REGISTRY_V2_CONTRACT_HASH;
const INVOICE_HASH_STR = process.env.INVOICE_ASSET_CONTRACT_HASH;
const INVESTOR_SHARE_HASH_STR = process.env.INVESTOR_SHARE_CONTRACT_HASH;

if (!WIF) throw new Error("Missing NEO_WALLET_WIF in .env!");
if (!CONTRACT_STR) throw new Error("Missing RECEIVABLE_REGISTRY_V2_CONTRACT_HASH in .env!");
if (!INVOICE_HASH_STR) throw new Error("Missing INVOICE_ASSET_CONTRACT_HASH in .env!");
if (!INVESTOR_SHARE_HASH_STR) throw new Error("Missing INVESTOR_SHARE_CONTRACT_HASH in .env!");

function toBigEndian(hex) {
  return hex.replace(/^0x/, "").match(/.{1,2}/g).reverse().join("");
}
const contractHash = toBigEndian(CONTRACT_STR);
// Invoice/Investor hashes passed as arguments can be little-endian (stored on chain as bytes)
// but if we pass them as HexStrings, emitAppCall will handle them.
// However, the contract stores them as bytes.
// If we pass "0x..." string to sc.ContractParam.string(), it stores the string literal.
// If we pass sc.ContractParam.hash160(), it handles endianness.
// The contract expects `invoice_contract_hash: str` in the method signature, but stores it.
// Let's pass them as strings for now as per previous logic, or hex strings if changed.
// The previous logic passed `INVOICE_HASH` (string).
// Let's stick to passing the string value from .env (e.g. "0x...") or raw hex.
// Better to pass raw hex string (without 0x) if the contract treats it as an opaque ID.
const INVOICE_HASH = INVOICE_HASH_STR.replace(/^0x/, "");
const INVESTOR_SHARE_HASH = INVESTOR_SHARE_HASH_STR.replace(/^0x/, "");

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
  console.log("ReceivableRegistryV2 Contract Invocation");
  console.log("==========================================");
  console.log(`Contract: ${CONTRACT_STR}`);
  console.log(`Account:  ${account.address}`);
  console.log("");

  const invId = "INV-3001";

  try {
    // 1. Register invoice
    console.log("1️⃣  Registering invoice in registry...");
    const tx1 = await contract.invoke("register_invoice", [
      sc.ContractParam.byteArray(Buffer.from(invId, "utf-8").toString("hex")),
      sc.ContractParam.string(INVOICE_HASH)
    ]);
    console.log("   ✅ register_invoice sent:", tx1);
    console.log("");

    // 2. Attach investor share contract
    console.log("2️⃣  Attaching investor share contract...");
    const tx2 = await contract.invoke("attach_investor_share", [
      sc.ContractParam.byteArray(Buffer.from(invId, "utf-8").toString("hex")),
      sc.ContractParam.string(INVESTOR_SHARE_HASH)
    ]);
    console.log("   ✅ attach_investor_share sent:", tx2);
    console.log("");

    // 3. Set status to ACTIVE
    console.log("3️⃣  Setting status to ACTIVE...");
    const tx3 = await contract.invoke("set_status", [
      sc.ContractParam.byteArray(Buffer.from(invId, "utf-8").toString("hex")),
      sc.ContractParam.string("ACTIVE")
    ]);
    console.log("   ✅ set_status sent:", tx3);
    console.log("");

    // 4. Get invoice contract
    const resInvoice = await contract.testInvoke("get_invoice_contract", [
      sc.ContractParam.byteArray(Buffer.from(invId, "utf-8").toString("hex"))
    ]);
    const resShare = await contract.testInvoke("get_share_contract", [
      sc.ContractParam.byteArray(Buffer.from(invId, "utf-8").toString("hex"))
    ]);
    const resStatus = await contract.testInvoke("get_status", [
      sc.ContractParam.byteArray(Buffer.from(invId, "utf-8").toString("hex"))
    ]);

    console.log("4️⃣  Registry state:");
    if (resInvoice.state === "HALT" && resInvoice.stack && resInvoice.stack.length > 0) {
      console.log("   Invoice contract:", decodeResult(resInvoice.stack[0].value));
    }
    if (resShare.state === "HALT" && resShare.stack && resShare.stack.length > 0) {
      console.log("   Share contract:", decodeResult(resShare.stack[0].value));
    }
    if (resStatus.state === "HALT" && resStatus.stack && resStatus.stack.length > 0) {
      console.log("   Status:", decodeResult(resStatus.stack[0].value));
    }
    console.log("");

    // 5. Settle
    console.log("5️⃣  Settling invoice...");
    const tx4 = await contract.invoke("settle", [
      sc.ContractParam.byteArray(Buffer.from(invId, "utf-8").toString("hex"))
    ]);
    console.log("   ✅ settle sent:", tx4);
    console.log("");

    // 6. Final status
    const finalStatus = await contract.testInvoke("get_status", [
      sc.ContractParam.byteArray(Buffer.from(invId, "utf-8").toString("hex"))
    ]);
    if (finalStatus.state === "HALT" && finalStatus.stack && finalStatus.stack.length > 0) {
      console.log("   Final status:", decodeResult(finalStatus.stack[0].value));
    }

    console.log("");
    console.log("✅ ReceivableRegistryV2 demo complete!");
  } catch (e) {
    console.error("❌ Failed:", e);
  }
  console.log("==========================================");
})();
