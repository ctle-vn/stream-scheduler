// scripts/index.js
const deployTestToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-token");
const deploySuperToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-super-token");
const { Framework } = require("@superfluid-finance/sdk-core");

const errorHandler = (type, err) => {
    if (err) console.error("Deploy " + type + " Error: ", err);
};

async function main() {
    const address = "0x1291Be112d480055DaFd8a610b7d1e203891C274";
    const StreamScheduler = await ethers.getContractFactory("StreamScheduler");
    const streamy = await StreamScheduler.attach(address);
    const accounts = await ethers.provider.listAccounts();
    await deployTestToken(errorHandler, [":", "fDAI"], {
        web3,
        from: accounts[0],
    });
    await deploySuperToken(errorHandler, [":", "fDAI"], {
        web3,
        from: accounts[0],
    });

    sf = new SuperfluidSDK.Framework({
        web3,
        version: "test",
        tokens: ["fDAI"],
    });
    await sf.initialize();
    daix = sf.tokens.fDAIx;
    dai = await sf.contracts.TestToken.at(await sf.tokens.fDAI.address);

    // Retrieve accounts from the local node
    console.log(accounts);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
