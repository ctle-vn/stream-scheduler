module.exports = {
    networks: {
        ganache: {
            host: "127.0.0.1",
            network_id: "*",
            port: 8545,
        },
        development: {
            host: "127.0.0.1",
            network_id: "*",
            port: 8545,
        },
    },
    compilers: {
        solc: {
            version: "^0.8.0",
        },
    },
    mocha: {
        timeout: 100000,
    },
};
