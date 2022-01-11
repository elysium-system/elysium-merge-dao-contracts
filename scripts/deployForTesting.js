const {
  TOKEN_URI,
  BLUE_MERGE_ID = '26984',
  ROYALTY_IN_BIPS = '1000',
} = process.env;

async function main() {
  const [owner, omnibus, pak, vault, royaltyReceiver, admin, ...accounts] =
    await ethers.getSigners();

  const NiftyRegistry = await ethers.getContractFactory('NiftyRegistry');
  const ownerAddress = await owner.getAddress();
  const niftyRegistry = await NiftyRegistry.deploy(
    [ownerAddress],
    [ownerAddress],
  );

  await niftyRegistry.deployed();

  console.log('NiftyRegistry deployed to:', niftyRegistry.address);

  const MergeMetadata = await ethers.getContractFactory('MergeMetadata');
  const mergeMetadata = await MergeMetadata.deploy();

  await mergeMetadata.deployed();

  console.log('MergeMetadata deployed to:', mergeMetadata.address);

  const Merge = await ethers.getContractFactory(
    'contracts/merge/Merge.sol:Merge',
  );
  const omnibusAddress = await omnibus.getAddress();
  const pakAddress = await pak.getAddress();
  const merge = await Merge.deploy(
    niftyRegistry.address,
    omnibusAddress,
    mergeMetadata.address,
    pakAddress,
  );

  await merge.deployed();

  console.log('Merge deployed to:', merge.address);

  const Em = await ethers.getContractFactory('Em');
  const vaultAddress = await vault.getAddress();
  const royaltyReceiverAddress = await royaltyReceiver.getAddress();
  const em = await Em.deploy(
    TOKEN_URI,
    merge.address,
    BLUE_MERGE_ID,
    vaultAddress,
    ROYALTY_IN_BIPS,
    royaltyReceiverAddress,
  );

  await em.deployed();

  console.log('Em deployed to:', em.address);

  const adminAddress = await admin.getAddress();
  await (await em.grantRole(await em.ADMIN_ROLE(), adminAddress)).wait();

  const CLASS_MULTIPLIER = 100 * 1000 * 1000;
  const BLUE_CLASS = 3;
  const WHITE_CLASS = 1;
  const blueMasses = [1];
  const whiteMasses = [1, 2, 4, 8, 16];
  await (
    await merge.mint([
      ...blueMasses.map((m) => BLUE_CLASS * CLASS_MULTIPLIER + m),
      ...whiteMasses.map((m) => WHITE_CLASS * CLASS_MULTIPLIER + m),
    ])
  ).wait();
  const vaultMergeId = 1;
  await (
    await merge
      .connect(omnibus)
      ['safeTransferFrom(address,address,uint256)'](
        omnibusAddress,
        vaultAddress,
        vaultMergeId,
      )
  ).wait();
  const numMinters = whiteMasses.length;
  for (let i = 0; i < numMinters; ++i) {
    const minter = accounts[i];
    const minterAddress = await minter.getAddress();
    const mergeId = 2 + i;
    await (
      await merge
        .connect(omnibus)
        ['safeTransferFrom(address,address,uint256)'](
          omnibusAddress,
          minterAddress,
          mergeId,
        )
    ).wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
