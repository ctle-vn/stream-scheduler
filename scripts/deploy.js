// scripts/deploy.js
const deployFramework = require("@superfluid-finance/ethereum-contracts/scripts/deploy-framework");
const deployTestToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-token");
const deploySuperToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-super-token");
const { Framework } = require("@superfluid-finance/sdk-core");
const StreamSchedulerJSON = require("../artifacts/contracts/StreamScheduler.sol/StreamScheduler.json");
const { Contract } = require("ethers");
const StreamSchedulerABI = StreamSchedulerJSON.abi;
require("dotenv").config();

const errorHandler = (type, err) => {
    if (err) console.error("Deploy " + type + " Error: ", err);
};

const url = "http://localhost:8545";
const provider = new ethers.providers.JsonRpcProvider(url);

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

        //initialize the superfluid framework...put custom and web3 only bc we are using hardhat locally
        return await Framework.create({
            networkName: "local",
            dataMode: "WEB3_ONLY",
            provider,
            resolverAddress: process.env.RESOLVER_ADDRESS, // can just call, no need to set anywhere
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

    console.log("================ START =================");
    const accounts = await ethers.provider.listAccounts();
    console.log(accounts);
    // console.log("Superfluid instance:", sf);

    const fDai = await sf.loadSuperToken("fDAIx");
    console.log("SuperToken instance:", fDai.address);

    console.log(
        "Length of stream order hashes: ",
        await streamScheduler.getStreamOrderHashesLength(),
    );

    const flowRate = "1000000000000";
    await streamScheduler.createStreamOrder(
        accounts[1],
        fDai.address,
        // Convert Date.now to seconds
        Math.floor(Date.now() / 1000) + 1000,
        flowRate,
        Math.floor(Date.now() / 1000) + 1000000,
        "0x",
    );
    await streamScheduler.createStreamOrder(
        accounts[1],
        fDai.address,
        // Convert Date.now to seconds
        Math.floor(Date.now() / 1000) + 1000,
        flowRate,
        Math.floor(Date.now() / 1000) + 10000230,
        "0x",
    );
    console.log(
        "Length of stream order hashes: ",
        await streamScheduler.getStreamOrderHashesLength(),
    );

    const contract = new Contract(
        streamScheduler.address,
        StreamSchedulerABI,
        provider,
    );
    // get past events emitted from contract
    const events = await contract.queryFilter(
        contract.filters.CreateStreamOrder(),
        0,
        "latest",
    );
    console.log(events);

    // const filter = {
    //     address: streamScheduler.address,
    //     fromBlock: 0,
    //     toBlock: 10000,
    //     topics: [contract.interface.events.CreateStreamOrder.topic],
    // };
    // const logs = await provider.getLogs(filter);

    // console.log("Superfluid instance:", sf.address);
    console.log("================ END =================");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
