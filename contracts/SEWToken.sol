// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SEWToken is ERC20, Ownable {
    constructor(uint256 initialSupply, address initialOwner)
        ERC20("Secure E-Wallet Token", "SEW")
        Ownable(initialOwner)   // ✅ pass initialOwner instead of msg.sender
    {
        _mint(initialOwner, initialSupply * 10 ** decimals());
    }

    // Mint new tokens (only owner)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount * 10 ** decimals());
    }
}

