require("dotenv").config();
const Web3 = require("web3");
const StreamSchedulerABI = require("./abi/StreamScheduler.abi.json");

const accounts = require("./accounts.json");
const STREAM_SCHEDULER_ADDRESS = process.env.STREAM_SCHEDULER_ADDRESS;

async function main() {
    const web3 = new Web3(provider);
    const streamScheduler = new web3.eth.Contract(
        StreamSchedulerABI,
        STREAM_SCHEDULER_ADDRESS,
    );
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
