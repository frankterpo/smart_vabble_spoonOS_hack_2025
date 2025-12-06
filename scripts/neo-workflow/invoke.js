import { rpc, sc, wallet, tx } from "@cityofzion/neon-js";
import dotenv from "dotenv";
dotenv.config();

const rpcNode = "https://testnet1.neo.coz.io";
const provider = new rpc.RPCClient(rpcNode);

const WIF = process.env.NEO_WALLET_WIF;
const CONTRACT = process.env.RECEIVABLE_REGISTRY_CONTRACT_HASH;

if (!WIF) throw new Error("Missing NEO_WALLET_WIF in .env!");
if (!CONTRACT) throw new Error("Missing RECEIVABLE_REGISTRY_CONTRACT_HASH in .env!");

const account = new wallet.Account(WIF);

async function invoke(method, args = []) {
  const sb = new sc.ScriptBuilder();
  sb.emitAppCall(CONTRACT, method, args);

  const script = sb.build();
  const height = await provider.getBlockCount();

  const transaction = new tx.Transaction({
    signers: [{ account: account.scriptHash, scopes: tx.WitnessScope.CalledByEntry }],
    script,
    validUntilBlock: height + 30
  });

  transaction.sign(account, 844378958);

  await provider.sendRawTransaction(transaction.serialize(true));
  console.log(`📡 Called ${method} → tx=${transaction.hash}`);
  return transaction.hash;
}

async function testInvoke(method, args = []) {
  // Test invoke (read-only, no tx broadcast)
  const sb = new sc.ScriptBuilder();
  sb.emitAppCall(CONTRACT, method, args);
  const script = sb.build();
  
  const result = await provider.invokeScript(script);
  return result;
}

function parseRecord(raw) {
  if (!raw || raw === '') {
    return null;
  }
  const parts = raw.split('|');
  if (parts.length < 7) {
    return { raw };
  }
  return {
    buyer: parts[0],
    seller: parts[1],
    amount: parts[2],
    currency: parts[3],
    due_date: parts[4],
    status: parts[5],
    meta: parts[6]
  };
}

(async () => {
  console.log("==========================================");
  console.log("ReceivableRegistryV1 Contract Invocation");
  console.log("==========================================");
  console.log(`Contract: ${CONTRACT}`);
  console.log(`Account:  ${account.address}`);
  console.log("");

  // 1. Register a receivable
  console.log("1️⃣  Registering receivable INV-001...");
  // Note: id parameter must be bytes (not string) for boa3 v1.1.1 compatibility
  await invoke("register", [
    sc.ContractParam.byteArray(Buffer.from("INV-001", "utf-8")), // id as bytes
    sc.ContractParam.string("Walmart"),
    sc.ContractParam.string("PeruvianAvocadosCo"),
    sc.ContractParam.integer(100000),
    sc.ContractParam.string("USD"),
    sc.ContractParam.integer(20251231),
    sc.ContractParam.string('{"po": "PO-123", "notes": "demo"}')
  ]);
  console.log("   ✅ Register transaction sent");
  console.log("");

  // Wait a moment for tx to propagate
  console.log("   ⏳ Waiting 5s for tx confirmation...");
  await new Promise(r => setTimeout(r, 5000));

  // 2. Read back the receivable (test invoke - read only)
  console.log("2️⃣  Reading back receivable INV-001...");
  // Note: id parameter must be bytes (not string) for boa3 v1.1.1 compatibility
  const result = await testInvoke("get_record", [
    sc.ContractParam.byteArray(Buffer.from("INV-001", "utf-8")) // id as bytes
  ]);

  if (result.state === "HALT" && result.stack && result.stack.length > 0) {
    const rawValue = result.stack[0].value;
    // get_record returns bytes, so we need to decode it
    let decoded = rawValue;
    if (typeof rawValue === 'string' && rawValue.length > 0) {
      try {
        // Try base64 first (common encoding for bytes in Neo)
        decoded = Buffer.from(rawValue, 'base64').toString('utf8');
      } catch (e) {
        try {
          // Try hex encoding
          decoded = Buffer.from(rawValue, 'hex').toString('utf8');
        } catch (e2) {
          // If it's already a string, use it as-is
          decoded = rawValue;
        }
      }
    } else if (Buffer.isBuffer(rawValue)) {
      decoded = rawValue.toString('utf8');
    }
    
    console.log("   Raw record:", decoded);
    
    const parsed = parseRecord(decoded);
    if (parsed && parsed.buyer) {
      console.log("   Parsed record:");
      console.log(`     buyer:    ${parsed.buyer}`);
      console.log(`     seller:   ${parsed.seller}`);
      console.log(`     amount:   ${parsed.amount}`);
      console.log(`     currency: ${parsed.currency}`);
      console.log(`     due_date: ${parsed.due_date}`);
      console.log(`     status:   ${parsed.status}`);
      console.log(`     meta:     ${parsed.meta}`);
    }
  } else {
    console.log("   ⚠️  Could not read record (may need more time for confirmation)");
    console.log("   Result:", JSON.stringify(result, null, 2));
  }

  console.log("");
  console.log("==========================================");
  console.log("Done!");
  console.log("==========================================");
})();
