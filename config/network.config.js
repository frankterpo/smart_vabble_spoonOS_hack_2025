/**
 * VABBLE Network Configuration
 * 
 * Switch between networks by setting NEO_NETWORK environment variable:
 *   - NEO_NETWORK=local   → Use neo-express (free, instant)
 *   - NEO_NETWORK=testnet → Use Neo N3 TestNet (real, costs GAS)
 * 
 * Usage:
 *   NEO_NETWORK=local node dist/server.cjs
 *   NEO_NETWORK=testnet node dist/server.cjs
 */

export const NETWORKS = {
    local: {
        name: "Neo-Express (Local)",
        rpcUrl: "http://localhost:50012",
        magic: 677225975,
        explorerUrl: null, // No explorer for local
        contracts: {
            // These get populated after running: npm run deploy:all:local
            INVOICE_ASSET: process.env.LOCAL_INVOICE_ASSET_CONTRACT_HASH || "",
            INVESTOR_SHARE: process.env.LOCAL_INVESTOR_SHARE_CONTRACT_HASH || "",
            RECEIVABLE_REGISTRY_V2: process.env.LOCAL_RECEIVABLE_REGISTRY_V2_CONTRACT_HASH || "",
            EXPORTER_REGISTRY: process.env.LOCAL_EXPORTER_REGISTRY_CONTRACT_HASH || "",
            IMPORTER_TERMS: process.env.LOCAL_IMPORTER_TERMS_CONTRACT_HASH || "",
            DD_REGISTRY: process.env.LOCAL_DD_REGISTRY_CONTRACT_HASH || ""
        }
    },
    testnet: {
        name: "Neo N3 TestNet (T5)",
        rpcUrl: "https://testnet1.neo.coz.io:443",
        magic: 894710606,
        explorerUrl: "https://testnet.neotube.io",
        contracts: {
            // Already deployed on TestNet
            INVOICE_ASSET: process.env.INVOICE_ASSET_CONTRACT_HASH || "0x566f9599ca386d4ff7a7c1f1281ae8d88b92b4a5",
            INVESTOR_SHARE: process.env.INVESTOR_SHARE_CONTRACT_HASH || "0x4a6d38cad4014d2b95e0cfa81a0cf26ff2c6c41d",
            RECEIVABLE_REGISTRY_V2: process.env.RECEIVABLE_REGISTRY_V2_CONTRACT_HASH || "0x198f17ecebce01b20ee07d8e46813b281dacd9eb",
            EXPORTER_REGISTRY: process.env.EXPORTER_REGISTRY_CONTRACT_HASH || "0x57c573e8f8da14c0add62cca327406d47149f76e",
            IMPORTER_TERMS: process.env.IMPORTER_TERMS_CONTRACT_HASH || "0x2c74d727499b11dba6f13c5826ee5196159bbab3",
            DD_REGISTRY: process.env.DD_REGISTRY_CONTRACT_HASH || ""
        }
    }
};

export function getNetworkConfig(networkName) {
    const network = networkName || process.env.NEO_NETWORK || "testnet";
    const config = NETWORKS[network];
    
    if (!config) {
        console.error(`Unknown network: ${network}. Use 'local' or 'testnet'`);
        process.exit(1);
    }
    
    return {
        ...config,
        networkKey: network
    };
}

export default { NETWORKS, getNetworkConfig };

