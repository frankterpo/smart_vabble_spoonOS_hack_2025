"""
PlatformFee Contract - Neo N3
Tracks cumulative protocol fees and allows owner withdrawal.
"""

from boa3.builtin import CreateNewEvent, public
from boa3.builtin.interop import storage, runtime
from typing import Any

# Events
FeeRecorded = CreateNewEvent(
    [
        ('amount', int)
    ],
    'FeeRecorded'
)


@public(safe=True)
def record_fee(amount: int) -> bool:
    """
    Record a fee payment.
    Only callable by InvoiceAsset contract.
    """
    # Verify caller is InvoiceAsset contract
    invoice_asset_hash = storage.get(b"invoice_asset_hash")
    if invoice_asset_hash == b'':
        raise Exception("InvoiceAsset hash not configured")
    
    caller = runtime.calling_script_hash
    if caller != invoice_asset_hash:
        raise Exception("Only InvoiceAsset can record fees")
    
    # Validate amount
    if amount <= 0:
        raise Exception("Amount must be positive")
    
    # Update fee balance
    current_balance = storage.get(b"fee_balance")
    if current_balance == b'':
        current_balance = 0
    
    new_balance = current_balance + amount
    storage.put(b"fee_balance", new_balance)
    
    # Emit event
    FeeRecorded(amount)
    
    return True


@public(safe=True)
def get_fee_balance() -> int:
    """
    Get current fee balance.
    """
    balance = storage.get(b"fee_balance")
    if balance == b'':
        return 0
    
    return balance


@public(safe=True)
def withdraw(recipient: bytes) -> bool:
    """
    Withdraw fees to recipient.
    Only owner can call.
    """
    owner = storage.get(b"owner")
    if owner == b'':
        raise Exception("Owner not set")
    
    caller = runtime.calling_script_hash
    if caller != owner:
        raise Exception("Only owner can withdraw")
    
    # Get balance
    balance = storage.get(b"fee_balance")
    if balance == b'':
        balance = 0
    
    if balance <= 0:
        raise Exception("No fees to withdraw")
    
    # Reset balance (in v1, this is accounting only - no actual transfer)
    storage.put(b"fee_balance", 0)
    
    # In production, would transfer balance to recipient here
    # For v1, we just reset the accounting
    
    return True


@public(safe=True)
def _deploy(data: Any, update: bool) -> bool:
    """
    Contract deployment hook.
    Set owner and initialize fee balance.
    """
    if not update:
        owner = runtime.calling_script_hash
        storage.put(b"owner", owner)
        storage.put(b"fee_balance", 0)
    
    return True

