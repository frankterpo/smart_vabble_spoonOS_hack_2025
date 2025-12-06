# Vabble Decentralised Receivables – Backend Spec Index

This folder contains the full backend specification for the **Vabble decentralised trade‑receivables platform (v1)**, designed for use with **Cursor Opus 4.5** (or similar coding agents).  
All files are written to be **directive**, **implementation‑ready**, and **modular**.

You can load these specs into Cursor and reference them in prompts, for example:

> _“You have access to the following spec files: `01_ARCHITECTURE.md`, `02_SMART_CONTRACTS.md`, `03_AGENTS.md`, `04_BACKEND_CLI.md`, `05_MCP_INTEGRATIONS.md`, `06_CI_CD.md`, `07_TEST_AND_DEMO.md`.  
> Build the entire backend according to these specifications.”_

---

## File Map

1. **01_ARCHITECTURE.md**  
   High‑level system overview, actors, data flows, components, dependencies, security assumptions, and folder structure.

2. **02_SMART_CONTRACTS.md**  
   Detailed Neo N3 contract suite spec: `InvoiceAsset`, `InvestorShare`, `PlatformFee`. Includes function‑by‑function requirements, data layout, events, and deployment interface for agents.

3. **03_AGENTS.md**  
   Full SpoonOS agent architecture: `BaseAgent`, `OnboardingAgent`, `RiskAgent`, `ListingAgent`, `FundingAgent`, `SettlementAgent`, `VoiceAgent` (optional). Defines responsibilities, inputs/outputs, and how each agent invokes smart contracts and external tools.

4. **04_BACKEND_CLI.md**  
   CLI‑only backend behaviour and commands. Defines Python entrypoints, arguments, options, and how to chain agents to perform end‑to‑end flows without any web UI.

5. **05_MCP_INTEGRATIONS.md**  
   How to integrate MCP‑style tools (Dynamic Tool Discovery, Vector Search, external data providers) to improve risk modelling and metadata retrieval in later versions, with minimal changes to v1.

6. **06_CI_CD.md**  
   GitHub Actions workflows, linting and test stages, contract compilation in CI, safe secrets handling, and branching recommendations for a small startup team.

7. **07_TEST_AND_DEMO.md**  
   End‑to‑end test plan, sample data, expected outputs, automated test scripts, and a step‑by‑step demo script for a live hackathon presentation.

---

## Recommended Use with Cursor / Opus 4.5

1. Place all spec files in a `spec/` directory in your repo.  
2. In Cursor, open the `spec/` folder so Opus can read them.  
3. Use a system prompt such as:

```text
You are a senior backend engineer agent. You must strictly follow the specification documents in the /spec directory:

- 01_ARCHITECTURE.md
- 02_SMART_CONTRACTS.md
- 03_AGENTS.md
- 04_BACKEND_CLI.md
- 05_MCP_INTEGRATIONS.md
- 06_CI_CD.md
- 07_TEST_AND_DEMO.md

Do not invent new features. Implement only what is specified. Ask for clarification only if a requirement is ambiguous or conflicting.
```

4. Start by asking Opus to scaffold the project structure, then implement contracts, agents, and CLI commands step by step.

---

## External References (for the coding agent)

The following online resources can be used by Opus for more context if needed:

- SpoonOS install & docs: `https://xspoonai.github.io/docs/getting-started/installation/`
- SpoonOS examples index: `https://xspoonai.github.io/docs/examples/`
- Graph Crypto Analysis example: `https://xspoonai.github.io/docs/examples/graph-crypto-analysis/`
- x402 React Agent example: `https://xspoonai.github.io/docs/examples/x402-react-agent/`
- XSpoonAi GitHub org: `https://github.com/XSpoonAi`
- Scoop AI Hackathon Guidelines: `https://neomarketing.notion.site/Scoop-AI-Hackathon-Guidelines-2bc10fda5dce802291cbf7cee335cc43`

These links **inform** the design but are **not** a substitute for the spec files themselves.
