// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract OxMartPayment is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Constants for magic numbers
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;
    uint256 public constant MAX_PLATFORM_FEE_BPS = 1000; // 10%
    uint256 public constant MAX_COMMISSION_BPS = 10000; // 100%
    uint256 public constant MAX_PAUSE_DURATION = 30 days;
    uint256 public constant EMERGENCY_WITHDRAWAL_DELAY = 48 hours;
    uint256 public constant MAX_BATCH_SIZE = 50; // Maximum products in batch payment

    // Hot wallet that receives all payments
    address public hotWallet;

    // Platform fee (in basis points, 100 = 1%)
    uint256 public platformFeeBps = 0; // No fee for now, can be enabled later

    // Pause tracking
    uint256 public pausedAt;

    // Emergency withdrawal timelock
    uint256 public pendingWithdrawalTimestamp;
    address public pendingWithdrawalToken;

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
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event EmergencyWithdrawalInitiated(address indexed token, uint256 executeAfter);
    event EmergencyWithdrawalExecuted(address indexed token, uint256 amount);
    event EmergencyWithdrawalCancelled(address indexed token);

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
    ) external nonReentrant whenNotPausedOrExpired {
        // Validate inputs
        require(!processedOrders[orderId], "Order already processed");
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Invalid amount");
        require(bytes(productId).length > 0 && bytes(productId).length <= 100, "Invalid product ID");
        require(commissionBps <= MAX_COMMISSION_BPS, "Invalid commission");

        // Calculate fees using constants
        uint256 platformFee = (amount * platformFeeBps) / BASIS_POINTS_DIVISOR;
        uint256 commission = (amount * commissionBps) / BASIS_POINTS_DIVISOR;
        uint256 netAmount = amount - platformFee;

        // CRITICAL FIX: Verify sufficient allowance before processing
        IERC20 stablecoin = IERC20(token);
        require(stablecoin.allowance(msg.sender, address(this)) >= netAmount, "Insufficient allowance");

        // CRITICAL FIX: Only mark as processed AFTER successful transfer
        // Use SafeERC20 for token transfers
        stablecoin.safeTransferFrom(msg.sender, hotWallet, netAmount);

        // Mark order as processed AFTER successful transfer (prevent double-spending)
        processedOrders[orderId] = true;

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
    ) external nonReentrant whenNotPausedOrExpired {
        require(!processedOrders[orderId], "Order already processed");
        require(supportedTokens[token], "Token not supported");
        require(totalAmount > 0, "Invalid amount");
        require(productIds.length > 0 && productIds.length <= MAX_BATCH_SIZE, "Invalid batch size");
        require(commissionBps <= MAX_COMMISSION_BPS, "Invalid commission");

        uint256 platformFee = (totalAmount * platformFeeBps) / BASIS_POINTS_DIVISOR;
        uint256 commission = (totalAmount * commissionBps) / BASIS_POINTS_DIVISOR;
        uint256 netAmount = totalAmount - platformFee;

        // CRITICAL FIX: Verify sufficient allowance before processing
        IERC20 stablecoin = IERC20(token);
        require(stablecoin.allowance(msg.sender, address(this)) >= netAmount, "Insufficient allowance");

        // CRITICAL FIX: Only mark as processed AFTER successful transfer
        // Use SafeERC20 for token transfers
        stablecoin.safeTransferFrom(msg.sender, hotWallet, netAmount);

        // Mark order as processed AFTER successful transfer
        processedOrders[orderId] = true;

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
        require(_newHotWallet != hotWallet, "Same as current");
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
        require(newFeeBps <= MAX_PLATFORM_FEE_BPS, "Fee too high");
        uint256 oldFee = platformFeeBps;
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(oldFee, newFeeBps);
    }

    // HIGH-02 FIX: Add maximum pause duration with automatic expiry
    function pause() external onlyOwner {
        _pause();
        pausedAt = block.timestamp;
    }

    function unpause() external onlyOwner {
        _unpause();
        pausedAt = 0;
    }

    // Custom modifier that adds auto-unpause functionality
    modifier whenNotPausedOrExpired() {
        require(!paused() || block.timestamp >= pausedAt + MAX_PAUSE_DURATION, "Contract paused");
        _;
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
