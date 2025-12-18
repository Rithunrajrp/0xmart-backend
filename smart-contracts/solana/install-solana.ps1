# Solana CLI Installation Script for Windows
# Run this in PowerShell as Administrator

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Solana CLI Installation for Windows" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  Warning: Not running as Administrator" -ForegroundColor Yellow
    Write-Host "Some operations may fail. Consider running PowerShell as Administrator." -ForegroundColor Yellow
    Write-Host ""
}

# Step 1: Create temp directory
Write-Host "📁 Step 1: Creating temporary directory..." -ForegroundColor Green
$tempDir = "C:\solana-install-tmp"
New-Item -Path $tempDir -ItemType Directory -Force | Out-Null
Write-Host "✓ Created: $tempDir" -ForegroundColor Green
Write-Host ""

# Step 2: Download Solana installer
Write-Host "⬇️  Step 2: Downloading Solana installer..." -ForegroundColor Green
$installerUrl = "https://release.solana.com/v1.18.0/solana-install-init-x86_64-pc-windows-msvc.exe"
$installerPath = "$tempDir\solana-install-init.exe"

try {
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "✓ Downloaded installer" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to download installer: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Run installer
Write-Host "🚀 Step 3: Running Solana installer..." -ForegroundColor Green
Write-Host "This may take a few minutes..." -ForegroundColor Yellow

try {
    & $installerPath v1.18.0
    Write-Host "✓ Solana installed successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Installation failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Add to PATH
Write-Host "🔧 Step 4: Configuring PATH..." -ForegroundColor Green

$solanaPath = "$env:USERPROFILE\.local\share\solana\install\active_release\bin"

if (Test-Path $solanaPath) {
    # Add to current session
    $env:Path += ";$solanaPath"

    # Add permanently for user
    $currentPath = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)
    if ($currentPath -notlike "*$solanaPath*") {
        [System.Environment]::SetEnvironmentVariable("Path", "$currentPath;$solanaPath", [System.EnvironmentVariableTarget]::User)
        Write-Host "✓ Added to PATH: $solanaPath" -ForegroundColor Green
    } else {
        Write-Host "✓ Already in PATH" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  Warning: Solana path not found: $solanaPath" -ForegroundColor Yellow
    Write-Host "You may need to add it to PATH manually" -ForegroundColor Yellow
}
Write-Host ""

# Step 5: Verify installation
Write-Host "✅ Step 5: Verifying installation..." -ForegroundColor Green

# Refresh PATH in current session
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::Machine) + ";" + [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)

try {
    $version = & solana --version 2>&1
    Write-Host "✓ Solana installed: $version" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not verify installation in current session" -ForegroundColor Yellow
    Write-Host "Please close and reopen PowerShell, then run: solana --version" -ForegroundColor Yellow
}
Write-Host ""

# Step 6: Install build tools
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Next: Install Solana Build Tools" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "Do you want to install cargo-build-sbf now? (This takes 5-10 minutes)" -ForegroundColor Yellow
$response = Read-Host "Type 'yes' to install, or 'no' to skip"

if ($response -eq "yes") {
    Write-Host ""
    Write-Host "⚙️  Installing cargo-build-sbf..." -ForegroundColor Green
    Write-Host "This will take several minutes. Please wait..." -ForegroundColor Yellow
    Write-Host ""

    try {
        cargo install --git https://github.com/solana-labs/cargo-build-sbf --tag v1.18.0 cargo-build-sbf
        Write-Host "✓ cargo-build-sbf installed successfully!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to install cargo-build-sbf: $_" -ForegroundColor Red
        Write-Host "You can install it later with:" -ForegroundColor Yellow
        Write-Host "cargo install --git https://github.com/solana-labs/cargo-build-sbf --tag v1.18.0 cargo-build-sbf" -ForegroundColor Cyan
    }
} else {
    Write-Host ""
    Write-Host "Skipped cargo-build-sbf installation." -ForegroundColor Yellow
    Write-Host "Install it later with:" -ForegroundColor Yellow
    Write-Host "cargo install --git https://github.com/solana-labs/cargo-build-sbf --tag v1.18.0 cargo-build-sbf" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Installation Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Close and reopen PowerShell (to refresh PATH)" -ForegroundColor White
Write-Host "2. Verify: solana --version" -ForegroundColor White
Write-Host "3. Build program: cd smart-contracts\solana && cargo build-sbf" -ForegroundColor White
Write-Host "4. Deploy: solana program deploy target\deploy\oxmart_payment.so" -ForegroundColor White
Write-Host ""

Write-Host "🔗 Useful Commands:" -ForegroundColor Yellow
Write-Host "   solana config set --url devnet" -ForegroundColor Cyan
Write-Host "   solana balance" -ForegroundColor Cyan
Write-Host "   solana airdrop 2" -ForegroundColor Cyan
Write-Host ""

# Cleanup
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "✨ Installation script completed!" -ForegroundColor Green
Write-Host ""
