@echo off
cd /d "%~dp0"
echo ========================================
echo 0xMart Smart Contract Deployment
echo Network: Sepolia Testnet
echo ========================================
echo.
npx hardhat run scripts/deploy.js --network sepolia
echo.
echo ========================================
echo Deployment Complete!
echo ========================================
pause
