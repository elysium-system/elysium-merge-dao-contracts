const {
  TOKEN_URI,
  MERGE,
  VAULT,
  ROYALTY_IN_BIPS = '1000',
  ROYALTY_RECEIVER,
} = process.env;

async function main() {
  const EmToken = await ethers.getContractFactory('EmToken');
  const emToken = await EmToken.deploy(
    TOKEN_URI,
    MERGE,
    VAULT,
    ROYALTY_IN_BIPS,
    ROYALTY_RECEIVER,
  );

  await emToken.deployed();

  console.log('EmToken deployed to:', emToken.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
