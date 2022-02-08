const { EM } = process.env;

async function main() {
  let tokenIdToAddressToBalance = [{}, {}];

  const em = await ethers.getContractAt('Em', EM);

  const fromBlock = 14015956;

  const transferSingleFilter = em.filters.TransferSingle();
  const transferSingleEvents = await em.queryFilter(
    transferSingleFilter,
    fromBlock,
  );
  transferSingleEvents.forEach((event) => {
    const { from, to, id, value } = event.args;
    if (from !== ethers.constants.AddressZero) {
      if (!tokenIdToAddressToBalance[id.toNumber()][from]) {
        tokenIdToAddressToBalance[id.toNumber()][from] = 0;
      }
      tokenIdToAddressToBalance[id.toNumber()][from] -= value.toNumber();
    }
    if (to !== ethers.constants.AddressZero) {
      if (!tokenIdToAddressToBalance[id.toNumber()][to]) {
        tokenIdToAddressToBalance[id.toNumber()][to] = 0;
      }
      tokenIdToAddressToBalance[id.toNumber()][to] += value.toNumber();
    }
  });

  const transferBatchFilter = em.filters.TransferBatch();
  const transferBatchEvents = await em.queryFilter(
    transferBatchFilter,
    fromBlock,
  );
  transferBatchEvents.forEach((event) => {
    const { from, to, ids } = event.args;
    const values = event.args[4];
    if (from !== ethers.constants.AddressZero) {
      for (let i = 0; i < ids.length; ++i) {
        const id = ids[i];
        const value = values[i];
        if (!tokenIdToAddressToBalance[id.toNumber()][from]) {
          tokenIdToAddressToBalance[id.toNumber()][from] = 0;
        }
        tokenIdToAddressToBalance[id.toNumber()][from] -= value.toNumber();
      }
    }
    if (to !== ethers.constants.AddressZero) {
      for (let i = 0; i < ids.length; ++i) {
        const id = ids[i];
        const value = values[i];
        if (!tokenIdToAddressToBalance[id.toNumber()][to]) {
          tokenIdToAddressToBalance[id.toNumber()][to] = 0;
        }
        tokenIdToAddressToBalance[id.toNumber()][to] += value.toNumber();
      }
    }
  });

  tokenIdToAddressToBalance = tokenIdToAddressToBalance.map(
    (addressToBalance) =>
      Object.fromEntries(
        Object.entries(addressToBalance).filter(([_, balance]) => balance > 0),
      ),
  );

  console.log(tokenIdToAddressToBalance);

  for (let i = 0; i < tokenIdToAddressToBalance.length; ++i) {
    const id = i;
    let total = 0;
    Object.entries(tokenIdToAddressToBalance[id]).forEach(
      async ([address, balance]) => {
        total += balance;
        const b = await em.balanceOf(address, id);
        if (!b.eq(balance)) {
          throw new Error(
            `Balance of ${address} for token ${id} should be ${b}, not ${balance}`,
          );
        }
      },
    );
    const t = await em.totalSupply(id);
    if (!t.eq(total)) {
      throw new Error(
        `Total supply of token ${id} should be ${t}, not ${total}`,
      );
    }
    console.log(`Total supply of token ${id} is ${total}`);
    console.log(
      `# of owners of token ${id} is ${
        Object.keys(tokenIdToAddressToBalance[id]).length
      }`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
