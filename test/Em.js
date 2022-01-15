require('dotenv').config();

const { expect } = require('chai');
const { ethers } = require('hardhat');

const { TOKEN_URI, ROYALTY_IN_BIPS = '1000', ROYALTY_RECEIVER } = process.env;

describe('Em', function () {
  const CLASS_MULTIPLIER = 100 * 1000 * 1000;
  const BLUE_CLASS = 3;
  const WHITE_CLASS = 1;
  const whiteMasses = new Array(13).fill(null).map((_, idx) => 2 ** idx);
  const blueMasses = [1, whiteMasses.reduce((prev, curr) => prev + curr, 0)];

  let owner, vault, omnibus, pak, admin;
  let accounts;
  let em;
  let merge;

  before(async function () {
    [owner, vault, omnibus, pak, admin, ...accounts] =
      await ethers.getSigners();
  });

  beforeEach(async function () {
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
    merge = await Merge.deploy(
      niftyRegistry.address,
      omnibusAddress,
      mergeMetadata.address,
      pakAddress,
    );

    await merge.deployed();

    await (
      await merge.mint([
        ...blueMasses.map((m) => BLUE_CLASS * CLASS_MULTIPLIER + m),
        ...whiteMasses.map((m) => WHITE_CLASS * CLASS_MULTIPLIER + m),
      ])
    ).wait();
    const vaultAddress = await vault.getAddress();
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
      const mergeId = blueMasses.length + 1 + i;
      await (
        await merge
          .connect(omnibus)
          ['safeTransferFrom(address,address,uint256)'](
            omnibusAddress,
            minterAddress,
            mergeId,
          )
      ).wait();

      expect(await merge.tokenOf(minterAddress)).to.equal(mergeId);
    }

    const Em = await ethers.getContractFactory('Em');
    em = await Em.deploy(
      TOKEN_URI,
      merge.address,
      vaultMergeId,
      vaultAddress,
      ROYALTY_IN_BIPS,
      ROYALTY_RECEIVER,
    );

    await em.deployed();

    const adminAddress = await admin.getAddress();
    await (await em.grantRole(await em.ADMIN_ROLE(), adminAddress)).wait();
  });

  describe('#setUri', function () {
    const newUri = 'https://newelysiumdao.xyz/{id}.json';

    it('Should set a new URI', async function () {
      await (await em.connect(admin).setUri(newUri)).wait();

      expect(await em.uri(0)).to.equal(newUri);
    });

    it('Should revert if the sender is not an admin', async function () {
      await expect(em.connect(accounts[0]).setUri(newUri)).to.be.reverted;
    });
  });

  describe('#setVault', function () {
    it('Should set a new vault', async function () {
      const newVault = accounts[1];
      const newVaultAddress = await newVault.getAddress();

      await (await em.connect(admin).setVault(newVaultAddress)).wait();

      expect(await em.vault()).to.equal(newVaultAddress);
    });

    it('Should revert if the sender is not an admin', async function () {
      const newVault = accounts[1];
      const newVaultAddress = await newVault.getAddress();

      await expect(em.connect(accounts[0]).setVault(newVaultAddress)).to.be
        .reverted;
    });
  });

  describe('#setRoyaltyInBips', function () {
    const newRoyaltyInBips = 2000;

    it('Should set a new royalty in bips', async function () {
      await (await em.connect(admin).setRoyaltyInBips(newRoyaltyInBips)).wait();

      expect(await em.royaltyInBips()).to.equal(newRoyaltyInBips);
    });

    it('Should revert if the sender is not an admin', async function () {
      await expect(em.connect(accounts[0]).setRoyaltyInBips(newRoyaltyInBips))
        .to.be.reverted;
    });

    it('Should revert if the royalty is over 100%', async function () {
      await expect(
        em.connect(admin).setRoyaltyInBips(10001),
      ).to.be.revertedWith('More than 100%');
    });
  });

  describe('#setRoyaltyReceiver', function () {
    it('Should set a new royalty receiver', async function () {
      const newRoyaltyReceiver = accounts[1];
      const newRoyaltyReceiverAddress = await newRoyaltyReceiver.getAddress();

      await (
        await em.connect(admin).setRoyaltyReceiver(newRoyaltyReceiverAddress)
      ).wait();

      expect(await em.royaltyReceiver()).to.equal(newRoyaltyReceiverAddress);
    });

    it('Should revert if the sender is not an admin', async function () {
      const newRoyaltyReceiver = accounts[1];
      const newRoyaltyReceiverAddress = await newRoyaltyReceiver.getAddress();

      await expect(
        em.connect(accounts[0]).setRoyaltyReceiver(newRoyaltyReceiverAddress),
      ).to.be.reverted;
    });
  });

  describe('#toggle*', function () {
    it('Should toggle all switches', async function () {
      const isOgTokenClaimingEnabled = await em.isOgTokenClaimingEnabled();
      await (await em.connect(admin).toggleOgTokenClaiming()).wait();
      expect(await em.isOgTokenClaimingEnabled()).to.equal(
        !isOgTokenClaimingEnabled,
      );
      await (await em.connect(admin).toggleOgTokenClaiming()).wait();
      expect(await em.isOgTokenClaimingEnabled()).to.equal(
        isOgTokenClaimingEnabled,
      );

      const isFounderTokenClaimingEnabled =
        await em.isFounderTokenClaimingEnabled();
      await (await em.connect(admin).toggleFounderTokenClaiming()).wait();
      expect(await em.isFounderTokenClaimingEnabled()).to.equal(
        !isFounderTokenClaimingEnabled,
      );
      await (await em.connect(admin).toggleFounderTokenClaiming()).wait();
      expect(await em.isFounderTokenClaimingEnabled()).to.equal(
        isFounderTokenClaimingEnabled,
      );

      const isFounderTokenMintingEnabled =
        await em.isFounderTokenMintingEnabled();
      await (await em.connect(admin).toggleFounderTokenMinting()).wait();
      expect(await em.isFounderTokenMintingEnabled()).to.equal(
        !isFounderTokenMintingEnabled,
      );
      await (await em.connect(admin).toggleFounderTokenMinting()).wait();
      expect(await em.isFounderTokenMintingEnabled()).to.equal(
        isFounderTokenMintingEnabled,
      );
    });

    it('Should revert if the sender is not an admin', async function () {
      await expect(em.connect(accounts[0]).toggleOgTokenClaiming()).to.be
        .reverted;
      await expect(em.connect(accounts[0]).toggleFounderTokenClaiming()).to.be
        .reverted;
      await expect(em.connect(accounts[0]).toggleFounderTokenMinting()).to.be
        .reverted;
    });
  });

  describe('#setNumClaimable*', function () {
    it('Should set OG and Founder token whitelists', async function () {
      const addresses = await Promise.all(
        accounts.slice(0, 3).map((account) => account.getAddress()),
      );
      const numClaimableTokenss = [1, 2, 3];

      await (
        await em
          .connect(admin)
          .setNumClaimableOgTokensForAddresses(addresses, numClaimableTokenss)
      ).wait();
      for (let i = 0; i < addresses.length; ++i) {
        expect(await em.addressToNumClaimableOgTokens(addresses[i])).to.equal(
          numClaimableTokenss[i],
        );
      }

      await (
        await em
          .connect(admin)
          .setNumClaimableFounderTokensForAddresses(
            addresses,
            numClaimableTokenss,
          )
      ).wait();
      for (let i = 0; i < addresses.length; ++i) {
        expect(
          await em.addressToNumClaimableFounderTokens(addresses[i]),
        ).to.equal(numClaimableTokenss[i]);
      }
    });

    it('Should revert if the sender is not an admin', async function () {
      const addresses = await Promise.all(
        accounts.slice(0, 3).map((account) => account.getAddress()),
      );
      const numClaimableTokenss = [1, 2, 3];

      await expect(
        em
          .connect(accounts[0])
          .setNumClaimableOgTokensForAddresses(addresses, numClaimableTokenss),
      ).to.be.reverted;
      await expect(
        em
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
        em
          .connect(admin)
          .setNumClaimableOgTokensForAddresses(addresses, numClaimableTokenss),
      ).to.be.revertedWith('Lengths are not equal');
      await expect(
        em
          .connect(admin)
          .setNumClaimableFounderTokensForAddresses(
            addresses,
            numClaimableTokenss,
          ),
      ).to.be.revertedWith('Lengths are not equal');
    });
  });

  describe('#claim*', function () {
    it('Should claim OG and Founder tokens', async function () {
      const addresses = await Promise.all(
        accounts.slice(0, 3).map((account) => account.getAddress()),
      );
      const numClaimableTokenss = [1, 2, 3];

      const isOgTokenClaimingEnabled = await em.isOgTokenClaimingEnabled();
      if (!isOgTokenClaimingEnabled) {
        await (await em.connect(admin).toggleOgTokenClaiming()).wait();
      }
      await (
        await em
          .connect(admin)
          .setNumClaimableOgTokensForAddresses(addresses, numClaimableTokenss)
      ).wait();
      for (let i = 0; i < addresses.length; ++i) {
        await expect(await em.connect(accounts[i]).claimOgToken(addresses[i]))
          .to.emit(em, 'OgTokenClaimed')
          .withArgs(addresses[i], numClaimableTokenss[i]);
      }
      const ogTokenId = await em.OG_TOKEN_ID();
      for (let i = 0; i < addresses.length; ++i) {
        expect(await em.balanceOf(addresses[i], ogTokenId)).to.equal(
          numClaimableTokenss[i],
        );
      }

      const isFounderTokenClaimingEnabled =
        await em.isFounderTokenClaimingEnabled();
      if (!isFounderTokenClaimingEnabled) {
        await (await em.connect(admin).toggleFounderTokenClaiming()).wait();
      }
      await (
        await em
          .connect(admin)
          .setNumClaimableFounderTokensForAddresses(
            addresses,
            numClaimableTokenss,
          )
      ).wait();
      for (let i = 0; i < addresses.length; ++i) {
        await expect(
          await em.connect(accounts[i]).claimFounderToken(addresses[i]),
        )
          .to.emit(em, 'FounderTokenClaimed')
          .withArgs(addresses[i], numClaimableTokenss[i]);
      }
      const founderTokenId = await em.FOUNDER_TOKEN_ID();
      for (let i = 0; i < addresses.length; ++i) {
        expect(await em.balanceOf(addresses[i], founderTokenId)).to.equal(
          numClaimableTokenss[i],
        );
      }
    });

    it('Should revert if claiming is not enabled', async function () {
      const addresses = await Promise.all(
        accounts.slice(0, 3).map((account) => account.getAddress()),
      );
      const numClaimableTokenss = [1, 2, 3];

      const isOgTokenClaimingEnabled = await em.isOgTokenClaimingEnabled();
      if (isOgTokenClaimingEnabled) {
        await (await em.connect(admin).toggleOgTokenClaiming()).wait();
      }
      await (
        await em
          .connect(admin)
          .setNumClaimableOgTokensForAddresses(addresses, numClaimableTokenss)
      ).wait();
      for (let i = 0; i < addresses.length; ++i) {
        await expect(
          em.connect(accounts[i]).claimOgToken(addresses[i]),
        ).to.be.revertedWith('Not enabled');
      }

      const isFounderTokenClaimingEnabled =
        await em.isFounderTokenClaimingEnabled();
      if (isFounderTokenClaimingEnabled) {
        await (
          await em.connect(admin).tfoundergleFounderTokenClaiming()
        ).wait();
      }
      await (
        await em
          .connect(admin)
          .setNumClaimableFounderTokensForAddresses(
            addresses,
            numClaimableTokenss,
          )
      ).wait();
      for (let i = 0; i < addresses.length; ++i) {
        await expect(
          em.connect(accounts[i]).claimFounderToken(addresses[i]),
        ).to.be.revertedWith('Not enabled');
      }
    });

    it('Should revert if not enough quota', async function () {
      const claimer = accounts[0];
      const claimerAddress = await claimer.getAddress();

      const isOgTokenClaimingEnabled = await em.isOgTokenClaimingEnabled();
      if (!isOgTokenClaimingEnabled) {
        await (await em.connect(admin).toggleOgTokenClaiming()).wait();
      }
      await expect(
        em.connect(claimer).claimOgToken(claimerAddress),
      ).to.be.revertedWith('Not enough quota');

      const isFounderTokenClaimingEnabled =
        await em.isFounderTokenClaimingEnabled();
      if (!isFounderTokenClaimingEnabled) {
        await (await em.connect(admin).toggleFounderTokenClaiming()).wait();
      }
      await expect(
        em.connect(claimer).claimFounderToken(claimerAddress),
      ).to.be.revertedWith('Not enough quota');
    });
  });

  describe('#mintFounderToken', function () {
    it('Should mint founder tokens', async function () {
      const isFounderTokenMintingEnabled =
        await em.isFounderTokenMintingEnabled();
      if (!isFounderTokenMintingEnabled) {
        await (await em.connect(admin).toggleFounderTokenMinting()).wait();
      }

      const founderTokenId = await em.FOUNDER_TOKEN_ID();
      const vaultAddress = await vault.getAddress();
      const numMinters = whiteMasses.length;
      for (let i = 0; i < numMinters; ++i) {
        const vaultMergeId = await merge.tokenOf(vaultAddress);
        const vaultMass = await merge.massOf(vaultMergeId);

        const minter = accounts[i];
        const minterAddress = await minter.getAddress();
        const minterMergeId = await merge.tokenOf(minterAddress);
        await (
          await merge.connect(minter).approve(em.address, minterMergeId)
        ).wait();
        const mass = whiteMasses[i];
        await expect(
          await em
            .connect(minter)
            .mintFounderToken(minterAddress, minterMergeId),
        )
          .to.emit(em, 'FounderTokenMinted')
          .withArgs(minterAddress, mass, minterMergeId);

        expect(await em.balanceOf(minterAddress, founderTokenId)).to.equal(
          mass,
        );
        expect(await merge.massOf(vaultMergeId)).to.equal(vaultMass.add(mass));
      }
    });

    it('Should revert if minting is not enabled', async function () {
      const isFounderTokenMintingEnabled =
        await em.isFounderTokenMintingEnabled();
      if (isFounderTokenMintingEnabled) {
        await (await em.connect(admin).toggleFounderTokenMinting()).wait();
      }

      const minter = accounts[0];
      const minterAddress = await minter.getAddress();
      const minterMergeId = await merge.tokenOf(minterAddress);
      await (
        await merge.connect(minter).approve(em.address, minterMergeId)
      ).wait();
      await expect(
        em.connect(minter).mintFounderToken(minterAddress, minterMergeId),
      ).to.be.revertedWith('Not enabled');
    });

    it('Should revert if the mass is too big to merge', async function () {
      const isFounderTokenMintingEnabled =
        await em.isFounderTokenMintingEnabled();
      if (!isFounderTokenMintingEnabled) {
        await (await em.connect(admin).toggleFounderTokenMinting()).wait();
      }

      const minter = accounts[1];
      const minterAddress = await minter.getAddress();
      const minterMergeId = await merge.tokenOf(minterAddress);
      const minterMass = await merge.massOf(minterMergeId);
      const vaultAddress = await vault.getAddress();
      const vaultMergeId = await merge.tokenOf(vaultAddress);
      const vaultMass = await merge.massOf(vaultMergeId);
      expect(minterMass).to.gt(vaultMass);
      await (
        await merge.connect(minter).approve(em.address, minterMergeId)
      ).wait();
      await expect(
        em.connect(minter).mintFounderToken(minterAddress, minterMergeId),
      ).to.be.revertedWith('Too big');
    });
  });

  describe('#mintFounderToken1', function () {
    it('Should mint founder tokens', async function () {
      const isFounderTokenMintingEnabled1 =
        await em.isFounderTokenMintingEnabled1();
      if (!isFounderTokenMintingEnabled1) {
        await (await em.connect(admin).toggleFounderTokenMinting1()).wait();
      }

      const vaultAddress = await vault.getAddress();
      const vaultMergeId = await merge.tokenOf(vaultAddress);
      const adminAddress = await admin.getAddress();
      await (
        await merge
          .connect(vault)
          ['safeTransferFrom(address,address,uint256)'](
            vaultAddress,
            adminAddress,
            vaultMergeId,
          )
      ).wait();

      await (
        await merge.connect(vault).setApprovalForAll(em.address, true)
      ).wait();

      const founderTokenId = await em.FOUNDER_TOKEN_ID();
      const numMinters = whiteMasses.length;
      const n = 2;
      const numGroups = Math.floor(numMinters / n);

      for (let g = 0; g < numGroups; ++g) {
        const idxEnd = numMinters - g * n;
        const idxBegin = numMinters - (g + 1) * n;

        const targetMass = whiteMasses
          .slice(idxBegin, idxEnd)
          .reduce((prev, curr) => prev + curr, 0);
        await (await em.connect(admin).setTargetMass(targetMass)).wait();

        for (let i = idxEnd - 1; i >= idxBegin; --i) {
          const minter = accounts[i];
          const minterAddress = await minter.getAddress();
          const minterMergeId = await merge.tokenOf(minterAddress);
          const minterMergeMass = await merge.massOf(minterMergeId);
          expect(minterMergeMass).to.equal(whiteMasses[i]);
          await (
            await merge.connect(minter).approve(em.address, minterMergeId)
          ).wait();
          await expect(
            await em
              .connect(minter)
              .mintFounderToken1(minterAddress, minterMergeId),
          )
            .to.emit(em, 'FounderTokenMinted1')
            .withArgs(minterAddress, minterMergeMass, minterMergeId);

          expect(await em.balanceOf(minterAddress, founderTokenId)).to.equal(
            minterMergeMass,
          );
        }
        expect(await merge.balanceOf(vaultAddress)).to.equal(0);
        expect(await merge.balanceOf(em.subVaults(g))).to.equal(1);
        expect(await merge.massOf(merge.tokenOf(em.subVaults(g)))).to.equal(
          targetMass,
        );

        if (g === numGroups - 1) {
          const targetMass = whiteMasses
            .slice(0, idxBegin)
            .reduce((prev, curr) => prev + curr, 1);
          await (await em.connect(admin).setTargetMass(targetMass)).wait();

          for (let i = idxBegin - 1; i >= 0; --i) {
            const minter = accounts[i];
            const minterAddress = await minter.getAddress();
            const minterMergeId = await merge.tokenOf(minterAddress);
            const minterMergeMass = await merge.massOf(minterMergeId);
            expect(minterMergeMass).to.equal(whiteMasses[i]);
            await (
              await merge.connect(minter).approve(em.address, minterMergeId)
            ).wait();
            await expect(
              await em
                .connect(minter)
                .mintFounderToken1(minterAddress, minterMergeId),
            )
              .to.emit(em, 'FounderTokenMinted1')
              .withArgs(minterAddress, minterMergeMass, minterMergeId);

            expect(await em.balanceOf(minterAddress, founderTokenId)).to.equal(
              minterMergeMass,
            );
          }
          expect(await merge.balanceOf(vaultAddress)).to.equal(1);
        }
      }

      await (
        await merge
          .connect(admin)
          ['safeTransferFrom(address,address,uint256)'](
            adminAddress,
            vaultAddress,
            vaultMergeId,
          )
      ).wait();
    });

    it('Should revert if minting is not enabled', async function () {
      const isFounderTokenMintingEnabled1 =
        await em.isFounderTokenMintingEnabled1();
      if (isFounderTokenMintingEnabled1) {
        await (await em.connect(admin).toggleFounderTokenMinting1()).wait();
      }

      const minter = accounts[0];
      const minterAddress = await minter.getAddress();
      const minterMergeId = await merge.tokenOf(minterAddress);
      await (
        await merge.connect(minter).approve(em.address, minterMergeId)
      ).wait();
      await expect(
        em.connect(minter).mintFounderToken1(minterAddress, minterMergeId),
      ).to.be.revertedWith('Not enabled');
    });

    it('Should revert if the mass is too big to merge', async function () {
      const isFounderTokenMintingEnabled1 =
        await em.isFounderTokenMintingEnabled1();
      if (!isFounderTokenMintingEnabled1) {
        await (await em.connect(admin).toggleFounderTokenMinting1()).wait();
      }

      const minter = accounts[1];
      const minterAddress = await minter.getAddress();
      const minterMergeId = await merge.tokenOf(minterAddress);

      const targetMass = blueMasses[0] + whiteMasses[1] - 1;
      await (await em.connect(admin).setTargetMass(targetMass)).wait();

      await (
        await merge.connect(minter).approve(em.address, minterMergeId)
      ).wait();
      await expect(
        em.connect(minter).mintFounderToken1(minterAddress, minterMergeId),
      ).to.be.revertedWith('Too big');
    });
  });

  describe('#mintFounderToken2', function () {
    it('Should mint founder tokens', async function () {
      const isFounderTokenMintingEnabled2 =
        await em.isFounderTokenMintingEnabled2();
      if (!isFounderTokenMintingEnabled2) {
        await (await em.connect(admin).toggleFounderTokenMinting2()).wait();
      }

      await (
        await em
          .connect(admin)
          .setPricePerToken(ethers.utils.parseEther('0.07'))
      ).wait();
      await (
        await em.connect(admin).setFundGoal(ethers.utils.parseEther('0.21'))
      ).wait();

      const pricePerToken = await em.pricePerToken();

      const minter = accounts[0];
      const minterAddress = await minter.getAddress();
      const qty = 3;
      const value = pricePerToken.mul(qty);
      await expect(
        await em
          .connect(minter)
          .mintFounderToken2(minterAddress, qty, { value }),
      )
        .to.emit(em, 'FounderTokenMinted2')
        .withArgs(minterAddress, qty, value)
        .to.changeEtherBalance(em, value);
    });

    it('Should revert if minting is not enabled', async function () {
      const isFounderTokenMintingEnabled2 =
        await em.isFounderTokenMintingEnabled2();
      if (isFounderTokenMintingEnabled2) {
        await (await em.connect(admin).toggleFounderTokenMinting2()).wait();
      }

      const pricePerToken = await em.pricePerToken();

      const minter = accounts[0];
      const minterAddress = await minter.getAddress();
      const qty = 3;
      await expect(
        em.connect(minter).mintFounderToken2(minterAddress, qty, {
          value: pricePerToken.mul(qty),
        }),
      ).to.be.revertedWith('Not enabled');
    });

    it('Should revert if wrong value', async function () {
      const isFounderTokenMintingEnabled2 =
        await em.isFounderTokenMintingEnabled2();
      if (!isFounderTokenMintingEnabled2) {
        await (await em.connect(admin).toggleFounderTokenMinting2()).wait();
      }

      await (
        await em
          .connect(admin)
          .setPricePerToken(ethers.utils.parseEther('0.07'))
      ).wait();

      const pricePerToken = await em.pricePerToken();

      const minter = accounts[0];
      const minterAddress = await minter.getAddress();
      const qty = 3;
      await expect(
        em.connect(minter).mintFounderToken2(minterAddress, qty, {
          value: pricePerToken.mul(qty - 1),
        }),
      ).to.be.revertedWith('Wrong value');
      await expect(
        em.connect(minter).mintFounderToken2(minterAddress, qty, {
          value: pricePerToken.mul(qty + 1),
        }),
      ).to.be.revertedWith('Wrong value');
    });

    it('Should revert if fund goal is not set', async function () {
      const isFounderTokenMintingEnabled2 =
        await em.isFounderTokenMintingEnabled2();
      if (!isFounderTokenMintingEnabled2) {
        await (await em.connect(admin).toggleFounderTokenMinting2()).wait();
      }

      await (
        await em
          .connect(admin)
          .setPricePerToken(ethers.utils.parseEther('0.07'))
      ).wait();

      const pricePerToken = await em.pricePerToken();

      const minter = accounts[0];
      const minterAddress = await minter.getAddress();
      const qty = 3;
      await expect(
        em.connect(minter).mintFounderToken2(minterAddress, qty, {
          value: pricePerToken.mul(qty),
        }),
      ).to.be.revertedWith('Fund goal not set');
    });
  });

  describe.only('#withdrawAllMerges', function () {
    it('Should withdraw all merges', async function () {
      const isFounderTokenMintingEnabled1 =
        await em.isFounderTokenMintingEnabled1();
      if (!isFounderTokenMintingEnabled1) {
        await (await em.connect(admin).toggleFounderTokenMinting1()).wait();
      }

      const vaultAddress = await vault.getAddress();
      const vaultMergeId = await merge.tokenOf(vaultAddress);
      const adminAddress = await admin.getAddress();
      await (
        await merge
          .connect(vault)
          ['safeTransferFrom(address,address,uint256)'](
            vaultAddress,
            adminAddress,
            vaultMergeId,
          )
      ).wait();

      await (
        await merge.connect(vault).setApprovalForAll(em.address, true)
      ).wait();

      const founderTokenId = await em.FOUNDER_TOKEN_ID();
      const numMinters = whiteMasses.length;
      const n = 2;
      const numGroups = Math.floor(numMinters / n);

      for (let g = 0; g < 2; ++g) {
        const idxEnd = numMinters - g * n;
        const idxBegin = numMinters - (g + 1) * n;

        const targetMass = whiteMasses
          .slice(idxBegin, idxEnd)
          .reduce((prev, curr) => prev + curr, 0);
        await (await em.connect(admin).setTargetMass(targetMass)).wait();

        for (let i = idxEnd - 1; i >= idxBegin; --i) {
          const minter = accounts[i];
          const minterAddress = await minter.getAddress();
          const minterMergeId = await merge.tokenOf(minterAddress);
          const minterMergeMass = await merge.massOf(minterMergeId);
          expect(minterMergeMass).to.equal(whiteMasses[i]);
          await (
            await merge.connect(minter).approve(em.address, minterMergeId)
          ).wait();
          await expect(
            await em
              .connect(minter)
              .mintFounderToken1(minterAddress, minterMergeId),
          )
            .to.emit(em, 'FounderTokenMinted1')
            .withArgs(minterAddress, minterMergeMass, minterMergeId);

          expect(await em.balanceOf(minterAddress, founderTokenId)).to.equal(
            minterMergeMass,
          );
        }
        expect(await merge.balanceOf(vaultAddress)).to.equal(0);
        expect(await merge.balanceOf(em.subVaults(g))).to.equal(1);
        expect(await merge.massOf(merge.tokenOf(em.subVaults(g)))).to.equal(
          targetMass,
        );
      }

      const ownerAddress = await owner.getAddress();
      await (await em.connect(admin).withdrawAllMerges(ownerAddress)).wait();

      for (let g = 2; g < numGroups; ++g) {
        const idxEnd = numMinters - g * n;
        const idxBegin = numMinters - (g + 1) * n;

        const targetMass = whiteMasses
          .slice(idxBegin, idxEnd)
          .reduce((prev, curr) => prev + curr, 0);
        await (await em.connect(admin).setTargetMass(targetMass)).wait();

        for (let i = idxEnd - 1; i >= idxBegin; --i) {
          const minter = accounts[i];
          const minterAddress = await minter.getAddress();
          const minterMergeId = await merge.tokenOf(minterAddress);
          const minterMergeMass = await merge.massOf(minterMergeId);
          expect(minterMergeMass).to.equal(whiteMasses[i]);
          await (
            await merge.connect(minter).approve(em.address, minterMergeId)
          ).wait();
          await expect(
            await em
              .connect(minter)
              .mintFounderToken1(minterAddress, minterMergeId),
          )
            .to.emit(em, 'FounderTokenMinted1')
            .withArgs(minterAddress, minterMergeMass, minterMergeId);

          expect(await em.balanceOf(minterAddress, founderTokenId)).to.equal(
            minterMergeMass,
          );
        }
        expect(await merge.balanceOf(vaultAddress)).to.equal(0);

        if (g === numGroups - 1) {
          const targetMass = whiteMasses
            .slice(0, idxBegin)
            .reduce((prev, curr) => prev + curr, 1);
          await (await em.connect(admin).setTargetMass(targetMass)).wait();

          for (let i = idxBegin - 1; i >= 0; --i) {
            const minter = accounts[i];
            const minterAddress = await minter.getAddress();
            const minterMergeId = await merge.tokenOf(minterAddress);
            const minterMergeMass = await merge.massOf(minterMergeId);
            expect(minterMergeMass).to.equal(whiteMasses[i]);
            await (
              await merge.connect(minter).approve(em.address, minterMergeId)
            ).wait();
            await expect(
              await em
                .connect(minter)
                .mintFounderToken1(minterAddress, minterMergeId),
            )
              .to.emit(em, 'FounderTokenMinted1')
              .withArgs(minterAddress, minterMergeMass, minterMergeId);

            expect(await em.balanceOf(minterAddress, founderTokenId)).to.equal(
              minterMergeMass,
            );
          }
          expect(await merge.balanceOf(vaultAddress)).to.equal(1);
        }
      }

      const omnibusAddress = await omnibus.getAddress();
      await (
        await merge
          .connect(omnibus)
          ['safeTransferFrom(address,address,uint256)'](
            omnibusAddress,
            vaultAddress,
            2,
          )
      ).wait();

      const ownerMergeId = merge.tokenOf(ownerAddress);
      await (
        await merge
          .connect(owner)
          ['safeTransferFrom(address,address,uint256)'](
            ownerAddress,
            vaultAddress,
            ownerMergeId,
          )
      ).wait();

      await (await em.connect(admin).withdrawAllMerges(vaultAddress)).wait();

      expect(
        await merge.decodeClass(merge.getValueOf(merge.tokenOf(vaultAddress))),
      ).to.equal(3);
      expect(await merge.massOf(merge.tokenOf(vaultAddress))).to.equal(
        whiteMasses.reduce((prev, curr) => prev + curr, blueMasses[1]),
      );
    });

    it('Should revert if the sender is not an admin', async function () {
      const isFounderTokenMintingEnabled1 =
        await em.isFounderTokenMintingEnabled1();
      if (!isFounderTokenMintingEnabled1) {
        await (await em.connect(admin).toggleFounderTokenMinting1()).wait();
      }

      const vaultAddress = await vault.getAddress();
      const vaultMergeId = await merge.tokenOf(vaultAddress);
      const adminAddress = await admin.getAddress();
      await (
        await merge
          .connect(vault)
          ['safeTransferFrom(address,address,uint256)'](
            vaultAddress,
            adminAddress,
            vaultMergeId,
          )
      ).wait();

      await (
        await merge.connect(vault).setApprovalForAll(em.address, true)
      ).wait();

      const founderTokenId = await em.FOUNDER_TOKEN_ID();
      const numMinters = whiteMasses.length;
      const n = 2;
      const numGroups = Math.floor(numMinters / n);

      for (let g = 0; g < numGroups; ++g) {
        const idxEnd = numMinters - g * n;
        const idxBegin = numMinters - (g + 1) * n;

        const targetMass = whiteMasses
          .slice(idxBegin, idxEnd)
          .reduce((prev, curr) => prev + curr, 0);
        await (await em.connect(admin).setTargetMass(targetMass)).wait();

        for (let i = idxEnd - 1; i >= idxBegin; --i) {
          const minter = accounts[i];
          const minterAddress = await minter.getAddress();
          const minterMergeId = await merge.tokenOf(minterAddress);
          const minterMergeMass = await merge.massOf(minterMergeId);
          expect(minterMergeMass).to.equal(whiteMasses[i]);
          await (
            await merge.connect(minter).approve(em.address, minterMergeId)
          ).wait();
          await expect(
            await em
              .connect(minter)
              .mintFounderToken1(minterAddress, minterMergeId),
          )
            .to.emit(em, 'FounderTokenMinted1')
            .withArgs(minterAddress, minterMergeMass, minterMergeId);

          expect(await em.balanceOf(minterAddress, founderTokenId)).to.equal(
            minterMergeMass,
          );
        }
        expect(await merge.balanceOf(vaultAddress)).to.equal(0);
        expect(await merge.balanceOf(em.subVaults(g))).to.equal(1);
        expect(await merge.massOf(merge.tokenOf(em.subVaults(g)))).to.equal(
          targetMass,
        );

        if (g === numGroups - 1) {
          const targetMass = whiteMasses
            .slice(0, idxBegin)
            .reduce((prev, curr) => prev + curr, 1);
          await (await em.connect(admin).setTargetMass(targetMass)).wait();

          for (let i = idxBegin - 1; i >= 0; --i) {
            const minter = accounts[i];
            const minterAddress = await minter.getAddress();
            const minterMergeId = await merge.tokenOf(minterAddress);
            const minterMergeMass = await merge.massOf(minterMergeId);
            expect(minterMergeMass).to.equal(whiteMasses[i]);
            await (
              await merge.connect(minter).approve(em.address, minterMergeId)
            ).wait();
            await expect(
              await em
                .connect(minter)
                .mintFounderToken1(minterAddress, minterMergeId),
            )
              .to.emit(em, 'FounderTokenMinted1')
              .withArgs(minterAddress, minterMergeMass, minterMergeId);

            expect(await em.balanceOf(minterAddress, founderTokenId)).to.equal(
              minterMergeMass,
            );
          }
          expect(await merge.balanceOf(vaultAddress)).to.equal(1);
        }
      }

      await (
        await merge
          .connect(admin)
          ['safeTransferFrom(address,address,uint256)'](
            adminAddress,
            vaultAddress,
            vaultMergeId,
          )
      ).wait();

      await expect(em.connect(accounts[0]).withdrawAllMerges(vaultAddress)).to
        .be.reverted;
    });
  });
});
