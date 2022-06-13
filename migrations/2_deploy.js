// migrations/2_deploy.js
const StreamScheduler = artifacts.require("StreamScheduler");

module.exports = async function (deployer) {
    await deployer.deploy(Box);
};
