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
    /// @dev This is required by solidity for using the CFAv1Library in the tester
    using CFAv1Library for CFAv1Library.InitData;

    /// @dev Example Stream Scheduler to test
    StreamScheduler internal streamScheduler;

    /// @dev Constants for Testing
    address internal constant admin = address(1);
    address internal constant someOtherPerson = address(2);
    uint256 internal startTime = block.timestamp + 1;
    uint256 testNumber;
    ISuperToken token;

    constructor() SuperfluidTester(admin) {}

    function setUp() public {
        streamScheduler = new StreamScheduler(sf.cfa);
        // access SuperTokenFactory
        sf.superTokenFactory;

        // create pure super token contract
        token = ISuperToken(
            sf.superTokenFactory.createSuperTokenLogic(sf.host)
        );
        token.initialize(
            IERC20(0x0000000000000000000000000000000000000000), // no underlying/wrapped token
            18, // shouldn't matter if there's no wrapped token
            "name",
            "FAKE"
        );
    }

    function testCreateStreamOrderWithExplicitTimeWindow() public {
        vm.expectEmit(true, true, false, true);
        emit CreateStreamOrder(
            address(someOtherPerson),
            address(this),
            token,
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
                    someOtherPerson,
                    token,
                    startTime,
                    1000,
                    startTime + 3600,
                    bytes("0x00")
                )
            )
        );
        streamScheduler.createStreamOrder(
            someOtherPerson,
            token,
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
                        address(someOtherPerson),
                        token,
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
            address(someOtherPerson),
            address(this),
            token,
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
                    someOtherPerson,
                    token,
                    uint256(0),
                    1000,
                    startTime + 3600,
                    bytes("0x00")
                )
            )
        );
        streamScheduler.createStreamOrder(
            someOtherPerson,
            token,
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
                        address(someOtherPerson),
                        token,
                        uint256(0),
                        startTime + 3600
                    )
                )
            )
        );
        streamScheduler.createStreamOrder(
            someOtherPerson,
            token,
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
                        address(someOtherPerson),
                        token,
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
            address(someOtherPerson),
            address(this),
            token,
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
                    someOtherPerson,
                    token,
                    uint256(0),
                    1000,
                    startTime + 3600,
                    bytes("0x00")
                )
            )
        );
        streamScheduler.createStreamOrder(
            someOtherPerson,
            token,
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
                        address(someOtherPerson),
                        token,
                        uint256(0),
                        startTime + 3600
                    )
                )
            )
        );
        // Expect revert on when duplicate stream order is attempted.
        vm.expectRevert(bytes("Stream order already exists"));
        streamScheduler.createStreamOrder(
            someOtherPerson,
            token,
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
            token,
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
            address(someOtherPerson),
            token,
            startTime - 100000,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 0);

        // Should fail since start and end are both 0.
        vm.expectRevert(bytes("Stream time window is invalid"));
        streamScheduler.createStreamOrder(
            address(someOtherPerson),
            token,
            0,
            1000,
            0,
            bytes("0x00")
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 0);

        // Should fail since start time is exactly block.timestamp.
        streamScheduler.createStreamOrder(
            address(someOtherPerson),
            token,
            block.timestamp,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 0);
    }
}
