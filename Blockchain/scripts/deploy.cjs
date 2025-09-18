const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // ✅ Deploy SEWToken (needs initialSupply + owner)
  const initialSupply = ethers.parseEther("1000"); // 1000 tokens
  const Token = await ethers.getContractFactory("SEWToken");
  const token = await Token.deploy(initialSupply, deployer.address);
  await token.waitForDeployment();
  console.log("SEWToken deployed at:", await token.getAddress());

  // ✅ Deploy Wallet (pass token address)
  const Wallet = await ethers.getContractFactory("Wallet");
  const wallet = await Wallet.deploy(await token.getAddress());
  await wallet.waitForDeployment();
  console.log("Wallet deployed at:", await wallet.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
