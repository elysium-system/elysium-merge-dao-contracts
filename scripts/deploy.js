const { TOKEN_BASE_URI, VAULT, MERGE } = process.env;

async function main() {
  const EmToken = await ethers.getContractFactory('EmToken');
  const emToken = await EmToken.deploy(TOKEN_BASE_URI, MERGE, VAULT);

  await emToken.deployed();

  console.log('EmToken deployed to:', emToken.address);

  // await hre.run('verify:verify', {
  //   address: emToken.address,
  //   constructorArguments: [TOKEN_BASE_URI, MERGE, VAULT],
  // });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
