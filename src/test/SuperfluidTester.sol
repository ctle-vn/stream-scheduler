// SPDX-License-Identifier: AGPLv3
pragma solidity ^0.8.0;

import { Test } from "forge-std/test.sol";
import { IERC1820Registry } from "@openzeppelin/contracts/utils/introspection/IERC1820Registry.sol";
import { SuperToken, Superfluid, ConstantFlowAgreementV1, IConstantFlowAgreementV1, InstantDistributionAgreementV1, SuperTokenFactory, SuperfluidFrameworkDeployer, ERC20PresetMinterPauser, ISuperfluid } from "@superfluid-finance/ethereum-contracts/contracts/utils/SuperfluidFrameworkDeployer.sol";
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

    ERC20PresetMinterPauser internal token;
    SuperToken internal superToken;

    uint256 private _expectedTotalSupply = 0;

    constructor(uint8 nTesters) {
        require(nTesters <= TEST_ACCOUNTS.length, "too many testers");
        N_TESTERS = nTesters;
    }
}
