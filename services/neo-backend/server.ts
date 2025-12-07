import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import chalk from 'chalk';
import * as neonFull from "@cityofzion/neon-js";

const { experimental, sc, wallet, u } = neonFull as any;

dotenv.config();

const app = express();
app.use(bodyParser.json());

const port = process.env.PORT || 4000;

// ==========================================
// NETWORK SWITCH: testnet | local
// ==========================================
// Set NEO_NETWORK in .env OR pass via command line:
//   NEO_NETWORK=local node dist/server.cjs
//   NEO_NETWORK=testnet node dist/server.cjs

const NETWORK = process.env.NEO_NETWORK || "testnet";

import * as fs from 'fs';
import * as os from 'os';
import * as pathLib from 'path';

// Auto-detect local neo-express magic
let localMagic = 677225975;
try {
    const configPath = pathLib.join(os.homedir(), '.neo-express', 'default.neo-express');
    const neoExpressConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    localMagic = neoExpressConfig.magic;
} catch (e) { /* use default */ }

const NETWORKS: Record<string, { rpc: string; magic: number; explorer: string | null; prefix: string }> = {
    local: {
        rpc: "http://localhost:50012",
        magic: localMagic,
        explorer: null,
        prefix: "LOCAL_"
    },
    testnet: {
        rpc: "https://testnet1.neo.coz.io:443",
        magic: 894710606,
        explorer: "https://testnet.neotube.io",
        prefix: "TESTNET_"
    }
};

const NET = NETWORKS[NETWORK] || NETWORKS.testnet;
const RPC_URL = NET.rpc;
const MAGIC = NET.magic;
const EXPLORER_URL = NET.explorer;
const WIF = process.env.NEO_WALLET_WIF;

// Get contract hash based on network prefix
function getContractHash(name: string): string | undefined {
    return process.env[`${NET.prefix}${name}`];
}

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

// Contract Hashes (auto-selected by network)
const CONTRACTS = {
    INVOICE: getContractHash("INVOICE_ASSET"),
    INVESTOR: getContractHash("INVESTOR_SHARE"),
    REGISTRY: getContractHash("REGISTRY"),
    EXPORTER: getContractHash("EXPORTER"),
    IMPORTER: getContractHash("IMPORTER"),
    DD: getContractHash("DD")
};

const RAW_HASHES = {
    INVOICE: CONTRACTS.INVOICE ? CONTRACTS.INVOICE.replace(/^0x/, "") : "",
    INVESTOR: CONTRACTS.INVESTOR ? CONTRACTS.INVESTOR.replace(/^0x/, "") : "",
    EXPORTER: CONTRACTS.EXPORTER ? CONTRACTS.EXPORTER.replace(/^0x/, "") : ""
};

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
    // Hashes in .env are already big-endian (display format), just strip 0x
    const hashHex = hashStr.replace(/^0x/, "");
    return new experimental.SmartContract(u.HexString.fromHex(hashHex), neoConfig);
}

// ==========================================
// INVESTOR ECONOMICS (FIXED RATES)
// ==========================================
// Exporter pays:  9.99% annualized discount (sells receivable at discount)
// Investor gets:  7.00% annualized return (buys at discount, receives face value)
// Vabble keeps:   2.99% spread (risk-free execution fee)
//
// NO NEGOTIATION - Vabble matches deals to investor preferences and executes

const PLATFORM_RATES = {
    EXPORTER_DISCOUNT_BPS: 999,   // 9.99% - what exporter pays
    INVESTOR_RETURN_BPS: 700,     // 7.00% - what investor earns
    VABBLE_SPREAD_BPS: 299        // 2.99% - platform keeps
};

interface InvestorPreferences {
    maxTermDays: number;         // e.g., 90 days max
    minDealSize: number;         // e.g., $10,000 minimum
    maxDealSize: number;         // e.g., $500,000 maximum
    preferredSectors: string[];  // e.g., ["agriculture", "manufacturing"]
    acceptedCountries: string[]; // e.g., ["VE", "PE", "CO"]
}

interface DealCalculation {
    faceValue: number;
    termDays: number;
}

function calculateDeal(params: DealCalculation) {
    const { faceValue, termDays } = params;
    const termFraction = termDays / 365;
    
    // Total discount exporter pays (9.99% annualized)
    const totalDiscount = faceValue * (PLATFORM_RATES.EXPORTER_DISCOUNT_BPS / 10000) * termFraction;
    
    // What investor pays (face value minus total discount)
    const investorPays = faceValue - totalDiscount;
    
    // Investor receives full face value at maturity
    const investorReceives = faceValue;
    
    // Investor profit (7% of what they paid, annualized)
    const investorProfit = faceValue * (PLATFORM_RATES.INVESTOR_RETURN_BPS / 10000) * termFraction;
    
    // Vabble fee (the spread: 2.99%)
    const vabbleFee = totalDiscount - investorProfit;
    
    return {
        faceValue,
        termDays,
        // Exporter side
        exporterReceives: Math.round(investorPays * 100) / 100,
        exporterDiscount: Math.round(totalDiscount * 100) / 100,
        exporterDiscountPercent: Math.round((totalDiscount / faceValue) * 10000) / 100,
        // Investor side  
        investorPays: Math.round(investorPays * 100) / 100,
        investorReceives: Math.round(investorReceives * 100) / 100,
        investorProfit: Math.round(investorProfit * 100) / 100,
        investorYieldBps: PLATFORM_RATES.INVESTOR_RETURN_BPS,
        // Platform
        vabbleFee: Math.round(vabbleFee * 100) / 100,
        vabbleSpreadBps: PLATFORM_RATES.VABBLE_SPREAD_BPS
    };
}

// Check if deal matches investor preferences
function dealMatchesPreferences(
    preferences: InvestorPreferences,
    termDays: number,
    faceValue: number,
    sector?: string,
    country?: string
): { matches: boolean; reason?: string } {
    if (termDays > preferences.maxTermDays) {
        return { matches: false, reason: `Term ${termDays}d exceeds max ${preferences.maxTermDays}d` };
    }
    if (faceValue < preferences.minDealSize) {
        return { matches: false, reason: `Size $${faceValue} below min $${preferences.minDealSize}` };
    }
    if (faceValue > preferences.maxDealSize) {
        return { matches: false, reason: `Size $${faceValue} exceeds max $${preferences.maxDealSize}` };
    }
    if (sector && preferences.preferredSectors.length > 0 && !preferences.preferredSectors.includes(sector)) {
        return { matches: false, reason: `Sector ${sector} not in preferred: ${preferences.preferredSectors.join(', ')}` };
    }
    if (country && preferences.acceptedCountries.length > 0 && !preferences.acceptedCountries.includes(country)) {
        return { matches: false, reason: `Country ${country} not accepted` };
    }
    return { matches: true };
}

// In-memory investor profiles
const investorProfiles: Map<string, InvestorPreferences> = new Map();

// ==========================================
// LOGGING HELPERS (Polished for Demo)
// ==========================================

function logRequest(tool: string, body: any) {
    const time = new Date().toLocaleTimeString();
    console.log(chalk.gray(`[${time}] `) + chalk.blueBright(`⚡ SpoonOS Call: `) + chalk.bold.white(tool));
    console.log(chalk.gray(`       Payload: `) + JSON.stringify(body));
}

function logSuccess(tool: string, txid: string) {
    console.log(chalk.green(`       ✔ Success! `) + chalk.gray(`TXID: `) + chalk.yellow(txid));
    if (EXPLORER_URL) {
        console.log(chalk.gray(`       🔗 Explorer: `) + chalk.cyan.underline(`${EXPLORER_URL}/transaction/${txid}`));
    } else {
        console.log(chalk.gray(`       📍 Local neo-express (no explorer)`));
    }
    console.log("");
}

function getExplorerUrl(txid: string): string | null {
    return EXPLORER_URL ? `${EXPLORER_URL}/transaction/${txid}` : null;
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
// DD (DUE DILIGENCE) ENDPOINTS
// ==========================================

// TOOL: Set Exporter DD Status
// POST /dd/exporter
app.post('/dd/exporter', async (req, res) => {
    const toolName = "set_exporter_dd";
    logRequest(toolName, req.body);

    try {
        const { exporterId, kycTier, ddMerkleRoot, kycStatus } = req.body;
        
        if (!CONTRACTS.DD) {
            throw new Error("DD_REGISTRY_CONTRACT_HASH not configured in .env");
        }
        
        const contract = getContract(CONTRACTS.DD);
        
        // Convert merkle root to bytes (expects hex string or will use placeholder)
        const merkleBytes = ddMerkleRoot 
            ? Buffer.from(ddMerkleRoot.replace('0x', ''), 'hex').toString('hex')
            : Buffer.alloc(32).toString('hex'); // 32-byte placeholder
        
        console.log(chalk.magenta(`       → Invoking DDRegistry.set_exporter_dd()...`));
        const txid = await contract.invoke("set_exporter_dd", [
            sc.ContractParam.byteArray(Buffer.from(exporterId, "utf-8").toString("hex")),
            sc.ContractParam.string(kycTier || "PENDING"),
            sc.ContractParam.byteArray(merkleBytes),
            sc.ContractParam.string(kycStatus || "PENDING")
        ]);
        
        logSuccess(toolName, txid);
        res.json({ 
            success: true, 
            txid, 
            explorer: `https://testnet.neotube.io/transaction/${txid}`,
            exporterId,
            kycTier,
            kycStatus,
            message: `Exporter DD status set: ${kycTier} / ${kycStatus}`
        });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL: Set Invoice DD Status
// POST /dd/invoice
app.post('/dd/invoice', async (req, res) => {
    const toolName = "set_invoice_dd";
    logRequest(toolName, req.body);

    try {
        const { invoiceId, docsStatus, docBundleHash, hasBl, hasPo, hasInsurance } = req.body;
        
        if (!CONTRACTS.DD) {
            throw new Error("DD_REGISTRY_CONTRACT_HASH not configured in .env");
        }
        
        const contract = getContract(CONTRACTS.DD);
        
        // Convert doc hash to bytes
        const hashBytes = docBundleHash 
            ? Buffer.from(docBundleHash.replace('0x', ''), 'hex').toString('hex')
            : Buffer.alloc(32).toString('hex');
        
        console.log(chalk.magenta(`       → Invoking DDRegistry.set_invoice_dd()...`));
        const txid = await contract.invoke("set_invoice_dd", [
            sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
            sc.ContractParam.string(docsStatus || "MISSING"),
            sc.ContractParam.byteArray(hashBytes),
            sc.ContractParam.boolean(hasBl || false),
            sc.ContractParam.boolean(hasPo || false),
            sc.ContractParam.boolean(hasInsurance || false)
        ]);
        
        logSuccess(toolName, txid);
        res.json({ 
            success: true, 
            txid, 
            explorer: `https://testnet.neotube.io/transaction/${txid}`,
            invoiceId,
            docsStatus,
            hasBl,
            hasPo,
            hasInsurance,
            message: `Invoice DD: ${docsStatus} | BL:${hasBl} PO:${hasPo} INS:${hasInsurance}`
        });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL: Get Exporter DD Status
// GET /dd/exporter/:exporterId
app.get('/dd/exporter/:exporterId', async (req, res) => {
    const toolName = "get_exporter_dd";
    const exporterId = req.params.exporterId;
    const time = new Date().toLocaleTimeString();
    console.log(chalk.gray(`[${time}] `) + chalk.blueBright(`⚡ SpoonOS Call: `) + chalk.bold.white(toolName));
    console.log(chalk.gray(`       Query: `) + exporterId);

    try {
        if (!CONTRACTS.DD) {
            throw new Error("DD_REGISTRY_CONTRACT_HASH not configured in .env");
        }
        
        const contract = getContract(CONTRACTS.DD);
        const idBytes = Buffer.from(exporterId, "utf-8").toString("hex");
        
        // Get KYC tier
        const tierResult = await contract.testInvoke("get_exporter_kyc_tier", [
            sc.ContractParam.byteArray(idBytes)
        ]);
        
        // Get KYC status
        const statusResult = await contract.testInvoke("get_exporter_kyc_status", [
            sc.ContractParam.byteArray(idBytes)
        ]);
        
        // Get verifier
        const verifierResult = await contract.testInvoke("get_exporter_verifier", [
            sc.ContractParam.byteArray(idBytes)
        ]);
        
        let kycTier = decodeResult(tierResult.stack?.[0]?.value) || "NOT_SET";
        let kycStatus = decodeResult(statusResult.stack?.[0]?.value) || "NOT_SET";
        let verifier = decodeResult(verifierResult.stack?.[0]?.value) || null;
        
        console.log(chalk.green(`       ✔ KYC Tier: ${kycTier}, Status: ${kycStatus}`));
        console.log("");
        
        res.json({ 
            success: true, 
            exporterId, 
            kycTier, 
            kycStatus,
            verifier,
            ddComplete: kycStatus === 'APPROVED'
        });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL: Get Invoice DD Status
// GET /dd/invoice/:invoiceId
app.get('/dd/invoice/:invoiceId', async (req, res) => {
    const toolName = "get_invoice_dd";
    const invoiceId = req.params.invoiceId;
    const time = new Date().toLocaleTimeString();
    console.log(chalk.gray(`[${time}] `) + chalk.blueBright(`⚡ SpoonOS Call: `) + chalk.bold.white(toolName));
    console.log(chalk.gray(`       Query: `) + invoiceId);

    try {
        if (!CONTRACTS.DD) {
            throw new Error("DD_REGISTRY_CONTRACT_HASH not configured in .env");
        }
        
        const contract = getContract(CONTRACTS.DD);
        const idBytes = Buffer.from(invoiceId, "utf-8").toString("hex");
        
        // Get docs status
        const statusResult = await contract.testInvoke("get_invoice_docs_status", [
            sc.ContractParam.byteArray(idBytes)
        ]);
        
        // Get document flags
        const blResult = await contract.testInvoke("has_bill_of_lading", [
            sc.ContractParam.byteArray(idBytes)
        ]);
        const poResult = await contract.testInvoke("has_purchase_order", [
            sc.ContractParam.byteArray(idBytes)
        ]);
        const insResult = await contract.testInvoke("has_insurance", [
            sc.ContractParam.byteArray(idBytes)
        ]);
        
        // Check if DD complete
        const completeResult = await contract.testInvoke("is_dd_complete", [
            sc.ContractParam.byteArray(idBytes)
        ]);
        
        let docsStatus = decodeResult(statusResult.stack?.[0]?.value) || "NOT_SET";
        let hasBl = blResult.stack?.[0]?.value === true || blResult.stack?.[0]?.value === 1;
        let hasPo = poResult.stack?.[0]?.value === true || poResult.stack?.[0]?.value === 1;
        let hasInsurance = insResult.stack?.[0]?.value === true || insResult.stack?.[0]?.value === 1;
        let ddComplete = completeResult.stack?.[0]?.value === true || completeResult.stack?.[0]?.value === 1;
        
        console.log(chalk.green(`       ✔ Docs: ${docsStatus} | BL:${hasBl} PO:${hasPo} INS:${hasInsurance}`));
        console.log("");
        
        res.json({ 
            success: true, 
            invoiceId, 
            docsStatus,
            hasBl,
            hasPo,
            hasInsurance,
            ddComplete
        });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// TOOL: Verify DD (mark as verified by Vabble)
// POST /dd/verify
app.post('/dd/verify', async (req, res) => {
    const toolName = "verify_dd";
    logRequest(toolName, req.body);

    try {
        const { entityId, entityType, verifier } = req.body;
        
        if (!CONTRACTS.DD) {
            throw new Error("DD_REGISTRY_CONTRACT_HASH not configured in .env");
        }
        
        const contract = getContract(CONTRACTS.DD);
        const method = entityType === 'exporter' ? 'verify_exporter_dd' : 'verify_invoice_dd';
        
        console.log(chalk.magenta(`       → Invoking DDRegistry.${method}()...`));
        const txid = await contract.invoke(method, [
            sc.ContractParam.byteArray(Buffer.from(entityId, "utf-8").toString("hex")),
            sc.ContractParam.string(verifier || "vabble_ops")
        ]);
        
        logSuccess(toolName, txid);
        res.json({ 
            success: true, 
            txid, 
            explorer: `https://testnet.neotube.io/transaction/${txid}`,
            entityId,
            entityType,
            verifier,
            message: `✅ DD VERIFIED by ${verifier || 'vabble_ops'}`
        });
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

// ==========================================
// INVESTOR PROFILE & DEAL ENDPOINTS
// ==========================================

// Register Investor Profile (preferences for matching - NO negotiation)
// POST /investor/profile
app.post('/investor/profile', async (req, res) => {
    const toolName = "register_investor_profile";
    logRequest(toolName, req.body);

    try {
        const { 
            investorId, 
            maxTermDays = 90,
            minDealSize = 10000,
            maxDealSize = 500000,
            preferredSectors = [],
            acceptedCountries = []
        } = req.body;

        if (!investorId) {
            throw new Error("investorId is required");
        }

        const preferences: InvestorPreferences = {
            maxTermDays,
            minDealSize,
            maxDealSize,
            preferredSectors,
            acceptedCountries
        };

        investorProfiles.set(investorId, preferences);

        console.log(chalk.green(`       ✔ Investor profile registered`));
        console.log(chalk.gray(`       📊 Fixed Return: 7.00% | Max Term: ${maxTermDays}d | Size: $${minDealSize}-$${maxDealSize}`));
        
        res.json({ 
            success: true, 
            investorId,
            preferences,
            fixedRates: {
                investorReturn: "7.00% annualized",
                exporterPays: "9.99% annualized discount",
                vabbleSpread: "2.99%"
            },
            message: `Investor ${investorId} registered. Deals matching preferences will be auto-executed at 7% return.`
        });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get Investor Profile
// GET /investor/profile/:investorId
app.get('/investor/profile/:investorId', (req, res) => {
    const { investorId } = req.params;
    const profile = investorProfiles.get(investorId);
    
    if (!profile) {
        return res.status(404).json({ success: false, error: "Investor not found" });
    }
    
    res.json({ 
        success: true, 
        investorId, 
        preferences: profile,
        fixedRates: PLATFORM_RATES
    });
});

// Calculate Deal (fixed rates - shows exporter and investor economics)
// POST /investor/calculate-deal
app.post('/investor/calculate-deal', (req, res) => {
    const toolName = "calculate_deal";
    logRequest(toolName, req.body);

    try {
        const { faceValue, termDays } = req.body;

        if (!faceValue || !termDays) {
            throw new Error("faceValue and termDays are required");
        }

        const deal = calculateDeal({ faceValue, termDays });

        console.log(chalk.green(`       ✔ Deal calculated (fixed rates)`));
        console.log(chalk.gray(`       💵 Face: $${faceValue} | Term: ${termDays}d`));
        console.log(chalk.gray(`       🏭 Exporter receives: $${deal.exporterReceives} (pays ${deal.exporterDiscountPercent}% discount)`));
        console.log(chalk.gray(`       💰 Investor pays: $${deal.investorPays} → receives: $${deal.investorReceives} (7% return)`));
        console.log(chalk.gray(`       🏦 Vabble fee: $${deal.vabbleFee}`));
        
        res.json({ 
            success: true, 
            deal,
            summary: {
                forExporter: `Receive $${deal.exporterReceives} today for $${faceValue} receivable (${deal.exporterDiscountPercent}% discount, 9.99% annualized)`,
                forInvestor: `Pay $${deal.investorPays}, receive $${deal.investorReceives} in ${termDays} days (7% annualized return)`,
                forVabble: `$${deal.vabbleFee} platform fee (2.99% spread)`
            }
        });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check if deal matches investor preferences
// POST /investor/check-match
app.post('/investor/check-match', (req, res) => {
    const toolName = "check_investor_match";
    logRequest(toolName, req.body);

    try {
        const { investorId, invoiceId, faceValue, termDays, sector, country } = req.body;

        const preferences = investorProfiles.get(investorId);
        if (!preferences) {
            return res.json({ 
                success: true, 
                matches: false, 
                reason: "Investor not registered" 
            });
        }

        const match = dealMatchesPreferences(preferences, termDays, faceValue, sector, country);
        const deal = calculateDeal({ faceValue, termDays });

        console.log(match.matches 
            ? chalk.green(`       ✔ Deal matches ${investorId}'s preferences`)
            : chalk.yellow(`       ⚠ Deal does not match: ${match.reason}`));
        
        res.json({ 
            success: true,
            invoiceId,
            investorId,
            matches: match.matches,
            reason: match.reason,
            dealIfExecuted: match.matches ? deal : null,
            message: match.matches 
                ? `Ready to execute - investor pays $${deal.investorPays}, earns $${deal.investorProfit}`
                : `Cannot execute: ${match.reason}`
        });
    } catch (error: any) {
        logError(toolName, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Execute Investment (auto-matched, fixed rates, on-chain)
// POST /investor/execute
app.post('/investor/execute', async (req, res) => {
    const toolName = "execute_investment";
    logRequest(toolName, req.body);

    try {
        const { invoiceId, investorId, faceValue, termDays, sector, country } = req.body;

        // Check preferences
        const preferences = investorProfiles.get(investorId);
        if (preferences) {
            const match = dealMatchesPreferences(preferences, termDays, faceValue, sector, country);
            if (!match.matches) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Deal does not match investor preferences: ${match.reason}` 
                });
            }
        }

        // Calculate at fixed rates
        const deal = calculateDeal({ faceValue, termDays });

        // Record on-chain
        const contract = getContract(CONTRACTS.INVESTOR);
        
        console.log(chalk.magenta(`       → Recording investment on-chain (fixed 7% return)...`));
        const txid = await contract.invoke("allocate", [
            sc.ContractParam.byteArray(Buffer.from(invoiceId, "utf-8").toString("hex")),
            sc.ContractParam.byteArray(Buffer.from(investorId, "utf-8").toString("hex")),
            sc.ContractParam.integer(Math.round(deal.investorPays * 100))
        ]);

        logSuccess(toolName, txid);
        
        res.json({ 
            success: true,
            txid,
            investment: {
                invoiceId,
                investorId,
                faceValue: deal.faceValue,
                termDays: deal.termDays,
                investorPays: deal.investorPays,
                investorReceives: deal.investorReceives,
                investorProfit: deal.investorProfit,
                investorYield: "7.00%",
                vabbleFee: deal.vabbleFee,
                maturityDate: new Date(Date.now() + termDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            },
            explorer: getExplorerUrl(txid)
        });
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
    console.log(chalk.white(`🌍 Network:  `) + (NETWORK === "local" 
        ? chalk.magenta(`🧪 LOCAL (neo-express)`)
        : chalk.cyan(`🌐 TESTNET (Neo N3 T5)`)));
    console.log(chalk.white(`🔗 RPC:      `) + chalk.gray(RPC_URL));
    console.log(chalk.white(`🔑 Wallet:   `) + chalk.yellow(account ? account.address : "Invalid"));
    if (NETWORK === "local") {
        console.log(chalk.magenta(`\n💡 LOCAL MODE - Free & instant, no GAS`));
        console.log(chalk.gray(`   Ensure neo-express is running: npm run neoxp:start`));
    } else {
        console.log(chalk.cyan(`\n💰 TESTNET MODE - Real chain, costs GAS`));
    }
    console.log(chalk.gray("───────────────────────────────────────"));
    console.log(chalk.gray("Waiting for SpoonOS tool calls...\n"));
});
