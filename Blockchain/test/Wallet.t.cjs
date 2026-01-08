const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Secure E-Wallet", function () {
  let Token, Wallet;
  let token, wallet;
  let owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Initial supply = 1,000,000 tokens
    const initialSupply = ethers.parseUnits("1000000", 18);

    // Deploy SEWToken
    Token = await ethers.getContractFactory("SEWToken");
    token = await Token.deploy(initialSupply, owner.address);
    await token.waitForDeployment();


    Wallet = await ethers.getContractFactory("Wallet");
    wallet = await Wallet.deploy(await token.getAddress());
    await wallet.waitForDeployment();

    await token.transfer(user1.address, ethers.parseUnits("1000", 18));
  });

  it("should deploy correctly with token address", async function () {
    expect(await wallet.token()).to.equal(await token.getAddress());
  });

  it("should allow deposit of tokens", async function () {
    await token.connect(user1).approve(await wallet.getAddress(), ethers.parseUnits("200", 18));
    await wallet.connect(user1).deposit(ethers.parseUnits("200", 18));

    const balance = await wallet.balances(user1.address);
    expect(balance).to.equal(ethers.parseUnits("200", 18));
  });

  it("should allow withdrawal of tokens", async function () {
    
    await token.connect(user1).approve(await wallet.getAddress(), ethers.parseUnits("300", 18));
    await wallet.connect(user1).deposit(ethers.parseUnits("300", 18));

   
    await wallet.connect(user1).withdraw(ethers.parseUnits("100", 18));

    const remainingBalance = await wallet.balances(user1.address);
    expect(remainingBalance).to.equal(ethers.parseUnits("200", 18));

    const userBalance = await token.balanceOf(user1.address);
    expect(userBalance).to.equal(ethers.parseUnits("800", 18));
  });

  it("should not allow withdrawal more than balance", async function () {
    await token.connect(user1).approve(await wallet.getAddress(), ethers.parseUnits("50", 18));
    await wallet.connect(user1).deposit(ethers.parseUnits("50", 18));

    await expect(
      wallet.connect(user1).withdraw(ethers.parseUnits("100", 18))
    ).to.be.revertedWith("Insufficient balance");
  });
});

