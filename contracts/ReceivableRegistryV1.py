from boa3.builtin.compile_time import public
from boa3.builtin.interop import storage


PREFIX = b'rec:'


@public
def register(id: bytes,
             buyer: str,
             seller: str,
             amount: int,
             currency: str,
             due_date: int,
             meta: str) -> bool:
    """
    Register a new receivable.

    The record is stored as:
    buyer|seller|amount|currency|due_date|registered|meta
    and keyed as PREFIX + id.
    Note: id must be bytes (caller should convert string with .encode('utf-8')).
    """
    key = PREFIX + id
    # Check if record already exists
    existing = storage.get(key)
    if existing != b'':
        return False

    amount_str = str(amount)
    due_str = str(due_date)

    record = (
        buyer + '|' +
        seller + '|' +
        amount_str + '|' +
        currency + '|' +
        due_str + '|' +
        'registered' + '|' +
        meta
    )
    
    # Store as bytes - boa3 v1.1.1 requires bytes for storage with bytes keys
    # We'll need to handle encoding in the invoke script
    storage.put(key, record)
    return True


@public
def get_record(id: bytes) -> bytes:
    """
    Return the raw pipe-delimited record bytes, or empty bytes if not found.
    Note: id must be bytes (caller should convert string with .encode('utf-8')).
    Caller must decode the result bytes to string.
    """
    key = PREFIX + id
    result = storage.get(key)
    if result == b'':
        return b''
    return result
