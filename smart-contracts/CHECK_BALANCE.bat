@echo off
cd /d "%~dp0"
echo Checking Sepolia testnet balance...
npx hardhat run scripts/checkBalance.js --network sepolia
pause
