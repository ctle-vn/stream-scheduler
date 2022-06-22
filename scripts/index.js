// scripts/index.js
const { ethers } = require("hardhat");

require("dotenv").config();

// Copy + Pasted from output of
// npx hardhat run --network localhost scripts/deploy.js
// const streamSchedulerAddress = "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";
// const fDaiAddress = "0x1f65B7b9b3ADB4354fF76fD0582bB6b0d046a41c";

// Copy + Pasted from output of
// npx hardhat run --network goerli scripts/deploy.js
// fDai from: https://docs.superfluid.finance/superfluid/developers/networks#test-networks
const streamSchedulerAddress = "0x3AE2459DF2b6A1552FC5d66Aec44A396Ba2BAE33";
const fDaiAddress = "0xF2d68898557cCb2Cf4C10c3Ef2B034b2a69DAD00";
const testGoerliReceiver = "0x3d027ef3f60754d0615837a1e7A375fEf9D45b81";

const flowRate = "100000000";

async function main() {
    const StreamScheduler = await ethers.getContractFactory("StreamScheduler");
    const streamScheduler = await StreamScheduler.attach(
        streamSchedulerAddress,
    );
    const accounts = await ethers.provider.listAccounts();
    console.log("================ Accounts: =================", accounts);

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
        // accounts[1],
        testGoerliReceiver,
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
        // accounts[1],
        testGoerliReceiver,
        fDaiAddress,
        startTime1,
        flowRate + 1,
        endTime1,
        "0x",
    );

    // Delete stream order but should update with new flow rate.
    console.log(
        "================ DELETING STREAM ORDER (DELETE ORDER_1) =================",
    );
    await streamScheduler.createStreamOrder(
        // accounts[1],
        testGoerliReceiver,
        fDaiAddress,
        startTime1,
        flowRate + 1,
        endTime1 - 100,
        "0x",
    );

    // // // Stream order with no close time, open indefinitely
    // console.log(
    //     "================ CREATING NEW STREAM ORDER (CREATE ORDER_2) =================",
    // );
    // await streamScheduler.createStreamOrder(
    //     accounts[2],
    //     fDaiAddress,
    //     Math.floor(Date.now() / 1000) + 1000,
    //     flowRate,
    //     0,
    //     "0x",
    // );

    // // // Stream order with no open time, so should close.
    // console.log(
    //     "================ CREATING NEW STREAM ORDER (DELETE ORDER_2) =================",
    // );
    // await streamScheduler.createStreamOrder(
    //     accounts[2],
    //     fDaiAddress,
    //     0,
    //     flowRate,
    //     Math.floor(Date.now() / 1000),
    //     "0x",
    // );

    // console.log(
    //     "================ CREATING NEW STREAM ORDER (CREATE ORDER_3) =================",
    // );
    // await streamScheduler.createStreamOrder(
    //     accounts[3],
    //     fDaiAddress,
    //     Math.floor(Date.now() / 1000) + 1000,
    //     flowRate,
    //     0,
    //     "0x",
    // );

    // console.log(
    //     "================ CREATING NEW STREAM ORDER (CREATE ORDER_4) =================",
    // );
    // await streamScheduler.createStreamOrder(
    //     accounts[5],
    //     fDaiAddress,
    //     Math.floor(Date.now() / 1000) + 1000,
    //     flowRate + 1000,
    //     0,
    //     "0x",
    // );

    // console.log(
    //     "================ CREATING NEW STREAM ORDER (UPDATE ORDER_3) =================",
    // );
    // await streamScheduler.createStreamOrder(
    //     accounts[3],
    //     fDaiAddress,
    //     Math.floor(Date.now() / 1000) + 1000,
    //     flowRate + 1000,
    //     0,
    //     "0x",
    // );

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
