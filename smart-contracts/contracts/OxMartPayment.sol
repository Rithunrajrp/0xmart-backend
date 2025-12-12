// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract OxMartPayment is Ownable, ReentrancyGuard, Pausable {
    // Hot wallet that receives all payments
    address public hotWallet;

    // Platform fee (in basis points, 100 = 1%)
    uint256 public platformFeeBps = 0; // No fee for now, can be enabled later

    // Supported stablecoins (USDT, USDC, DAI, BUSD)
    mapping(address => bool) public supportedTokens;

    // Order tracking
    mapping(bytes32 => bool) public processedOrders;

    // Events
    event PaymentReceived(
        bytes32 indexed orderId,
        address indexed buyer,
        address indexed token,
        uint256 amount,
        uint256 platformFee,
        address apiKeyOwner,
        uint256 commission,
        string productId
    );

    event HotWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);

    constructor(address _hotWallet) Ownable(msg.sender) {
        require(_hotWallet != address(0), "Invalid hot wallet");
        hotWallet = _hotWallet;
    }

    /**
     * @notice Main payment function
     * @param orderId Unique order ID from backend
     * @param token Stablecoin address (USDT, USDC, etc.)
     * @param amount Amount to pay (in token decimals)
     * @param productId Product being purchased
     * @param apiKeyOwner Address to credit commission (if applicable)
     * @param commissionBps Commission in basis points (500 = 5%)
     */
    function processPayment(
        bytes32 orderId,
        address token,
        uint256 amount,
        string calldata productId,
        address apiKeyOwner,
        uint256 commissionBps
    ) external nonReentrant whenNotPaused {
        // Validate inputs
        require(!processedOrders[orderId], "Order already processed");
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Invalid amount");
        require(commissionBps <= 10000, "Invalid commission"); // Max 100%

        // Mark order as processed (prevent double-spending)
        processedOrders[orderId] = true;

        // Calculate fees
        uint256 platformFee = (amount * platformFeeBps) / 10000;
        uint256 commission = (amount * commissionBps) / 10000;
        uint256 netAmount = amount - platformFee;

        // Transfer tokens from buyer to hot wallet
        IERC20 stablecoin = IERC20(token);
        require(
            stablecoin.transferFrom(msg.sender, hotWallet, netAmount),
            "Payment transfer failed"
        );

        // Emit event for backend to process
        emit PaymentReceived(
            orderId,
            msg.sender,
            token,
            amount,
            platformFee,
            apiKeyOwner,
            commission,
            productId
        );
    }

    /**
     * @notice Batch payment for multiple products (shopping cart)
     */
    function processBatchPayment(
        bytes32 orderId,
        address token,
        uint256 totalAmount,
        string[] calldata productIds,
        address apiKeyOwner,
        uint256 commissionBps
    ) external nonReentrant whenNotPaused {
        require(!processedOrders[orderId], "Order already processed");
        require(supportedTokens[token], "Token not supported");
        require(totalAmount > 0, "Invalid amount");
        require(productIds.length > 0, "No products");

        processedOrders[orderId] = true;

        uint256 platformFee = (totalAmount * platformFeeBps) / 10000;
        uint256 commission = (totalAmount * commissionBps) / 10000;
        uint256 netAmount = totalAmount - platformFee;

        IERC20 stablecoin = IERC20(token);
        require(
            stablecoin.transferFrom(msg.sender, hotWallet, netAmount),
            "Payment transfer failed"
        );

        emit PaymentReceived(
            orderId,
            msg.sender,
            token,
            totalAmount,
            platformFee,
            apiKeyOwner,
            commission,
            "" // Empty for batch, productIds in separate param
        );
    }

    // Admin functions
    function updateHotWallet(address _newHotWallet) external onlyOwner {
        require(_newHotWallet != address(0), "Invalid address");
        address oldWallet = hotWallet;
        hotWallet = _newHotWallet;
        emit HotWalletUpdated(oldWallet, _newHotWallet);
    }

    function addSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token");
        supportedTokens[token] = true;
        emit TokenAdded(token);
    }

    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    function updatePlatformFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee too high"); // Max 10%
        platformFeeBps = newFeeBps;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Emergency withdrawal (only owner, only if contract has balance)
    function emergencyWithdraw(address token) external onlyOwner {
        IERC20 stablecoin = IERC20(token);
        uint256 balance = stablecoin.balanceOf(address(this));
        require(balance > 0, "No balance");
        require(stablecoin.transfer(owner(), balance), "Transfer failed");
    }
}
