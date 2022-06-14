// scripts/deploy.js
const deployFramework = require("@superfluid-finance/ethereum-contracts/scripts/deploy-framework");
const deployTestToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-token");
const deploySuperToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-super-token");
const { Framework } = require("@superfluid-finance/sdk-core");
const StreamSchedulerJSON = require("../artifacts/contracts/StreamScheduler.sol/StreamScheduler.json");
const StreamSchedulerABI = StreamSchedulerJSON.abi;
const { Contract } = require("ethers");
require("dotenv").config();

const errorHandler = (type, err) => {
    if (err) console.error("Deploy " + type + " Error: ", err);
};

const url = "http://localhost:8545";
const provider = new ethers.providers.JsonRpcProvider(url);
const flowRate = "1000000000000";

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
    console.log(
        "================ Superfluid CFA Addy: =================",
        sf.settings.config.cfaV1Address,
    );
    console.log(
        "================ Superfluid Host Addy: =================",
        sf.settings.config.hostAddress,
    );
    console.log("================ Deploying StreamScheduler =================");
    await streamScheduler.deployed();
    console.log(
        "================= StreamScheduler deployed to:",
        streamScheduler.address,
        "=================",
    );

    console.log("================ START DEPLOY =================");

    const fDai = await sf.loadSuperToken("fDAIx");
    console.log(
        "================ SuperToken instance:",
        fDai.address,
        "================",
    );

    console.log("================ UPDATING PERMISSIONS =================");
    const signer = sf.createSigner({
        privateKey:
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        provider: provider,
    });

    await sf.cfaV1
        .updateFlowOperatorPermissions({
            flowOperator: streamScheduler.address,
            permissions: 7,
            flowRateAllowance: flowRate,
            superToken: fDai.address,
        })
        .exec(signer);

    console.log(
        "================ SUCCESSFULLY UPDATED PERMISSIONS =================",
    );

    console.log("================ END DEPLOY =================");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
