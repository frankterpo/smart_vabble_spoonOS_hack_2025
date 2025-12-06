import os
import json
import time
from dotenv import load_dotenv
from openai import OpenAI
from vabble_tools import TOOLS_SCHEMA, TOOL_MAP

# Load env vars
load_dotenv()

# Configuration
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()
LLM_MODEL = os.getenv("LLM_MODEL", "llama3") # Default to llama3 for Ollama
API_KEY = os.getenv("LLM_API_KEY", "ollama") # 'ollama' is dummy key required by client

print(f"\n🔧 Agent Config: Provider={LLM_PROVIDER}, Model={LLM_MODEL}")

if LLM_PROVIDER == "ollama":
    # Point to local Ollama instance
    base_url = "http://localhost:11434/v1"
    print(f"   Using Local Ollama at {base_url}")
    client = OpenAI(base_url=base_url, api_key="ollama")
elif LLM_PROVIDER == "deepseek":
    base_url = "https://api.deepseek.com/v1"
    API_KEY = os.getenv("DEEPSEEK_API_KEY")
    if not API_KEY:
        print("❌ Missing DEEPSEEK_API_KEY in .env")
        exit(1)
    client = OpenAI(base_url=base_url, api_key=API_KEY)
else:
    # Fallback/OpenAI
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """
You are Vabble Agent – an autonomous operator for the Vabble Decentralised Receivables platform on Neo N3.

Your Goal: Manage the lifecycle of real-world invoices on the blockchain.

Capabilities:
1.  **Onboard Invoices**: Register new invoices from exporters (using `register_invoice` then `registry_register`).
2.  **Manage Capital**: Allocate investor capital to specific invoices (using `allocate_shares`).
3.  **Update State**: Move invoices through their lifecycle (using `set_status`).
4.  **Execute Settlement**: Trigger final payout and settlement when an invoice is paid (using `settle_invoice`).
5.  **Audit**: Check the on-chain status of any invoice (using `query_invoice_status`).

Rules:
*   Always ask for clarification if parameters (like IDs or amounts) are missing.
*   When onboarding, ALWAYS perform `register_invoice` (Asset contract) AND `registry_register` (Registry contract) in sequence.
*   Before settling, ensure the invoice status is set to "ACTIVE" or "VERIFIED" if not already.
*   Output clean, concise confirmations with the Transaction IDs provided by the tools.

Start every session by asking the user what invoice operation they would like to perform today.
"""

def run_conversation():
    print("\n🤖 Vabble Agent initialized. (Type 'quit' to exit)\n")
    
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    # Initial greeting
    print("Agent: Hello! I am Vabble Agent. How can I help with your invoice operations today?")

    while True:
        user_input = input("\nUser: ")
        if user_input.lower() in ['quit', 'exit']:
            break

        messages.append({"role": "user", "content": user_input})

        # 1. Call LLM with tools
        try:
            response = client.chat.completions.create(
                model=LLM_MODEL,
                messages=messages,
                tools=TOOLS_SCHEMA,
                tool_choice="auto"
            )
            
            response_message = response.choices[0].message
            tool_calls = response_message.tool_calls

            # 2. Check if model wants to call tools
            if tool_calls:
                print(f"\n(Agent decides to call {len(tool_calls)} tools...)")
                messages.append(response_message)  # extend conversation with assistant's reply

                for tool_call in tool_calls:
                    function_name = tool_call.function.name
                    function_args = json.loads(tool_call.function.arguments)
                    
                    # Execute tool
                    if function_name in TOOL_MAP:
                        function_to_call = TOOL_MAP[function_name]
                        print(f"  ⚡ Executing {function_name}({function_args})...")
                        
                        tool_result = function_to_call(**function_args)
                        
                        print(f"  ✔ Result: {json.dumps(tool_result)}")
                        
                        # Append result to messages
                        messages.append({
                            "tool_call_id": tool_call.id,
                            "role": "tool",
                            "name": function_name,
                            "content": json.dumps(tool_result),
                        })
                    else:
                        print(f"  ❌ Tool {function_name} not found!")

                # 3. Get final response from LLM based on tool outputs
                second_response = client.chat.completions.create(
                    model=LLM_MODEL,
                    messages=messages
                )
                final_reply = second_response.choices[0].message.content
                print(f"\nAgent: {final_reply}")
                messages.append({"role": "assistant", "content": final_reply})
            
            else:
                # No tools called, just chat
                reply = response_message.content
                print(f"\nAgent: {reply}")
                messages.append({"role": "assistant", "content": reply})

        except Exception as e:
            print(f"\n❌ Error in agent loop: {e}")
            print("Tip: Ensure Ollama is running (`ollama serve`) and model is pulled (`ollama pull llama3`).")

if __name__ == "__main__":
    run_conversation()
