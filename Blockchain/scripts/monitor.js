const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
const contractAddress = "0xb80772a65d9EDEF45aF9a08B96C078542F1ce7C7";

const abi = [
    "event FakeWithdrawalAttempt(address indexed attacker, uint256 amount)"
];

const contract = new ethers.Contract(contractAddress, abi, provider);

console.log("Listening for attacks...");
contract.on("FakeWithdrawalAttempt", (attacker, amount) => {
    console.log("⚠️ Attack detected!");
    console.log("Attacker:", attacker);
    console.log("Amount:", ethers.formatEther(amount));
});
