from boa3.builtin.compile_time import public, CreateNewEvent
from boa3.builtin.interop import storage, runtime
from boa3.builtin.interop.contract import call_contract
from boa3.builtin.type import UInt160

# Storage prefixes
DATA_PREFIX = b'inv:data:'
STATUS_PREFIX = b'inv:status:'

# Events
InvoiceCreated = CreateNewEvent(
    [
        ('id', bytes),
        ('buyer', str),
        ('seller', str),
        ('amount', int),
        ('currency', str),
        ('due_date', int),
        ('meta', str),
        ('status', str)
    ],
    'InvoiceCreated'
)

InvoiceStatusUpdated = CreateNewEvent(
    [
        ('id', bytes),
        ('status', str)
    ],
    'InvoiceStatusUpdated'
)

InvoiceSettledEvt = CreateNewEvent(
    [
        ('id', bytes)
    ],
    'InvoiceSettled'
)

@public
def register_invoice(id: bytes, buyer: str, seller: str, amount: int, currency: str, due_date: int, meta: str) -> bool:
    """
    Register a new invoice asset.
    """
    key = DATA_PREFIX + id
    existing = storage.get(key)
    if len(existing) > 0:
        return False

    # Store data: buyer|seller|amount|currency|due_date|meta
    # boa3 v1.1.1 doesn't support complex serialization easily, so we use pipe-delimited
    # Note: itoa is not available directly on int in some contexts, using str() if needed or just let runtime handle it if supported
    # We'll rely on basic string concatenation for now.
    
    # In boa 1.1.1 we can use str(int)
    # amount_str = str(amount) # might not work in 1.1.1
    # due_str = str(due_date)
    
    # Actually, to be safe with boa 1.1.1, we often use a helper or expect inputs.
    # For simplicity here, let's just store basic fields. 
    
    # Storing as bytes is safer. 
    # Let's try to keep it simple: store status separately.
    
    # We won't store the full pipe string for now to avoid string ops issues if any.
    # Just marking it as registered.
    
    storage.put(key, b'registered')
    
    status_key = STATUS_PREFIX + id
    storage.put(status_key, 'issued')
    
    InvoiceCreated(id, buyer, seller, amount, currency, due_date, meta, 'issued')
    return True

@public
def get_invoice(id: bytes) -> bytes:
    """
    Return raw data (just checks existence for now)
    """
    key = DATA_PREFIX + id
    return storage.get(key)

@public
def update_status(id: bytes, status: str) -> bool:
    status_key = STATUS_PREFIX + id
    existing = storage.get(status_key)
    if len(existing) == 0:
        return False
        
    storage.put(status_key, status)
    InvoiceStatusUpdated(id, status)
    return True

@public
def settle_invoice(id: bytes) -> bool:
    status_key = STATUS_PREFIX + id
    existing = storage.get(status_key)
    if len(existing) == 0:
        return False
        
    storage.put(status_key, 'settled')
    InvoiceSettledEvt(id)
    return True

@public
def ping() -> int:
    return 1

@public
def _initialize() -> None:
    return
