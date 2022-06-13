// migrations/2_deploy.js
const { ethers } = require("hardhat");
const StreamScheduler = artifacts.require("StreamScheduler");
const ConstantFlowAgreement = artifacts.require("IConstantFlowAgreementV1");
const Superfluid = artifacts.require("ISuperfluid");
const web3Provider = new ethers.providers.Web3Provider(web3.currentProvider);
const { Framework } = require("@superfluid-finance/sdk-core");
const deployFramework = require("@superfluid-finance/ethereum-contracts/scripts/deploy-framework");
const deployTestToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-token");
const deploySuperToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-super-token");
const provider = web3Provider;

const errorHandler = (type, err) => {
    if (err) console.error("Deploy " + type + " Error: ", err);
};

async function deployFrameworkAndTokens() {
    try {
        const [Deployer] = (await ethers.getSigners()).map(x => x.address);
        console.log("Deployer: ", Deployer);
        await deployFramework(x => errorHandler("Framework", x), {
            web3,
            from: Deployer,
        });
        await deployTestToken(
            x => errorHandler("TestToken", x),
            [":", "fDAI"],
            {
                web3: web3,
                from: Deployer,
            },
        );
        await deploySuperToken(
            x => errorHandler("SuperToken", x),
            [":", "fDAI"],
            {
                web3: web3,
                from: Deployer,
            },
        );
    } catch (err) {
        console.error(err);
    }
}

module.exports = async function (deployer) {
    await deployFrameworkAndTokens();

    //initialize the superfluid framework...put custom and web3 only bc we are using hardhat locally
    const sf = await Framework.create({
        networkName: "custom",
        provider,
        dataMode: "WEB3_ONLY",
        resolverAddress: process.env.RESOLVER_ADDRESS, //this is how you get the resolver address
        protocolReleaseVersion: "test",
    });
    await deployer.deploy(StreamScheduler, sf.cfaV1, sf.host);
};
