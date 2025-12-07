#!/bin/bash
set -e

echo "📦 Compiling DDRegistry contract..."

PYTHON310=""
for py in python3.10 /opt/homebrew/bin/python3.10 /usr/local/bin/python3.10; do
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTRACT="$PROJECT_ROOT/contracts/DDRegistry.py"
OUT_DIR="$PROJECT_ROOT/build"
OUT_NEF="$OUT_DIR/DDRegistry.nef"

mkdir -p "$OUT_DIR"

echo "🛠  Compiling DDRegistry..."

if ! /opt/homebrew/bin/neo3-boa compile "$CONTRACT" --output "$OUT_NEF"; then
  echo "❌ Compilation failed"
  exit 1
fi

echo ""
echo "✅ Compilation complete!"
echo "NEF:      $OUT_NEF"
echo "MANIFEST: $OUT_DIR/DDRegistry.manifest.json"
wc -c "$OUT_NEF"
wc -c "$OUT_DIR/DDRegistry.manifest.json"

