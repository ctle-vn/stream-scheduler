const ethers = require("hardhat");
const deployFramework = require("@superfluid-finance/ethereum-contracts/scripts/deploy-framework");
const deployTestToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-token");
const deploySuperToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-super-token");

const errorHandler = (type, err) => {
    if (err) console.error("Deploy " + type + " Error: ", err);
};

async function deployFrameworkAndTokens() {
    try {
        const [Deployer] = (await ethers.getSigners()).map(x => x.address);
        await deployFramework(x => errorHandler("Framework", x), {
            web3: global.web3,
            from: Deployer,
        });
        await deployTestToken(
            x => errorHandler("TestToken", x),
            [":", "fDAI"],
            {
                web3: global.web3,
                from: Deployer,
            },
        );
        await deploySuperToken(
            x => errorHandler("SuperToken", x),
            [":", "fDAI"],
            {
                web3: global.web3,
                from: Deployer,
            },
        );
    } catch (err) {
        console.error(err);
    }
}
