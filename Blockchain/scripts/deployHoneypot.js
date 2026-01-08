async function main() {
  const Honeypot = await ethers.deployContract("HoneypotEWallet");
  await Honeypot.waitForDeployment();
  console.log("Honeypot deployed at:", await Honeypot.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
