const {
  TOKEN_URI,
  MERGE,
  BLUE_MERGE_ID = '26984',
  VAULT,
  ROYALTY_IN_BIPS = '1000',
  ROYALTY_RECEIVER,
} = process.env;

async function main() {
  const Em = await ethers.getContractFactory('Em');
  const em = await Em.deploy(
    TOKEN_URI,
    MERGE,
    BLUE_MERGE_ID,
    VAULT,
    ROYALTY_IN_BIPS,
    ROYALTY_RECEIVER,
  );

  await em.deployed();

  console.log('Em deployed to:', em.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
