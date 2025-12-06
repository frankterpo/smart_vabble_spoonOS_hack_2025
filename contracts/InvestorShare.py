from boa3.builtin.compile_time import public, CreateNewEvent
from boa3.builtin.interop import storage
from boa3.builtin.interop.stdlib import serialize, deserialize

ALLOC_PREFIX = b'invshare:alloc:'
REDEEM_PREFIX = b'invshare:redeem:'
TOTAL_ALLOC_PREFIX = b'invshare:total_alloc:'
TOTAL_REDEEM_PREFIX = b'invshare:total_redeem:'

ShareAllocated = CreateNewEvent([
    ('invoice_id', bytes),
    ('investor', bytes),
    ('amount', int),
], 'ShareAllocated')

ShareTransferred = CreateNewEvent([
    ('invoice_id', bytes),
    ('from_investor', bytes),
    ('to_investor', bytes),
    ('amount', int),
], 'ShareTransferred')

ShareRedeemed = CreateNewEvent([
    ('invoice_id', bytes),
    ('investor', bytes),
    ('amount', int),
], 'ShareRedeemed')


def _k_alloc(invoice_id: bytes, investor: bytes) -> bytes:
    return ALLOC_PREFIX + invoice_id + b'|' + investor


def _k_redeem(invoice_id: bytes, investor: bytes) -> bytes:
    return REDEEM_PREFIX + invoice_id + b'|' + investor


def _k_total_alloc(invoice_id: bytes) -> bytes:
    return TOTAL_ALLOC_PREFIX + invoice_id


def _k_total_redeem(invoice_id: bytes) -> bytes:
    return TOTAL_REDEEM_PREFIX + invoice_id


def _get_amount(key: bytes) -> int:
    val = storage.get(key)
    if val == b'':
        return 0
    amt: int = deserialize(val)
    return amt


def _put_amount(key: bytes, amount: int):
    storage.put(key, serialize(amount))


@public
def allocate(invoice_id: bytes, investor: bytes, amount: int) -> bool:
    if amount <= 0:
        return False
    alloc_key = _k_alloc(invoice_id, investor)
    current = _get_amount(alloc_key)
    _put_amount(alloc_key, current + amount)
    _put_amount(_k_total_alloc(invoice_id), _get_amount(_k_total_alloc(invoice_id)) + amount)
    ShareAllocated(invoice_id, investor, amount)
    return True


@public
def transfer(invoice_id: bytes, from_investor: bytes, to_investor: bytes, amount: int) -> bool:
    if amount <= 0:
        return False
    from_key = _k_alloc(invoice_id, from_investor)
    to_key = _k_alloc(invoice_id, to_investor)
    from_alloc = _get_amount(from_key)
    from_redeemed = _get_amount(_k_redeem(invoice_id, from_investor))
    available = from_alloc - from_redeemed
    if available < amount:
        return False
    _put_amount(from_key, from_alloc - amount)
    _put_amount(to_key, _get_amount(to_key) + amount)
    ShareTransferred(invoice_id, from_investor, to_investor, amount)
    return True


@public
def redeem(invoice_id: bytes, investor: bytes, amount: int) -> bool:
    if amount <= 0:
        return False
    alloc = _get_amount(_k_alloc(invoice_id, investor))
    redeemed = _get_amount(_k_redeem(invoice_id, investor))
    available = alloc - redeemed
    if available < amount:
        return False
    _put_amount(_k_redeem(invoice_id, investor), redeemed + amount)
    _put_amount(_k_total_redeem(invoice_id), _get_amount(_k_total_redeem(invoice_id)) + amount)
    ShareRedeemed(invoice_id, investor, amount)
    return True


@public
def get_share(invoice_id: bytes, investor: bytes) -> str:
    alloc = _get_amount(_k_alloc(invoice_id, investor))
    redeemed = _get_amount(_k_redeem(invoice_id, investor))
    available = alloc - redeemed
    return str(alloc) + '|' + str(redeemed) + '|' + str(available)


@public
def total_allocated(invoice_id: bytes) -> int:
    return _get_amount(_k_total_alloc(invoice_id))


@public
def total_claimed(invoice_id: bytes) -> int:
    return _get_amount(_k_total_redeem(invoice_id))

