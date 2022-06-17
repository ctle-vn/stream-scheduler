// scripts/index.js
const { ethers } = require("hardhat");

require("dotenv").config();

// Copy + Pasted from output of
// npx hardhat run --network localhost scripts/deploy.js
const streamSchedulerAddress = "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";
const fDaiAddress = "0x1f65B7b9b3ADB4354fF76fD0582bB6b0d046a41c";

const flowRate = "100000000";

async function main() {
    const StreamScheduler = await ethers.getContractFactory("StreamScheduler");
    const streamScheduler = await StreamScheduler.attach(
        streamSchedulerAddress,
    );
    const accounts = await ethers.provider.listAccounts();

    console.log(
        "Length of stream order hashes: ",
        await streamScheduler.getStreamOrderHashesLength(),
    );

    const startTime1 = Math.floor(Date.now() / 1000) + 1000;
    const endTime1 = Math.floor(Date.now() / 1000) + 1000000;
    console.log("================ CREATE STREAM ORDER =================");
    // New stream order
    console.log(
        "================ CREATING NEW STREAM ORDER (CREATE ORDER_1) =================",
    );
    await streamScheduler.createStreamOrder(
        accounts[1],
        fDaiAddress,
        startTime1,
        flowRate,
        endTime1,
        "0x",
    );

    // Duplicate stream order but should update with new flow rate.
    console.log(
        "================ CREATING NEW STREAM ORDER (UPDATE ORDER_1) =================",
    );
    await streamScheduler.createStreamOrder(
        accounts[1],
        fDaiAddress,
        startTime1,
        flowRate + 1,
        endTime1,
        "0x",
    );

    // // Stream order with no close time, open indefinitely
    console.log(
        "================ CREATING NEW STREAM ORDER (CREATE ORDER_2) =================",
    );
    await streamScheduler.createStreamOrder(
        accounts[2],
        fDaiAddress,
        Math.floor(Date.now() / 1000) + 1000,
        flowRate,
        0,
        "0x",
    );

    // // Stream order with no open time, so should close.
    console.log(
        "================ CREATING NEW STREAM ORDER (DELETE ORDER_2) =================",
    );
    await streamScheduler.createStreamOrder(
        accounts[2],
        fDaiAddress,
        0,
        flowRate,
        Math.floor(Date.now() / 1000),
        "0x",
    );

    console.log(
        "================ CREATING NEW STREAM ORDER (CREATE ORDER_3) =================",
    );
    await streamScheduler.createStreamOrder(
        accounts[3],
        fDaiAddress,
        Math.floor(Date.now() / 1000) + 1000,
        flowRate,
        0,
        "0x",
    );

    console.log(
        "================ CREATING NEW STREAM ORDER (CREATE ORDER_4) =================",
    );
    await streamScheduler.createStreamOrder(
        accounts[5],
        fDaiAddress,
        Math.floor(Date.now() / 1000) + 1000,
        flowRate + 1000,
        0,
        "0x",
    );

    console.log(
        "================ CREATING NEW STREAM ORDER (UPDATE ORDER_3) =================",
    );
    await streamScheduler.createStreamOrder(
        accounts[3],
        fDaiAddress,
        Math.floor(Date.now() / 1000) + 1000,
        flowRate + 1000,
        0,
        "0x",
    );

    console.log(
        "Length of stream order hashes: ",
        await streamScheduler.getStreamOrderHashesLength(),
    );
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
