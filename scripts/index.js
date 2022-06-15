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
const connectionString =
    "postgres://superfluid:password@localhost:5432/superfluid";
const sql = fs
    .readFileSync(path.resolve(__dirname, "./../database/init.sql"))
    .toString();

// Init.sql to create table and seed data
const writeSQL = async () => {
    const client = new pg.Client({
        connectionString,
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

/**
 * Parse to rows to get format:
 *   {
    event_name: string,
    event_receiver: string,
    event_sender: string,
    event_block_number: int,
    event_flow_rate: int96,
    event_end_time: bigint,
    event_start_time: uint256,
    event_data_hash: string,
    event_super_token: string,
    event_user_data: string,
  }
 */
const parseToStreamOrder = rows => {
    let streamOrders = [];
    for (let i = 0; i < rows.length; i++) {
        streamOrders.push({
            name: rows[i].event_name,
            receiver: rows[i].event_receiver,
            sender: rows[i].event_sender,
            blockNumber: parseInt(rows[i].event_block_number),
            flowRate: parseInt(rows[i].event_flow_rate),
            endTime: parseInt(rows[i].event_end_time),
            startTime: parseInt(rows[i].event_start_time),
            superToken: rows[i].event_super_token,
            userData: rows[i].event_user_data,
        });
    }
    return streamOrders;
};

async function main() {
    // console.log("================ CREATING TABLE =================");
    // await writeSQL();
    // console.log("================ DONE CREATING =================");
    console.log("================ START QUERY =================");
    const client = new pg.Client({
        connectionString,
    });
    await client.connect();
    const result = await client.query("SELECT * FROM stream_orders;");
    console.log("ROWS: ", parseToStreamOrder(result.rows));
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
    // New stream order
    await streamScheduler.createStreamOrder(
        accounts[1],
        fDaiAddress,
        // Convert Date.now to seconds
        startTime1,
        flowRate,
        endTime1,
        "0x",
    );

    // Duplicate stream order but should update with new flow rate.
    // await streamScheduler.createStreamOrder(
    //     accounts[1],
    //     fDaiAddress,
    //     // Convert Date.now to seconds
    //     Math.floor(Date.now() / 1000) + 1000,
    //     flowRate,
    //     Math.floor(Date.now() / 1000) + 10000230,
    //     "0x",
    // );

    // // Stream order with no close time
    // await streamScheduler.createStreamOrder(
    //     accounts[1],
    //     fDaiAddress,
    //     // Convert Date.now to seconds
    //     Math.floor(Date.now() / 1000) + 1000,
    //     flowRate,
    //     0,
    //     "0x",
    // );

    // // Stream order with no close time
    // await streamScheduler.createStreamOrder(
    //     accounts[1],
    //     fDaiAddress,
    //     // Convert Date.now to seconds
    //     Math.floor(Date.now() / 1000) + 1000,
    //     flowRate,
    //     0,
    //     "0x",
    // );
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
        const eventBlockNumber = event.blockNumber;
        const eventTimestamp = event.timestamp;
        const blob = {
            event_name: eventName,
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

    // console.log("================ EXECUTE CREATE STREAM =================");

    // // Call executeCreateStream
    // await streamScheduler.executeCreateStream(
    //     accounts[1],
    //     fDaiAddress,
    //     // Convert Date.now to seconds
    //     startTime1,
    //     flowRate,
    //     endTime1,
    //     "0x",
    // );

    // get past events emitted from contract
    // events = await streamScheduler.queryFilter(
    //     streamScheduler.filters.ExecuteCreateStream(),
    //     latestBlock,
    //     "latest",
    // );
    // console.log("Events:", events);
    /*
    msg.sender,
                    receiver,
                    superToken,
                    startTime,
                    endTime
    */
    console.log(
        "Contract state variable: ",
        await streamScheduler.streamOrderHashes(
            ethers.utils.solidityKeccak256(
                ["address", "address", "address", "uint256", "uint256"],
                [accounts[0], accounts[1], fDaiAddress, startTime1, endTime1],
            ),
        ),
    );
}

const errorHandler = (type, err) => {
    if (err) console.error("Deploy " + type + " Error: ", err);
};

const parseEventDataArgs = eventData => {
    const streamOrderData = {};
    streamOrderData.receiver = eventData.receiver;
    streamOrderData.sender = eventData.sender;
    streamOrderData.superToken = eventData.superToken;
    streamOrderData.flowRate = eventData.flowRate;
    streamOrderData.endTime = eventData.endTime;
    streamOrderData.userData = eventData.userData;
    return streamOrderData;
};

async function runBot(events) {
    // Query the db for the latest block number.
    const latestBlockNumber = await getLatestBlockNumberFromDB();
    console.log("Latest Block Number: ", latestBlockNumber);

    // Use this block number as the "from" parameter and get all past events from the contract.
    const pastEvents = await getPastEventsFromContract(latestBlockNumber);

    // Store all the stream orders back into the database.
    await storeStreamOrdersIntoDB(pastEvents);

    // Loop through the events and check differentiate the diff types of stream orders.
    await processStreamOrders(pastEvents);
}

async function processStreamOrders(events) {
    const timeNowInSecs = Math.floor(Date.now() / 1000);
    let streamOrdersToDelete = [];
    let streamOrdersToUpdateOrCreate = [];
    for (let i = 0; i < events.length; i++) {
        if (events[i].endTime != 0 && events[i].endTime < timeNowInSecs) {
            console.log("Detected close stream order");
            await streamScheduler.executeDeleteStream(
                events[i].receiver,
                events[i].superToken,
                events[i].startTime,
                events[i].flowRate,
                events[i].endTime,
                events[i].userData,
            );
            streamOrdersToDelete.push({
                name: events[i].event_name,
                receiver: events[i].event_receiver,
                sender: events[i].event_sender,
                blockNumber: parseInt(events[i].event_block_number),
                flowRate: parseInt(events[i].event_flow_rate),
                endTime: parseInt(events[i].event_end_time),
                startTime: parseInt(events[i].event_start_time),
                superToken: events[i].event_super_token,
                userData: events[i].event_user_data,
            });
        } else {
            streamOrdersToUpdateOrCreate.push({
                name: events[i].event_name,
                receiver: events[i].event_receiver,
                sender: events[i].event_sender,
                blockNumber: parseInt(events[i].event_block_number),
                flowRate: parseInt(events[i].event_flow_rate),
                endTime: parseInt(events[i].event_end_time),
                startTime: parseInt(events[i].event_start_time),
                superToken: events[i].event_super_token,
                userData: events[i].event_user_data,
            });
        }
    }

    for (let i = 0; i < streamOrdersToUpdateOrCreate.length; i++) {
        let streamOrder = streamOrdersToUpdateOrCreate[i];
        const shouldCreateStreamOrder = await checkIfStreamOrderExistsInDB(
            streamOrder,
        );
        if (shouldCreateStreamOrder) {
            await streamScheduler.executeCreateStream(
                streamOrder.receiver,
                streamOrder.superToken,
                streamOrder.startTime,
                streamOrder.flowRate,
                streamOrder.endTime,
                streamOrder.userData,
            );
        } else {
            await streamScheduler.executeUpdateStream(
                streamOrder.receiver,
                streamOrder.superToken,
                streamOrder.startTime,
                streamOrder.flowRate,
                streamOrder.endTime,
                streamOrder.userData,
            );
            // Update stream order in database.
            await updateStreamOrderInDB(streamOrder);
        }
    }

    // Delete stream orders that have been closed from the database.
    streamOrdersToDelete.push(await getExpiredStreamOrdersFromDB());
    await deleteStreamOrdersFromDB(streamOrdersToDelete);
}

async function getExpiredStreamOrdersFromDB() {
    const timeNowInSecs = Math.floor(Date.now() / 1000);
    const client = new pg.Client({
        connectionString: connectionString,
    });
    await client.connect();
    const sql = `SELECT event_name, 
    event_data_hash,
     event_block_number, 
     event_timestamp, 
     event_receiver, 
     event_sender, 
     event_super_token, 
     event_flow_rate, 
     event_end_time, 
     event_user_data
    FROM stream_orders WHERE event_end_time < $1`;
    const values = [timeNowInSecs];
    const result = await client.query(sql, values);
    return parseToStreamOrder(result.rows);
}

async function updateStreamOrderInDB(streamOrder) {
    const sql = `UPDATE stream_orders SET
        event_flow_rate = ?,
        WHERE event_sender = ? AND event_receiver = ?`;
    const values = [
        streamOrder.flowRate,
        streamOrder.sender,
        streamOrder.receiver,
    ];
    await db.run(sql, values);
    console.log("Updated stream order in database");
}

async function deleteStreamOrdersFromDB(streamOrdersToDelete) {
    const client = new pg.Client({
        connectionString: connectionString,
    });
    await client.connect();
    for (let i = 0; i < streamOrdersToDelete.length; i++) {
        let streamOrder = streamOrdersToDelete[i];
        // TODO: Batch delete from db.
        const deleteQuery = `DELETE FROM stream_orders WHERE event_receiver = '${streamOrder.receiver}' AND event_sender = '${streamOrder.sender}'`;
        await client.query(deleteQuery);
    }
    await client.end();
    console.log("Deleted stream orders from database");
}

async function checkIfStreamOrderExistsInDB(streamOrder) {
    const client = new pg.Client({
        connectionString: connectionString,
    });
    await client.connect();
    const sql = `select count(*) from stream_orders 
    where stream_order.receiver = event_receiver
    and stream_order.sender = event_sender`;
    const result = await client.query(sql);
    return result == 0 ? true : false;
}

async function insertStreamOrdersIntoDB(streamOrderList) {
    const client = new pg.Client({
        connectionString: connectionString,
    });
    await client.connect();
    const sql = `INSERT INTO stream_order (
        event_name,
        event_data_hash,
        event_block_number,
        event_timestamp,
        event_receiver,
        event_sender,
        event_super_token,
        event_flow_rate,
        event_end_time,
        event_user_data
    ) VALUES ?`;
    const values = [streamOrderList];
    const result = await db.query(sql, [values]);
    console.log("Inserted stream orders into DB: ", result);
}

async function storeStreamOrdersIntoDB(events) {
    let streamOrderList = [];
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const eventData = event.args;
        const streamOrderData = parseEventDataArgs(eventData);
        const eventName = event.event;
        const eventBlockNumber = event.blockNumber;
        const eventTimestamp = event.timestamp;
        const blob = {
            event_name: eventName,
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
    }
    // Insert the stream orders into the database.
    await insertStreamOrdersIntoDB(streamOrderList);
}

async function getPastEventsFromContract(latestBlockNumber) {
    return await streamScheduler.queryFilter(
        streamScheduler.filters.CreateStreamOrder(),
        latestBlockNumber,
        "latest",
    );
}

async function getLatestBlockNumberFromDB() {
    const client = new pg.Client({
        connectionString: connectionString,
    });
    await client.connect();
    const sql = `SELECT max(event_block_number) as latest_block_number FROM stream_orders`;
    if (result.rowCount == 0) {
        console.log("No data in the database, returning default block of 0.");
        return 0;
    }
    console.log("Found data in the database, returning latest block.");
    return parseInt(result.rows[0].event_block_number);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
