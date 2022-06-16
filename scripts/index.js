// scripts/index.js
const { Framework } = require("@superfluid-finance/sdk-core");
const StreamSchedulerJSON = require("../artifacts/contracts/StreamScheduler.sol/StreamScheduler.json");
const StreamSchedulerABI = StreamSchedulerJSON.abi;
const ConstantFlowAgreementV1JSON = require("../artifacts/@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol/IConstantFlowAgreementV1.json");
const ConstantFlowAgreementV1ABI = ConstantFlowAgreementV1JSON.abi;
const SuperfluidJSON = require("../artifacts/@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol/ISuperfluid.json");
const { ethers } = require("hardhat");
const SuperfluidABI = SuperfluidJSON.abi;

require("dotenv").config();

const url = "http://localhost:8545";
const provider = new ethers.providers.JsonRpcProvider(url);

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
    await streamScheduler.createStreamOrder(
        accounts[1],
        fDaiAddress,
        startTime1,
        flowRate,
        endTime1,
        "0x",
    );

    // Duplicate stream order but should update with new flow rate.
    await streamScheduler.createStreamOrder(
        accounts[1],
        fDaiAddress,
        startTime1,
        flowRate + 1,
        endTime1,
        "0x",
    );

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

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
