import pkg from "@cityofzion/neon-js";
const { rpc, u } = pkg;
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.NEO_LOCAL_RPC_URL || "https://testnet1.neo.coz.io:443";
const provider = new rpc.RPCClient(RPC_URL);

// Contract hashes from README (without 0x)
const contracts = {
  InvoiceAsset: "566f9599926df494a64854f33be188c5ad073d26",
  InvestorShare: "4a6d38ca03b790f8c9913c1d1ee33b7b66b94f28",
  Registry: "198f17ecebce01b20ee07d8e46813b281dacd9eb"
};

async function findDeploymentTx(contractHash) {
  try {
    // Convert to script hash format (little-endian)
    const leHash = u.reverseHex(contractHash);
    
    // Query contract state
    const state = await provider.getContractState(leHash);
    
    if (state && state.hash) {
      // Try to find the deployment transaction
      // Note: Neo N3 doesn't directly store deployment TX in contract state
      // We'll need to search recent blocks or use a different method
      console.log(`Contract ${contractHash}:`);
      console.log(`  Hash: ${state.hash}`);
      console.log(`  Name: ${state.manifest?.name || 'N/A'}`);
      
      // Alternative: Search recent transactions for contract creation
      // This is a simplified approach - in production you'd query block history
      return null;
    }
  } catch (e) {
    console.error(`Error querying ${contractHash}:`, e.message);
  }
  return null;
}

// Better approach: Query recent transactions from the deployer address
async function findRecentDeployments() {
  const deployerAddress = process.env.NEO_WALLET_ADDRESS || "NQGop9Bnj21Zq8foruvzsa1v7vxHiiRZEb";
  
  console.log(`\nSearching for deployment transactions from ${deployerAddress}...\n`);
  
  try {
    // Get current block height
    const blockCount = await provider.getBlockCount();
    console.log(`Current block height: ${blockCount}`);
    
    // Search last 1000 blocks for deployment transactions
    // Note: This is a simplified search - in production use an indexer
    console.log("\n⚠️  Note: Neo RPC doesn't provide direct transaction search by contract.");
    console.log("   Deployment transactions can be found by:");
    console.log("   1. Searching NeoTube explorer for your wallet address");
    console.log("   2. Looking for 'Contract Deploy' transactions");
    console.log("   3. Or use a Neo indexer API\n");
    
    console.log("📋 Transaction Explorer Links Format:");
    console.log("   https://testnet.neotube.io/transaction/{TXID}\n");
    
    console.log("🔍 To find your deployment transactions:");
    console.log(`   1. Visit: https://testnet.neotube.io/address/${deployerAddress}`);
    console.log(`   2. Look for 'Contract Deploy' transactions`);
    console.log(`   3. Match the contract hash in the transaction details\n`);
    
  } catch (e) {
    console.error("Error:", e.message);
  }
}

findRecentDeployments();

