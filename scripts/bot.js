//db stuff
const pg = require("pg");
const format = require("pg-format");
const connectionString =
    "postgres://postgres:password@localhost:5432/superfluid"; // Docker Postgres DB Connection.
const streamSchedulerAddress = "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";

async function runBot(streamScheduler) {
    // Query the db for the latest block number.
    const latestBlockNumber = await getLatestBlockNumberFromDB();
    console.log("Latest Block Number: ", latestBlockNumber);

    // Use this block number as the "from" parameter and get all past events from the contract.
    const pastEvents = await getPastEventsFromContract(
        streamScheduler,
        latestBlockNumber,
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
        streamOrders.push([rows[i].event_receiver, rows[i].event_sender]);
    }
    return streamOrders;
};

async function processStreamOrders(streamScheduler, events) {
    const timeNowInSecs = Math.floor(Date.now() / 1000);
    let streamOrdersToDelete = [];
    let streamOrdersToUpdateOrCreate = [];
    for (let i = 0; i < events.length; i++) {
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
                streamOrdersToDelete.push([
                    streamOrder.receiver,
                    streamOrder.sender,
                ]);
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

    // for (let i = 0; i < streamOrdersToUpdateOrCreate.length; i++) {
    // let streamOrder = streamOrdersToUpdateOrCreate[i];
    // console.log("Stream order: ", streamOrder);
    // const shouldCreateStreamOrder = await checkIfStreamOrderExistsInDB(
    //     streamOrder,
    // );
    // // const doesExistOnChain = await checkStreamOrdersOnChain(
    // //     streamScheduler,
    // //     streamOrder,
    // // );
    // if (shouldCreateStreamOrder) {
    //     console.log(
    //         "Did not find sender/receiver pair, creating stream order with stream order: ",
    //         streamOrder,
    //     );
    //     await storeStreamOrdersIntoDB([streamOrder]);
    //     await streamScheduler.executeCreateStream(
    //         streamOrder.receiver,
    //         streamOrder.superToken,
    //         streamOrder.startTime,
    //         streamOrder.flowRate,
    //         streamOrder.endTime,
    //         streamOrder.userData,
    //     );
    // } else {
    //     console.log(
    //         "Found sender/receiver pair, updating stream order with stream order: ",
    //         streamOrder,
    //     );
    //     await streamScheduler.executeUpdateStream(
    //         streamOrder.receiver,
    //         streamOrder.superToken,
    //         streamOrder.startTime,
    //         streamOrder.flowRate,
    //         streamOrder.endTime,
    //         streamOrder.userData,
    //     );
    //     // Update stream order in database.
    //     await updateStreamOrderInDB(streamOrder);
    // }
    // }

    // Delete stream orders that have been closed from the database.
    streamOrdersToDelete.concat(await getExpiredStreamOrdersFromDB());
    if (streamOrdersToDelete.length > 0) {
        await deleteStreamOrdersFromDB(streamOrdersToDelete);
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
            const query = `DELETE FROM stream_orders WHERE event_receiver = '${streamOrder[0]}' AND event_sender = '${streamOrder[1]}'`;
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
    const sql = `SELECT event_receiver, event_sender
    FROM stream_orders WHERE event_end_time < $1`;
    const values = [timeNowInSecs];

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
    const sql = `SELECT max(event_block_number) as event_block_number FROM stream_orders`;
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
    return await streamScheduler.queryFilter(
        streamScheduler.filters.CreateStreamOrder(),
        latestBlockNumber,
        "latest",
    );
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
