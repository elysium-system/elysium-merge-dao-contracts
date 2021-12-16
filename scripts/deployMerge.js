const { OMNIBUS, PAK } = process.env;

async function main() {
  const NiftyRegistry = await ethers.getContractFactory("NiftyRegistry");
  const niftyRegistry = await NiftyRegistry.deploy();

  await niftyRegistry.deployed();

  console.log("NiftyRegistry deployed to:", niftyRegistry.address);

  const MergeMetadata = await ethers.getContractFactory("MergeMetadata");
  const mergeMetadata = await MergeMetadata.deploy();

  await mergeMetadata.deployed();

  console.log("MergeMetadata deployed to:", mergeMetadata.address);

  const Merge = await ethers.getContractFactory("Merge");
  const merge = await Merge.deploy(
    niftyRegistry.address,
    OMNIBUS,
    mergeMetadata.address,
    PAK
  );

  await merge.deployed();

  console.log("Merge deployed to:", merge.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
