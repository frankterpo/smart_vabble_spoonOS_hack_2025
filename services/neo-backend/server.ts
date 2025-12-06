import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import chalk from 'chalk'; // Add chalk for beautiful logs
import * as neonFull from "@cityofzion/neon-js";

// In CommonJS/TS compilation, neonFull seems to have the named exports directly.
const { experimental, sc, wallet, u } = neonFull as any;

dotenv.config();

const app = express();
app.use(bodyParser.json());

// Default to port 4000 for SpoonOS integration
const port = process.env.PORT || 4000;

// Neo Configuration (Matches .env from deploy-all-testnet.js)
const RPC_URL = process.env.NEO_LOCAL_RPC_URL || "https://testnet1.neo.coz.io:443";
const MAGIC = parseInt(process.env.NEO_LOCAL_MAGIC || "894710606"); // Default to TestNet T5
const WIF = process.env.NEO_WALLET_WIF;

// Helper for Endianness
function toBigEndian(hex: string) {
    if (!hex) return "";
    return hex.replace(/^0x/, "").match(/.{1,2}/g)!.reverse().join("");
}

// Helper to decode bytes to string
function decodeResult(rawValue: any) {
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

// Contract Hashes (Standardized names from .env)
const CONTRACTS = {
    INVOICE: process.env.INVOICE_ASSET_CONTRACT_HASH,
    INVESTOR: process.env.INVESTOR_SHARE_CONTRACT_HASH,
    REGISTRY: process.env.RECEIVABLE_REGISTRY_V2_CONTRACT_HASH
};

const RAW_HASHES = {
    INVOICE: CONTRACTS.INVOICE ? CONTRACTS.INVOICE.replace(/^0x/, "") : "",
    INVESTOR: CONTRACTS.INVESTOR ? CONTRACTS.INVESTOR.replace(/^0x/, "") : ""
};

if (!CONTRACTS.INVOICE || !CONTRACTS.INVESTOR || !CONTRACTS.REGISTRY) {
    console.warn(chalk.yellow("⚠️  WARNING: One or more contract hashes are missing in .env"));
}

// Setup Neo Account & Config
let account: any;
try {
    if (WIF) account = new wallet.Account(WIF);
} catch (e: any) {
    console.error(chalk.red("Invalid WIF in .env:", e.message));
}

const neoConfig = {
    networkMagic: MAGIC,
    rpcAddress: RPC_URL,
    account: account
};

// Helper to get SmartContract instance
function getContract(hashStr: string | undefined) {
    if (!account) throw new Error("Server configured without valid WIF");
    if (!hashStr) throw new Error("Contract hash not configured");
    const hashBig = toBigEndian(hashStr);
    return new experimental.SmartContract(u.HexString.fromHex(hashBig), neoConfig);
}

// ==========================================
// LOGGING HELPERS (Polished for Demo)
// ==========================================

function logRequest(tool: string, body: any) {
    const time = new Date().toLocaleTimeString();
    console.log(chalk.gray(`[${time}] `) + chalk.blueBright(`⚡ SpoonOS Call: `) + chalk.bold.white(tool));
    // Filter out potentially large or sensitive fields if any (none currently in schema)
    console.log(chalk.gray(`       Payload: `) + JSON.stringify(body));
}

function logSuccess(tool: string, txid: string) {
    console.log(chalk.green(`       ✔ Success! `) + chalk.gray(`TXID: `) + chalk.yellow(txid));
    console.log(chalk.gray(`       🔗 Explorer: `) + chalk.cyan.underline(`https://testnet.neotube.io/transaction/${txid}`));
    console.log(""); // Spacer
}

function logError(tool: string, error: any) {
    console.log(chalk.red(`       ❌ Error: `) + error.message);
    console.log(""); // Spacer
}

// ==========================================
// API ENDPOINTS FOR SPOONOS TOOLS
// ==========================================

// 0. Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        network: 'neo-n3-testnet',
        rpc: RPC_URL,
        contracts: {
            invoice: !!CONTRACTS.INVOICE,
            investor: !!CONTRACTS.INVESTOR,
            registry: !!CONTRACTS.REGISTRY
        }
    });
});

// TOOL 1: Register Invoice
// POST /invoice/register
app.post('/invoice/register', async (req, res) => {
    const toolName = "register_invoice";
    logRequest(toolName, req.body);
    
    try {
        const { invoiceId, buyer, exporter, amount, currency, dueDate, meta } = req.body;
        const contract = getContract(CONTRACTS.INVOICE);
        
        // Defaults
        const curr = currency || "USD";
        const due = dueDate || 20251231;
        const sell = exporter || "Unknown Exporter";
        const buy = buyer || "Unknown Buyer";
        
        console.log(chalk.magenta(`       → Invoking InvoiceAsset.register()...`));
        const txid = await contract.invoke("register_invoice", [
            sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
            sc.ContractParam.string(buy),
            sc.ContractParam.string(sell),
            sc.ContractParam.integer(amount),
            sc.ContractParam.string(curr),
            sc.ContractParam.integer(due),
            sc.ContractParam.string(JSON.stringify(meta || {}))
        ]);
        
        logSuccess(toolName, txid);
        res.json({ success: true, txid, explorer: `https://testnet.neotube.io/transaction/${txid}` });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL 2: Allocate Shares
// POST /investor/allocate
app.post('/investor/allocate', async (req, res) => {
    const toolName = "allocate_shares";
    logRequest(toolName, req.body);

    try {
        const { invoiceId, investor, amount } = req.body;
        const contract = getContract(CONTRACTS.INVESTOR);
        
        console.log(chalk.magenta(`       → Invoking InvestorShare.allocate()...`));
        const txid = await contract.invoke("allocate", [
            sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
            sc.ContractParam.byteArray(Buffer.from(investor, "utf-8").toString("hex")),
            sc.ContractParam.integer(amount)
        ]);
        
        logSuccess(toolName, txid);
        res.json({ success: true, txid, explorer: `https://testnet.neotube.io/transaction/${txid}` });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL 3: Register Invoice in Registry
// POST /registry/register
app.post('/registry/register', async (req, res) => {
    const toolName = "registry_register";
    logRequest(toolName, req.body);

    try {
        const { invoiceId } = req.body;
        const contract = getContract(CONTRACTS.REGISTRY);
        
        console.log(chalk.magenta(`       → Invoking RegistryV2.register_invoice()...`));
        const txid = await contract.invoke("register_invoice", [
            sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
            sc.ContractParam.string(RAW_HASHES.INVOICE)
        ]);
        
        logSuccess(toolName, txid);
        res.json({ success: true, txid, explorer: `https://testnet.neotube.io/transaction/${txid}` });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL 4: Set Status
// POST /registry/status
app.post('/registry/status', async (req, res) => {
    const toolName = "set_status";
    logRequest(toolName, req.body);

    try {
        const { invoiceId, status } = req.body;
        const contract = getContract(CONTRACTS.REGISTRY);
        
        console.log(chalk.magenta(`       → Invoking RegistryV2.set_status()...`));
        const txid = await contract.invoke("set_status", [
            sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
            sc.ContractParam.string(status)
        ]);
        
        logSuccess(toolName, txid);
        res.json({ success: true, txid, explorer: `https://testnet.neotube.io/transaction/${txid}` });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL 5: Run Settlement
// POST /settlement/run
app.post('/settlement/run', async (req, res) => {
    const toolName = "settle_invoice";
    logRequest(toolName, req.body);

    try {
        const { invoiceId } = req.body;
        const contract = getContract(CONTRACTS.REGISTRY);
        
        console.log(chalk.magenta(`       → Invoking RegistryV2.settle()...`));
        const txid = await contract.invoke("settle", [
            sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex"))
        ]);
        
        logSuccess(toolName, txid);
        res.json({ success: true, txid, explorer: `https://testnet.neotube.io/transaction/${txid}` });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL 6: Query Invoice Status
// GET /registry/status/:invoiceId
app.get('/registry/status/:invoiceId', async (req, res) => {
    const toolName = "query_invoice_status";
    const invoiceId = req.params.invoiceId;
    // Manual log for GET since it has no body
    const time = new Date().toLocaleTimeString();
    console.log(chalk.gray(`[${time}] `) + chalk.blueBright(`⚡ SpoonOS Call: `) + chalk.bold.white(toolName));
    console.log(chalk.gray(`       Query: `) + invoiceId);

    try {
        const contract = getContract(CONTRACTS.REGISTRY);
        
        console.log(chalk.magenta(`       → Reading RegistryV2.get_status()...`));
        const result = await contract.testInvoke("get_status", [
            sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex"))
        ]);
        
        let status = "UNKNOWN";
        if (result.state === "HALT" && result.stack && result.stack.length > 0) {
            status = decodeResult(result.stack[0].value);
        }
        
        console.log(chalk.green(`       ✔ Result: `) + status);
        console.log("");
        
        res.json({ success: true, invoiceId, status });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(port, () => {
    console.clear();
    console.log(chalk.bold.green("🚀 Vabble Neo Backend Service - READY"));
    console.log(chalk.gray("───────────────────────────────────────"));
    console.log(chalk.white(`📡 Port:     `) + chalk.cyan(port));
    console.log(chalk.white(`🌍 Network:  `) + chalk.cyan("Neo N3 TestNet"));
    console.log(chalk.white(`🔗 RPC:      `) + chalk.gray(RPC_URL));
    console.log(chalk.white(`🔑 Wallet:   `) + chalk.yellow(account ? account.address : "Invalid"));
    console.log(chalk.gray("───────────────────────────────────────"));
    console.log(chalk.gray("Waiting for SpoonOS tool calls...\n"));
});
