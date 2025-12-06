import requests
import json
import os

# Backend Configuration
BACKEND_URL = "http://localhost:4000"

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

# Tool Definitions for the Agent (SpoonOS / OpenAI Schema)
TOOLS_SCHEMA = [
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

TOOL_MAP = {
    "register_invoice": register_invoice,
    "allocate_shares": allocate_shares,
    "registry_register": registry_register,
    "set_status": set_status,
    "settle_invoice": settle_invoice,
    "query_invoice_status": query_invoice_status
}

