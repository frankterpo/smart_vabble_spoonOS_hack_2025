"""
DDRegistry - Due Diligence proofs and document verification for Vabble
Deployed on Neo N3 TestNet
Compatible with neo3-boa v1.1.1

This contract stores:
- Cryptographic proofs that DD was done (merkle roots, hashes)
- Statuses (not the actual documents)
- Document completeness flags

Actual documents live OFF-CHAIN (AIOZ, NeoFS, S3).
"""

from boa3.builtin.compile_time import public, CreateNewEvent
from boa3.builtin.interop import storage

# Storage prefixes
EXPORTER_DD_PREFIX = b'dd:exp:'      # Exporter-level DD
INVOICE_DD_PREFIX = b'dd:inv:'       # Invoice-level DD
DOC_HASH_PREFIX = b'dd:doc:'         # Document bundle hashes

# KYC Tiers (stored as strings for simplicity)
# TIER_1 = Full DD complete, institutional grade
# TIER_2 = Standard DD complete
# TIER_3 = Basic DD only
# RESTRICTED = Watchlist or flagged
# PENDING = DD not yet complete

# Doc Statuses
# MISSING = No docs submitted
# PARTIAL = Some docs submitted
# COMPLETE = All required docs present
# VERIFIED = Docs verified by Vabble

# Events
ExporterDDUpdated = CreateNewEvent([
    ('exporter_id', bytes),
    ('kyc_tier', str),
    ('dd_merkle_root', bytes)
], 'ExporterDDUpdated')

InvoiceDDUpdated = CreateNewEvent([
    ('invoice_id', bytes),
    ('docs_status', str),
    ('doc_bundle_hash', bytes)
], 'InvoiceDDUpdated')

DDVerified = CreateNewEvent([
    ('entity_id', bytes),
    ('entity_type', str),
    ('verifier', str)
], 'DDVerified')


@public
def set_exporter_dd(exporter_id: bytes, kyc_tier: str, dd_merkle_root: bytes, kyc_status: str) -> bool:
    """
    Set Due Diligence status for an exporter.
    
    Args:
        exporter_id: Exporter identifier
        kyc_tier: TIER_1, TIER_2, TIER_3, RESTRICTED, PENDING
        dd_merkle_root: Merkle root of all KYC/KYB docs (32 bytes hash)
        kyc_status: PENDING, APPROVED, REJECTED, REVIEW
    
    Returns:
        True if set successfully
    """
    # Store tier
    tier_key = EXPORTER_DD_PREFIX + exporter_id + b':tier'
    storage.put(tier_key, kyc_tier)
    
    # Store merkle root
    merkle_key = EXPORTER_DD_PREFIX + exporter_id + b':merkle'
    storage.put(merkle_key, dd_merkle_root)
    
    # Store status
    status_key = EXPORTER_DD_PREFIX + exporter_id + b':status'
    storage.put(status_key, kyc_status)
    
    ExporterDDUpdated(exporter_id, kyc_tier, dd_merkle_root)
    return True


@public
def get_exporter_kyc_tier(exporter_id: bytes) -> bytes:
    """Get KYC tier for exporter."""
    key = EXPORTER_DD_PREFIX + exporter_id + b':tier'
    return storage.get(key)


@public
def get_exporter_dd_merkle(exporter_id: bytes) -> bytes:
    """Get DD merkle root for exporter."""
    key = EXPORTER_DD_PREFIX + exporter_id + b':merkle'
    return storage.get(key)


@public
def get_exporter_kyc_status(exporter_id: bytes) -> bytes:
    """Get KYC approval status."""
    key = EXPORTER_DD_PREFIX + exporter_id + b':status'
    return storage.get(key)


@public
def set_invoice_dd(invoice_id: bytes, docs_status: str, doc_bundle_hash: bytes, has_bl: bool, has_po: bool, has_insurance: bool) -> bool:
    """
    Set Due Diligence and document status for an invoice.
    
    Args:
        invoice_id: Invoice identifier
        docs_status: MISSING, PARTIAL, COMPLETE, VERIFIED
        doc_bundle_hash: Hash of all invoice docs (invoice PDF, BL, PO, etc.)
        has_bl: Has Bill of Lading
        has_po: Has Purchase Order
        has_insurance: Has Insurance Certificate
    
    Returns:
        True if set successfully
    """
    # Store docs status
    status_key = INVOICE_DD_PREFIX + invoice_id + b':status'
    storage.put(status_key, docs_status)
    
    # Store doc bundle hash
    hash_key = INVOICE_DD_PREFIX + invoice_id + b':hash'
    storage.put(hash_key, doc_bundle_hash)
    
    # Store document flags
    bl_key = INVOICE_DD_PREFIX + invoice_id + b':bl'
    storage.put(bl_key, b'1' if has_bl else b'0')
    
    po_key = INVOICE_DD_PREFIX + invoice_id + b':po'
    storage.put(po_key, b'1' if has_po else b'0')
    
    ins_key = INVOICE_DD_PREFIX + invoice_id + b':ins'
    storage.put(ins_key, b'1' if has_insurance else b'0')
    
    InvoiceDDUpdated(invoice_id, docs_status, doc_bundle_hash)
    return True


@public
def get_invoice_docs_status(invoice_id: bytes) -> bytes:
    """Get document completeness status."""
    key = INVOICE_DD_PREFIX + invoice_id + b':status'
    return storage.get(key)


@public
def get_invoice_doc_hash(invoice_id: bytes) -> bytes:
    """Get document bundle hash for integrity verification."""
    key = INVOICE_DD_PREFIX + invoice_id + b':hash'
    return storage.get(key)


@public
def has_bill_of_lading(invoice_id: bytes) -> bool:
    """Check if invoice has Bill of Lading."""
    key = INVOICE_DD_PREFIX + invoice_id + b':bl'
    val = storage.get(key)
    return len(val) > 0 and val == b'1'


@public
def has_purchase_order(invoice_id: bytes) -> bool:
    """Check if invoice has Purchase Order."""
    key = INVOICE_DD_PREFIX + invoice_id + b':po'
    val = storage.get(key)
    return len(val) > 0 and val == b'1'


@public
def has_insurance(invoice_id: bytes) -> bool:
    """Check if invoice has Insurance Certificate."""
    key = INVOICE_DD_PREFIX + invoice_id + b':ins'
    val = storage.get(key)
    return len(val) > 0 and val == b'1'


@public
def verify_exporter_dd(exporter_id: bytes, verifier: str) -> bool:
    """
    Mark exporter DD as verified by a specific verifier.
    
    Args:
        exporter_id: Exporter ID
        verifier: Who verified (e.g., "vabble_ops", "external_auditor")
    
    Returns:
        True if marked
    """
    key = b'dd:verified:exp:' + exporter_id
    storage.put(key, verifier)
    
    DDVerified(exporter_id, 'exporter', verifier)
    return True


@public
def verify_invoice_dd(invoice_id: bytes, verifier: str) -> bool:
    """
    Mark invoice DD as verified by a specific verifier.
    
    Args:
        invoice_id: Invoice ID
        verifier: Who verified
    
    Returns:
        True if marked
    """
    key = b'dd:verified:inv:' + invoice_id
    storage.put(key, verifier)
    
    DDVerified(invoice_id, 'invoice', verifier)
    return True


@public
def get_exporter_verifier(exporter_id: bytes) -> bytes:
    """Get who verified this exporter's DD."""
    key = b'dd:verified:exp:' + exporter_id
    return storage.get(key)


@public
def get_invoice_verifier(invoice_id: bytes) -> bytes:
    """Get who verified this invoice's DD."""
    key = b'dd:verified:inv:' + invoice_id
    return storage.get(key)


@public
def is_dd_complete(invoice_id: bytes) -> bool:
    """
    Quick check: Is DD complete for this invoice?
    Returns True only if docs_status is COMPLETE or VERIFIED.
    """
    key = INVOICE_DD_PREFIX + invoice_id + b':status'
    status = storage.get(key)
    # Check if status starts with 'COMPLETE' or 'VERIFIED'
    return len(status) >= 8 and (status[:8] == b'COMPLETE' or status[:8] == b'VERIFIED')


@public
def ping() -> int:
    """Health check."""
    return 1


@public
def _initialize() -> None:
    """Contract initialization."""
    return

