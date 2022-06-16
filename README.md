# Stream Scheduler

## Running unit tests

`forge t`

## Local Deployment + Testing

### Run local instance of postgres in docker

```
docker-compose build
docker-compose stop
docker-compose rm -f
docker-compose up
```

If you want to confirm data in container:
`docker exec -it <container-id> /bin/sh` Connect to container
`su - postgres` Change as postgres user
`\c superfluid` Connect to superfluid database
`SELECT * FROM stream_orders;` Query table.

### Running local chain and deploying contracts

`npx hardhat node` Runs local blockchain instance
`npx hardhat run --network localhost scripts/deploy.js` Compiles, spins up Superfluid and deploys StreamScheduler contract
`npx hardhat run --network localhost scripts/index.js` Mock create stream orders for demo.
`npx hardhat run --network localhost scripts/bot.js` Run bot
