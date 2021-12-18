require('dotenv').config();

const { expect } = require('chai');
const { ethers } = require('hardhat');

const { TOKEN_BASE_URI } = process.env;

describe('EmToken', function () {
  let owner, vault, omnibus, pak, admin, minter;
  let emToken;

  beforeEach(async function () {
    [owner, vault, omnibus, pak, admin, minter] = await ethers.getSigners();

    const NiftyRegistry = await ethers.getContractFactory('NiftyRegistry');
    const ownerAddress = await owner.getAddress();
    const niftyRegistry = await NiftyRegistry.deploy(
      [ownerAddress],
      [ownerAddress],
    );

    await niftyRegistry.deployed();

    const MergeMetadata = await ethers.getContractFactory('MergeMetadata');
    const mergeMetadata = await MergeMetadata.deploy();

    await mergeMetadata.deployed();

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

    const EmToken = await ethers.getContractFactory('EmToken');
    const vaultAddress = await vault.getAddress();
    emToken = await EmToken.deploy(TOKEN_BASE_URI, vaultAddress, merge.address);

    await emToken.deployed();

    const adminAddress = await admin.getAddress();
    await (
      await emToken.grantRole(await emToken.ADMIN_ROLE(), adminAddress)
    ).wait();
  });

  describe('setVault', function () {
    it('Should set a new vault', async function () {
      const [, , , , newVault] = await ethers.getSigners();
      const newVaultAddress = await newVault.getAddress();
      await (await emToken.connect(admin).setVault(newVaultAddress)).wait();

      expect(await emToken.vault()).to.equal(newVaultAddress);
    });

    it('Should revert if the sender is not an admin', async function () {
      const [, , , , newVault] = await ethers.getSigners();
      const newVaultAddress = await newVault.getAddress();

      await expect(emToken.connect(minter).setVault(newVaultAddress)).to.be
        .reverted;
    });
  });

  describe('setUri', function () {
    const newUri = 'https://newelysiumdao.xyz/{id}.json';

    it('Should set a new URI', async function () {
      await (await emToken.connect(admin).setUri(newUri)).wait();

      expect(await emToken.uri(0)).to.equal(newUri);
    });

    it('Should revert if the sender is not an admin', async function () {
      await expect(emToken.connect(minter).setUri(newUri)).to.be.reverted;
    });
  });

  describe('toggle*', function () {
    it('Should toggle all switches', async function () {
      const isOgTokenClaimingEnabled = await emToken.isOgTokenClaimingEnabled();
      const isFounderTokenClaimingEnabled =
        await emToken.isFounderTokenClaimingEnabled();
      const isFounderTokenMintingEnabled =
        await emToken.isFounderTokenMintingEnabled();

      await (
        await emToken.connect(admin).toggleIsOgTokenClaimingEnabled()
      ).wait();
      await (
        await emToken.connect(admin).toggleIsFounderTokenClaimingEnabled()
      ).wait();
      await (
        await emToken.connect(admin).toggleIsFounderTokenMintingEnabled()
      ).wait();

      expect(await emToken.isOgTokenClaimingEnabled()).to.equal(
        !isOgTokenClaimingEnabled,
      );
      expect(await emToken.isFounderTokenClaimingEnabled()).to.equal(
        !isFounderTokenClaimingEnabled,
      );
      expect(await emToken.isFounderTokenMintingEnabled()).to.equal(
        !isFounderTokenMintingEnabled,
      );

      await (
        await emToken.connect(admin).toggleIsOgTokenClaimingEnabled()
      ).wait();
      await (
        await emToken.connect(admin).toggleIsFounderTokenClaimingEnabled()
      ).wait();
      await (
        await emToken.connect(admin).toggleIsFounderTokenMintingEnabled()
      ).wait();

      expect(await emToken.isOgTokenClaimingEnabled()).to.equal(
        isOgTokenClaimingEnabled,
      );
      expect(await emToken.isFounderTokenClaimingEnabled()).to.equal(
        isFounderTokenClaimingEnabled,
      );
      expect(await emToken.isFounderTokenMintingEnabled()).to.equal(
        isFounderTokenMintingEnabled,
      );
    });

    it('Should revert if the sender is not an admin', async function () {
      await expect(emToken.connect(minter).toggleIsOgTokenClaimingEnabled()).to
        .be.reverted;
      await expect(
        emToken.connect(minter).toggleIsFounderTokenClaimingEnabled(),
      ).to.be.reverted;
      await expect(emToken.connect(minter).toggleIsFounderTokenMintingEnabled())
        .to.be.reverted;
    });
  });
});
