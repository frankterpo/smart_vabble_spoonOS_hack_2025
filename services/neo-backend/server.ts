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
    REGISTRY: process.env.RECEIVABLE_REGISTRY_V2_CONTRACT_HASH,
    EXPORTER: process.env.EXPORTER_REGISTRY_CONTRACT_HASH,
    IMPORTER: process.env.IMPORTER_TERMS_CONTRACT_HASH
};

const RAW_HASHES = {
    INVOICE: CONTRACTS.INVOICE ? CONTRACTS.INVOICE.replace(/^0x/, "") : "",
    INVESTOR: CONTRACTS.INVESTOR ? CONTRACTS.INVESTOR.replace(/^0x/, "") : "",
    EXPORTER: CONTRACTS.EXPORTER ? CONTRACTS.EXPORTER.replace(/^0x/, "") : ""
};

if (!CONTRACTS.INVOICE || !CONTRACTS.INVESTOR || !CONTRACTS.REGISTRY) {
    console.warn(chalk.yellow("⚠️  WARNING: One or more core contract hashes are missing in .env"));
}
if (!CONTRACTS.EXPORTER) {
    console.warn(chalk.yellow("⚠️  INFO: EXPORTER_REGISTRY_CONTRACT_HASH not set (Phase 1 V2)"));
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
            registry: !!CONTRACTS.REGISTRY,
            exporter: !!CONTRACTS.EXPORTER
        }
    });
});

// ==========================================
// PHASE 1: EXPORTER FLOW ENDPOINTS
// ==========================================

// TOOL: Register Exporter Profile
// POST /exporter/profile
app.post('/exporter/profile', async (req, res) => {
    const toolName = "register_exporter_profile";
    logRequest(toolName, req.body);

    try {
        const { exporterId, companyName, country, sector } = req.body;
        
        if (!CONTRACTS.EXPORTER) {
            throw new Error("EXPORTER_REGISTRY_CONTRACT_HASH not configured in .env");
        }
        
        const contract = getContract(CONTRACTS.EXPORTER);
        
        console.log(chalk.magenta(`       → Invoking ExporterRegistry.register_profile()...`));
        const txid = await contract.invoke("register_profile", [
            sc.ContractParam.byteArray(Buffer.from(exporterId, "utf-8").toString("hex")),
            sc.ContractParam.string(companyName || "Unknown Company"),
            sc.ContractParam.string(country || "XX"),
            sc.ContractParam.string(sector || "general")
        ]);
        
        logSuccess(toolName, txid);
        res.json({ 
            success: true, 
            txid, 
            explorer: `https://testnet.neotube.io/transaction/${txid}`,
            exporterId,
            message: `Exporter ${companyName} registered successfully`
        });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL: Get Exporter Profile
// GET /exporter/profile/:exporterId
app.get('/exporter/profile/:exporterId', async (req, res) => {
    const toolName = "get_exporter_profile";
    const exporterId = req.params.exporterId;
    const time = new Date().toLocaleTimeString();
    console.log(chalk.gray(`[${time}] `) + chalk.blueBright(`⚡ SpoonOS Call: `) + chalk.bold.white(toolName));
    console.log(chalk.gray(`       Query: `) + exporterId);

    try {
        if (!CONTRACTS.EXPORTER) {
            throw new Error("EXPORTER_REGISTRY_CONTRACT_HASH not configured in .env");
        }
        
        const contract = getContract(CONTRACTS.EXPORTER);
        
        console.log(chalk.magenta(`       → Reading ExporterRegistry.get_profile()...`));
        const result = await contract.testInvoke("get_profile", [
            sc.ContractParam.byteArray(Buffer.from(exporterId, "utf-8").toString("hex"))
        ]);
        
        let profile = null;
        if (result.state === "HALT" && result.stack && result.stack.length > 0) {
            const raw = decodeResult(result.stack[0].value);
            if (raw) {
                const parts = raw.split('|');
                profile = {
                    exporterId,
                    companyName: parts[0] || '',
                    country: parts[1] || '',
                    sector: parts[2] || ''
                };
            }
        }
        
        console.log(chalk.green(`       ✔ Result: `) + (profile ? JSON.stringify(profile) : "Not found"));
        console.log("");
        
        res.json({ success: true, profile });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL: Create Invoice Request (combines InvoiceAsset + Registry registration)
// POST /exporter/invoice-request
app.post('/exporter/invoice-request', async (req, res) => {
    const toolName = "exporter_create_invoice_request";
    logRequest(toolName, req.body);

    try {
        const { 
            exporterId, 
            invoiceId, 
            buyerName, 
            buyerCountry,
            faceValue, 
            currency, 
            dueDate, 
            minYield,
            maxTenorDays,
            meta 
        } = req.body;
        
        // 1. Register in InvoiceAsset
        const invoiceContract = getContract(CONTRACTS.INVOICE);
        console.log(chalk.magenta(`       → Step 1: InvoiceAsset.register_invoice()...`));
        
        const tx1 = await invoiceContract.invoke("register_invoice", [
            sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
            sc.ContractParam.string(buyerName || "Unknown Buyer"),
            sc.ContractParam.string(exporterId || "Unknown Exporter"),
            sc.ContractParam.integer(faceValue || 0),
            sc.ContractParam.string(currency || "USD"),
            sc.ContractParam.integer(dueDate || 20251231),
            sc.ContractParam.string(JSON.stringify({
                buyerCountry: buyerCountry || "",
                minYield: minYield || 0,
                maxTenorDays: maxTenorDays || 90,
                ...(meta || {})
            }))
        ]);
        console.log(chalk.green(`       ✔ InvoiceAsset TX: `) + chalk.yellow(tx1));
        
        // 2. Register in Registry
        const registryContract = getContract(CONTRACTS.REGISTRY);
        console.log(chalk.magenta(`       → Step 2: RegistryV2.register_invoice()...`));
        
        const tx2 = await registryContract.invoke("register_invoice", [
            sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
            sc.ContractParam.string(RAW_HASHES.INVOICE)
        ]);
        console.log(chalk.green(`       ✔ Registry TX: `) + chalk.yellow(tx2));
        
        console.log(chalk.green(`       ✔ Invoice request created successfully!`));
        console.log(chalk.gray(`       🔗 Explorer: `) + chalk.cyan.underline(`https://testnet.neotube.io/transaction/${tx2}`));
        console.log("");
        
        res.json({ 
            success: true, 
            invoiceId,
            invoiceAssetTxid: tx1,
            registryTxid: tx2,
            explorer: `https://testnet.neotube.io/transaction/${tx2}`,
            message: `Invoice ${invoiceId} created and registered for financing`
        });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL: Check if Exporter is Registered
// GET /exporter/check/:exporterId
app.get('/exporter/check/:exporterId', async (req, res) => {
    const toolName = "check_exporter_registered";
    const exporterId = req.params.exporterId;
    const time = new Date().toLocaleTimeString();
    console.log(chalk.gray(`[${time}] `) + chalk.blueBright(`⚡ SpoonOS Call: `) + chalk.bold.white(toolName));
    console.log(chalk.gray(`       Query: `) + exporterId);

    try {
        if (!CONTRACTS.EXPORTER) {
            throw new Error("EXPORTER_REGISTRY_CONTRACT_HASH not configured in .env");
        }
        
        const contract = getContract(CONTRACTS.EXPORTER);
        
        console.log(chalk.magenta(`       → Reading ExporterRegistry.is_registered()...`));
        const result = await contract.testInvoke("is_registered", [
            sc.ContractParam.byteArray(Buffer.from(exporterId, "utf-8").toString("hex"))
        ]);
        
        let isRegistered = false;
        if (result.state === "HALT" && result.stack && result.stack.length > 0) {
            isRegistered = result.stack[0].value === true || result.stack[0].value === 1;
        }
        
        console.log(chalk.green(`       ✔ Result: `) + (isRegistered ? "Registered" : "Not registered"));
        console.log("");
        
        res.json({ success: true, exporterId, isRegistered });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL: Link Invoice to Exporter
// POST /exporter/invoice-link
app.post('/exporter/invoice-link', async (req, res) => {
    const toolName = "link_exporter_invoice";
    logRequest(toolName, req.body);

    try {
        const { exporterId, invoiceId } = req.body;
        
        if (!CONTRACTS.EXPORTER) {
            throw new Error("EXPORTER_REGISTRY_CONTRACT_HASH not configured in .env");
        }
        
        const contract = getContract(CONTRACTS.EXPORTER);
        
        console.log(chalk.magenta(`       → Invoking ExporterRegistry.link_invoice()...`));
        const txid = await contract.invoke("link_invoice", [
            sc.ContractParam.byteArray(Buffer.from(exporterId, "utf-8").toString("hex")),
            sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex"))
        ]);
        
        logSuccess(toolName, txid);
        res.json({ 
            success: true, 
            txid, 
            explorer: `https://testnet.neotube.io/transaction/${txid}`,
            message: `Invoice ${invoiceId} linked to exporter ${exporterId}`
        });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// PHASE 2: IMPORTER FLOW ENDPOINTS
// ==========================================

// TOOL: Register Importer Profile
// POST /importer/profile
app.post('/importer/profile', async (req, res) => {
    const toolName = "register_importer_profile";
    logRequest(toolName, req.body);

    try {
        const { importerId, companyName, country } = req.body;
        
        if (!CONTRACTS.IMPORTER) {
            throw new Error("IMPORTER_TERMS_CONTRACT_HASH not configured in .env");
        }
        
        const contract = getContract(CONTRACTS.IMPORTER);
        
        console.log(chalk.magenta(`       → Invoking ImporterTerms.register_importer()...`));
        const txid = await contract.invoke("register_importer", [
            sc.ContractParam.byteArray(Buffer.from(importerId, "utf-8").toString("hex")),
            sc.ContractParam.string(companyName || "Unknown Company"),
            sc.ContractParam.string(country || "XX")
        ]);
        
        logSuccess(toolName, txid);
        res.json({ 
            success: true, 
            txid, 
            explorer: `https://testnet.neotube.io/transaction/${txid}`,
            importerId,
            message: `Importer ${companyName} registered successfully`
        });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL: Register Financing Terms
// POST /importer/terms
app.post('/importer/terms', async (req, res) => {
    const toolName = "register_importer_terms";
    logRequest(toolName, req.body);

    try {
        const { invoiceId, importerId, maxYieldBps, currency, jurisdiction } = req.body;
        
        if (!CONTRACTS.IMPORTER) {
            throw new Error("IMPORTER_TERMS_CONTRACT_HASH not configured in .env");
        }
        
        const contract = getContract(CONTRACTS.IMPORTER);
        
        console.log(chalk.magenta(`       → Invoking ImporterTerms.register_terms()...`));
        const txid = await contract.invoke("register_terms", [
            sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
            sc.ContractParam.byteArray(Buffer.from(importerId, "utf-8").toString("hex")),
            sc.ContractParam.integer(maxYieldBps || 850),
            sc.ContractParam.string(currency || "USD"),
            sc.ContractParam.string(jurisdiction || "US")
        ]);
        
        logSuccess(toolName, txid);
        res.json({ 
            success: true, 
            txid, 
            explorer: `https://testnet.neotube.io/transaction/${txid}`,
            invoiceId,
            maxYieldBps,
            message: `Terms registered: max yield ${(maxYieldBps || 850) / 100}% under ${jurisdiction || 'US'} law`
        });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL: Confirm Payable (buyer commits to paying)
// POST /importer/confirm
app.post('/importer/confirm', async (req, res) => {
    const toolName = "confirm_payable";
    logRequest(toolName, req.body);

    try {
        const { invoiceId, importerId } = req.body;
        
        if (!CONTRACTS.IMPORTER) {
            throw new Error("IMPORTER_TERMS_CONTRACT_HASH not configured in .env");
        }
        
        const contract = getContract(CONTRACTS.IMPORTER);
        
        console.log(chalk.magenta(`       → Invoking ImporterTerms.confirm_payable()...`));
        const txid = await contract.invoke("confirm_payable", [
            sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
            sc.ContractParam.byteArray(Buffer.from(importerId, "utf-8").toString("hex"))
        ]);
        
        logSuccess(toolName, txid);
        res.json({ 
            success: true, 
            txid, 
            explorer: `https://testnet.neotube.io/transaction/${txid}`,
            invoiceId,
            importerId,
            message: `✅ Payable CONFIRMED on-chain! ${importerId} commits to paying invoice ${invoiceId}`
        });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL: Get Terms for Invoice
// GET /importer/terms/:invoiceId
app.get('/importer/terms/:invoiceId', async (req, res) => {
    const toolName = "get_importer_terms";
    const invoiceId = req.params.invoiceId;
    const time = new Date().toLocaleTimeString();
    console.log(chalk.gray(`[${time}] `) + chalk.blueBright(`⚡ SpoonOS Call: `) + chalk.bold.white(toolName));
    console.log(chalk.gray(`       Query: `) + invoiceId);

    try {
        if (!CONTRACTS.IMPORTER) {
            throw new Error("IMPORTER_TERMS_CONTRACT_HASH not configured in .env");
        }
        
        const contract = getContract(CONTRACTS.IMPORTER);
        
        // Get terms
        const termsResult = await contract.testInvoke("get_terms", [
            sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex"))
        ]);
        
        // Get confirmation status
        const confirmedResult = await contract.testInvoke("is_confirmed", [
            sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex"))
        ]);
        
        let terms = null;
        let isConfirmed = false;
        
        if (termsResult.state === "HALT" && termsResult.stack && termsResult.stack.length > 0) {
            const raw = decodeResult(termsResult.stack[0].value);
            if (raw) {
                const parts = raw.split('|');
                terms = {
                    currency: parts[0] || 'USD',
                    jurisdiction: parts[1] || 'US'
                };
            }
        }
        
        if (confirmedResult.state === "HALT" && confirmedResult.stack && confirmedResult.stack.length > 0) {
            isConfirmed = confirmedResult.stack[0].value === true || confirmedResult.stack[0].value === 1;
        }
        
        console.log(chalk.green(`       ✔ Terms: `) + (terms ? JSON.stringify(terms) : "Not found"));
        console.log(chalk.green(`       ✔ Confirmed: `) + isConfirmed);
        console.log("");
        
        res.json({ success: true, invoiceId, terms, isConfirmed });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL: Check if Importer is Registered
// GET /importer/check/:importerId
app.get('/importer/check/:importerId', async (req, res) => {
    const toolName = "check_importer_registered";
    const importerId = req.params.importerId;
    const time = new Date().toLocaleTimeString();
    console.log(chalk.gray(`[${time}] `) + chalk.blueBright(`⚡ SpoonOS Call: `) + chalk.bold.white(toolName));
    console.log(chalk.gray(`       Query: `) + importerId);

    try {
        if (!CONTRACTS.IMPORTER) {
            throw new Error("IMPORTER_TERMS_CONTRACT_HASH not configured in .env");
        }
        
        const contract = getContract(CONTRACTS.IMPORTER);
        
        const result = await contract.testInvoke("is_importer_registered", [
            sc.ContractParam.byteArray(Buffer.from(importerId, "utf-8").toString("hex"))
        ]);
        
        let isRegistered = false;
        if (result.state === "HALT" && result.stack && result.stack.length > 0) {
            isRegistered = result.stack[0].value === true || result.stack[0].value === 1;
        }
        
        console.log(chalk.green(`       ✔ Result: `) + (isRegistered ? "Registered" : "Not registered"));
        console.log("");
        
        res.json({ success: true, importerId, isRegistered });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// CORE V1 ENDPOINTS
// ==========================================

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
