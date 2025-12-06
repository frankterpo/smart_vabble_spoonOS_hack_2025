import pkg from "@cityofzion/neon-js";
const { experimental, sc, wallet, u } = pkg;
import dotenv from "dotenv";
dotenv.config();

const rpcNode = process.env.NEO_LOCAL_RPC_URL || "http://localhost:50012";
const WIF = process.env.NEO_WALLET_WIF;
const INVESTOR_HASH_STR = process.env.INVESTOR_SHARE_CONTRACT_HASH;

if (!WIF) throw new Error("Missing NEO_WALLET_WIF in .env!");
if (!INVESTOR_HASH_STR) throw new Error("Missing INVESTOR_SHARE_CONTRACT_HASH in .env!");

function toBigEndian(hex) {
  return hex.replace(/^0x/, "").match(/.{1,2}/g).reverse().join("");
}
const contractHash = toBigEndian(INVESTOR_HASH_STR);

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
  console.log("InvestorShare Contract Invocation");
  console.log("==========================================");
  console.log(`Contract: ${INVESTOR_HASH_STR}`);
  console.log(`Account:  ${account.address}`);
  console.log("");

  const invoiceId = "INV-2001";

  try {
    // 1. Allocate to INVESTOR-A
    console.log("1️⃣  Allocating 600 to INVESTOR-A...");
    const tx1 = await contract.invoke("allocate", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
      sc.ContractParam.byteArray(Buffer.from("INVESTOR-A", "utf-8").toString("hex")),
      sc.ContractParam.integer(600)
    ]);
    console.log("   ✅ allocate sent:", tx1);
    console.log("");

    // 2. Allocate to INVESTOR-B
    console.log("2️⃣  Allocating 400 to INVESTOR-B...");
    const tx2 = await contract.invoke("allocate", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
      sc.ContractParam.byteArray(Buffer.from("INVESTOR-B", "utf-8").toString("hex")),
      sc.ContractParam.integer(400)
    ]);
    console.log("   ✅ allocate sent:", tx2);
    console.log("");

    // 3. Transfer from A to B
    console.log("3️⃣  Transferring 100 from INVESTOR-A to INVESTOR-B...");
    const tx3 = await contract.invoke("transfer", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
      sc.ContractParam.byteArray(Buffer.from("INVESTOR-A", "utf-8").toString("hex")),
      sc.ContractParam.byteArray(Buffer.from("INVESTOR-B", "utf-8").toString("hex")),
      sc.ContractParam.integer(100)
    ]);
    console.log("   ✅ transfer sent:", tx3);
    console.log("");

    // 4. Redeem from INVESTOR-B
    console.log("4️⃣  Redeeming 150 from INVESTOR-B...");
    const tx4 = await contract.invoke("redeem", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
      sc.ContractParam.byteArray(Buffer.from("INVESTOR-B", "utf-8").toString("hex")),
      sc.ContractParam.integer(150)
    ]);
    console.log("   ✅ redeem sent:", tx4);
    console.log("");

    // 5. Get share for INVESTOR-A
    console.log("5️⃣  Getting share for INVESTOR-A...");
    const resA = await contract.testInvoke("get_share", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
      sc.ContractParam.byteArray(Buffer.from("INVESTOR-A", "utf-8").toString("hex"))
    ]);
    if (resA.state === "HALT" && resA.stack && resA.stack.length > 0) {
      const shareA = decodeResult(resA.stack[0].value);
      console.log("   INVESTOR-A share:", shareA);
    }

    // 6. Get share for INVESTOR-B
    console.log("6️⃣  Getting share for INVESTOR-B...");
    const resB = await contract.testInvoke("get_share", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
      sc.ContractParam.byteArray(Buffer.from("INVESTOR-B", "utf-8").toString("hex"))
    ]);
    if (resB.state === "HALT" && resB.stack && resB.stack.length > 0) {
      const shareB = decodeResult(resB.stack[0].value);
      console.log("   INVESTOR-B share:", shareB);
    }

    // 7. Get totals
    console.log("7️⃣  Getting totals...");
    const resTotalAlloc = await contract.testInvoke("total_allocated", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex"))
    ]);
    const resTotalClaim = await contract.testInvoke("total_claimed", [
      sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex"))
    ]);
    if (resTotalAlloc.state === "HALT" && resTotalAlloc.stack && resTotalAlloc.stack.length > 0) {
      console.log("   Total allocated:", decodeResult(resTotalAlloc.stack[0].value));
    }
    if (resTotalClaim.state === "HALT" && resTotalClaim.stack && resTotalClaim.stack.length > 0) {
      console.log("   Total claimed:", decodeResult(resTotalClaim.stack[0].value));
    }

    console.log("");
    console.log("✅ InvestorShare demo complete!");
  } catch (e) {
    console.error("❌ Failed:", e);
  }
  console.log("==========================================");
})();
