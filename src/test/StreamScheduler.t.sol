// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import { ISuperToken } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperToken.sol";
import { FlowOperatorDefinitions } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import { ERC1820RegistryCompiled, SuperfluidFrameworkDeployer, SuperfluidTester, Superfluid, ISuperfluid, IConstantFlowAgreementV1, ConstantFlowAgreementV1, CFAv1Library, SuperTokenFactory } from "../test/SuperfluidTester.sol";
import { StreamScheduler } from "../../contracts/StreamScheduler.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC1820Registry } from "@openzeppelin/contracts/utils/introspection/IERC1820Registry.sol";

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
        address indexed receiver,
        address indexed sender,
        ISuperToken superToken,
        uint256 startTime,
        int96 flowRate,
        uint256 endTime,
        bytes userData
    );
    event ExecuteUpdateStream(
        address indexed receiver,
        address indexed sender,
        ISuperToken superToken,
        uint256 startTime,
        int96 flowRate,
        uint256 endTime,
        bytes userData
    );
    event ExecuteDeleteStream(
        address indexed receiver,
        address indexed sender,
        ISuperToken superToken,
        uint256 startTime,
        int96 flowRate,
        uint256 endTime,
        bytes userData
    );

    SuperfluidFrameworkDeployer internal immutable sfDeployer;
    SuperfluidFrameworkDeployer.Framework internal sf;
    ISuperfluid host;
    IConstantFlowAgreementV1 cfa;
    StreamScheduler internal streamScheduler;
    uint256 private _expectedTotalSupply = 0;

    /// @dev This is required by solidity for using the CFAv1Library in the tester
    using CFAv1Library for CFAv1Library.InitData;

    constructor() SuperfluidTester(3) {
        vm.startPrank(admin);
        vm.etch(ERC1820RegistryCompiled.at, ERC1820RegistryCompiled.bin);
        sfDeployer = new SuperfluidFrameworkDeployer();
        sf = sfDeployer.getFramework();
        host = sf.host;
        cfa = sf.cfa;
        vm.stopPrank();

        /// @dev Example Stream Scheduler to test
        streamScheduler = new StreamScheduler(cfa, host);
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

    /// @dev Constants for Testing
    uint256 internal startTime = block.timestamp + 1;
    uint256 testNumber;

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
                        startTime + 3600,
                        int96(1000)
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
                        startTime + 3600,
                        int96(1000)
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
                        uint256(0),
                        int96(1000)
                    )
                )
            )
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 2);
    }

    function testCannotCreateStreamOrderWhenDuplicateStreamOrder() public {
        vm.expectEmit(true, true, false, true);
        emit CreateStreamOrder(
            alice,
            address(this),
            superToken,
            uint256(0),
            int96(1000),
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
                    int96(1000),
                    startTime + 3600,
                    bytes("0x00")
                )
            )
        );
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            uint256(0),
            int96(1000),
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
                        startTime + 3600,
                        int96(1000)
                    )
                )
            )
        );
        // Expect revert on when duplicate stream order is attempted.
        vm.expectRevert(bytes("Stream order already exists."));
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            uint256(0),
            int96(1000),
            startTime + 3600,
            bytes("0x00")
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 1);
    }

    function testCannotCreateStreamOrderWhenSenderSameAsReceiver() public {
        // Expect revert on receiver same as sender.
        vm.expectRevert(bytes("Receiver cannot be the same as sender."));
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

    function testCannotCreateStreamOrderWhenTimeWindowInvalid() public {
        // Should fail since start time is in past.
        vm.expectRevert(bytes("Stream time window is invalid."));
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            startTime - 1,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 0);

        // Should fail since start and end are both 0.
        vm.expectRevert(bytes("Stream time window is invalid."));
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
        vm.expectRevert(bytes("Stream time window is invalid."));
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

    function testCannotExecuteCreateStreamWhenOrderDNE() public {
        // Expect revert on when order does not exist.
        vm.expectRevert(bytes("Stream order does not exist."));
        streamScheduler.executeCreateStream(
            alice,
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 0);
    }

    function testCannotExecuteDeleteStreamWhenOrderDNE() public {
        // Expect revert on when order does not exist.
        vm.expectRevert(bytes("Stream order does not exist."));
        streamScheduler.executeDeleteStream(
            alice,
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 0);
    }

    function testCannotExecuteUpdateStreamWhenOrderDNE() public {
        vm.expectRevert(bytes("Stream order does not exist."));
        streamScheduler.executeUpdateStream(
            alice,
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 0);
    }

    function testCannotExecuteCreateStreamWithInvalidPermissions() public {
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        vm.expectRevert(bytes("CFA: E_NO_OPERATOR_CREATE_FLOW"));
        streamScheduler.executeCreateStream(
            alice,
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
    }

    function testCannotExecuteCreateStreamWhenTimeWindowInvalid() public {
        // Expect revert on when start time is in past.
        vm.expectRevert(bytes("Stream time window is invalid."));
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            startTime - 1,
            1000,
            startTime + 3600,
            bytes("0x00")
        );

        // Expect revert on when start and end are both 0.
        vm.expectRevert(bytes("Stream time window is invalid."));
        streamScheduler.executeCreateStream(
            alice,
            superToken,
            0,
            1000,
            0,
            bytes("0x00")
        );

        // Expect revert on when start time is exactly block.timestamp.
        vm.expectRevert(bytes("Stream time window is invalid."));
        streamScheduler.executeCreateStream(
            alice,
            superToken,
            block.timestamp,
            1000,
            startTime + 3600,
            bytes("0x00")
        );

        // Expect revert on when start time is after end time.
        vm.expectRevert(bytes("Stream time window is invalid."));
        streamScheduler.executeCreateStream(
            alice,
            superToken,
            startTime + 3600,
            1000,
            startTime,
            bytes("0x00")
        );

        // Expect revert on when start time is after end time.
        vm.expectRevert(bytes("Stream time window is invalid."));
        streamScheduler.executeCreateStream(
            alice,
            superToken,
            startTime + 3600,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
    }

    function testCannotExecuteUpdateStreamWhenTimeWindowInvalid() public {
        // Expect revert on when start time is in past.
        vm.expectRevert(bytes("Stream time window is invalid."));
        streamScheduler.executeUpdateStream(
            alice,
            superToken,
            startTime - 1,
            1000,
            startTime + 3600,
            bytes("0x00")
        );

        // Expect revert on when start and end are both 0.
        vm.expectRevert(bytes("Stream time window is invalid."));
        streamScheduler.executeUpdateStream(
            alice,
            superToken,
            0,
            1000,
            0,
            bytes("0x00")
        );

        // Expect revert on when start time is exactly block.timestamp.
        vm.expectRevert(bytes("Stream time window is invalid."));
        streamScheduler.executeUpdateStream(
            alice,
            superToken,
            block.timestamp,
            1000,
            startTime + 3600,
            bytes("0x00")
        );

        // Expect revert on when start time is after end time.
        vm.expectRevert(bytes("Stream time window is invalid."));
        streamScheduler.executeUpdateStream(
            alice,
            superToken,
            startTime + 3600,
            1000,
            startTime,
            bytes("0x00")
        );

        // Expect revert on when start time equal to end time.
        vm.expectRevert(bytes("Stream time window is invalid."));
        streamScheduler.executeUpdateStream(
            alice,
            superToken,
            startTime,
            1000,
            startTime,
            bytes("0x00")
        );
    }

    function testExecuteCreateStreamWithEndTimeZero() public {
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            startTime,
            1000,
            0,
            bytes("0x00")
        );

        host.callAgreement(
            cfa,
            abi.encodeCall(
                cfa.updateFlowOperatorPermissions,
                (
                    superToken,
                    address(streamScheduler),
                    FlowOperatorDefinitions.AUTHORIZE_FLOW_OPERATOR_CREATE,
                    1000,
                    new bytes(0)
                )
            ),
            new bytes(0)
        );

        vm.expectEmit(true, true, false, true);
        emit ExecuteCreateStream(
            alice,
            address(this),
            superToken,
            startTime,
            1000,
            0,
            bytes("0x00")
        );
        vm.expectCall(
            address(streamScheduler),
            abi.encodeCall(
                streamScheduler.executeCreateStream,
                (alice, superToken, startTime, 1000, 0, bytes("0x00"))
            )
        );
        streamScheduler.executeCreateStream(
            alice,
            superToken,
            startTime,
            1000,
            0,
            bytes("0x00")
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 0);
    }

    function testCannotExecuteDeleteStreamWhenEndTimeInvalid() public {
        // Expect revert on when end time is in past.
        vm.expectRevert(bytes("Stream order end time is in the past."));
        streamScheduler.executeDeleteStream(
            alice,
            superToken,
            startTime,
            1000,
            block.timestamp - 1,
            bytes("0x00")
        );

        // Expect revert on when end time is exactly block.timestamp.
        vm.expectRevert(bytes("Stream order end time is in the past."));
        streamScheduler.executeDeleteStream(
            alice,
            superToken,
            startTime,
            1000,
            block.timestamp,
            bytes("0x00")
        );

        // Expect revert on when end time is 0
        vm.expectRevert(bytes("Stream order end time is in the past."));
        streamScheduler.executeDeleteStream(
            alice,
            superToken,
            startTime,
            1000,
            0,
            bytes("0x00")
        );
    }

    function testCannotExecuteUpdateStreamDueToNoPermissions() public {
        host.callAgreement(
            cfa,
            abi.encodeCall(
                cfa.updateFlowOperatorPermissions,
                (
                    superToken,
                    address(streamScheduler),
                    FlowOperatorDefinitions.AUTHORIZE_FLOW_OPERATOR_CREATE,
                    1000,
                    new bytes(0)
                )
            ),
            new bytes(0)
        );
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        streamScheduler.executeCreateStream(
            alice,
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        vm.expectRevert(bytes("E_NO_OPERATOR_UPDATE_FLOW"));
        streamScheduler.executeUpdateStream(
            alice,
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
    }

    function testExecuteCreateStream() public {
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );

        host.callAgreement(
            cfa,
            abi.encodeCall(
                cfa.updateFlowOperatorPermissions,
                (
                    superToken,
                    address(streamScheduler),
                    FlowOperatorDefinitions.AUTHORIZE_FLOW_OPERATOR_CREATE,
                    1000,
                    new bytes(0)
                )
            ),
            new bytes(0)
        );

        vm.expectEmit(true, true, false, true);
        emit ExecuteCreateStream(
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
                streamScheduler.executeCreateStream,
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
        streamScheduler.executeCreateStream(
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
                        startTime + 3600,
                        int96(1000)
                    )
                )
            )
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 1);
    }

    function testExecuteUpdateStream() public {
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        host.callAgreement(
            cfa,
            abi.encodeCall(
                cfa.updateFlowOperatorPermissions,
                (
                    superToken,
                    address(streamScheduler),
                    FlowOperatorDefinitions.AUTHORIZE_FLOW_OPERATOR_CREATE,
                    1000,
                    new bytes(0)
                )
            ),
            new bytes(0)
        );
        streamScheduler.executeCreateStream(
            alice,
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );

        host.callAgreement(
            cfa,
            abi.encodeCall(
                cfa.updateFlowOperatorPermissions,
                (
                    superToken,
                    address(streamScheduler),
                    FlowOperatorDefinitions.AUTHORIZE_FLOW_OPERATOR_UPDATE,
                    1000,
                    new bytes(0)
                )
            ),
            new bytes(0)
        );

        vm.expectEmit(true, true, false, true);
        emit ExecuteUpdateStream(
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
                streamScheduler.executeUpdateStream,
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
        streamScheduler.executeUpdateStream(
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
                        startTime + 3600,
                        int96(1000)
                    )
                )
            )
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 1);
    }

    function testExecuteDeleteStream() public {
        streamScheduler.createStreamOrder(
            alice,
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        host.callAgreement(
            cfa,
            abi.encodeCall(
                cfa.updateFlowOperatorPermissions,
                (
                    superToken,
                    address(streamScheduler),
                    FlowOperatorDefinitions.AUTHORIZE_FLOW_OPERATOR_CREATE,
                    1000,
                    new bytes(0)
                )
            ),
            new bytes(0)
        );
        streamScheduler.executeCreateStream(
            alice,
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );

        host.callAgreement(
            cfa,
            abi.encodeCall(
                cfa.updateFlowOperatorPermissions,
                (
                    superToken,
                    address(streamScheduler),
                    FlowOperatorDefinitions.AUTHORIZE_FLOW_OPERATOR_DELETE,
                    1000,
                    new bytes(0)
                )
            ),
            new bytes(0)
        );

        vm.expectEmit(true, true, false, true);
        emit ExecuteDeleteStream(
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
                streamScheduler.executeDeleteStream,
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
        streamScheduler.executeDeleteStream(
            alice,
            superToken,
            startTime,
            1000,
            startTime + 3600,
            bytes("0x00")
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 0);
    }

    function testCannotExecuteDeleteStreamInvalidEndTime() public {
        vm.expectRevert(bytes("Stream order end time is in the past."));
        streamScheduler.executeDeleteStream(
            alice,
            superToken,
            startTime,
            1000,
            startTime - 1,
            bytes("0x00")
        );
        assertTrue(streamScheduler.getStreamOrderHashesLength() == 0);
    }
}
