//db stuff
const pg = require("pg");
const format = require("pg-format");
const { max } = require("pg/lib/defaults");
const connectionString =
    "postgres://postgres:password@localhost:5432/superfluid"; // Docker Postgres DB Connection.
const streamSchedulerAddress = "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";

const BlockIncrement = 1000;

async function runBot(streamScheduler) {
    // Query the db for the latest block number.
    const latestBlockNumberFromDB = await getLatestBlockNumberFromDB();
    console.log("Latest Block Number: ", latestBlockNumberFromDB);

    // Use this block number as the "from" parameter and get all past events from the contract.
    const pastEvents = await getPastEventsFromContract(
        streamScheduler,
        latestBlockNumberFromDB,
    );
    console.log("Retrieved past Events, count: ", pastEvents.length);
    // Loop through the events and check differentiate the diff types of stream orders.
    await processStreamOrders(streamScheduler, pastEvents);

    console.log("Finished processing stream orders");
    console.log("Bot job completed");
}

const parseEventDataArgs = eventData => {
    const streamOrderData = {};
    streamOrderData.receiver = eventData.receiver;
    streamOrderData.sender = eventData.sender;
    streamOrderData.superToken = eventData.superToken;
    streamOrderData.flowRate = eventData.flowRate;
    streamOrderData.startTime = eventData.startTime;
    streamOrderData.endTime = eventData.endTime;
    streamOrderData.userData = eventData.userData;
    return streamOrderData;
};

const parseToDeleteStreamOrder = rows => {
    let streamOrders = [];
    for (let i = 0; i < rows.length; i++) {
        let streamOrder = {
            name: rows[i].event_name,
            receiver: rows[i].event_receiver,
            sender: rows[i].event_sender,
            blockNumber: parseInt(rows[i].event_block_number),
            flowRate: parseInt(rows[i].event_flow_rate),
            endTime: parseInt(rows[i].event_end_time),
            startTime: parseInt(rows[i].event_start_time),
            superToken: rows[i].event_super_token,
            userData: rows[i].event_user_data,
        };
        streamOrders.push(streamOrder);
    }
    return streamOrders;
};

async function processStreamOrders(streamScheduler, events) {
    const timeNowInSecs = Math.floor(Date.now() / 1000);
    let maxBlockNumber = 0;
    let streamOrdersToDelete = [];
    for (let i = 0; i < events.length; i++) {
        maxBlockNumber = Math.max(
            maxBlockNumber,
            parseInt(events[i].blockNumber),
        );
        let streamOrderData = parseEventDataArgs(events[i].args);
        let streamOrder = {
            name: events[i].event,
            receiver: streamOrderData.receiver,
            sender: streamOrderData.sender,
            blockNumber: parseInt(events[i].blockNumber),
            flowRate: parseInt(streamOrderData.flowRate),
            endTime: parseInt(streamOrderData.endTime),
            startTime: parseInt(streamOrderData.startTime),
            superToken: streamOrderData.superToken,
            userData: streamOrderData.userData,
        };
        // console.log("Stream order: ", streamOrder);
        const shouldCreateStreamOrder = await checkIfStreamOrderExistsInDB(
            streamOrder,
        );
        if (shouldCreateStreamOrder) {
            console.log("============ EXECUTE CREATE STREAM ============");
            //  console.log(
            //     "Did not find sender/receiver pair, creating new stream with stream order: ",
            //     streamOrder,
            // );
            await storeStreamOrdersIntoDB([streamOrder]);
            await streamScheduler.executeCreateStream(
                streamOrder.receiver,
                streamOrder.superToken,
                streamOrder.startTime,
                streamOrder.flowRate,
                streamOrder.endTime,
                streamOrder.userData,
            );
        } else {
            console.log("Flow exists.");
            const doesExistOnChain = await checkStreamOrdersOnChain(
                streamScheduler,
                streamOrder,
            );
            if (!doesExistOnChain) {
                console.log(
                    "Detected should delete in DB but does not exist on chain, event: ",
                    events[i],
                );
                continue;
            }
            if (
                (streamOrder.endTime != 0 &&
                    streamOrder.endTime < timeNowInSecs) ||
                streamOrder.startTime == 0
            ) {
                console.log("============ EXECUTE DELETE STREAM ============");
                // console.log("Detected close stream order", streamOrder);
                await streamScheduler.executeDeleteStream(
                    streamOrder.receiver,
                    streamOrder.superToken,
                    streamOrder.startTime,
                    streamOrder.flowRate,
                    streamOrder.endTime,
                    streamOrder.userData,
                );
                streamOrdersToDelete.push(streamOrder);
            } else {
                console.log("============ EXECUTE UPDATE STREAM ============");
                // console.log("Detected update stream order: ", streamOrder);
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
    }
    // Update the latest block number in the db.
    await updateLatestBlockNumberInDB(maxBlockNumber);

    // Delete stream orders that have been closed from the database.
    const expiredStreamOrders = await getExpiredStreamOrdersFromDB();
    console.log("Found expired stream orders: ", expiredStreamOrders);
    for (let i = 0; i < expiredStreamOrders.length; i++) {
        const streamOrder = expiredStreamOrders[i];
        console.log(
            "============ EXECUTE DELETE STREAM FOR EXPIRED STREAMS FROM DB ============",
        );
        await streamScheduler.executeDeleteStream(
            streamOrder.receiver,
            streamOrder.superToken,
            streamOrder.startTime,
            streamOrder.flowRate,
            streamOrder.endTime,
            streamOrder.userData,
        );
    }
    streamOrdersToDelete.concat(expiredStreamOrders);
    if (streamOrdersToDelete.length > 0) {
        // TODO: Call executeDeleteStream on these stream orders.
        await deleteStreamOrdersFromDB(streamOrdersToDelete);
    }
}

async function updateLatestBlockNumberInDB(maxBlockNumber) {
    const client = new pg.Client({
        connectionString: connectionString,
    });
    try {
        await client.connect();
        const query = `INSERT INTO block_numbers (
                event_block_number
                ) VALUES (${maxBlockNumber})`;
        await client.query(query);
        console.log("Updated latest block number in DB.");
    } catch (e) {
        console.log("Error updating latest block number in DB: ", e);
    } finally {
        await client.end();
    }
}

async function checkStreamOrdersOnChain(streamScheduler, streamOrder) {
    return await streamScheduler.streamOrderHashes(
        ethers.utils.solidityKeccak256(
            ["address", "address", "address", "uint256", "uint256", "int96"],
            [
                streamOrder.sender,
                streamOrder.receiver,
                streamOrder.superToken,
                streamOrder.startTime,
                streamOrder.endTime,
                streamOrder.flowRate,
            ],
        ),
    );
}

async function deleteStreamOrdersFromDB(streamOrdersToDelete) {
    const client = new pg.Client({
        connectionString: connectionString,
    });
    try {
        await client.connect();
        for (let i = 0; i < streamOrdersToDelete.length; i++) {
            const streamOrder = streamOrdersToDelete[i];
            const query = `DELETE FROM stream_orders WHERE event_receiver = '${streamOrder.receiver}' AND event_sender = '${streamOrder.sender}'`;
            await client.query(query);
        }
        console.log("Deleted stream orders from database");
    } catch (e) {
        console.log("Error deleting stream orders into database, " + e);
    } finally {
        await client.end();
    }
}

async function getExpiredStreamOrdersFromDB() {
    const client = new pg.Client({
        connectionString: connectionString,
    });
    const timeNowInSecs = Math.floor(Date.now() / 1000);
    const sql = `SELECT *
    FROM stream_orders WHERE event_end_time < $1 and event_end_time <> 0`;
    const values = [timeNowInSecs];
    console.log(
        "Getting expired stream orders from database that are older than: ",
        timeNowInSecs,
    );

    try {
        await client.connect();
        const result = await client.query(sql, values);
        return parseToDeleteStreamOrder(result.rows);
    } catch (e) {
        console.log("Error querying for expired streams in database, " + e);
        return [];
    } finally {
        await client.end();
    }
}

async function checkIfStreamOrderExistsInDB(streamOrder) {
    const client = new pg.Client({
        connectionString: connectionString,
    });
    try {
        await client.connect();
        const sql = `select count(*) from stream_orders 
        where stream_orders.event_receiver = '${streamOrder.receiver}'
        and stream_orders.event_sender = '${streamOrder.sender}'`;
        const result = await client.query(sql);
        await client.end();
        return result.rows[0].count == 0 ? true : false;
    } catch (e) {
        console.log(
            "Error checking if stream order exists in database, error: ",
            e,
        );
    } finally {
        await client.end();
    }
}

async function updateStreamOrderInDB(streamOrder) {
    const client = new pg.Client({
        connectionString: connectionString,
    });
    const sql = `UPDATE stream_orders SET
            event_flow_rate = ${streamOrder.flowRate}
            WHERE event_sender = '${streamOrder.sender}' AND event_receiver = '${streamOrder.receiver}'`;
    try {
        await client.connect();
        await client.query(sql);
        console.log("Updated stream order in database");
    } catch (e) {
        console.log("Error updating stream order in db, error: " + e);
    } finally {
        await client.end();
    }
}

async function getLatestBlockNumberFromDB() {
    const client = new pg.Client({
        connectionString: connectionString,
    });
    const sql = `SELECT max(event_block_number) as event_block_number FROM block_numbers`;
    try {
        await client.connect();
        const result = await client.query(sql);
        if (result.rows[0].event_block_number === null) {
            console.log(
                "No data in the database, returning default block of 0.",
            );
            return 0;
        }
        console.log(
            "Found data in the database, returning latest block, ",
            result.rows[0],
        );
        return parseInt(result.rows[0].event_block_number) + 1;
    } catch (e) {
        console.log(
            "Error getting latest block number from database, error: ",
            e,
        );
        return 0;
    } finally {
        await client.end();
    }
}

async function getPastEventsFromContract(streamScheduler, latestBlockNumber) {
    const latestNetworkBlockNumber = await ethers.provider.getBlockNumber();
    const events = [];
    while(latestBlockNumber < latestNetworkBlockNumber) {
        const blockEvents = await streamScheduler.queryFilter(
            streamScheduler.filters.CreateStreamOrder(),
            latestBlockNumber,
            latestBlockNumber + BlockIncrement,
        );
        events.push(...blockEvents);
        latestBlockNumber += BlockIncrement;
    }
    //get the latest events of the network
    if(latestBlockNumber < await ethers.provider.getBlockNumber()) {
        events.push(...await streamScheduler.queryFilter(streamScheduler.filters.CreateStreamOrder(),
            latestBlockNumber,
            "latest",
        ));
    }
    return events;
}

async function storeStreamOrdersIntoDB(events) {
    let streamOrderList = [];
    console.log("Inserting into DB");
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const eventName = event.name;
        const eventBlockNumber = event.blockNumber;
        const eventTimestamp = event.timestamp;
        const blob = [
            eventName,
            eventBlockNumber,
            event.receiver,
            event.sender,
            event.superToken,
            event.flowRate,
            event.startTime,
            event.endTime,
            event.userData,
        ];
        streamOrderList.push(blob);
    }
    // Insert the stream orders into the database.
    // console.log("Stream order list: ", streamOrderList);
    if (streamOrderList.length > 0) {
        await insertStreamOrdersIntoDB(streamOrderList);
    }
}

async function insertStreamOrdersIntoDB(streamOrderList) {
    // Insert 2d array of stream orders into the database.
    const client = new pg.Client({
        connectionString: connectionString,
    });
    const sql = format(
        `INSERT INTO stream_orders (
        event_name,
            event_block_number,
            event_receiver,
            event_sender,
            event_super_token,
            event_flow_rate,
            event_start_time,
            event_end_time,
            event_user_data
            ) VALUES %L`,
        streamOrderList,
    );
    try {
        await client.connect();
        const result = await client.query(sql);
        console.log(
            "Inserted stream orders into DB, row count: ",
            result.rowCount,
        );
    } catch (e) {
        console.log("Error inserting stream orders into database, " + e);
    } finally {
        await client.end();
    }
}

async function main() {
    const StreamScheduler = await ethers.getContractFactory("StreamScheduler");
    const streamScheduler = await StreamScheduler.attach(
        streamSchedulerAddress,
    );
    await runBot(streamScheduler);
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
