"""
Deploy Contracts Script
Helper script for deploying Neo N3 contracts to TestNet.
"""

import os
import json
import subprocess
from pathlib import Path


def compile_contract(contract_path: str) -> bool:
    """
    Compile a Neo contract using boa.
    
    Args:
        contract_path: Path to contract Python file
    
    Returns:
        True if compilation successful
    """
    print(f"Compiling {contract_path}...")
    try:
        result = subprocess.run(
            ["boa", "compile", contract_path],
            capture_output=True,
            text=True,
            check=True
        )
        print(f"  ✓ Compiled successfully")
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"  ✗ Compilation failed:")
        print(e.stderr)
        return False
    except FileNotFoundError:
        print("  ✗ 'boa' command not found. Install neo3-boa first.")
        return False


def main():
    """Main deployment script."""
    print("=" * 60)
    print("Vabble Contract Deployment")
    print("=" * 60)
    print()
    
    contracts_dir = Path("contracts")
    contracts = [
        "InvoiceAsset.py",
        "InvestorShare.py",
        "PlatformFee.py"
    ]
    
    compiled = []
    for contract_file in contracts:
        contract_path = contracts_dir / contract_file
        if contract_path.exists():
            if compile_contract(str(contract_path)):
                compiled.append(contract_file)
        else:
            print(f"  ✗ Contract not found: {contract_path}")
    
    print()
    print("=" * 60)
    print(f"Compiled {len(compiled)}/{len(contracts)} contracts")
    print("=" * 60)
    print()
    print("Next steps:")
    print("1. Deploy NEF files to Neo N3 TestNet using neoxp or similar")
    print("2. Store contract hashes in contracts/addresses.json")
    print("3. Update .env with contract hashes")


if __name__ == "__main__":
    main()

