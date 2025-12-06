# Python 3.10 Setup for neo3-boa

## Why Python 3.10?

**neo3-boa v1.4.1 is NOT compatible with Python 3.11, 3.12, or 3.13.**

The compiler uses a static type analyzer tuned for Python 3.8-3.10. Using newer Python versions causes:
- "Unresolved reference" errors
- Type checking failures
- Compilation errors

## Installation

### macOS (Homebrew)

```bash
brew install python@3.10
```

After installation, verify:
```bash
python3.10 --version
# Should show: Python 3.10.x
```

### Using pyenv

```bash
pyenv install 3.10.13
pyenv local 3.10.13
python --version  # Should show 3.10.13
```

## Verify Setup

```bash
cd /Users/franciscoterpolilli/Projects/vabs_v2
npm run compile
```

The compile script will automatically:
1. Detect Python 3.10
2. Install neo3-boa for Python 3.10
3. Compile the contract

## Troubleshooting

If you see "Python 3.10 not found":
1. Install Python 3.10 using one of the methods above
2. Make sure `python3.10` is in your PATH
3. Run `npm run compile` again

If compilation still fails:
- Check that neo3-boa is installed: `python3.10 -m pip list | grep neo3-boa`
- Reinstall: `python3.10 -m pip install --user neo3-boa`
