//db stuff
const pg = require("pg");
const format = require("pg-format");
const connectionString =
    "postgres://superfluid:password@localhost:5432/superfluid";
const client = new pg.Client({
    connectionString: connectionString,
});
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

    // Store all the stream orders back into the database.
    await storeStreamOrdersIntoDB(pastEvents);

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
    streamOrderData.endTime = eventData.endTime;
    streamOrderData.userData = eventData.userData;
    return streamOrderData;
};

const parseToDeleteStreamOrder = rows => {
    let streamOrders = [];
    for (let i = 0; i < rows.length; i++) {
        streamOrders.push({
            receiver: rows[i].event_receiver,
            sender: rows[i].event_sender,
        });
    }
    return streamOrders;
};

async function processStreamOrders(streamScheduler, events) {
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
                receiver: events[i].event_receiver,
                sender: events[i].event_sender,
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
    streamOrdersToDelete.concat(await getExpiredStreamOrdersFromDB());
    await deleteStreamOrdersFromDB(streamOrdersToDelete);
}

async function deleteStreamOrdersFromDB(streamOrdersToDelete) {
    const sql = format(
        `DELETE FROM stream_orders 
        WHERE (event_receiver, event_sender)
        IN %L`,
        streamOrdersToDelete,
    );
    try {
        await client.connect();
        const result = await client.query(sql);
        console.log("Deleted stream orders from database");
    } catch (e) {
        console.log("Error inserting stream orders into database, " + e);
    } finally {
        await client.end();
    }
    await client.end();
}

async function getExpiredStreamOrdersFromDB() {
    const timeNowInSecs = Math.floor(Date.now() / 1000);
    const sql = `SELECT event_receiver, event_sender
    FROM stream_orders WHERE event_end_time < $1`;
    const values = [timeNowInSecs];

    try {
        await client.connect();
        const result = await client.query(sql, values);
    } catch (e) {
        console.log("Error inserting stream orders into database, " + e);
    } finally {
        await client.end();
    }
    return parseToDeleteStreamOrder(result.rows);
}

async function checkIfStreamOrderExistsInDB(streamOrder) {
    try {
        await client.connect();
        const sql = `select count(*) from stream_orders 
        where stream_order.receiver = event_receiver
        and stream_order.sender = event_sender`;
        const result = await client.query(sql);
        await client.end();
        return result == 0 ? true : false;
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
    const sql = `UPDATE stream_orders SET
            event_flow_rate = ?,
            WHERE event_sender = ? AND event_receiver = ?`;
    try {
        await client.connect();
        const values = [
            streamOrder.flowRate,
            streamOrder.sender,
            streamOrder.receiver,
        ];
        await client.query(sql, values);
        console.log("Updated stream order in database");
    } catch (e) {
        console.log("Error updating stream order in db, error: " + e);
    } finally {
        await client.end();
    }
}

async function getLatestBlockNumberFromDB() {
    const sql = `SELECT max(event_block_number) as latest_block_number FROM stream_orders`;
    try {
        await client.connect();
        const result = await client.query(sql);
        if (result.rowCount == 0) {
            console.log(
                "No data in the database, returning default block of 0.",
            );
            return 0;
        }
        console.log("Found data in the database, returning latest block.");
        return parseInt(result.rows[0].event_block_number);
    } catch (e) {
        console.log(
            "Error getting latest block number from database, error: ",
            e,
        );
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
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const eventData = event.args;
        const streamOrderData = parseEventDataArgs(eventData);
        const eventName = event.event;
        const eventBlockNumber = event.blockNumber;
        const eventTimestamp = event.timestamp;
        const blob = [
            eventName,
            eventBlockNumber,
            streamOrderData.receiver,
            streamOrderData.sender,
            streamOrderData.superToken,
            streamOrderData.flowRate,
            streamOrderData.endTime,
            streamOrderData.userData,
        ];
        streamOrderList.push(blob);
    }
    // Insert the stream orders into the database.
    await insertStreamOrdersIntoDB(streamOrderList);
}

async function insertStreamOrdersIntoDB(streamOrderList) {
    // Insert 2d array of stream orders into the database.
    const sql = format(
        `INSERT INTO stream_order (
            event_name,
            event_block_number,
            event_receiver,
            event_sender,
            event_super_token,
            event_flow_rate,
            event_end_time,
            event_user_data
            ) VALUES %L`,
        streamOrderList,
    );
    try {
        await client.connect();
        const result = await client.query(sql);
    } catch (e) {
        console.log("Error inserting stream orders into database, " + e);
    } finally {
        await client.end();
    }

    console.log("Inserted stream orders into DB: ", result);
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
