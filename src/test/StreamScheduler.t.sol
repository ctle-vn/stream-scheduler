// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import { ISuperToken } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperToken.sol";
import { SuperfluidTester, Superfluid, ConstantFlowAgreementV1, CFAv1Library, SuperTokenFactory } from "../test/SuperfluidTester.sol";
import { StreamScheduler } from "../StreamScheduler.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Example Super Token Test
/// @author ctle-vn, SuperfluidTester taken from jtriley.eth
/// @notice For demonstration only. You can delete this file.
contract StreamSchedulerTest is SuperfluidTester {
    event CreateStreamOrder(
        address indexed receiver,
        address indexed sender,
        ISuperToken superToken,
        uint256 startTime,
        int96 flowRate,
        uint256 endTime,
        bytes userData
    );
    event ExecuteCreateStream(
        address receiver,
        address sender,
        ISuperToken superToken,
        uint256 startTime,
        int96 flowRate,
        uint256 endTime,
        bytes userData
    );

    /// @dev This is required by solidity for using the CFAv1Library in the tester
    using CFAv1Library for CFAv1Library.InitData;

    /// @dev Example Stream Scheduler to test
    StreamScheduler internal streamScheduler = new StreamScheduler(sf.cfa);

    /// @dev Constants for Testing
    uint256 internal startTime = block.timestamp + 1;
    uint256 testNumber;

    constructor() SuperfluidTester(3) {}

    function testCreateStreamOrderWithExplicitTimeWindow() public {
        vm.expectEmit(true, true, false, true);
        emit CreateStreamOrder(
            alice,
            address(this),
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        vm.expectCall(
            address(streamScheduler),
            abi.encodeCall(
                streamScheduler.createStreamOrder,
                (
                    alice,
                    superToken,
                    startTime,
                    1000,
                    startTime + 3600,
                    bytes("0x00")
                )
            )
        );
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        assertTrue(
            streamScheduler.getStreamOrderHashesByValue(
                keccak256(
                    abi.encodePacked(
                        address(this),
                        alice,
                        superToken,
                        startTime,
                        startTime + 3600
                    )
                )
            )
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 1);
    }

    function testCreateStreamOrderWithZeroTimes() public {
        vm.expectEmit(true, true, false, true);
        emit CreateStreamOrder(
            alice,
            address(this),
            superToken,
            uint256(0),
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        vm.expectCall(
            address(streamScheduler),
            abi.encodeCall(
                streamScheduler.createStreamOrder,
                (
                    alice,
                    superToken,
                    uint256(0),
                    1000,
                    startTime + 3600,
                    bytes("0x00")
                )
            )
        );
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            uint256(0),
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        assertTrue(
            streamScheduler.getStreamOrderHashesByValue(
                keccak256(
                    abi.encodePacked(
                        address(this),
                        alice,
                        superToken,
                        uint256(0),
                        startTime + 3600
                    )
                )
            )
        );
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            startTime,
            1000,
            uint256(0),
            bytes("0x00")
        );
        assertTrue(
            streamScheduler.getStreamOrderHashesByValue(
                keccak256(
                    abi.encodePacked(
                        address(this),
                        alice,
                        superToken,
                        startTime,
                        uint256(0)
                    )
                )
            )
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 2);
    }

    function testFailedCreateStreamOrderWhenDuplicateStreamOrder() public {
        vm.expectEmit(true, true, false, true);
        emit CreateStreamOrder(
            alice,
            address(this),
            superToken,
            uint256(0),
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        vm.expectCall(
            address(streamScheduler),
            abi.encodeCall(
                streamScheduler.createStreamOrder,
                (
                    alice,
                    superToken,
                    uint256(0),
                    1000,
                    startTime + 3600,
                    bytes("0x00")
                )
            )
        );
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            uint256(0),
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        assertTrue(
            streamScheduler.getStreamOrderHashesByValue(
                keccak256(
                    abi.encodePacked(
                        address(this),
                        alice,
                        superToken,
                        uint256(0),
                        startTime + 3600
                    )
                )
            )
        );
        // Expect revert on when duplicate stream order is attempted.
        vm.expectRevert(bytes("Stream order already exists"));
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            uint256(0),
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 1);
    }

    function testFailedCreateStreamOrderWhenSenderSameAsReceiver() public {
        // Expect revert on receiver same as sender.
        vm.expectRevert(bytes("Receiver cannot be the same as sender"));
        streamScheduler.createStreamOrder(
            address(this),
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 0);
    }

    function testFailedCreateStreamOrderWhenTimeWindowInvalid() public {
        // Should fail since start time is in past.
        vm.expectRevert(bytes("Stream time window is invalid"));
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            startTime - 100000,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 0);

        // Should fail since start and end are both 0.
        vm.expectRevert(bytes("Stream time window is invalid"));
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            0,
            1000,
            0,
            bytes("0x00")
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 0);

        // Should fail since start time is exactly block.timestamp.
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            block.timestamp,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 0);
    }

    // Test executeCreateStream
    // function testExecuteCreateStream() public {
    //     vm.startPrank(admin);
    //     sf.cfaLib.createFlow(alice, superToken, 1000);
    //     vm.stopPrank();
    // vm.expectEmit(true, true, false, true);
    // emit ExecuteCreateStream(
    //     address(this),
    //     alice,
    //     superToken,
    //     startTime,
    //     1000,
    //     startTime + 3600,
    //     bytes("0x00")
    // );
    // vm.expectCall(
    //     address(streamScheduler),
    //     abi.encodeCall(
    //         streamScheduler.executeCreateStream,
    //         (
    //             alice,
    //             superToken,
    //             startTime,
    //             1000,
    //             startTime + 3600,
    //             bytes("0x00")
    //         )
    //     )
    // );
    // streamScheduler.executeCreateStream(
    //     alice,
    //     superToken,
    //     startTime,
    //     1000,
    //     startTime + 3600,
    //     bytes("0x00")
    // );
    // assertTrue(
    //     streamScheduler.getStreamOrderHashesByValue(
    //         keccak256(
    //             abi.encodePacked(
    //                 address(this),
    //                 alice,
    //                 superToken,
    //                 startTime,
    //                 startTime + 3600
    //             )
    //         )
    //     )
    // );
    // assertTrue(streamScheduler.getStreamOrderHashesLength() == 1);
    // }
}
