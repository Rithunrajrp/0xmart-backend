// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PaymentProcessor
 * @notice Processes payments for 0xMart platform with automatic commission handling
 */
contract PaymentProcessor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Hot wallet that receives all payments
    address public hotWallet;

    // Platform commission rate (5% = 500 basis points)
    uint256 public constant COMMISSION_RATE = 500;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant EMERGENCY_WITHDRAWAL_DELAY = 48 hours;
    uint256 public constant MAX_BATCH_SIZE = 50;

    // HIGH-03 FIX: Use bytes32 instead of string for order IDs
    mapping(bytes32 => bool) public processedOrders;

    // Supported tokens
    mapping(address => bool) public supportedTokens;

    // Emergency withdrawal timelock
    uint256 public pendingWithdrawalTimestamp;
    address public pendingWithdrawalToken;

    // Events
    event PaymentProcessed(
        bytes32 indexed orderId,
        address indexed customer,
        address indexed token,
        uint256 amount,
        uint256 commission,
        address merchant,
        uint256 timestamp
    );

    event HotWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event EmergencyWithdrawalInitiated(address indexed token, uint256 executeAfter);
    event EmergencyWithdrawalExecuted(address indexed token, uint256 amount);
    event EmergencyWithdrawalCancelled(address indexed token);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);

    constructor(address _hotWallet) Ownable(msg.sender) {
        require(_hotWallet != address(0), "Invalid hot wallet");
        hotWallet = _hotWallet;
    }

    /**
     * @notice Process a single product payment
     * @param orderId Unique order identifier from backend (bytes32)
     * @param productId Product being purchased
     * @param token Stablecoin contract address (USDT, USDC, etc.)
     * @param amount Amount to pay in token decimals
     */
    function payForProduct(
        bytes32 orderId,
        string calldata productId,
        address token,
        uint256 amount
    ) external nonReentrant {
        require(!processedOrders[orderId], "Order already processed");
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Invalid amount");
        require(bytes(productId).length > 0 && bytes(productId).length <= 100, "Invalid product ID");

        // Calculate commission (5%)
        uint256 commission = (amount * COMMISSION_RATE) / BASIS_POINTS;
        uint256 merchantAmount = amount - commission;

        // CRITICAL FIX: Verify sufficient allowance before processing
        IERC20 stablecoin = IERC20(token);
        require(stablecoin.allowance(msg.sender, address(this)) >= amount, "Insufficient allowance");

        // CRITICAL FIX: Transfer BEFORE marking as processed
        stablecoin.safeTransferFrom(msg.sender, hotWallet, amount);

        // Mark order as processed AFTER successful transfer
        processedOrders[orderId] = true;

        // Emit event for backend verification
        emit PaymentProcessed(
            orderId,
            msg.sender,
            token,
            amount,
            commission,
            hotWallet, // Merchant (platform hot wallet)
            block.timestamp
        );
    }

    /**
     * @notice Process batch payment for multiple products
     * @param orderIds Array of order IDs (bytes32)
     * @param productIds Array of product IDs
     * @param token Stablecoin address
     * @param amounts Array of amounts for each product
     */
    function batchPayForProducts(
        bytes32[] calldata orderIds,
        string[] calldata productIds,
        address token,
        uint256[] calldata amounts
    ) external nonReentrant {
        require(
            orderIds.length == productIds.length &&
            productIds.length == amounts.length,
            "Array length mismatch"
        );

        // GAS-02 FIX: Cache array length
        uint256 length = amounts.length;
        require(length > 0 && length <= MAX_BATCH_SIZE, "Invalid batch size");
        require(supportedTokens[token], "Token not supported");

        uint256 totalAmount = 0;

        // First pass: Validate all orders and check for duplicates
        for (uint256 i = 0; i < length; ++i) {
            require(!processedOrders[orderIds[i]], "Order already processed");
            require(amounts[i] > 0, "Invalid amount");
            totalAmount += amounts[i];

            // CRITICAL FIX: Check for duplicate order IDs within the same batch
            for (uint256 j = i + 1; j < length; ++j) {
                require(orderIds[i] != orderIds[j], "Duplicate order in batch");
            }
        }

        require(totalAmount > 0, "Invalid total amount");

        // Calculate total commission
        uint256 totalCommission = (totalAmount * COMMISSION_RATE) / BASIS_POINTS;

        // CRITICAL FIX: Verify sufficient allowance before processing
        IERC20 stablecoin = IERC20(token);
        require(stablecoin.allowance(msg.sender, address(this)) >= totalAmount, "Insufficient allowance");

        // CRITICAL FIX: Transfer BEFORE marking orders as processed
        stablecoin.safeTransferFrom(msg.sender, hotWallet, totalAmount);

        // Process each order and emit events AFTER successful transfer
        for (uint256 i = 0; i < length; ++i) {
            processedOrders[orderIds[i]] = true;

            uint256 itemCommission = (amounts[i] * COMMISSION_RATE) / BASIS_POINTS;

            emit PaymentProcessed(
                orderIds[i],
                msg.sender,
                token,
                amounts[i],
                itemCommission,
                hotWallet,
                block.timestamp
            );
        }
    }

    /**
     * @notice Check if an order has been processed
     * @param orderId Order ID to check (bytes32)
     * @return bool True if order was processed
     */
    function isOrderProcessed(bytes32 orderId) external view returns (bool) {
        return processedOrders[orderId];
    }

    /**
     * @notice Update hot wallet address (owner only)
     * @param _newHotWallet New hot wallet address
     */
    function updateHotWallet(address _newHotWallet) external onlyOwner {
        require(_newHotWallet != address(0), "Invalid address");
        require(_newHotWallet != hotWallet, "Same as current");
        address oldWallet = hotWallet;
        hotWallet = _newHotWallet;
        emit HotWalletUpdated(oldWallet, _newHotWallet);
    }

    /**
     * @notice Add supported token (owner only)
     * @param token Token address to add
     */
    function addSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token");
        supportedTokens[token] = true;
        emit TokenAdded(token);
    }

    /**
     * @notice Remove supported token (owner only)
     * @param token Token address to remove
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    // HIGH-01 FIX: Two-step emergency withdrawal with timelock
    function initiateEmergencyWithdrawal(address token) external onlyOwner {
        require(token != address(0), "Invalid token");
        IERC20 stablecoin = IERC20(token);
        require(stablecoin.balanceOf(address(this)) > 0, "No balance");

        pendingWithdrawalToken = token;
        pendingWithdrawalTimestamp = block.timestamp + EMERGENCY_WITHDRAWAL_DELAY;

        emit EmergencyWithdrawalInitiated(token, pendingWithdrawalTimestamp);
    }

    function executeEmergencyWithdrawal() external onlyOwner {
        require(pendingWithdrawalToken != address(0), "No pending withdrawal");
        require(block.timestamp >= pendingWithdrawalTimestamp, "Timelock active");

        address token = pendingWithdrawalToken;
        IERC20 stablecoin = IERC20(token);
        uint256 balance = stablecoin.balanceOf(address(this));
        require(balance > 0, "No balance");

        // Clear pending withdrawal
        pendingWithdrawalToken = address(0);
        pendingWithdrawalTimestamp = 0;

        // Use SafeERC20 for withdrawal
        stablecoin.safeTransfer(owner(), balance);

        emit EmergencyWithdrawalExecuted(token, balance);
    }

    function cancelEmergencyWithdrawal() external onlyOwner {
        require(pendingWithdrawalToken != address(0), "No pending withdrawal");

        address token = pendingWithdrawalToken;
        pendingWithdrawalToken = address(0);
        pendingWithdrawalTimestamp = 0;

        emit EmergencyWithdrawalCancelled(token);
    }
}
