# Vabble Agent (Powered by SpoonOS & Neo N3)

> **Tagline:** The first autonomous AI agent for on-chain trade finance.

[![Watch the Demo](https://img.shields.io/badge/Watch_Demo-Video-red)](https://drive.google.com/file/d/1pFEEcRIbQLAIDX07Fa1A8bIIIeyZwX1u/view?usp=sharing)

## 💡 Short Description

Vabble is an autonomous AI agent that tokenizes, finances, and settles real-world invoices on the Neo N3 blockchain. Built on **SpoonOS**, it replaces complex banking dashboards with a simple natural-language interface, allowing exporters to turn unpaid invoices into liquid assets instantly.

## ✨ Key Features

1.  **Autonomous Onboarding**: The agent verifies invoice data and mints a "Digital Invoice Asset" on Neo N3 (TestNet).
2.  **Capital Allocation**: Investors can be declared and allocated fractional shares of an invoice via smart contracts.
3.  **Lifecycle Management**: Real-time status updates (Verified, Funded, Active) are recorded immutably on-chain.
4.  **Smart Settlement**: When payment is received, the agent orchestrates an atomic settlement, redeeming investor shares and closing the invoice automatically.

## 🏗 How it Works

*   **Agent**: Built on SpoonOS (Python), using local LLMs (Ollama) for privacy and reasoning.
*   **Infrastructure**: A custom Node.js backend connects the AI capabilities to the Neo N3 blockchain.
*   **Smart Contracts**: Three custom Python (boa3) contracts handle the asset logic, equity distribution, and registry state.

## 🚀 Live on TestNet

This infrastructure is live on Neo N3 TestNet.

*   **InvoiceAsset Contract**: [Explorer](https://testnet.neotube.io/contract/566f9599926df494a64854f33be188c5ad073d26)
*   **InvestorShare Contract**: [Explorer](https://testnet.neotube.io/contract/4a6d38ca03b790f8c9913c1d1ee33b7b66b94f28)
*   **Registry Contract**: [Explorer](https://testnet.neotube.io/contract/198f17ecebce01b20ee07d8e46813b281dacd9eb)

## 🛠 Installation & Usage

### Prerequisites
*   Node.js 18+
*   Python 3.10+
*   Ollama (for local LLM)

### 1. Setup Backend
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# (Add your NEO_WALLET_WIF)

# Compile TypeScript backend
npx tsc services/neo-backend/server.ts --esModuleInterop --moduleResolution node --target ES2020 --module CommonJS --outDir dist
mv dist/server.js dist/server.cjs

# Run the backend
node -r dotenv/config dist/server.cjs
```

### 2. Run the Agent Demo
In a separate terminal:
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate
pip install openai python-dotenv requests

# Run the agent
python3 scripts/agent/vabble_agent.py
```

## 🔮 Future Roadmap

*   **Privacy**: Transitioning to a private Neo infrastructure for sensitive commercial data.
*   **Voice AI**: Integrating **ElevenLabs** to allow exporters to onboard invoices via phone calls—fully handled by the AI.
*   **Cross-Chain**: Expanding settlement to NeoX (EVM) for broader liquidity.

## 🧠 Why SpoonOS?

SpoonOS provided the critical reasoning layer, allowing us to turn rigid blockchain transactions into a flexible, conversation-driven workflow. It bridges the gap between "Web2 operations" and "Web3 settlement."

---

**Hackathon Submission 2025**
