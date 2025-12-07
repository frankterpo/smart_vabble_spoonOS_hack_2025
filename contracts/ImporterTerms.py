"""
ImporterTerms - Buyer confirmation & financing terms for Vabble marketplace
Deployed on Neo N3 TestNet
Compatible with neo3-boa v1.1.1

This contract allows importers (buyers like Walmart, Nestle) to:
1. Register financing terms they're willing to accept
2. Confirm payables on-chain (cryptographic commitment)
"""

from boa3.builtin.compile_time import public, CreateNewEvent
from boa3.builtin.interop import storage

# Storage prefixes
TERMS_PREFIX = b'imp:terms:'
CONFIRMED_PREFIX = b'imp:confirmed:'
IMPORTER_PREFIX = b'imp:profile:'

# Events
TermsRegistered = CreateNewEvent([
    ('invoice_id', bytes),
    ('importer_id', bytes),
    ('max_yield_bps', int),
    ('currency', str),
    ('jurisdiction', str)
], 'TermsRegistered')

TermsUpdated = CreateNewEvent([
    ('invoice_id', bytes),
    ('max_yield_bps', int)
], 'TermsUpdated')

PayableConfirmed = CreateNewEvent([
    ('invoice_id', bytes),
    ('importer_id', bytes)
], 'PayableConfirmed')

ImporterRegistered = CreateNewEvent([
    ('importer_id', bytes),
    ('company_name', str),
    ('country', str)
], 'ImporterRegistered')


@public
def register_importer(importer_id: bytes, company_name: str, country: str) -> bool:
    """
    Register an importer profile.
    
    Args:
        importer_id: Unique importer identifier
        company_name: Company name (e.g., "Walmart", "Nestle")
        country: ISO country code (e.g., "US", "CH")
    
    Returns:
        True if registered, False if already exists
    """
    key = IMPORTER_PREFIX + importer_id
    existing = storage.get(key)
    
    if len(existing) > 0:
        return False
    
    data = company_name + '|' + country
    storage.put(key, data)
    
    ImporterRegistered(importer_id, company_name, country)
    return True


@public
def get_importer(importer_id: bytes) -> bytes:
    """Get importer profile data."""
    key = IMPORTER_PREFIX + importer_id
    return storage.get(key)


@public
def is_importer_registered(importer_id: bytes) -> bool:
    """Check if importer is registered."""
    key = IMPORTER_PREFIX + importer_id
    existing = storage.get(key)
    return len(existing) > 0


@public
def register_terms(invoice_id: bytes, importer_id: bytes, max_yield_bps: int, currency: str, jurisdiction: str) -> bool:
    """
    Register financing terms for an invoice.
    
    Args:
        invoice_id: Invoice to set terms for
        importer_id: Importer (buyer) setting the terms
        max_yield_bps: Maximum yield in basis points (e.g., 850 = 8.5%)
        currency: Settlement currency (e.g., "USD")
        jurisdiction: Legal jurisdiction (e.g., "CH" for Switzerland)
    
    Returns:
        True if terms registered, False if already exists
    """
    key = TERMS_PREFIX + invoice_id
    existing = storage.get(key)
    
    if len(existing) > 0:
        return False  # Terms already exist
    
    # Store simple marker with importer + terms info
    # Format: currency|jurisdiction (importer stored separately)
    data = currency + '|' + jurisdiction
    storage.put(key, data)
    
    # Store yield separately for easy updates
    yield_key = key + b':yield'
    storage.put(yield_key, max_yield_bps)
    
    # Store importer link
    importer_key = key + b':importer'
    storage.put(importer_key, importer_id)
    
    TermsRegistered(invoice_id, importer_id, max_yield_bps, currency, jurisdiction)
    return True


@public
def update_terms(invoice_id: bytes, max_yield_bps: int) -> bool:
    """
    Update financing terms (only yield can be updated).
    
    Args:
        invoice_id: Invoice to update
        max_yield_bps: New maximum yield in basis points
    
    Returns:
        True if updated, False if terms don't exist
    """
    key = TERMS_PREFIX + invoice_id
    existing = storage.get(key)
    
    if len(existing) == 0:
        return False
    
    # Update yield
    yield_key = key + b':yield'
    storage.put(yield_key, max_yield_bps)
    
    TermsUpdated(invoice_id, max_yield_bps)
    return True


@public
def get_terms(invoice_id: bytes) -> bytes:
    """
    Get terms for an invoice.
    
    Returns:
        Pipe-delimited terms data or empty bytes if not found
    """
    key = TERMS_PREFIX + invoice_id
    return storage.get(key)


@public
def get_terms_yield(invoice_id: bytes) -> int:
    """Get max yield for invoice terms."""
    key = TERMS_PREFIX + invoice_id + b':yield'
    raw = storage.get(key)
    if len(raw) == 0:
        return 0
    # Storage returns bytes, need to interpret as int
    return raw[0] if len(raw) == 1 else 0


@public
def get_terms_importer(invoice_id: bytes) -> bytes:
    """Get importer who set the terms."""
    key = TERMS_PREFIX + invoice_id + b':importer'
    return storage.get(key)


@public
def confirm_payable(invoice_id: bytes, importer_id: bytes) -> bool:
    """
    Importer confirms the payable on-chain.
    This is the cryptographic commitment that the buyer will pay.
    
    Args:
        invoice_id: Invoice to confirm
        importer_id: Importer confirming
    
    Returns:
        True if confirmed, False if already confirmed or no terms
    """
    # Check terms exist
    terms_key = TERMS_PREFIX + invoice_id
    terms = storage.get(terms_key)
    
    if len(terms) == 0:
        return False  # No terms registered
    
    # Check not already confirmed
    confirmed_key = CONFIRMED_PREFIX + invoice_id
    already = storage.get(confirmed_key)
    
    if len(already) > 0:
        return False  # Already confirmed
    
    # Mark as confirmed with importer id
    storage.put(confirmed_key, importer_id)
    
    PayableConfirmed(invoice_id, importer_id)
    return True


@public
def is_confirmed(invoice_id: bytes) -> bool:
    """Check if payable is confirmed by importer."""
    key = CONFIRMED_PREFIX + invoice_id
    existing = storage.get(key)
    return len(existing) > 0


@public
def get_confirmer(invoice_id: bytes) -> bytes:
    """Get the importer who confirmed the payable."""
    key = CONFIRMED_PREFIX + invoice_id
    return storage.get(key)


@public
def ping() -> int:
    """Health check."""
    return 1


@public
def _initialize() -> None:
    """Contract initialization."""
    return
