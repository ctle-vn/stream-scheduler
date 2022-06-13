// migrations/2_deploy.js
const StreamScheduler = artifacts.require("StreamScheduler");
const ConstantFlowAgreement = artifacts.require("IConstantFlowAgreementV1");
const Superfluid = artifacts.require("ISuperfluid");
// import deployFramework from "@superfluid-finance/ethereum-contracts/scripts/deploy-framework";
// import deployTestToken from "@superfluid-finance/ethereum-contracts/scripts/deploy-test-token";
// import deploySuperToken from "@superfluid-finance/ethereum-contracts/scripts/deploy-super-token";

// export const errorHandler = (type, err) => {
//     if (err) console.error("Deploy " + type + " Error: ", err);
// };

// export async function deployFrameworkAndTokens() {
//     try {
//         const [Deployer] = (await ethers.getSigners()).map(x => x.address);
//         await deployFramework(x => errorHandler("Framework", x), {
//             web3: global.web3,
//             from: Deployer,
//         });
//         await deployTestToken(
//             x => errorHandler("TestToken", x),
//             [":", "fDAI"],
//             {
//                 web3: global.web3,
//                 from: Deployer,
//             },
//         );
//         await deploySuperToken(
//             x => errorHandler("SuperToken", x),
//             [":", "fDAI"],
//             {
//                 web3: global.web3,
//                 from: Deployer,
//             },
//         );
//     } catch (err) {
//         console.error(err);
//     }
// }

module.exports = async function (deployer) {
    // deployFrameworkAndTokens();
    await deployer.deploy(StreamScheduler, ConstantFlowAgreement, Superfluid);
};
