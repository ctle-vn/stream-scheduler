// scripts/index.js
const { Framework } = require("@superfluid-finance/sdk-core");
const StreamSchedulerJSON = require("../artifacts/contracts/StreamScheduler.sol/StreamScheduler.json");
const StreamSchedulerABI = StreamSchedulerJSON.abi;
const ConstantFlowAgreementV1JSON = require("../artifacts/@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol/IConstantFlowAgreementV1.json");
const ConstantFlowAgreementV1ABI = ConstantFlowAgreementV1JSON.abi;
const SuperfluidJSON = require("../artifacts/@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol/ISuperfluid.json");
const { ethers } = require("hardhat");
const SuperfluidABI = SuperfluidJSON.abi;

//db stuff
const pg = require("pg");
const path = require("path");
const fs = require("fs");
const sql = fs
    .readFileSync(path.resolve(__dirname, "./../database/init.sql"))
    .toString();
// Write sql to postgres database
const writeSQL = async () => {
    const client = new pg.Client({
        connectionString:
            "postgres://superfluid:password@localhost:5432/superfluid",
    });
    await client.connect();
    await client.query(sql);
    await client.end();
};

require("dotenv").config();

const url = "http://localhost:8545";
const provider = new ethers.providers.JsonRpcProvider(url);

// Copy + Pasted from output of
// npx hardhat run --network localhost scripts/deploy.js
// const superfluidCFAAddress = "0x9bd03768a7DCc129555dE410FF8E85528A4F88b5";
// const superfluidHostAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";
const streamSchedulerAddress = "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";
const fDaiAddress = "0x1f65B7b9b3ADB4354fF76fD0582bB6b0d046a41c";

const flowRate = "1000000000000";

async function main() {
    console.log("================ CREATING TABLE =================");
    await writeSQL();
    console.log("================ DONE CREATING =================");
    console.log("================ START QUERY =================");
    const client = new pg.Client({
        connectionString:
            "postgres://superfluid:password@localhost:5432/superfluid",
    });
    await client.connect();
    const result = await client.query("SELECT * FROM stream_orders;");
    console.log("ROWS: ", result.rows);
    console.log("================ DONE QUERY =================");

    const StreamScheduler = await ethers.getContractFactory("StreamScheduler");
    // const host = await new ethers.Contract(
    //     superfluidCFAAddress,
    //     ConstantFlowAgreementV1ABI,
    //     provider,
    // );
    // const cfaV1 = await new ethers.Contract(
    //     superfluidHostAddress,
    //     SuperfluidABI,
    //     provider,
    // );

    const streamScheduler = await StreamScheduler.attach(
        streamSchedulerAddress,
    );
    // const sf = await Framework.create({
    //     networkName: "local",
    //     dataMode: "WEB3_ONLY",
    //     provider,
    //     resolverAddress: "0xD5ac451B0c50B9476107823Af206eD814a2e2580", // can just call, no need to set anywhere
    //     protocolReleaseVersion: "test",
    // });
    const accounts = await ethers.provider.listAccounts();

    console.log(
        "Length of stream order hashes: ",
        await streamScheduler.getStreamOrderHashesLength(),
    );

    const startTime1 = Math.floor(Date.now() / 1000) + 1000;
    const endTime1 = Math.floor(Date.now() / 1000) + 1000000;
    console.log("================ CREATE STREAM ORDER =================");
    await streamScheduler.createStreamOrder(
        accounts[1],
        fDaiAddress,
        // Convert Date.now to seconds
        startTime1,
        flowRate,
        endTime1,
        "0x",
    );
    await streamScheduler.createStreamOrder(
        accounts[1],
        fDaiAddress,
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

    // get past events emitted from contract
    let events = await streamScheduler.queryFilter(
        streamScheduler.filters.CreateStreamOrder(),
        0,
        "latest",
    );
    console.log("Events:", events);

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
    }

    console.log("================ EXECUTE CREATE STREAM =================");

    // Call executeCreateStream
    await streamScheduler.executeCreateStream(
        accounts[1],
        fDaiAddress,
        // Convert Date.now to seconds
        startTime1,
        flowRate,
        endTime1,
        "0x",
    );

    // get past events emitted from contract
    events = await streamScheduler.queryFilter(
        streamScheduler.filters.ExecuteCreateStream(),
        latestBlock,
        "latest",
    );
    console.log("Events:", events);
}

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

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
