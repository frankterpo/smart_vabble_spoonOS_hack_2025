#!/bin/bash
set -e

echo "📦 Checking for Python 3.10 (required for neo3-boa compatibility)..."
echo ""

PYTHON310=""
PYENV_CANDIDATES=""
if command -v pyenv >/dev/null 2>&1; then
  PYENV_ROOT="$(pyenv root)"
  PYENV_CANDIDATES=$(ls "$PYENV_ROOT"/versions/3.10*/bin/python 2>/dev/null || true)
fi

for py in python3.10 /opt/homebrew/bin/python3.10 /usr/local/bin/python3.10 $PYENV_CANDIDATES; do
  if command -v "$py" >/dev/null 2>&1 && "$py" --version 2>&1 | grep -q "3.10"; then
    PYTHON310="$py"
    break
  fi
done

if [ -z "$PYTHON310" ]; then
  echo "❌ ERROR: Python 3.10 not found!"
  echo ""
  echo "neo3-boa v1.1.1 requires Python 3.8-3.10 (NOT 3.11+)."
  echo ""
  echo "Install Python 3.10 using one of these methods:"
  echo "  brew install python@3.10"
  echo "  pyenv install 3.10.13 && pyenv local 3.10.13"
  exit 1
fi

echo "✅ Found Python 3.10: $PYTHON310"
"$PYTHON310" --version
echo ""

echo "📦 Installing neo3-boa for Python 3.10 (if missing)..."
"$PYTHON310" -m pip install --user neo3-boa >/dev/null 2>&1 || "$PYTHON310" -m pip install neo3-boa --break-system-packages >/dev/null 2>&1 || {
  echo "⚠️  Could not install neo3-boa automatically. Trying to continue..."
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTRACT="$PROJECT_ROOT/contracts/InvoiceAsset.py"
OUT_DIR="$PROJECT_ROOT/build"
OUT_NEF="$OUT_DIR/InvoiceAsset.nef"

mkdir -p "$OUT_DIR"

echo "🛠  Compiling InvoiceAsset contract with neo3-boa..."
echo ""

if ! /opt/homebrew/bin/neo3-boa compile "$CONTRACT" --output "$OUT_NEF"; then
  echo "❌ Compilation failed with exit code $?"
  exit 1
fi

NEF="$OUT_NEF"
MANIFEST="$OUT_DIR/InvoiceAsset.manifest.json"

if [[ ! -f "$NEF" ]]; then
  echo "❌ NEF file not produced. Compile failed."
  exit 1
fi

echo ""
echo "✅ Compilation complete!"
echo "NEF:      $NEF"
echo "MANIFEST: $MANIFEST"
wc -c "$NEF"
wc -c "$MANIFEST"

