// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title PaymentProcessor
 * @notice Smart contract for processing 0xMart payments with stablecoins
 * @dev Handles direct payments from customers to merchant with commission tracking
 */
contract PaymentProcessor is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

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

    event CommissionWithdrawn(
        address indexed recipient,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

    event MerchantAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event CommissionRateUpdated(uint256 oldRate, uint256 newRate);

    // State variables
    address public merchantAddress;
    uint256 public commissionRate; // In basis points (100 = 1%, 500 = 5%)

    // Mapping to track processed orders (prevent double-spending)
    mapping(string => bool) public processedOrders;

    // Mapping to track commission balances per token
    mapping(address => uint256) public commissionBalances;

    // Supported stablecoins
    mapping(address => bool) public supportedTokens;

    /**
     * @notice Constructor
     * @param _merchantAddress Address to receive payments
     * @param _commissionRate Commission rate in basis points (500 = 5%)
     */
    constructor(address _merchantAddress, uint256 _commissionRate) {
        require(_merchantAddress != address(0), "Invalid merchant address");
        require(_commissionRate <= 10000, "Commission rate too high"); // Max 100%

        merchantAddress = _merchantAddress;
        commissionRate = _commissionRate;
    }

    /**
     * @notice Add supported stablecoin
     * @param token Address of the stablecoin contract
     */
    function addSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");
        supportedTokens[token] = true;
    }

    /**
     * @notice Remove supported stablecoin
     * @param token Address of the stablecoin contract
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }

    /**
     * @notice Process payment for an order
     * @param orderId Unique order identifier from 0xMart backend
     * @param productId Product ID being purchased
     * @param token Stablecoin contract address (USDT, USDC, DAI, BUSD)
     * @param amount Total amount to pay (in token's smallest unit)
     */
    function payForProduct(
        string calldata orderId,
        string calldata productId,
        address token,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        // Validations
        require(!processedOrders[orderId], "Order already processed");
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be greater than 0");

        // Mark order as processed
        processedOrders[orderId] = true;

        // Calculate commission
        uint256 commission = (amount * commissionRate) / 10000;
        uint256 merchantAmount = amount - commission;

        // Transfer tokens from customer to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Transfer merchant's portion
        IERC20(token).safeTransfer(merchantAddress, merchantAmount);

        // Track commission
        commissionBalances[token] += commission;

        // Emit event
        emit PaymentProcessed(
            orderId,
            msg.sender,
            token,
            amount,
            commission,
            merchantAddress,
            block.timestamp
        );
    }

    /**
     * @notice Batch payment for multiple orders
     * @param orderIds Array of order IDs
     * @param productIds Array of product IDs
     * @param token Stablecoin contract address
     * @param amounts Array of amounts
     */
    function batchPayForProducts(
        string[] calldata orderIds,
        string[] calldata productIds,
        address token,
        uint256[] calldata amounts
    ) external nonReentrant whenNotPaused {
        require(orderIds.length == amounts.length, "Array length mismatch");
        require(orderIds.length == productIds.length, "Array length mismatch");
        require(supportedTokens[token], "Token not supported");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        // Transfer total tokens once
        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        // Process each order
        for (uint256 i = 0; i < orderIds.length; i++) {
            require(!processedOrders[orderIds[i]], "Order already processed");
            require(amounts[i] > 0, "Amount must be greater than 0");

            processedOrders[orderIds[i]] = true;

            uint256 commission = (amounts[i] * commissionRate) / 10000;
            uint256 merchantAmount = amounts[i] - commission;

            IERC20(token).safeTransfer(merchantAddress, merchantAmount);
            commissionBalances[token] += commission;

            emit PaymentProcessed(
                orderIds[i],
                msg.sender,
                token,
                amounts[i],
                commission,
                merchantAddress,
                block.timestamp
            );
        }
    }

    /**
     * @notice Withdraw accumulated commissions
     * @param token Token to withdraw
     * @param recipient Address to receive commissions
     */
    function withdrawCommission(address token, address recipient) external onlyOwner nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        uint256 balance = commissionBalances[token];
        require(balance > 0, "No commission to withdraw");

        commissionBalances[token] = 0;
        IERC20(token).safeTransfer(recipient, balance);

        emit CommissionWithdrawn(recipient, token, balance, block.timestamp);
    }

    /**
     * @notice Update merchant address
     * @param newMerchantAddress New merchant address
     */
    function updateMerchantAddress(address newMerchantAddress) external onlyOwner {
        require(newMerchantAddress != address(0), "Invalid address");
        address oldAddress = merchantAddress;
        merchantAddress = newMerchantAddress;
        emit MerchantAddressUpdated(oldAddress, newMerchantAddress);
    }

    /**
     * @notice Update commission rate
     * @param newRate New commission rate in basis points
     */
    function updateCommissionRate(uint256 newRate) external onlyOwner {
        require(newRate <= 10000, "Rate too high");
        uint256 oldRate = commissionRate;
        commissionRate = newRate;
        emit CommissionRateUpdated(oldRate, newRate);
    }

    /**
     * @notice Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Check if order has been processed
     * @param orderId Order ID to check
     * @return bool Whether order has been processed
     */
    function isOrderProcessed(string calldata orderId) external view returns (bool) {
        return processedOrders[orderId];
    }

    /**
     * @notice Get commission balance for a token
     * @param token Token address
     * @return uint256 Commission balance
     */
    function getCommissionBalance(address token) external view returns (uint256) {
        return commissionBalances[token];
    }
}
