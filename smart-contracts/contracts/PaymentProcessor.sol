// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PaymentProcessor
 * @notice Processes payments for 0xMart platform with automatic commission handling
 */
contract PaymentProcessor is Ownable, ReentrancyGuard {
    // Hot wallet that receives all payments
    address public hotWallet;

    // Platform commission rate (5% = 500 basis points)
    uint256 public constant COMMISSION_RATE = 500;
    uint256 public constant BASIS_POINTS = 10000;

    // Order tracking to prevent double-spending
    mapping(string => bool) public processedOrders;

    // Events
    event PaymentProcessed(
        string indexed orderId,
        address indexed customer,
        address indexed token,
        uint256 amount,
        uint256 commission,
        address merchant,
        uint256 timestamp
    );

    event HotWalletUpdated(address indexed oldWallet, address indexed newWallet);

    constructor(address _hotWallet) Ownable(msg.sender) {
        require(_hotWallet != address(0), "Invalid hot wallet");
        hotWallet = _hotWallet;
    }

    /**
     * @notice Process a single product payment
     * @param orderId Unique order identifier from backend
     * @param productId Product being purchased
     * @param token Stablecoin contract address (USDT, USDC, etc.)
     * @param amount Amount to pay in token decimals
     */
    function payForProduct(
        string calldata orderId,
        string calldata productId,
        address token,
        uint256 amount
    ) external nonReentrant {
        require(!processedOrders[orderId], "Order already processed");
        require(amount > 0, "Invalid amount");

        // Mark order as processed
        processedOrders[orderId] = true;

        // Calculate commission (5%)
        uint256 commission = (amount * COMMISSION_RATE) / BASIS_POINTS;
        uint256 merchantAmount = amount - commission;

        // Transfer tokens from customer to hot wallet
        IERC20 stablecoin = IERC20(token);
        require(
            stablecoin.transferFrom(msg.sender, hotWallet, amount),
            "Transfer failed"
        );

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
     * @param orderIds Array of order IDs
     * @param productIds Array of product IDs
     * @param token Stablecoin address
     * @param amounts Array of amounts for each product
     */
    function batchPayForProducts(
        string[] calldata orderIds,
        string[] calldata productIds,
        address token,
        uint256[] calldata amounts
    ) external nonReentrant {
        require(
            orderIds.length == productIds.length &&
            productIds.length == amounts.length,
            "Array length mismatch"
        );

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        require(totalAmount > 0, "Invalid total amount");

        // Calculate total commission
        uint256 totalCommission = (totalAmount * COMMISSION_RATE) / BASIS_POINTS;

        // Transfer total amount
        IERC20 stablecoin = IERC20(token);
        require(
            stablecoin.transferFrom(msg.sender, hotWallet, totalAmount),
            "Batch transfer failed"
        );

        // Process each order and emit events
        for (uint256 i = 0; i < orderIds.length; i++) {
            require(!processedOrders[orderIds[i]], "Order already processed");
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
     * @param orderId Order ID to check
     * @return bool True if order was processed
     */
    function isOrderProcessed(string calldata orderId) external view returns (bool) {
        return processedOrders[orderId];
    }

    /**
     * @notice Update hot wallet address (owner only)
     * @param _newHotWallet New hot wallet address
     */
    function updateHotWallet(address _newHotWallet) external onlyOwner {
        require(_newHotWallet != address(0), "Invalid address");
        address oldWallet = hotWallet;
        hotWallet = _newHotWallet;
        emit HotWalletUpdated(oldWallet, _newHotWallet);
    }

    /**
     * @notice Emergency token withdrawal (owner only)
     * @param token Token address to withdraw
     */
    function emergencyWithdraw(address token) external onlyOwner {
        IERC20 stablecoin = IERC20(token);
        uint256 balance = stablecoin.balanceOf(address(this));
        require(balance > 0, "No balance");
        require(stablecoin.transfer(owner(), balance), "Withdrawal failed");
    }
}
