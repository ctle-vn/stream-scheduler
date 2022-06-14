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

const parseEventDataArgs = eventData => {
    const streamOrderData = {};
    streamOrderData.streamOrderHash = eventData.receiver;
    streamOrderData.sender = eventData.sender;
    streamOrderData.sender = eventData.superToken;
    streamOrderData.sender = eventData.flowRate;
    streamOrderData.sender = eventData.endTime;
    streamOrderData.sender = eventData.userData;
    return streamOrderData;
};

const url = "http://localhost:8545";
const provider = new ethers.providers.JsonRpcProvider(url);
const ALLOW_CREATE = 1 << 0;
const ALLOW_UPDATE = 1 << 1;
const ALLOW_DELETE = 1 << 2;

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
    const startTime1 = Math.floor(Date.now() / 1000) + 1000;
    const endTime1 = Math.floor(Date.now() / 1000) + 1000000;
    await streamScheduler.createStreamOrder(
        accounts[1],
        fDai.address,
        // Convert Date.now to seconds
        startTime1,
        flowRate,
        endTime1,
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
    let events = await contract.queryFilter(
        contract.filters.CreateStreamOrder(),
        0,
        "latest",
    );

    // Go through the events, and store the event data into SQLLite database
    let streamOrderList = [];
    let latestBlock = 0;
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const eventData = event.args;
        const streamOrderData = parseEventDataArgs(eventData);
        const eventName = event.event;
        const eventDataHash = event.data;
        const eventBlockNumber = event.blockNumber;
        const eventTimestamp = event.timestamp;
        const blob = {
            event_name: eventName,
            event_data_hash: eventDataHash,
            event_block_number: eventBlockNumber,
            event_timestamp: eventTimestamp,
            event_receiver: streamOrderData.receiver,
            event_sender: streamOrderData.sender,
            event_super_token: streamOrderData.superToken,
            event_flow_rate: streamOrderData.flowRate,
            event_end_time: streamOrderData.endTime,
            event_user_data: streamOrderData.userData,
        };
        streamOrderList.push(blob);
        latestBlock = eventBlockNumber;

        // Write to SQL Lite database
        // const db = new sqlite3.Database("db/streams.db");
        // db.run(
        //     `INSERT INTO streams (event_name, event_address, event_block, event_timestamp, event_data) VALUES (?, ?, ?, ?, ?)`,
        //     [eventName, eventAddress, eventBlock, eventTimestamp, eventData],
        //     function (err) {
        //         if (err) {
        //             return console.log(err.message);
        //         }
        //         console.log(
        //             `A row has been inserted with rowid ${this.lastID}`,
        //         );
        //     },
        // );
        // db.close();
    }

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

    console.log("================ EXECUTE CREATE STREAM =================");

    // Call executeCreateStream
    await streamScheduler.executeCreateStream(
        accounts[1],
        fDai.address,
        // Convert Date.now to seconds
        startTime1,
        flowRate,
        endTime1,
        "0x",
    );

    // get past events emitted from contract
    events = await contract.queryFilter(
        contract.filters.ExecuteCreateStream(),
        latestBlock,
        "latest",
    );
    console.log("Events:", events);

    console.log("================ END =================");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
