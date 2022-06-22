// scripts/deploy.js
const deployFramework = require("@superfluid-finance/ethereum-contracts/scripts/deploy-framework");
const deployTestToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-token");
const deploySuperToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-super-token");
const { Framework } = require("@superfluid-finance/sdk-core");
const StreamSchedulerJSON = require("../artifacts/contracts/StreamScheduler.sol/StreamScheduler.json");
const StreamSchedulerABI = StreamSchedulerJSON.abi;
const { Contract } = require("ethers");
const { defaultNetwork, networks } = require("../hardhat.config");
require("dotenv").config();

const errorHandler = (type, err) => {
    if (err) console.error("Deploy " + type + " Error: ", err);
};

const url = "http://localhost:8545";
const localhostProvider = new ethers.providers.JsonRpcProvider(url);
const goerliProvider = new ethers.providers.JsonRpcProvider(
    networks.goerli.url,
);
const flowRate = "100000000000000000000000";

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
            provider: localhostProvider,
            resolverAddress: process.env.RESOLVER_ADDRESS, // can just call, no need to set anywhere
            protocolReleaseVersion: "test",
        });
    } catch (err) {
        console.error(err);
    }
}

async function main() {
    let sf;
    console.log("goerli provider: ", networks.goerli.url);
    if (defaultNetwork == "localhost") {
        sf = await deployFrameworkAndTokens();
    } else {
        sf = await Framework.create({
            networkName: "goerli",
            chainId: 5,
            provider: goerliProvider,
        });
    }
    let host;
    let cfa;
    if (defaultNetwork == "localhost") {
        cfa = sf.settings.config.cfaV1Address;
        host = sf.settings.config.hostAddress;
    } else {
        // Goerli testnet addresses: https://docs.superfluid.finance/superfluid/developers/networks#test-networks
        cfa = "0xEd6BcbF6907D4feEEe8a8875543249bEa9D308E8";
        host = "0x22ff293e14F1EC3A09B137e9e06084AFd63adDF9";
    }

    const StreamScheduler = await ethers.getContractFactory("StreamScheduler");
    const streamScheduler = await StreamScheduler.deploy(cfa, host);
    console.log("================ Superfluid CFA Addy: =================", cfa);
    console.log(
        "================ Superfluid Host Addy: =================",
        host,
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
        // privateKey:
        //     "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        // provider: localhostProvider,
        privateKey: process.env.GOERLI_PRIVATE_KEY,
        provider: goerliProvider,
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
