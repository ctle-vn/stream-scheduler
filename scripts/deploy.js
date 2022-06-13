// scripts/deploy.js
const ethers = require("hardhat");
const deployFramework = require("@superfluid-finance/ethereum-contracts/scripts/deploy-framework");
const deployTestToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-token");
const deploySuperToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-super-token");
const { Framework } = require("@superfluid-finance/sdk-core");
const StreamSchedulerJSON = require("../artifacts/contracts/StreamScheduler.sol/StreamScheduler.json");
const StreamSchedulerABI = StreamSchedulerJSON.abi;
const web3Provider = new ethers.providers.Web3Provider(web3.currentProvider);
const provider = web3Provider;
require("dotenv").config();

const errorHandler = (type, err) => {
    if (err) console.error("Deploy " + type + " Error: ", err);
};

async function deployFrameworkAndTokens() {
    try {
        const [Deployer] = (await hre.ethers.getSigners()).map(x => x.address);
        await deployFramework(x => errorHandler("Framework", x), {
            web3: web3,
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

async function main() {
    await deployFrameworkAndTokens();

    //initialize the superfluid framework...put custom and web3 only bc we are using hardhat locally
    const sf = await Framework.create({
        networkName: "custom",
        provider,
        dataMode: "WEB3_ONLY",
        resolverAddress: process.env.RESOLVER_ADDRESS, //this is how you get the resolver address
        protocolReleaseVersion: "test",
    });
    // We get the contract to deploy
    // const StreamScheduler = await ethers.getContractFactory("StreamScheduler");
    const StreamScheduler = await hre.ethers.getContractFactory(
        "StreamScheduler",
    );
    const streamScheduler = await StreamScheduler.deploy(sf.cfaV1, sf.host);
    console.log("Deploying StreamScheduler...");
    await streamScheduler.deployed();
    console.log("StreamScheduler deployed to:", box.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
