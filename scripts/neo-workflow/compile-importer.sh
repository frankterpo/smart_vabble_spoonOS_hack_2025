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
  exit 1
fi

echo "✅ Found Python 3.10: $PYTHON310"
"$PYTHON310" --version
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTRACT="$PROJECT_ROOT/contracts/ImporterTerms.py"
OUT_DIR="$PROJECT_ROOT/build"
OUT_NEF="$OUT_DIR/ImporterTerms.nef"

mkdir -p "$OUT_DIR"

echo "🛠  Compiling ImporterTerms contract with neo3-boa..."
echo ""

if ! /opt/homebrew/bin/neo3-boa compile "$CONTRACT" --output "$OUT_NEF"; then
  echo "❌ Compilation failed"
  exit 1
fi

NEF="$OUT_NEF"
MANIFEST="$OUT_DIR/ImporterTerms.manifest.json"

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

