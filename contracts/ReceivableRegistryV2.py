from boa3.builtin.compile_time import public, CreateNewEvent
from boa3.builtin.interop import storage

INVOICE_PREFIX = b'reg:inv:'
SHARE_PREFIX = b'reg:share:'
STATUS_PREFIX = b'reg:status:'
ALLOWED_STATUSES = ["CREATED", "VERIFIED", "ACTIVE", "SETTLED", "CANCELLED"]

InvoiceRegistered = CreateNewEvent([
    ('id', bytes),
    ('invoice_contract', str),
], 'InvoiceRegistered')

ShareAttached = CreateNewEvent([
    ('id', bytes),
    ('share_contract', str),
], 'ShareAttached')

StatusChanged = CreateNewEvent([
    ('id', bytes),
    ('status', str),
], 'StatusChanged')

InvoiceSettledEvt = CreateNewEvent([
    ('id', bytes),
], 'InvoiceSettled')


def _k_invoice(id: bytes) -> bytes:
    return INVOICE_PREFIX + id


def _k_share(id: bytes) -> bytes:
    return SHARE_PREFIX + id


def _k_status(id: bytes) -> bytes:
    return STATUS_PREFIX + id


def _status_allowed(status: str) -> bool:
    for s in ALLOWED_STATUSES:
        if s == status:
            return True
    return False


@public
def register_invoice(id: bytes, invoice_contract_hash: str) -> bool:
    if storage.get(_k_invoice(id)) != b'':
        return False
    storage.put(_k_invoice(id), invoice_contract_hash)
    storage.put(_k_status(id), "CREATED")
    InvoiceRegistered(id, invoice_contract_hash)
    StatusChanged(id, "CREATED")
    return True


@public
def attach_investor_share(id: bytes, share_contract_hash: str) -> bool:
    if storage.get(_k_invoice(id)) == b'':
        return False
    storage.put(_k_share(id), share_contract_hash)
    ShareAttached(id, share_contract_hash)
    return True


@public
def set_status(id: bytes, status: str) -> bool:
    if not _status_allowed(status):
        return False
    if storage.get(_k_invoice(id)) == b'':
        return False
    storage.put(_k_status(id), status)
    StatusChanged(id, status)
    return True


@public
def settle(id: bytes) -> bool:
    current = storage.get(_k_status(id))
    if current == b'':
        return False
    if current == b"SETTLED" or current == b"CANCELLED":
        return False
    if not (current == b"ACTIVE" or current == b"VERIFIED"):
        return False
    storage.put(_k_status(id), "SETTLED")
    StatusChanged(id, "SETTLED")
    InvoiceSettledEvt(id)
    return True


@public
def get_invoice_contract(id: bytes) -> bytes:
    val = storage.get(_k_invoice(id))
    if val == b'':
        return b''
    return val


@public
def get_share_contract(id: bytes) -> bytes:
    val = storage.get(_k_share(id))
    if val == b'':
        return b''
    return val


@public
def get_status(id: bytes) -> bytes:
    val = storage.get(_k_status(id))
    if val == b'':
        return b''
    return val

