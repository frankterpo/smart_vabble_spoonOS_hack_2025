#!/usr/bin/env python3
"""
Vabble Agent V2 - Multi-Mode Agent with Exporter Flow
Supports: Exporter Mode, Investor Mode, Admin Mode
Integrates with SpoonOS toolkits where applicable
"""

import os
import json
import sys
from dotenv import load_dotenv

load_dotenv()

# Import tools
from vabble_tools_v2 import (
    TOOLS_SCHEMA,
    TOOLS_SCHEMA_EXPORTER,
    TOOLS_SCHEMA_IMPORTER,
    TOOL_MAP,
    EXPORTER_TOOLS,
    IMPORTER_TOOLS,
    INVESTOR_TOOLS,
    ADMIN_TOOLS
)

# LLM Configuration
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")  # ollama, openai, deepseek
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "deepseek-r1:8b")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")

# ==========================================
# SYSTEM PROMPTS (Multi-Mode)
# ==========================================

SYSTEM_PROMPT_BASE = """
You are Vabble Agent – an autonomous operator for the Vabble Decentralised Receivables platform on Neo N3.

PLATFORM OVERVIEW:
Vabble is a 3-sided marketplace connecting:
1. EXPORTERS (Latin America) - who have unpaid invoices from creditworthy buyers
2. IMPORTERS (Global) - Fortune 500 buyers who confirm payment terms
3. INVESTORS - who fund invoices for yield

Your job is to help users navigate their role-specific flows using on-chain tools.
"""

SYSTEM_PROMPT_EXPORTER = SYSTEM_PROMPT_BASE + """
CURRENT MODE: EXPORTER

You are helping an EXPORTER (e.g., Venezuelan cacao producer) finance their invoices.

EXPORTER WORKFLOW:
1. First, register the exporter profile (company name, country, sector)
2. Then create invoice requests with buyer details, face value, due date
3. Each invoice gets recorded on-chain and enters the financing pool

AVAILABLE TOOLS:
- register_exporter_profile: Register new exporter (first step!)
- get_exporter_profile: Check if already registered
- check_exporter_registered: Quick registration check
- exporter_create_invoice_request: Submit invoice for financing (main action)
- query_invoice_status: Check invoice status

IMPORTANT:
- Always verify exporter is registered before creating invoices
- Ask for: company name, country (VE, CO, PE, etc.), sector (cacao, coffee, etc.)
- For invoices ask: invoice ID, buyer name, buyer country, face value in cents, due date (YYYYMMDD)
- Be friendly but professional - these are real business owners

When responding, always explain what you're doing and provide transaction links when available.
"""

SYSTEM_PROMPT_IMPORTER = SYSTEM_PROMPT_BASE + """
CURRENT MODE: IMPORTER (Buyer)

You are helping an IMPORTER (buyer like Walmart, Nestle, Costco) confirm invoices and set financing terms.

IMPORTER WORKFLOW:
1. First, register the importer profile (company name, country)
2. Review invoices from exporters that need confirmation
3. Set financing terms (max yield, currency, jurisdiction)
4. Confirm the payable on-chain (cryptographic commitment to pay)

AVAILABLE TOOLS:
- register_importer_profile: Register new importer (first step!)
- check_importer_registered: Quick registration check
- register_importer_terms: Set financing terms for an invoice
- confirm_payable: Confirm the invoice on-chain (IMPORTANT!)
- get_importer_terms: View terms for an invoice
- query_invoice_status: Check invoice status

IMPORTANT:
- Always verify importer is registered first
- Ask for: company name, country (US, CH, UK, etc.)
- For terms ask: invoice ID, max yield (in % or basis points), jurisdiction
- Confirming a payable is a COMMITMENT - explain this clearly
- Be professional - these are Fortune 500 companies

EXAMPLE:
User: "I'm Nestle, show me invoice INV-VE-001 and let me confirm it at 8.5% yield under Swiss law"
You: Check importer → register if needed → register_terms → confirm_payable → return TXIDs
"""

SYSTEM_PROMPT_INVESTOR = SYSTEM_PROMPT_BASE + """
CURRENT MODE: INVESTOR

You are helping an INVESTOR allocate capital to CONFIRMED receivables.

INVESTOR WORKFLOW:
1. Review available invoices (only invest in CONFIRMED payables!)
2. Check importer terms and confirmation status
3. Allocate shares to selected invoices
4. Monitor status and await settlement

AVAILABLE TOOLS:
- query_invoice_status: Check invoice status
- get_importer_terms: Check if payable is confirmed + terms
- allocate_shares: Commit capital to an invoice
- settle_invoice: Trigger settlement

IMPORTANT:
- Only invest in CONFIRMED payables (check is_confirmed!)
- Explain yield based on importer terms
- Confirm amounts before allocation
- Provide transaction links
"""

SYSTEM_PROMPT_ADMIN = SYSTEM_PROMPT_BASE + """
CURRENT MODE: ADMIN (Full Access)

You have access to ALL tools for testing and administration.

AVAILABLE TOOLS:
- All exporter tools
- All investor tools
- register_invoice, registry_register, set_status, settle_invoice

Use responsibly and always explain actions taken.
"""

# ==========================================
# LLM INTERFACE
# ==========================================

def call_ollama(messages: list, tools: list = None):
    """Call Ollama with optional tool definitions."""
    import requests
    
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False
    }
    
    if tools:
        payload["tools"] = tools
    
    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json=payload,
            timeout=120
        )
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def call_openai(messages: list, tools: list = None):
    """Call OpenAI-compatible API."""
    import requests
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OPENAI_API_KEY not set"}
    
    payload = {
        "model": os.getenv("OPENAI_MODEL", "gpt-4"),
        "messages": messages
    }
    
    if tools:
        payload["tools"] = tools
    
    try:
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
            timeout=60
        )
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def call_llm(messages: list, tools: list = None):
    """Route to configured LLM provider."""
    if LLM_PROVIDER == "ollama":
        return call_ollama(messages, tools)
    elif LLM_PROVIDER == "openai":
        return call_openai(messages, tools)
    else:
        return {"error": f"Unknown LLM provider: {LLM_PROVIDER}"}


# ==========================================
# TOOL EXECUTION
# ==========================================

def execute_tool_call(name: str, args: dict):
    """Execute a tool by name with given arguments."""
    if name not in TOOL_MAP:
        return {"error": f"Unknown tool: {name}"}
    
    try:
        result = TOOL_MAP[name](**args)
        return result
    except Exception as e:
        return {"error": str(e)}


def process_tool_calls(tool_calls: list) -> list:
    """Process a list of tool calls and return results."""
    results = []
    for call in tool_calls:
        name = call.get("function", {}).get("name", "")
        args_str = call.get("function", {}).get("arguments", "{}")
        
        try:
            args = json.loads(args_str) if isinstance(args_str, str) else args_str
        except json.JSONDecodeError:
            args = {}
        
        print(f"\n🔧 Executing: {name}")
        print(f"   Args: {json.dumps(args, indent=2)}")
        
        result = execute_tool_call(name, args)
        
        print(f"   Result: {json.dumps(result, indent=2)[:200]}...")
        
        results.append({
            "tool_call_id": call.get("id", ""),
            "role": "tool",
            "name": name,
            "content": json.dumps(result)
        })
    
    return results


# ==========================================
# AGENT MODES
# ==========================================

def get_mode_config(mode: str) -> tuple:
    """Get system prompt and tools for a given mode."""
    if mode == "exporter":
        return SYSTEM_PROMPT_EXPORTER, TOOLS_SCHEMA_EXPORTER
    elif mode == "importer":
        # Filter tools schema for importer
        importer_schema = [t for t in TOOLS_SCHEMA if t["function"]["name"] in IMPORTER_TOOLS]
        return SYSTEM_PROMPT_IMPORTER, importer_schema
    elif mode == "investor":
        # Filter tools schema for investor
        investor_schema = [t for t in TOOLS_SCHEMA if t["function"]["name"] in INVESTOR_TOOLS]
        return SYSTEM_PROMPT_INVESTOR, investor_schema
    else:  # admin
        return SYSTEM_PROMPT_ADMIN, TOOLS_SCHEMA


def run_agent(mode: str = "exporter"):
    """Run the Vabble Agent in specified mode."""
    system_prompt, tools = get_mode_config(mode)
    
    print("\n" + "="*60)
    print(f"🚀 VABBLE AGENT V2 - {mode.upper()} MODE")
    print("="*60)
    print(f"LLM: {LLM_PROVIDER} / {OLLAMA_MODEL}")
    print(f"Backend: {os.getenv('VABBLE_BACKEND_URL', 'http://localhost:4000')}")
    print(f"Tools: {len(tools)} available")
    print("="*60)
    print("\nType 'quit' to exit, 'mode <exporter|investor|admin>' to switch modes\n")
    
    messages = [{"role": "system", "content": system_prompt}]
    
    while True:
        try:
            user_input = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n\n👋 Goodbye!")
            break
        
        if not user_input:
            continue
        
        if user_input.lower() == "quit":
            print("\n👋 Goodbye!")
            break
        
        if user_input.lower().startswith("mode "):
            new_mode = user_input.split(" ", 1)[1].strip().lower()
            if new_mode in ["exporter", "importer", "investor", "admin"]:
                mode = new_mode
                system_prompt, tools = get_mode_config(mode)
                messages = [{"role": "system", "content": system_prompt}]
                print(f"\n✅ Switched to {mode.upper()} mode\n")
            else:
                print(f"\n❌ Unknown mode: {new_mode}. Use: exporter, importer, investor, admin\n")
            continue
        
        # Add user message
        messages.append({"role": "user", "content": user_input})
        
        # Call LLM
        print("\n🤔 Thinking...")
        response = call_llm(messages, tools)
        
        if "error" in response:
            print(f"\n❌ Error: {response['error']}\n")
            continue
        
        # Handle Ollama response format
        message = response.get("message", {})
        
        # Check for tool calls
        tool_calls = message.get("tool_calls", [])
        
        if tool_calls:
            # Execute tools
            tool_results = process_tool_calls(tool_calls)
            
            # Add assistant message with tool calls
            messages.append(message)
            
            # Add tool results
            for result in tool_results:
                messages.append(result)
            
            # Get final response
            print("\n🤔 Processing results...")
            final_response = call_llm(messages, tools)
            final_message = final_response.get("message", {})
            content = final_message.get("content", "")
        else:
            content = message.get("content", "")
        
        # Print response
        print(f"\n🤖 Agent: {content}\n")
        
        # Add to history
        if content:
            messages.append({"role": "assistant", "content": content})


# ==========================================
# DEMO MODE (Non-interactive)
# ==========================================

def run_demo():
    """Run a quick demo showing exporter flow."""
    print("\n" + "="*60)
    print("🎬 VABBLE AGENT V2 - DEMO MODE")
    print("="*60)
    
    # Demo: Register exporter and create invoice
    demo_steps = [
        ("Check if exporter registered", "check_exporter_registered", {"exporter_id": "DEMO-EXP-001"}),
        ("Register exporter profile", "register_exporter_profile", {
            "exporter_id": "DEMO-EXP-001",
            "company_name": "Cacao Venezuela SA",
            "country": "VE",
            "sector": "cacao"
        }),
        ("Create invoice request", "exporter_create_invoice_request", {
            "exporter_id": "DEMO-EXP-001",
            "invoice_id": "INV-DEMO-001",
            "buyer_name": "Nestle Switzerland",
            "buyer_country": "CH",
            "face_value": 5000000,  # $50,000
            "currency": "USD",
            "due_date": 20251231,
            "min_yield": 8.5,
            "max_tenor_days": 90
        }),
        ("Query invoice status", "query_invoice_status", {"invoice_id": "INV-DEMO-001"})
    ]
    
    for step_name, tool_name, args in demo_steps:
        print(f"\n📋 Step: {step_name}")
        print(f"   Tool: {tool_name}")
        print(f"   Args: {json.dumps(args, indent=2)}")
        
        result = execute_tool_call(tool_name, args)
        print(f"   Result: {json.dumps(result, indent=2)}")
        
        if result.get("success"):
            if result.get("txid"):
                print(f"   ✅ TX: {result.get('txid')}")
            if result.get("explorer"):
                print(f"   🔗 {result.get('explorer')}")
        else:
            print(f"   ⚠️  {result.get('error', 'Unknown error')}")
    
    print("\n" + "="*60)
    print("✅ Demo complete!")
    print("="*60)


# ==========================================
# MAIN
# ==========================================

if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == "demo":
            run_demo()
        elif sys.argv[1] in ["exporter", "investor", "admin"]:
            run_agent(mode=sys.argv[1])
        else:
            print(f"Usage: python {sys.argv[0]} [exporter|investor|admin|demo]")
    else:
        # Default to exporter mode
        run_agent(mode="exporter")

