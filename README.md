# Stream Scheduler

## Running unit tests

`forge t`

## Local Deployment + Testing

`npx hardhat node` Runs local blockchain instance
`npx hardhat run --network localhost scripts/deploy.js` Compiles, spins up Superfluid and deploys StreamScheduler contract
`npx hardhat run --network localhost scripts/index.js` Mock create stream orders for demo.
`npx hardhat run --network localhost scripts/bot.js` Run bot
