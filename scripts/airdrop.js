const { EM } = process.env;

async function main() {
  const tokenIdToAddressToQty = [];
  const addressToTokenQtys = tokenIdToAddressToQty.reduce(
    (prev, curr, id) => ({
      ...prev,
      ...Object.entries(curr).reduce(
        (p, c) => ({
          ...p,
          ...(Array.isArray(prev[c[0]])
            ? {
                [c[0]]: [
                  ...prev[c[0]].slice(0, id),
                  c[1],
                  ...prev[c[0]].slice(id + 1),
                ],
              }
            : {
                [c[0]]: [
                  ...new Array(id).fill(0),
                  c[1],
                  ...new Array(tokenIdToAddressToQty.length - id - 1).fill(0),
                ],
              }),
        }),
        {},
      ),
    }),
    {},
  );
  console.log(addressToTokenQtys);

  const em = await ethers.getContractAt('Em', EM);
  const airdrops = Object.entries(addressToTokenQtys);
  for (const [address, qtys] of airdrops) {
    await (
      await em.mintBatch(
        address,
        new Array(qtys.length).fill(null).map((_, idx) => idx),
        qtys,
      )
    ).wait();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
