#!/bin/bash
set -e

echo "📦 Checking for Python 3.10 (required for neo3-boa compatibility)..."
echo ""

# Find Python 3.10
PYTHON310=""
# Check common locations
for py in python3.10 /opt/homebrew/bin/python3.10 /usr/local/bin/python3.10; do
    if command -v "$py" >/dev/null 2>&1 && "$py" --version 2>&1 | grep -q "3.10"; then
        PYTHON310="$py"
        break
    fi
done

# Check pyenv if not found
if [ -z "$PYTHON310" ] && command -v pyenv >/dev/null 2>&1; then
    PYENV_ROOT=$(pyenv root 2>/dev/null || echo "$HOME/.pyenv")
    for py in "$PYENV_ROOT"/versions/3.10*/bin/python; do
        if [ -f "$py" ] && "$py" --version 2>&1 | grep -q "3.10"; then
            PYTHON310="$py"
            break
        fi
    done
fi

if [ -z "$PYTHON310" ]; then
    echo "❌ ERROR: Python 3.10 not found!"
    echo ""
    echo "neo3-boa v1.4.1 requires Python 3.8-3.10 (NOT 3.11, 3.12, or 3.13)"
    echo ""
    echo "Install Python 3.10 using one of these methods:"
    echo ""
    echo "  Option 1 (Homebrew):"
    echo "    brew install python@3.10"
    echo ""
    echo "  Option 2 (pyenv):"
    echo "    pyenv install 3.10.13"
    echo "    pyenv local 3.10.13"
    echo ""
    exit 1
fi

echo "✅ Found Python 3.10: $PYTHON310"
"$PYTHON310" --version
echo ""

echo "📦 Installing neo3-boa for Python 3.10..."
"$PYTHON310" -m pip install --user neo3-boa >/dev/null 2>&1 || "$PYTHON310" -m pip install neo3-boa --break-system-packages >/dev/null 2>&1 || {
    echo "⚠️  Could not install neo3-boa automatically. Trying to continue..."
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTRACT="$PROJECT_ROOT/contracts/ReceivableRegistryV1.py"
OUT_DIR="$PROJECT_ROOT/build"

mkdir -p "$OUT_DIR"

echo "🛠  Compiling ReceivableRegistryV1 contract with Python 3.10..."
echo ""

# Use Python 3.10 with boa3 CLI module
"$PYTHON310" << EOF
import sys
import os
from boa3.cli import main

os.chdir('$PROJECT_ROOT')
sys.argv = ['boa3', 'compile', '$CONTRACT', '--output', '$OUT_DIR/ReceivableRegistryV1.nef']
try:
    main()
    print("✅ Compilation successful!")
except SystemExit as e:
    if e.code != 0:
        print(f"❌ Compilation failed with exit code {e.code}")
        sys.exit(e.code)
except Exception as e:
    print(f"❌ Compilation error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
EOF

NEF="$OUT_DIR/ReceivableRegistryV1.nef"
MANIFEST="$OUT_DIR/ReceivableRegistryV1.manifest.json"

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
