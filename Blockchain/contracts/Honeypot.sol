// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Honeypot {

    event HoneypotTriggered(address attacker, string action);

    // Fake balance (not real)
    uint256 public fakeBalance = 1000 ether;

    // Fake withdraw function
    function withdrawFunds() public {
        emit HoneypotTriggered(msg.sender, "Tried to withdraw fake funds");
    }

    // Fake admin transfer function
    function transferAdminRights() public {
        emit HoneypotTriggered(msg.sender, "Tried to transfer fake admin rights");
    }

    // Fake internal recovery function
    function recoverWallet() public {
        emit HoneypotTriggered(msg.sender, "Tried to recover wallet");
    }
}
