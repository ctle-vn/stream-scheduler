// SPDX-License-Identifier: AGPLv3
pragma solidity ^0.8.0;

import { Test } from "forge-std/test.sol";
import { IERC1820Registry } from "@openzeppelin/contracts/utils/introspection/IERC1820Registry.sol";
import { SuperToken, Superfluid, ConstantFlowAgreementV1, InstantDistributionAgreementV1, SuperTokenFactory, SuperfluidFrameworkDeployer, ERC20PresetMinterPauser } from "@superfluid-finance/ethereum-contracts/contracts/utils/SuperfluidFrameworkDeployer.sol";
import { ERC1820RegistryCompiled } from "@superfluid-finance/ethereum-contracts/contracts/libs/ERC1820RegistryCompiled.sol";
import { CFAv1Library } from "@superfluid-finance/ethereum-contracts/contracts/apps/CFAv1Library.sol";
import { IDAv1Library } from "@superfluid-finance/ethereum-contracts/contracts/apps/IDAv1Library.sol";

/// @title Superfluid Framework
/// @author jtriley.eth
/// @notice This is NOT for deploying public nets, but rather only for tesing envs
contract SuperfluidTester is Test {
    uint256 internal constant INIT_TOKEN_BALANCE = type(uint128).max;
    uint256 internal constant INIT_SUPER_TOKEN_BALANCE = type(uint64).max;
    address internal constant admin = address(0x420);
    address internal constant alice = address(0x421);
    address internal constant bob = address(0x422);
    address[] internal TEST_ACCOUNTS = [admin, alice, bob];
    uint256 internal immutable N_TESTERS;

    /// @dev Everything you need from framework is in it. See `README.md` for more.
    SuperfluidFrameworkDeployer internal immutable sfDeployer;
    SuperfluidFrameworkDeployer.Framework internal sf;
    ERC20PresetMinterPauser internal token;
    SuperToken internal superToken;
    uint256 private _expectedTotalSupply = 0;

    constructor(uint8 nTesters) {
        require(nTesters <= TEST_ACCOUNTS.length, "too many testers");
        N_TESTERS = nTesters;
        // everything will be deployed as if `admin` was the message sender of each
        vm.startPrank(admin);
        // Deploy ERC1820Registry by 'etching' the bytecode into the address
        // mother of god this can not be real
        vm.etch(ERC1820RegistryCompiled.at, ERC1820RegistryCompiled.bin);
        sfDeployer = new SuperfluidFrameworkDeployer();
        sf = sfDeployer.getFramework();
        vm.stopPrank();
    }

    function setUp() public virtual {
        (token, superToken) = sfDeployer.deployWrapperSuperToken("FTT", "FTT");

        for (uint256 i = 0; i < N_TESTERS; ++i) {
            token.mint(TEST_ACCOUNTS[i], INIT_TOKEN_BALANCE);

            vm.startPrank(TEST_ACCOUNTS[i]);
            token.approve(address(superToken), INIT_SUPER_TOKEN_BALANCE);
            superToken.upgrade(INIT_SUPER_TOKEN_BALANCE);
            _expectedTotalSupply += INIT_SUPER_TOKEN_BALANCE;
            vm.stopPrank();
        }
    }
}
