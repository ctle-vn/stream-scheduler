// scripts/deploy.js
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
        const [Deployer] = (await ethers.getSigners()).map(x => x.address);
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
        const url = "http://localhost:8545";
        const provider = new ethers.providers.JsonRpcProvider(url);
        //initialize the superfluid framework...put custom and web3 only bc we are using hardhat locally
        return await Framework.create({
            networkName: "local",
            dataMode: "WEB3_ONLY",
            provider,
            resolverAddress: process.env.RESOLVER_ADDRESS, //this is how you get the resolver address
            protocolReleaseVersion: "test",
        });
    } catch (err) {
        console.error(err);
    }
}

async function main() {
    const sf = await deployFrameworkAndTokens();

    const StreamScheduler = await ethers.getContractFactory("StreamScheduler");
    const streamScheduler = await StreamScheduler.deploy(
        sf.settings.config.cfaV1Address,
        sf.settings.config.hostAddress,
    );
    console.log("================ Deploying StreamScheduler =================");
    await streamScheduler.deployed();
    console.log(
        "================= StreamScheduler deployed to:",
        streamScheduler.address,
        "=================",
    );
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
