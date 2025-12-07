"""
Vabble Tools V2 - Extended toolset with Exporter Mode
Includes all V1 tools + new exporter flow tools for 3-sided marketplace
"""

import requests
import json
import os

# Backend Configuration
BACKEND_URL = os.getenv("VABBLE_BACKEND_URL", "http://localhost:4000")

# ==========================================
# V1 CORE TOOLS (Existing)
# ==========================================

def register_invoice(invoice_id: str, amount: int, buyer: str, exporter: str):
    """
    Registers a new invoice on the blockchain.
    
    Args:
        invoice_id (str): Unique ID for the invoice (e.g. INV-1001).
        amount (int): Invoice amount in cents/integers.
        buyer (str): Name of the buyer.
        exporter (str): Name of the exporter.
    """
    url = f"{BACKEND_URL}/invoice/register"
    payload = {
        "invoiceId": invoice_id,
        "amount": amount,
        "buyer": buyer,
        "exporter": exporter,
        "currency": "USD",
        "dueDate": 20251231
    }
    print(f"\n🛠️  TOOL: Calling register_invoice for {invoice_id}...")
    try:
        resp = requests.post(url, json=payload)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def allocate_shares(invoice_id: str, investor: str, amount: int):
    """
    Allocates shares of an invoice to an investor.
    
    Args:
        invoice_id (str): ID of the invoice.
        investor (str): Investor identifier (e.g. INVESTOR-A).
        amount (int): Amount to allocate.
    """
    url = f"{BACKEND_URL}/investor/allocate"
    payload = {
        "invoiceId": invoice_id,
        "investor": investor,
        "amount": amount
    }
    print(f"\n🛠️  TOOL: Calling allocate_shares for {investor}...")
    try:
        resp = requests.post(url, json=payload)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def registry_register(invoice_id: str):
    """
    Registers the invoice in the central Receivable Registry contract.
    
    Args:
        invoice_id (str): ID of the invoice.
    """
    url = f"{BACKEND_URL}/registry/register"
    payload = {"invoiceId": invoice_id}
    print(f"\n🛠️  TOOL: Calling registry_register for {invoice_id}...")
    try:
        resp = requests.post(url, json=payload)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def set_status(invoice_id: str, status: str):
    """
    Updates the lifecycle status of an invoice.
    
    Args:
        invoice_id (str): ID of the invoice.
        status (str): New status (ACTIVE, VERIFIED, SETTLED, CANCELLED).
    """
    url = f"{BACKEND_URL}/registry/status"
    payload = {
        "invoiceId": invoice_id,
        "status": status
    }
    print(f"\n🛠️  TOOL: Calling set_status to {status}...")
    try:
        resp = requests.post(url, json=payload)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def settle_invoice(invoice_id: str):
    """
    Executes final settlement for an invoice (redeems shares + marks settled).
    
    Args:
        invoice_id (str): ID of the invoice.
    """
    url = f"{BACKEND_URL}/settlement/run"
    payload = {"invoiceId": invoice_id}
    print(f"\n🛠️  TOOL: Calling settle_invoice for {invoice_id}...")
    try:
        resp = requests.post(url, json=payload)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def query_invoice_status(invoice_id: str):
    """
    Queries the current on-chain status of an invoice.
    
    Args:
        invoice_id (str): ID of the invoice.
    """
    url = f"{BACKEND_URL}/registry/status/{invoice_id}"
    print(f"\n🛠️  TOOL: Querying status for {invoice_id}...")
    try:
        resp = requests.get(url)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


# ==========================================
# V2 EXPORTER MODE TOOLS (New)
# ==========================================

def register_exporter_profile(exporter_id: str, company_name: str, country: str, sector: str = "general"):
    """
    Register a new exporter with KYC-lite profile on-chain.
    
    Args:
        exporter_id (str): Unique exporter ID or tax ID
        company_name (str): Company/business name
        country (str): ISO country code (e.g., VE, CO, PE)
        sector (str): Industry sector (e.g., cacao, coffee, metals)
    
    Returns:
        dict with txid and explorer link
    """
    url = f"{BACKEND_URL}/exporter/profile"
    payload = {
        "exporterId": exporter_id,
        "companyName": company_name,
        "country": country,
        "sector": sector
    }
    print(f"\n🛠️  TOOL: Registering exporter profile for {company_name}...")
    try:
        resp = requests.post(url, json=payload)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def get_exporter_profile(exporter_id: str):
    """
    Retrieve exporter profile from on-chain registry.
    
    Args:
        exporter_id (str): Exporter identifier
    
    Returns:
        dict with profile data or None if not found
    """
    url = f"{BACKEND_URL}/exporter/profile/{exporter_id}"
    print(f"\n🛠️  TOOL: Fetching exporter profile for {exporter_id}...")
    try:
        resp = requests.get(url)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def check_exporter_registered(exporter_id: str):
    """
    Check if an exporter is registered on-chain.
    
    Args:
        exporter_id (str): Exporter identifier
    
    Returns:
        dict with isRegistered boolean
    """
    url = f"{BACKEND_URL}/exporter/check/{exporter_id}"
    print(f"\n🛠️  TOOL: Checking registration for {exporter_id}...")
    try:
        resp = requests.get(url)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def link_exporter_invoice(exporter_id: str, invoice_id: str):
    """
    Link an existing invoice to an exporter's profile on-chain.
    
    Args:
        exporter_id (str): Exporter identifier
        invoice_id (str): Invoice identifier to link
    
    Returns:
        dict with txid and explorer link
    """
    url = f"{BACKEND_URL}/exporter/invoice-link"
    payload = {
        "exporterId": exporter_id,
        "invoiceId": invoice_id
    }
    print(f"\n🛠️  TOOL: Linking invoice {invoice_id} to exporter {exporter_id}...")
    try:
        resp = requests.post(url, json=payload)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def exporter_create_invoice_request(
    exporter_id: str,
    invoice_id: str,
    buyer_name: str,
    face_value: int,
    buyer_country: str = "",
    currency: str = "USD",
    due_date: int = 20251231,
    min_yield: float = 0,
    max_tenor_days: int = 90
):
    """
    Create a full financing request for an invoice.
    This is the main exporter action - creates invoice + registers in system.
    
    Args:
        exporter_id (str): Exporter's ID
        invoice_id (str): Unique invoice ID
        buyer_name (str): Name of the buyer/importer
        face_value (int): Invoice amount in cents
        buyer_country (str): Buyer's country code
        currency (str): Currency code (default: USD)
        due_date (int): Due date in YYYYMMDD format
        min_yield (float): Minimum acceptable yield %
        max_tenor_days (int): Maximum financing period in days
    
    Returns:
        dict with invoiceAssetTxid, registryTxid, and explorer links
    """
    url = f"{BACKEND_URL}/exporter/invoice-request"
    payload = {
        "exporterId": exporter_id,
        "invoiceId": invoice_id,
        "buyerName": buyer_name,
        "buyerCountry": buyer_country,
        "faceValue": face_value,
        "currency": currency,
        "dueDate": due_date,
        "minYield": min_yield,
        "maxTenorDays": max_tenor_days
    }
    print(f"\n🛠️  TOOL: Creating invoice request {invoice_id} for {buyer_name}...")
    try:
        resp = requests.post(url, json=payload)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


# ==========================================
# V2 IMPORTER MODE TOOLS (Phase 2)
# ==========================================

def register_importer_profile(importer_id: str, company_name: str, country: str):
    """
    Register a new importer (buyer) profile on-chain.
    
    Args:
        importer_id (str): Unique importer ID
        company_name (str): Company name (e.g., Walmart, Nestle)
        country (str): ISO country code (e.g., US, CH)
    
    Returns:
        dict with txid and explorer link
    """
    url = f"{BACKEND_URL}/importer/profile"
    payload = {
        "importerId": importer_id,
        "companyName": company_name,
        "country": country
    }
    print(f"\n🛠️  TOOL: Registering importer profile for {company_name}...")
    try:
        resp = requests.post(url, json=payload)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def register_importer_terms(invoice_id: str, importer_id: str, max_yield_bps: int, currency: str = "USD", jurisdiction: str = "US"):
    """
    Register financing terms for an invoice.
    
    Args:
        invoice_id (str): Invoice ID to set terms for
        importer_id (str): Importer setting the terms
        max_yield_bps (int): Maximum yield in basis points (e.g., 850 = 8.5%)
        currency (str): Settlement currency (default: USD)
        jurisdiction (str): Legal jurisdiction (e.g., US, CH, UK)
    
    Returns:
        dict with txid and explorer link
    """
    url = f"{BACKEND_URL}/importer/terms"
    payload = {
        "invoiceId": invoice_id,
        "importerId": importer_id,
        "maxYieldBps": max_yield_bps,
        "currency": currency,
        "jurisdiction": jurisdiction
    }
    print(f"\n🛠️  TOOL: Registering terms for {invoice_id} (max yield: {max_yield_bps/100}%)...")
    try:
        resp = requests.post(url, json=payload)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def confirm_payable(invoice_id: str, importer_id: str):
    """
    Importer confirms the payable on-chain.
    This is the cryptographic commitment that the buyer will pay.
    
    Args:
        invoice_id (str): Invoice to confirm
        importer_id (str): Importer making the confirmation
    
    Returns:
        dict with txid and explorer link
    """
    url = f"{BACKEND_URL}/importer/confirm"
    payload = {
        "invoiceId": invoice_id,
        "importerId": importer_id
    }
    print(f"\n🛠️  TOOL: Confirming payable {invoice_id} by {importer_id}...")
    try:
        resp = requests.post(url, json=payload)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def get_importer_terms(invoice_id: str):
    """
    Get financing terms for an invoice.
    
    Args:
        invoice_id (str): Invoice ID to query
    
    Returns:
        dict with terms and confirmation status
    """
    url = f"{BACKEND_URL}/importer/terms/{invoice_id}"
    print(f"\n🛠️  TOOL: Getting terms for {invoice_id}...")
    try:
        resp = requests.get(url)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def check_importer_registered(importer_id: str):
    """
    Check if an importer is registered on-chain.
    
    Args:
        importer_id (str): Importer ID to check
    
    Returns:
        dict with isRegistered boolean
    """
    url = f"{BACKEND_URL}/importer/check/{importer_id}"
    print(f"\n🛠️  TOOL: Checking registration for {importer_id}...")
    try:
        resp = requests.get(url)
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


# ==========================================
# TOOL SCHEMAS (OpenAI Function Calling Format)
# ==========================================

TOOLS_SCHEMA_V1 = [
    {
        "type": "function",
        "function": {
            "name": "register_invoice",
            "description": "Registers a new invoice on the blockchain.",
            "parameters": {
                "type": "object",
                "properties": {
                    "invoice_id": {"type": "string"},
                    "amount": {"type": "integer"},
                    "buyer": {"type": "string"},
                    "exporter": {"type": "string"}
                },
                "required": ["invoice_id", "amount", "buyer", "exporter"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "allocate_shares",
            "description": "Allocates shares of an invoice to an investor.",
            "parameters": {
                "type": "object",
                "properties": {
                    "invoice_id": {"type": "string"},
                    "investor": {"type": "string"},
                    "amount": {"type": "integer"}
                },
                "required": ["invoice_id", "investor", "amount"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "registry_register",
            "description": "Registers the invoice in the central Receivable Registry contract.",
            "parameters": {
                "type": "object",
                "properties": {
                    "invoice_id": {"type": "string"}
                },
                "required": ["invoice_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "set_status",
            "description": "Updates the lifecycle status of an invoice.",
            "parameters": {
                "type": "object",
                "properties": {
                    "invoice_id": {"type": "string"},
                    "status": {"type": "string", "enum": ["ACTIVE", "VERIFIED", "SETTLED", "CANCELLED"]}
                },
                "required": ["invoice_id", "status"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "settle_invoice",
            "description": "Executes final settlement for an invoice.",
            "parameters": {
                "type": "object",
                "properties": {
                    "invoice_id": {"type": "string"}
                },
                "required": ["invoice_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_invoice_status",
            "description": "Queries the current on-chain status of an invoice.",
            "parameters": {
                "type": "object",
                "properties": {
                    "invoice_id": {"type": "string"}
                },
                "required": ["invoice_id"]
            }
        }
    }
]

TOOLS_SCHEMA_EXPORTER = [
    {
        "type": "function",
        "function": {
            "name": "register_exporter_profile",
            "description": "Register a new exporter with KYC-lite profile on-chain. Call this first for new exporters.",
            "parameters": {
                "type": "object",
                "properties": {
                    "exporter_id": {"type": "string", "description": "Unique exporter ID or tax ID"},
                    "company_name": {"type": "string", "description": "Company/business name"},
                    "country": {"type": "string", "description": "ISO country code (e.g., VE, CO, PE)"},
                    "sector": {"type": "string", "description": "Industry sector (e.g., cacao, coffee, metals)"}
                },
                "required": ["exporter_id", "company_name", "country"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_exporter_profile",
            "description": "Retrieve exporter profile from on-chain registry.",
            "parameters": {
                "type": "object",
                "properties": {
                    "exporter_id": {"type": "string"}
                },
                "required": ["exporter_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_exporter_registered",
            "description": "Check if an exporter is already registered on-chain.",
            "parameters": {
                "type": "object",
                "properties": {
                    "exporter_id": {"type": "string"}
                },
                "required": ["exporter_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "link_exporter_invoice",
            "description": "Link an existing invoice to an exporter's profile on-chain. Use after creating an invoice to associate it with the exporter.",
            "parameters": {
                "type": "object",
                "properties": {
                    "exporter_id": {"type": "string", "description": "Exporter identifier"},
                    "invoice_id": {"type": "string", "description": "Invoice identifier to link"}
                },
                "required": ["exporter_id", "invoice_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "exporter_create_invoice_request",
            "description": "Create a full financing request for an invoice. This is the main exporter action - registers invoice on-chain and in the registry.",
            "parameters": {
                "type": "object",
                "properties": {
                    "exporter_id": {"type": "string", "description": "Exporter's ID"},
                    "invoice_id": {"type": "string", "description": "Unique invoice ID (e.g., INV-1001)"},
                    "buyer_name": {"type": "string", "description": "Name of the buyer/importer (e.g., Walmart)"},
                    "face_value": {"type": "integer", "description": "Invoice amount in cents"},
                    "buyer_country": {"type": "string", "description": "Buyer's country code"},
                    "currency": {"type": "string", "description": "Currency code (default: USD)"},
                    "due_date": {"type": "integer", "description": "Due date in YYYYMMDD format"},
                    "min_yield": {"type": "number", "description": "Minimum acceptable yield %"},
                    "max_tenor_days": {"type": "integer", "description": "Maximum financing period in days"}
                },
                "required": ["exporter_id", "invoice_id", "buyer_name", "face_value"]
            }
        }
    }
]

TOOLS_SCHEMA_IMPORTER = [
    {
        "type": "function",
        "function": {
            "name": "register_importer_profile",
            "description": "Register a new importer (buyer) profile on-chain. Call this first for new importers like Walmart, Nestle.",
            "parameters": {
                "type": "object",
                "properties": {
                    "importer_id": {"type": "string", "description": "Unique importer ID"},
                    "company_name": {"type": "string", "description": "Company name (e.g., Walmart, Nestle)"},
                    "country": {"type": "string", "description": "ISO country code (e.g., US, CH)"}
                },
                "required": ["importer_id", "company_name", "country"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "register_importer_terms",
            "description": "Register financing terms for an invoice. Set max yield, currency, and jurisdiction.",
            "parameters": {
                "type": "object",
                "properties": {
                    "invoice_id": {"type": "string", "description": "Invoice ID to set terms for"},
                    "importer_id": {"type": "string", "description": "Importer setting the terms"},
                    "max_yield_bps": {"type": "integer", "description": "Maximum yield in basis points (e.g., 850 = 8.5%)"},
                    "currency": {"type": "string", "description": "Settlement currency (default: USD)"},
                    "jurisdiction": {"type": "string", "description": "Legal jurisdiction (e.g., US, CH, UK)"}
                },
                "required": ["invoice_id", "importer_id", "max_yield_bps"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "confirm_payable",
            "description": "Importer confirms the payable on-chain. This is the cryptographic commitment that the buyer will pay.",
            "parameters": {
                "type": "object",
                "properties": {
                    "invoice_id": {"type": "string", "description": "Invoice to confirm"},
                    "importer_id": {"type": "string", "description": "Importer making the confirmation"}
                },
                "required": ["invoice_id", "importer_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_importer_terms",
            "description": "Get financing terms for an invoice including confirmation status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "invoice_id": {"type": "string", "description": "Invoice ID to query"}
                },
                "required": ["invoice_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_importer_registered",
            "description": "Check if an importer is registered on-chain.",
            "parameters": {
                "type": "object",
                "properties": {
                    "importer_id": {"type": "string", "description": "Importer ID to check"}
                },
                "required": ["importer_id"]
            }
        }
    }
]

# Combined V2 schema (all tools)
TOOLS_SCHEMA = TOOLS_SCHEMA_V1 + TOOLS_SCHEMA_EXPORTER + TOOLS_SCHEMA_IMPORTER

# Tool mapping for execution
TOOL_MAP = {
    # V1 Core
    "register_invoice": register_invoice,
    "allocate_shares": allocate_shares,
    "registry_register": registry_register,
    "set_status": set_status,
    "settle_invoice": settle_invoice,
    "query_invoice_status": query_invoice_status,
    # V2 Exporter
    "register_exporter_profile": register_exporter_profile,
    "get_exporter_profile": get_exporter_profile,
    "check_exporter_registered": check_exporter_registered,
    "link_exporter_invoice": link_exporter_invoice,
    "exporter_create_invoice_request": exporter_create_invoice_request,
    # V2 Importer
    "register_importer_profile": register_importer_profile,
    "register_importer_terms": register_importer_terms,
    "confirm_payable": confirm_payable,
    "get_importer_terms": get_importer_terms,
    "check_importer_registered": check_importer_registered
}

# Mode-specific tool sets
EXPORTER_TOOLS = [
    "register_exporter_profile",
    "get_exporter_profile", 
    "check_exporter_registered",
    "link_exporter_invoice",
    "exporter_create_invoice_request",
    "query_invoice_status"
]

IMPORTER_TOOLS = [
    "register_importer_profile",
    "check_importer_registered",
    "register_importer_terms",
    "confirm_payable",
    "get_importer_terms",
    "query_invoice_status"
]

INVESTOR_TOOLS = [
    "allocate_shares",
    "query_invoice_status",
    "settle_invoice",
    "get_importer_terms"  # Investors need to see terms
]

ADMIN_TOOLS = list(TOOL_MAP.keys())  # All tools

