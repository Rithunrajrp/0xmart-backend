# Solana Installation Guide for Windows

## Method 1: Direct Download (Recommended)

### Step 1: Download Solana Installer

Open PowerShell as Administrator and run:

```powershell
# Create temp directory
New-Item -Path "C:\solana-install-tmp" -ItemType Directory -Force

# Download installer
Invoke-WebRequest -Uri "https://release.solana.com/v1.18.0/solana-install-init-x86_64-pc-windows-msvc.exe" -OutFile "C:\solana-install-tmp\solana-install-init.exe"

# Run installer
& "C:\solana-install-tmp\solana-install-init.exe" v1.18.0
```

### Step 2: Add to PATH

The installer will show you the path. Add it to your PATH:

```powershell
# Add to PATH (replace USERNAME with your username)
$env:Path += ";C:\Users\USERNAME\.local\share\solana\install\active_release\bin"

# Make it permanent
[System.Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableTarget]::User)
```

### Step 3: Verify Installation

Close and reopen PowerShell, then:

```powershell
solana --version
```

Expected output: `solana-cli 1.18.0`

---

## Method 2: Manual Installation

If the installer doesn't work, follow these steps:

### Step 1: Download Solana Release

1. Go to: https://github.com/solana-labs/solana/releases
2. Download `solana-release-x86_64-pc-windows-msvc.tar.bz2`
3. Extract to `C:\solana`

### Step 2: Add to PATH

```powershell
$env:Path += ";C:\solana\bin"
[System.Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableTarget]::User)
```

---

## Install Solana Build Tools

After Solana CLI is installed:

```powershell
cargo install --git https://github.com/solana-labs/cargo-build-sbf --tag v1.18.0 cargo-build-sbf
```

This will take 5-10 minutes to compile and install.

---

## Quick Start Deployment

Once tools are installed:

```powershell
# Navigate to project
cd E:\company\0xMart\0xmart-application\0xmart-backend\smart-contracts\solana

# Build the program
cargo build-sbf

# Configure for devnet
solana config set --url devnet

# Set your wallet
solana config set --keypair E:\company\0xMart\0xmart-application\0xmart-backend\smart-contracts\solana-wallet.json

# Check balance
solana balance

# Deploy!
solana program deploy target\deploy\oxmart_payment.so
```

---

## Troubleshooting

### Error: "solana: command not found"

The PATH wasn't set correctly. Find your Solana installation:

```powershell
# Search for solana.exe
Get-ChildItem -Path C:\Users -Recurse -Filter "solana.exe" -ErrorAction SilentlyContinue
```

Add that directory to PATH.

### Error: "cargo-build-sbf: command not found"

The cargo bin directory isn't in PATH:

```powershell
$env:Path += ";$HOME\.cargo\bin"
[System.Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableTarget]::User)
```

### Error: "Insufficient funds"

Request more SOL from faucet:

```powershell
solana airdrop 2
```

Or visit: https://faucet.solana.com/

---

## Alternative: Use WSL (Windows Subsystem for Linux)

If you have WSL installed:

```bash
# In WSL terminal
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="/home/$USER/.local/share/solana/install/active_release/bin:$PATH"
```

---

## Next Steps After Installation

1. ✅ Verify installation: `solana --version`
2. ✅ Install build tools: `cargo install cargo-build-sbf`
3. ✅ Build program: `cargo build-sbf`
4. ✅ Deploy: `solana program deploy target\deploy\oxmart_payment.so`

---

**Need Help?**
- Solana Docs: https://docs.solana.com/cli/install-solana-cli-tools
- Discord: https://discord.gg/solana
