const { TOKEN_BASE_URI, VAULT, MERGE } = process.env;

async function main() {
  const EmToken = await ethers.getContractFactory("EmToken");
  const emToken = await EmToken.deploy(TOKEN_BASE_URI, VAULT, MERGE);

  await emToken.deployed();

  console.log("EmToken deployed to:", emToken.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
