/**
 * 0xMart Payment Widget
 *
 * This widget allows third-party developers to easily integrate crypto payments
 * WITHOUT writing any Web3 code. Simply include this script and call the widget.
 *
 * The widget handles:
 * - Wallet connection (MetaMask, WalletConnect, etc.)
 * - Token approval
 * - Smart contract interaction
 * - Transaction confirmation
 *
 * Usage:
 * <script src="https://api.0xmart.com/widget/0xmart-payment.js"></script>
 *
 * OxMartPayment.pay({
 *   apiKey: 'your_api_key',
 *   apiSecret: 'your_api_secret',
 *   orderId: 'order_123',
 *   onSuccess: (txHash) => console.log('Payment successful:', txHash),
 *   onError: (error) => console.error('Payment failed:', error)
 * });
 */

(function (window) {
  'use strict';

  // Check if ethers is available
  const loadEthers = async () => {
    if (window.ethers) return window.ethers;

    // Load ethers.js from CDN if not already loaded
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js';
      script.onload = () => resolve(window.ethers);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  class OxMartPaymentWidget {
    constructor() {
      this.apiBaseUrl = 'http://localhost:8000/api/v1'; // Change in production
      this.ethers = null;
    }

    /**
     * Initialize and execute payment
     */
    async pay(options) {
      const {
        apiKey,
        apiSecret,
        orderId,
        onSuccess,
        onError,
        onProgress,
      } = options;

      if (!apiKey || !apiSecret || !orderId) {
        const error = new Error('Missing required parameters: apiKey, apiSecret, orderId');
        if (onError) onError(error);
        return;
      }

      try {
        // Load ethers.js
        this.updateProgress(onProgress, 'Loading Web3 library...');
        this.ethers = await loadEthers();

        // Get order details from API
        this.updateProgress(onProgress, 'Fetching payment details...');
        const paymentDetails = await this.getPaymentDetails(apiKey, orderId);

        // Connect wallet
        this.updateProgress(onProgress, 'Connecting wallet...');
        const { provider, signer, userAddress } = await this.connectWallet();

        // Check network
        this.updateProgress(onProgress, 'Checking network...');
        await this.checkNetwork(provider, paymentDetails.payment.network);

        // Check and approve token
        this.updateProgress(onProgress, 'Checking token allowance...');
        await this.approveTokenIfNeeded(
          signer,
          paymentDetails.payment.tokenAddress,
          paymentDetails.payment.contractAddress,
          paymentDetails.payment.amountWei,
          paymentDetails.payment.tokenAbi,
          onProgress
        );

        // Execute payment
        this.updateProgress(onProgress, 'Processing payment...');
        const txHash = await this.executePayment(
          signer,
          paymentDetails.payment,
          onProgress
        );

        // Confirm payment with backend
        this.updateProgress(onProgress, 'Confirming transaction...');
        await this.confirmPayment(apiKey, orderId, txHash);

        this.updateProgress(onProgress, 'Payment successful!');
        if (onSuccess) onSuccess(txHash);
      } catch (error) {
        console.error('Payment error:', error);
        if (onError) onError(error);
      }
    }

    /**
     * Get payment details from 0xMart API
     */
    async getPaymentDetails(apiKey, orderId) {
      const response = await fetch(`${this.apiBaseUrl}/payment/status/${orderId}`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get payment details: ${response.statusText}`);
      }

      return await response.json();
    }

    /**
     * Connect to user's wallet
     */
    async connectWallet() {
      if (!window.ethereum) {
        throw new Error('No Web3 wallet detected. Please install MetaMask or another wallet.');
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });

      const provider = new this.ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const userAddress = await signer.getAddress();

      return { provider, signer, userAddress };
    }

    /**
     * Check if user is on correct network
     */
    async checkNetwork(provider, expectedNetwork) {
      const network = await provider.getNetwork();
      const networkMap = {
        'ETHEREUM': 1,
        'POLYGON': 137,
        'BSC': 56,
        'ARBITRUM': 42161,
        'OPTIMISM': 10,
        'AVALANCHE': 43114,
        'BASE': 8453,
      };

      const expectedChainId = networkMap[expectedNetwork];
      if (network.chainId !== expectedChainId) {
        // Try to switch network
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${expectedChainId.toString(16)}` }],
          });
        } catch (switchError) {
          throw new Error(`Please switch to ${expectedNetwork} network in your wallet`);
        }
      }
    }

    /**
     * Approve token spending if needed
     */
    async approveTokenIfNeeded(signer, tokenAddress, spenderAddress, amount, tokenAbi, onProgress) {
      const tokenContract = new this.ethers.Contract(tokenAddress, tokenAbi, signer);
      const userAddress = await signer.getAddress();

      // Check current allowance
      const allowance = await tokenContract.allowance(userAddress, spenderAddress);

      if (allowance.lt(amount)) {
        this.updateProgress(onProgress, 'Approving token spending...');

        // Request approval for exact amount (or use max for convenience)
        const approveTx = await tokenContract.approve(spenderAddress, amount);

        this.updateProgress(onProgress, 'Waiting for approval confirmation...');
        await approveTx.wait();

        this.updateProgress(onProgress, 'Token approved!');
      }
    }

    /**
     * Execute payment smart contract call
     */
    async executePayment(signer, paymentDetails, onProgress) {
      const contract = new this.ethers.Contract(
        paymentDetails.contractAddress,
        paymentDetails.abi,
        signer
      );

      // Call payForProduct function
      const tx = await contract.payForProduct(
        paymentDetails.params.orderId,
        paymentDetails.params.productId,
        paymentDetails.params.token,
        paymentDetails.params.amount,
        {
          gasLimit: paymentDetails.estimatedGas,
        }
      );

      this.updateProgress(onProgress, `Transaction sent: ${tx.hash}`);
      this.updateProgress(onProgress, 'Waiting for confirmation...');

      const receipt = await tx.wait();

      this.updateProgress(onProgress, `Confirmed in block ${receipt.blockNumber}`);

      return tx.hash;
    }

    /**
     * Confirm payment with backend
     */
    async confirmPayment(apiKey, orderId, txHash) {
      const response = await fetch(`${this.apiBaseUrl}/payment/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          orderId,
          txHash,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to confirm payment: ${response.statusText}`);
      }

      return await response.json();
    }

    /**
     * Update progress
     */
    updateProgress(callback, message) {
      console.log(`[0xMart] ${message}`);
      if (callback) callback(message);
    }
  }

  // Export to global scope
  window.OxMartPayment = new OxMartPaymentWidget();

})(window);
