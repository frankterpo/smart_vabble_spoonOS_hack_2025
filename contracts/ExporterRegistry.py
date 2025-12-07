"""
ExporterRegistry - KYC-lite exporter profiles for Vabble marketplace
Deployed on Neo N3 TestNet
Compatible with neo3-boa v1.1.1
"""

from boa3.builtin.compile_time import public, CreateNewEvent
from boa3.builtin.interop import storage

# Storage prefixes
PROFILE_PREFIX = b'exp:profile:'
LINK_PREFIX = b'exp:link:'

# Events
ExporterRegistered = CreateNewEvent([
    ('exporter_id', bytes),
    ('company_name', str),
    ('country', str),
    ('sector', str)
], 'ExporterRegistered')

ExporterUpdated = CreateNewEvent([
    ('exporter_id', bytes),
    ('company_name', str),
    ('country', str),
    ('sector', str)
], 'ExporterUpdated')

ExporterLinkedInvoice = CreateNewEvent([
    ('exporter_id', bytes),
    ('invoice_id', bytes)
], 'ExporterLinkedInvoice')


@public
def register_profile(exporter_id: bytes, company_name: str, country: str, sector: str) -> bool:
    """
    Register a new exporter profile.
    
    Args:
        exporter_id: Unique exporter identifier (e.g., tax ID or internal ID)
        company_name: Company/business name
        country: ISO country code (e.g., "VE", "CO", "PE")
        sector: Industry sector (e.g., "cacao", "coffee", "metals")
    
    Returns:
        True if registered successfully, False if already exists
    """
    key = PROFILE_PREFIX + exporter_id
    existing = storage.get(key)
    
    if len(existing) > 0:
        return False  # Already registered
    
    # Store as pipe-delimited string
    data = company_name + '|' + country + '|' + sector
    storage.put(key, data)
    
    ExporterRegistered(exporter_id, company_name, country, sector)
    return True


@public
def get_profile(exporter_id: bytes) -> bytes:
    """
    Retrieve exporter profile data.
    
    Args:
        exporter_id: Exporter identifier
    
    Returns:
        Pipe-delimited profile data or empty bytes if not found
    """
    key = PROFILE_PREFIX + exporter_id
    return storage.get(key)


@public
def update_profile(exporter_id: bytes, company_name: str, country: str, sector: str) -> bool:
    """
    Update an existing exporter profile.
    
    Args:
        exporter_id: Exporter identifier
        company_name: New company name
        country: New country code
        sector: New sector
    
    Returns:
        True if updated, False if exporter not found
    """
    key = PROFILE_PREFIX + exporter_id
    existing = storage.get(key)
    
    if len(existing) == 0:
        return False  # Not registered
    
    # Update with new data
    data = company_name + '|' + country + '|' + sector
    storage.put(key, data)
    
    ExporterUpdated(exporter_id, company_name, country, sector)
    return True


@public
def is_registered(exporter_id: bytes) -> bool:
    """
    Check if an exporter is registered.
    
    Args:
        exporter_id: Exporter identifier
    
    Returns:
        True if registered, False otherwise
    """
    key = PROFILE_PREFIX + exporter_id
    existing = storage.get(key)
    return len(existing) > 0


@public
def link_invoice(exporter_id: bytes, invoice_id: bytes) -> bool:
    """
    Link an invoice to an exporter's profile.
    
    Args:
        exporter_id: Exporter identifier
        invoice_id: Invoice identifier to link
    
    Returns:
        True if linked successfully, False if exporter not registered
    """
    # Check exporter exists
    profile_key = PROFILE_PREFIX + exporter_id
    existing = storage.get(profile_key)
    
    if len(existing) == 0:
        return False  # Exporter not registered
    
    # Store link
    link_key = LINK_PREFIX + exporter_id + b':' + invoice_id
    storage.put(link_key, b'1')
    
    ExporterLinkedInvoice(exporter_id, invoice_id)
    return True


@public
def is_invoice_linked(exporter_id: bytes, invoice_id: bytes) -> bool:
    """
    Check if an invoice is linked to an exporter.
    
    Args:
        exporter_id: Exporter identifier
        invoice_id: Invoice identifier
    
    Returns:
        True if linked, False otherwise
    """
    link_key = LINK_PREFIX + exporter_id + b':' + invoice_id
    existing = storage.get(link_key)
    return len(existing) > 0


@public
def ping() -> int:
    """Health check - returns 1 if contract is alive."""
    return 1


@public
def _initialize() -> None:
    """Contract initialization."""
    return
