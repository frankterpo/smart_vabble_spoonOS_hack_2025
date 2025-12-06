"""
BaseAgent - Foundation for all SpoonOS agents
Provides shared functionality: env loading, Neo RPC client, logging, transaction helpers.
"""

import os
import json
import logging
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Try to import SpoonAgent from spoon-sdk, fallback to base class if not available
try:
    from spoon_sdk import SpoonAgent
except ImportError:
    # Fallback: create a minimal base class if spoon-sdk is not available
    class SpoonAgent:
        def __init__(self, name: str):
            self.name = name

# Try to import Neo libraries
try:
    from neo_mamba import NeoRPC, Account, TransactionBuilder
    NEO_AVAILABLE = True
except ImportError:
    try:
        from neo3 import network, wallet, contracts
        NEO_AVAILABLE = True
    except ImportError:
        NEO_AVAILABLE = False
        logging.warning("Neo libraries not available - using mock mode")


class BaseAgent(SpoonAgent):
    """
    Base agent providing common functionality for all Vabble agents.
    """
    
    def __init__(self, name: str):
        """
        Initialize base agent with environment configuration.
        
        Args:
            name: Agent name for logging
        """
        super().__init__(name=name)
        
        # Load environment variables
        load_dotenv()
        
        self.rpc_url = os.getenv("RPC_URL", "https://testnet1.neo.org:443")
        self.private_key = os.getenv("NEO_WALLET_PRIVATE_KEY", "")
        self.address = os.getenv("NEO_WALLET_ADDRESS", "")
        
        # Contract hashes
        self.invoice_asset_hash = os.getenv("INVOICE_ASSET_CONTRACT_HASH", "")
        self.investor_share_hash = os.getenv("INVESTOR_SHARE_CONTRACT_HASH", "")
        self.platform_fee_hash = os.getenv("PLATFORM_FEE_CONTRACT_HASH", "")
        
        # Initialize Neo RPC client if available
        self.rpc_client = None
        if NEO_AVAILABLE and self.rpc_url:
            try:
                if 'neo_mamba' in globals():
                    self.rpc_client = NeoRPC(self.rpc_url)
                # Add other Neo library initialization here if needed
            except Exception as e:
                logging.warning(f"Failed to initialize Neo RPC client: {e}")
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format=f'[%(asctime)s] [{self.name}] %(levelname)s: %(message)s'
        )
        self.logger = logging.getLogger(self.name)
    
    def log(self, message: str, level: str = "info"):
        """
        Log a message.
        
        Args:
            message: Message to log
            level: Log level (info, warning, error, debug)
        """
        if level == "info":
            self.logger.info(message)
        elif level == "warning":
            self.logger.warning(message)
        elif level == "error":
            self.logger.error(message)
        elif level == "debug":
            self.logger.debug(message)
        else:
            print(f"[{self.name}] {message}")
    
    async def invoke_contract(
        self,
        contract_hash: str,
        operation: str,
        args: list,
        signer_private_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Invoke a contract method (state-changing transaction).
        
        Args:
            contract_hash: Contract script hash (hex string)
            operation: Method name to call
            args: List of arguments for the method
            signer_private_key: Optional private key (defaults to env var)
        
        Returns:
            Dictionary with transaction hash and result
        """
        self.log(f"Invoking contract {contract_hash}.{operation} with args: {args}")
        
        private_key = signer_private_key or self.private_key
        if not private_key:
            raise ValueError("No private key available for signing")
        
        # For v1, implement basic transaction building
        # This is a simplified implementation - real Neo N3 tx building is more complex
        try:
            if self.rpc_client and NEO_AVAILABLE:
                # Use neo-mamba or neo3 library to build and send transaction
                # Placeholder - actual implementation depends on library API
                self.log("Building transaction...", "debug")
                
                # Build script
                # script = build_invocation_script(contract_hash, operation, args)
                
                # Sign transaction
                # tx = sign_transaction(script, private_key)
                
                # Send transaction
                # result = await self.rpc_client.send_transaction(tx)
                
                # For now, return mock result
                return {
                    "tx_hash": "0x" + "0" * 64,  # Mock hash
                    "success": True,
                    "message": "Transaction sent (mock mode)"
                }
            else:
                # Mock mode - return success without actual chain interaction
                self.log("Running in mock mode - no actual transaction sent", "warning")
                return {
                    "tx_hash": "0x" + "0" * 64,
                    "success": True,
                    "message": "Mock transaction - Neo libraries not available"
                }
        except Exception as e:
            self.log(f"Error invoking contract: {e}", "error")
            raise
    
    async def call_contract(
        self,
        contract_hash: str,
        operation: str,
        args: list
    ) -> Dict[str, Any]:
        """
        Call a contract method (read-only, no state change).
        
        Args:
            contract_hash: Contract script hash (hex string)
            operation: Method name to call
            args: List of arguments for the method
        
        Returns:
            Dictionary with result data
        """
        self.log(f"Calling contract {contract_hash}.{operation} with args: {args}")
        
        try:
            if self.rpc_client and NEO_AVAILABLE:
                # Use RPC client to call contract
                # result = await self.rpc_client.invoke_contract(contract_hash, operation, args)
                
                # For now, return mock result
                return {
                    "success": True,
                    "result": None,
                    "message": "Mock call - Neo libraries not fully configured"
                }
            else:
                # Mock mode
                self.log("Running in mock mode - no actual RPC call", "warning")
                return {
                    "success": True,
                    "result": None,
                    "message": "Mock call"
                }
        except Exception as e:
            self.log(f"Error calling contract: {e}", "error")
            raise
    
    def load_contract_addresses(self, addresses_file: str = "contracts/addresses.json") -> Dict[str, str]:
        """
        Load contract addresses from JSON file.
        
        Args:
            addresses_file: Path to addresses JSON file
        
        Returns:
            Dictionary mapping contract names to addresses
        """
        try:
            if os.path.exists(addresses_file):
                with open(addresses_file, 'r') as f:
                    addresses = json.load(f)
                    self.log(f"Loaded contract addresses from {addresses_file}")
                    return addresses
            else:
                self.log(f"Addresses file {addresses_file} not found", "warning")
                return {}
        except Exception as e:
            self.log(f"Error loading contract addresses: {e}", "error")
            return {}

