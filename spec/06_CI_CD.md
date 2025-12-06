# 06 – CI/CD Spec (GitHub Actions)

This document defines the minimal but robust CI/CD setup for the v1 backend.

Goals:
- Automatic checks on every push/PR.
- Contract compilation guaranteed in CI.
- Tests run before merging to main.
- Secrets stored securely.

---

## 1. Repository Layout for CI

CI expects:

- `requirements.txt` at root.  
- `contracts/` with Boa contracts.  
- `agents/` and `scripts/` with Python code.  
- `ci/github-actions.yml` as main workflow.  

---

## 2. Requirements File

`requirements.txt` should minimally include:

```text
spoon-sdk
spoon-toolkits
neo3-boa
python-dotenv
requests
pytest
flake8
```

Add any additional libraries used by agents or scripts.

---

## 3. GitHub Actions Workflow

Create `ci/github-actions.yml` (or `.github/workflows/ci.yml` if preferred).

### 3.1 Basic Workflow

```yaml
name: CI

on:
  push:
    branches: [ "main", "develop" ]
  pull_request:
    branches: [ "main", "develop" ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt

      - name: Lint
        run: |
          flake8 agents scripts contracts

      - name: Run tests
        run: |
          pytest

      - name: Compile contracts
        run: |
          boa compile contracts/InvoiceAsset.py
          boa compile contracts/InvestorShare.py
          boa compile contracts/PlatformFee.py
```

---

## 4. Secrets Management

- In GitHub repo settings, under **Settings → Secrets and variables → Actions**, define:
  - `NEO_WALLET_PRIVATE_KEY` (if you ever deploy from CI – optional).
  - Any API keys if used.

> **For v1 hackathon**: it is acceptable to deploy contracts manually from local and only use CI for tests/linting.

Avoid using real or sensitive keys; testnet keys only.

---

## 5. Branching Strategy (Suggestive)

- `main` – stable, demo‑ready branch.
- `develop` – active development branch.
- Feature branches: `feature/*`.

All PRs must:
- Pass CI (lint + tests + compile) before merge.

---

## 6. Optional: Deployment Job

If you want to auto‑deploy NEF to TestNet from CI:

- Add a job guarded by a manual `workflow_dispatch` or tag.

Pseudocode example:

```yaml
  deploy:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'workflow_dispatch'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: "3.12"
      - run: |
          pip install -r requirements.txt
          boa compile contracts/InvoiceAsset.py
          # TODO: run deployment script using env secrets
```

For hackathon, manual `python scripts/deploy_contracts.py` from your machine is usually simpler.
