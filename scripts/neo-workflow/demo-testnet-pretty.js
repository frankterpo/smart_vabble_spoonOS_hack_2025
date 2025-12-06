#!/usr/bin/env node
import { execSync } from "child_process";
import chalk from "chalk";

// Pretty logging helpers
const hdr = (t) =>
  console.log(chalk.cyan("\n───────────────────────────────────────────────\n▶ " + t + "\n───────────────────────────────────────────────"));

const call = (label, fn) => {
  console.log(chalk.yellow(`Calling SpoonOS Tool: ${label}`));
  return fn();
};

const prettyTx = (title, txid) => {
  console.log(chalk.green(`✔ ${title}`));
  console.log(chalk.white(`  TXID: ${txid}`));
  console.log(chalk.white(`  Explorer: https://testnet.neotube.io/transaction/${txid}`));
};

// Generate random ID to ensure fresh state every run
const randomId = Math.floor(Math.random() * 10000);
const INVOICE_ID = `INV-DEMO-${randomId}`;

// Start demo
console.clear();
console.log(chalk.bold.green("VABBLE × SCOOP — On-Chain Demo (TestNet)\n"));

hdr("STEP 1 — Register invoice on-chain");

call("register_invoice", () => {
  console.log("Payload:");
  console.log(`  invoiceId: ${INVOICE_ID}`);
  console.log("  buyer: WholeFoods");
  console.log("  exporter: LatAmFoods");
  console.log("  amount: 50000");
  
  // This triggers your running backend:
  const r = execSync(
    `curl -s -X POST http://localhost:4000/invoice/register -H "Content-Type: application/json" -d '{"invoiceId":"${INVOICE_ID}","buyer":"WholeFoods","exporter":"LatAmFoods","amount":50000}'`
  ).toString();

  try {
    const out = JSON.parse(r);
    if (out.error) {
        console.error(chalk.red(`❌ Error: ${out.error}`));
        process.exit(1);
    }
    console.log(chalk.magenta(`→ Backend: /invoice/register`));
    console.log(chalk.magenta(`→ Blockchain: InvoiceAsset.register()`));

    prettyTx("Invoice registered on-chain", out.txid);
  } catch (e) {
      console.error(chalk.red("Failed to parse response:"), r);
  }
});


hdr("STEP 2 — Allocate Investor Capital");

call("allocate_shares", () => {
  console.log("Payload:");
  console.log(`  invoiceId: ${INVOICE_ID}`);
  console.log("  investor: INVESTOR-A");
  console.log("  amount: 30000");

  const r = execSync(
    `curl -s -X POST http://localhost:4000/investor/allocate -H "Content-Type: application/json" -d '{"invoiceId":"${INVOICE_ID}","investor":"INVESTOR-A","amount":30000}'`
  ).toString();

  const out = JSON.parse(r);
  console.log(chalk.magenta(`→ Backend: /investor/allocate`));
  console.log(chalk.magenta(`→ Blockchain: InvestorShare.allocate()`));
  prettyTx("Capital allocation confirmed", out.txid);
});

hdr("STEP 3 — Register in Registry (Linking)");

call("registry_register", () => {
  console.log("Payload:");
  console.log(`  invoiceId: ${INVOICE_ID}`);

  const r = execSync(
    `curl -s -X POST http://localhost:4000/registry/register -H "Content-Type: application/json" -d '{"invoiceId":"${INVOICE_ID}"}'`
  ).toString();

  const out = JSON.parse(r);
  console.log(chalk.magenta(`→ Backend: /registry/register`));
  console.log(chalk.magenta(`→ Blockchain: RegistryV2.register()`));
  prettyTx("Linked in Registry", out.txid);
});


hdr("STEP 4 — Activate Lifecycle Status");

call("set_status", () => {
  console.log("Payload:");
  console.log(`  invoiceId: ${INVOICE_ID}`);
  console.log("  status: ACTIVE");

  const r = execSync(
    `curl -s -X POST http://localhost:4000/registry/status -H "Content-Type: application/json" -d '{"invoiceId":"${INVOICE_ID}","status":"ACTIVE"}'`
  ).toString();

  const out = JSON.parse(r);
  console.log(chalk.magenta(`→ Backend: /registry/status`));
  console.log(chalk.magenta(`→ Blockchain: RegistryV2.set_status()`));
  prettyTx("Status updated", out.txid);
});


hdr("STEP 5 — Settle the Invoice");

console.log(chalk.gray("⏳ Waiting 15s for blocks to confirm before settlement..."));
execSync("sleep 15");

call("settle_invoice", () => {
  console.log("Payload:");
  console.log(`  invoiceId: ${INVOICE_ID}`);

  const r = execSync(
    `curl -s -X POST http://localhost:4000/settlement/run -H "Content-Type: application/json" -d '{"invoiceId":"${INVOICE_ID}"}'`
  ).toString();

  const out = JSON.parse(r);
  console.log(chalk.magenta(`→ Backend: /settlement/run`));
  console.log(chalk.magenta(`→ Blockchain: InvoiceAsset.settle() + InvestorShare.redeem() + RegistryV2.settled()`));
  prettyTx("Settlement completed", out.txid);
});


hdr("DEMO COMPLETE");
console.log(chalk.green("🎉 Invoice lifecycle executed fully on Neo N3 TestNet."));
console.log(chalk.gray(`(Invoice ID used: ${INVOICE_ID})`));

