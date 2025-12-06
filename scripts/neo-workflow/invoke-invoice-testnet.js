import pkg from "@cityofzion/neon-js";
const { experimental, u, wallet } = pkg;
import dotenv from "dotenv";
dotenv.config();

// Configuration for TestNet
const rpcNode = process.env.NEO_RPC_URL || "https://testnet1.neo.coz.io:443";
const magic = parseInt(process.env.NEO_NETWORK_MAGIC || "844378958");
const WIF = process.env.NEO_WALLET_WIF;
const INVOICE_HASH_STR = process.env.TESTNET_INVOICE_ASSET_HASH;

if (!WIF) throw new Error("Missing NEO_WALLET_WIF in .env!");
if (!INVOICE_HASH_STR) throw new Error("Missing TESTNET_INVOICE_ASSET_HASH in .env!");

// Helper to flip endianness for Big-Endian hash required by SmartContract
function reverseHex(hex) {
  return hex.replace(/^0x/, "").match(/.{1,2}/g).reverse().join("");
}

// Assuming the hash in .env is Little-Endian (standard output from deploy)
const contractHashBig = reverseHex(INVOICE_HASH_STR);

const account = new wallet.Account(WIF);

console.log("Neo N3 TestNet Invocation");
console.log("-------------------------");
console.log(`RPC: ${rpcNode}`);
console.log(`Magic: ${magic}`);
console.log(`Contract: ${INVOICE_HASH_STR}`);
console.log(`Account: ${account.address}`);

const config = {
  networkMagic: magic,
  rpcAddress: rpcNode,
  account: account
};

const contract = new experimental.SmartContract(u.HexString.fromHex(contractHashBig), config);

async function run() {
  try {
    console.log("\n📡 Invoking ping() on InvoiceAsset...");
    // Using testInvoke for read-only call to save GAS during verification
    const result = await contract.testInvoke("ping", []);
    
    console.log("Result State:", result.state);
    if (result.stack && result.stack.length > 0) {
      console.log("Return value:", result.stack[0].value);
      if (result.stack[0].value === "1") {
        console.log("✅ Success! Contract is alive on TestNet.");
      } else {
        console.log("⚠️ Unexpected return value.");
      }
    } else {
        if (result.state === "HALT") {
             console.log("⚠️ HALT with empty stack (method might return void).");
        } else {
             console.log("❌ FAULT or error during execution.");
             if (result.exception) console.log("Exception:", result.exception);
        }
    }
  } catch (e) {
    console.error("❌ Failed:", e.message);
  }
}

run();

