const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Solana Wallet Generation
console.log('=== Generating Solana Wallet ===');
exec('"C:\\Users\\RITHUN\\.cargo\\bin\\solana-keygen.exe" new --outfile solana-wallet.json --no-bip39-passphrase --force',
  { cwd: __dirname },
  (error, stdout, stderr) => {
    if (error) {
      console.error(`Solana Error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Solana stderr: ${stderr}`);
    }
    console.log(stdout);

    // Get Solana address
    exec('"C:\\Users\\RITHUN\\.cargo\\bin\\solana.exe" address -k solana-wallet.json',
      { cwd: __dirname },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Solana address Error: ${error.message}`);
          return;
        }
        console.log('\n=== SOLANA WALLET ADDRESS ===');
        console.log(stdout.trim());
        console.log('Wallet saved to: solana-wallet.json');
        console.log('=============================\n');
      }
    );
  }
);

// TON Wallet Generation (using tonutils or manual generation)
console.log('\n=== Generating TON Wallet ===');
console.log('Note: TON wallet will be generated using TON SDK');

// For TON, we'll need to check if ton CLI is available
exec('ton --version', (error, stdout, stderr) => {
  if (error) {
    console.log('TON CLI not found via "ton" command. Checking for toncli...');

    // Try toncli instead
    exec('toncli version', (error2, stdout2, stderr2) => {
      if (error2) {
        console.log('TON CLI not found. Please ensure TON CLI is installed.');
        console.log('Install from: https://github.com/ton-blockchain/ton');
      } else {
        console.log(stdout2);
        // Generate TON wallet using toncli
        exec('toncli wallet create -n testnet', { cwd: path.join(__dirname, 'ton') }, (err, out, errOut) => {
          if (err) {
            console.error(`TON wallet Error: ${err.message}`);
            return;
          }
          console.log(out);
        });
      }
    });
  } else {
    console.log(stdout);
  }
});

console.log('\n=== SUI WALLET (Already Generated) ===');
console.log('Address: 0x3d543ec09b0ce4bf5f9ea4431fd0f2aac16148ad11180d09c65c704028fc8cfb');
console.log('Alias: friendly-pearl');
console.log('Seed Phrase: adjust device flock author scare mosquito sponsor coyote typical mother tube explain');
console.log('Config: C:\\Users\\RITHUN\\.sui\\sui_config\\client.yaml');
console.log('=======================================\n');
