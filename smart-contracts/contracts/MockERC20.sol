// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockERC20
 * @dev Mock ERC20 token for testing purposes ONLY
 * @notice ⚠️  WARNING: DO NOT DEPLOY TO MAINNET - FOR TESTING ONLY
 */
contract MockERC20 is ERC20, Ownable {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _decimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice CRITICAL-02 FIX: Only owner can mint tokens
     * @dev For testing purposes only
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice CRITICAL-02 FIX: Only burn own tokens
     * @dev Users can burn their own tokens
     */
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    /**
     * @notice Burn tokens from another address (requires allowance)
     * @dev Only burns if msg.sender has sufficient allowance
     */
    function burnFrom(address from, uint256 amount) public {
        uint256 currentAllowance = allowance(from, msg.sender);
        require(currentAllowance >= amount, "Insufficient allowance");
        _approve(from, msg.sender, currentAllowance - amount);
        _burn(from, amount);
    }
}
