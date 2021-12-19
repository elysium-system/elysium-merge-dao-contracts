require('dotenv').config();

const { expect } = require('chai');
const { ethers } = require('hardhat');

const { TOKEN_BASE_URI } = process.env;

describe('EmToken', function () {
  let owner, vault, omnibus, pak, admin;
  let accounts;
  let emToken;

  beforeEach(async function () {
    [owner, vault, omnibus, pak, admin, ...accounts] =
      await ethers.getSigners();

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
      const newVault = accounts[1];
      const newVaultAddress = await newVault.getAddress();

      await (await emToken.connect(admin).setVault(newVaultAddress)).wait();

      expect(await emToken.vault()).to.equal(newVaultAddress);
    });

    it('Should revert if the sender is not an admin', async function () {
      const newVault = accounts[1];
      const newVaultAddress = await newVault.getAddress();

      await expect(emToken.connect(accounts[0]).setVault(newVaultAddress)).to.be
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
      await expect(emToken.connect(accounts[0]).setUri(newUri)).to.be.reverted;
    });
  });

  describe('toggle*', function () {
    it('Should toggle all switches', async function () {
      const isOgTokenClaimingEnabled = await emToken.isOgTokenClaimingEnabled();
      await (await emToken.connect(admin).toggleOgTokenClaiming()).wait();
      expect(await emToken.isOgTokenClaimingEnabled()).to.equal(
        !isOgTokenClaimingEnabled,
      );
      await (await emToken.connect(admin).toggleOgTokenClaiming()).wait();
      expect(await emToken.isOgTokenClaimingEnabled()).to.equal(
        isOgTokenClaimingEnabled,
      );

      const isFounderTokenClaimingEnabled =
        await emToken.isFounderTokenClaimingEnabled();
      await (await emToken.connect(admin).toggleFounderTokenClaiming()).wait();
      expect(await emToken.isFounderTokenClaimingEnabled()).to.equal(
        !isFounderTokenClaimingEnabled,
      );
      await (await emToken.connect(admin).toggleFounderTokenClaiming()).wait();
      expect(await emToken.isFounderTokenClaimingEnabled()).to.equal(
        isFounderTokenClaimingEnabled,
      );

      const isFounderTokenMintingEnabled =
        await emToken.isFounderTokenMintingEnabled();
      await (await emToken.connect(admin).toggleFounderTokenMinting()).wait();
      expect(await emToken.isFounderTokenMintingEnabled()).to.equal(
        !isFounderTokenMintingEnabled,
      );
      await (await emToken.connect(admin).toggleFounderTokenMinting()).wait();
      expect(await emToken.isFounderTokenMintingEnabled()).to.equal(
        isFounderTokenMintingEnabled,
      );
    });

    it('Should revert if the sender is not an admin', async function () {
      await expect(emToken.connect(accounts[0]).toggleOgTokenClaiming()).to.be
        .reverted;
      await expect(emToken.connect(accounts[0]).toggleFounderTokenClaiming()).to
        .be.reverted;
      await expect(emToken.connect(accounts[0]).toggleFounderTokenMinting()).to
        .be.reverted;
    });
  });

  describe('setNumClaimable*', function () {
    it('Should set OG and Founder token whitelists', async function () {
      const addresses = await Promise.all(
        accounts.slice(0, 3).map((account) => account.getAddress()),
      );
      const numClaimableTokenss = [1, 2, 3];

      await (
        await emToken
          .connect(admin)
          .setNumClaimableOgTokensForAddresses(addresses, numClaimableTokenss)
      ).wait();
      for (let i = 0; i < addresses.length; ++i) {
        expect(
          await emToken.addressToNumClaimableOgTokens(addresses[i]),
        ).to.equal(numClaimableTokenss[i]);
      }

      await (
        await emToken
          .connect(admin)
          .setNumClaimableFounderTokensForAddresses(
            addresses,
            numClaimableTokenss,
          )
      ).wait();
      for (let i = 0; i < addresses.length; ++i) {
        expect(
          await emToken.addressToNumClaimableFounderTokens(addresses[i]),
        ).to.equal(numClaimableTokenss[i]);
      }
    });

    it('Should revert if the sender is not an admin', async function () {
      const addresses = await Promise.all(
        accounts.slice(0, 3).map((account) => account.getAddress()),
      );
      const numClaimableTokenss = [1, 2, 3];

      await expect(
        emToken
          .connect(accounts[0])
          .setNumClaimableOgTokensForAddresses(addresses, numClaimableTokenss),
      ).to.be.reverted;
      await expect(
        emToken
          .connect(accounts[0])
          .setNumClaimableFounderTokensForAddresses(
            addresses,
            numClaimableTokenss,
          ),
      ).to.be.reverted;
    });

    it('Should revert if lengths of addresses and quantities are not equal', async function () {
      const addresses = await Promise.all(
        accounts.slice(0, 3).map((account) => account.getAddress()),
      );
      const numClaimableTokenss = [1, 2];

      await expect(
        emToken
          .connect(admin)
          .setNumClaimableOgTokensForAddresses(addresses, numClaimableTokenss),
      ).to.be.revertedWith('Lengths are not equal');
      await expect(
        emToken
          .connect(admin)
          .setNumClaimableFounderTokensForAddresses(
            addresses,
            numClaimableTokenss,
          ),
      ).to.be.revertedWith('Lengths are not equal');
    });
  });

  describe('claim*', function () {
    it('Should claim OG and Founder tokens', async function () {
      const addresses = await Promise.all(
        accounts.slice(0, 3).map((account) => account.getAddress()),
      );
      const numClaimableTokenss = [1, 2, 3];

      const isOgTokenClaimingEnabled = await emToken.isOgTokenClaimingEnabled();
      if (!isOgTokenClaimingEnabled) {
        await (await emToken.connect(admin).toggleOgTokenClaiming()).wait();
      }
      await (
        await emToken
          .connect(admin)
          .setNumClaimableOgTokensForAddresses(addresses, numClaimableTokenss)
      ).wait();
      for (let i = 0; i < addresses.length; ++i) {
        await (
          await emToken.connect(accounts[i]).claimOgToken(addresses[i])
        ).wait();
      }
      const ogTokenId = await emToken.OG_TOKEN_ID();
      for (let i = 0; i < addresses.length; ++i) {
        expect(await emToken.balanceOf(addresses[i], ogTokenId)).to.equal(
          numClaimableTokenss[i],
        );
      }

      const isFounderTokenClaimingEnabled =
        await emToken.isFounderTokenClaimingEnabled();
      if (!isFounderTokenClaimingEnabled) {
        await (
          await emToken.connect(admin).toggleFounderTokenClaiming()
        ).wait();
      }
      await (
        await emToken
          .connect(admin)
          .setNumClaimableFounderTokensForAddresses(
            addresses,
            numClaimableTokenss,
          )
      ).wait();
      for (let i = 0; i < addresses.length; ++i) {
        await (
          await emToken.connect(accounts[i]).claimFounderToken(addresses[i])
        ).wait();
      }
      const founderTokenId = await emToken.FOUNDER_TOKEN_ID();
      for (let i = 0; i < addresses.length; ++i) {
        expect(await emToken.balanceOf(addresses[i], founderTokenId)).to.equal(
          numClaimableTokenss[i],
        );
      }
    });
  });

  describe('mintFounderToken', function () {
    it('Should mint founder tokens', async function () {
      const minter = accounts[0];
      const minterAddress = await accounts[0].getAddress();
      const isFounderTokenMintingEnabled =
        await emToken.isFounderTokenMintingEnabled();
      if (!isFounderTokenMintingEnabled) {
        await (await emToken.connect(admin).toggleFounderTokenMinting()).wait();
      }
      // await (
      //   await emToken.connect(minter).mintFounderToken(minterAddress, 0)
      // ).wait();
    });
  });
});
