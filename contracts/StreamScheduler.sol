// SPDX-License-Identifier: AGPLv3
pragma solidity ^0.8.0;

import { ISuperToken, ISuperfluid } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperToken.sol";
import { IConstantFlowAgreementV1 } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import { CFAv1Library } from "@superfluid-finance/ethereum-contracts/contracts/apps/CFAv1Library.sol";

/**
 * @title Stream scheduler contract
 * @author Superfluid
 */
contract StreamScheduler {
    IConstantFlowAgreementV1 public _cfa;
    ISuperfluid public _host; // host
    mapping(bytes32 => bool) public streamOrderHashes;
    uint256 public streamOrderLength;

    using CFAv1Library for CFAv1Library.InitData;
    CFAv1Library.InitData public cfaV1; //initialize cfaV1 variable

    constructor(IConstantFlowAgreementV1 cfa, ISuperfluid host) {
        _cfa = cfa;
        _host = host;
        streamOrderLength = 0;
        // Check cfa and host address to be non zero.
        assert(address(_host) != address(0));
        assert(address(_cfa) != address(0));

        //initialize InitData struct, and set equal to cfaV1
        cfaV1 = CFAv1Library.InitData(host, cfa);
    }

    /**
     * @dev Stream order event executed by bot.
     * @param receiver The account who will be receiving the stream
     * @param superToken The superToken to be streamed
     * @param startTime The timestamp when the stream should start (or 0 if starting not required)
     * @param flowRate The flowRate for the stream (or 0 if starting not required)
     * @param endTime The timestamp when the stream should stop (or 0 if closing not required)
     * @param userData Arbitrary UserData to be added to the stream (or bytes(0) if no data needed)
     */
    event CreateStreamOrder(
        address indexed receiver,
        address indexed sender,
        ISuperToken superToken,
        uint256 startTime,
        int96 flowRate,
        uint256 endTime,
        bytes userData
    );

    /**
     * @dev Stream order event executed by bot.
     * @param receiver The account who will be receiving the stream
     * @param superToken The superToken to be streamed
     * @param startTime The timestamp when the stream should start (or 0 if starting not required)
     * @param flowRate The flowRate for the stream (or 0 if starting not required)
     * @param endTime The timestamp when the stream should stop (or 0 if closing not required)
     * @param userData Arbitrary UserData to be added to the stream (or bytes(0) if no data needed)
     */
    event ExecuteCreateStream(
        address indexed receiver,
        address indexed sender,
        ISuperToken superToken,
        uint256 startTime,
        int96 flowRate,
        uint256 endTime,
        bytes userData
    );

    /**
     * @dev Stream order event executed by bot.
     * @param receiver The account who will be receiving the stream
     * @param superToken The superToken to be streamed
     * @param startTime The timestamp when the stream should start (or 0 if starting not required)
     * @param flowRate The flowRate for the stream (or 0 if starting not required)
     * @param endTime The timestamp when the stream should stop (or 0 if closing not required)
     * @param userData Arbitrary UserData to be added to the stream (or bytes(0) if no data needed)
     */
    event ExecuteUpdateStream(
        address indexed receiver,
        address indexed sender,
        ISuperToken superToken,
        uint256 startTime,
        int96 flowRate,
        uint256 endTime,
        bytes userData
    );

    /**
     * @dev Stream order event executed by bot.
     * @param receiver The account who will be receiving the stream
     * @param superToken The superToken to be streamed
     * @param startTime The timestamp when the stream should start (or 0 if starting not required)
     * @param flowRate The flowRate for the stream (or 0 if starting not required)
     * @param endTime The timestamp when the stream should stop (or 0 if closing not required)
     * @param userData Arbitrary UserData to be added to the stream (or bytes(0) if no data needed)
     */
    event ExecuteDeleteStream(
        address indexed receiver,
        address indexed sender,
        ISuperToken superToken,
        uint256 startTime,
        int96 flowRate,
        uint256 endTime,
        bytes userData
    );

    /**
     * @dev Setup a stream order, can be create, update or delete.
     * @param receiver The account who will be receiving the stream
     * @param superToken The superToken to be streamed
     * @param startTime The timestamp when the stream should start (or 0 if starting not required)
     * @param flowRate The flowRate for the stream (or 0 if starting not required)
     * @param endTime The timestamp when the stream should stop (or 0 if closing not required)
     * @param userData Arbitrary UserData to be added to the stream (or bytes(0) if no data needed)
     */
    function createStreamOrder(
        address receiver,
        ISuperToken superToken,
        uint256 startTime,
        int96 flowRate,
        uint256 endTime,
        bytes memory userData
    ) external {
        // Check that receiver is not the same as sender
        require(
            receiver != msg.sender,
            "Receiver cannot be the same as sender."
        );

        require(
            // solhint-disable-next-line not-rely-on-time
            (startTime > block.timestamp && endTime > startTime) ||
                (startTime == 0 && endTime != 0) ||
                (startTime != 0 && endTime == 0),
            "Stream time window is invalid."
        );
        // // Check if hash exists first.
        // require(
        //     !streamOrderHashes[
        //         keccak256(
        //             abi.encodePacked(
        //                 msg.sender,
        //                 receiver,
        //                 superToken,
        //                 startTime,
        //                 endTime
        //             )
        //         )
        //     ],
        //     "Stream order already exists."
        // );
        streamOrderHashes[
            keccak256(
                abi.encodePacked(
                    msg.sender,
                    receiver,
                    superToken,
                    startTime,
                    endTime
                )
            )
        ] = true;
        streamOrderLength++;
        emit CreateStreamOrder(
            receiver,
            msg.sender,
            superToken,
            startTime,
            flowRate,
            endTime,
            userData
        );
    }

    /**
     * @dev Executes a create stream order.
     * @param receiver The account who will be receiving the stream
     * @param superToken The superToken to be streamed
     * @param startTime The timestamp when the stream should start (or 0 if starting not required)
     * @param flowRate The flowRate for the stream (or 0 if starting not required)
     * @param endTime The timestamp when the stream should stop (or 0 if closing not required)
     * @param userData Arbitrary UserData to be added to the stream (or bytes(0) if no data needed)
     */
    function executeCreateStream(
        address receiver,
        ISuperToken superToken,
        uint256 startTime,
        int96 flowRate,
        uint256 endTime,
        bytes memory userData
    ) external {
        // Check start time and end time is a valid time window.
        require(
            // solhint-disable-next-line not-rely-on-time
            (startTime > block.timestamp && endTime > startTime) ||
                (startTime == 0 && endTime != 0) ||
                (startTime != 0 && endTime == 0),
            "Stream time window is invalid."
        );

        // Check if hash exists first.
        require(
            streamOrderHashes[
                keccak256(
                    abi.encodePacked(
                        msg.sender,
                        receiver,
                        superToken,
                        startTime,
                        endTime
                    )
                )
            ],
            "Stream order does not exist."
        );

        // Create a flow accordingly as per the stream order data.
        cfaV1.host.callAgreement(
            cfaV1.cfa,
            abi.encodeCall(
                cfaV1.cfa.createFlowByOperator,
                (superToken, msg.sender, receiver, flowRate, new bytes(0))
            ),
            new bytes(0)
        );
        // If there are no further operations (endTime isn’t specified) then the data should be deleted.
        if (endTime == 0) {
            delete streamOrderHashes[
                keccak256(
                    abi.encodePacked(
                        msg.sender,
                        receiver,
                        superToken,
                        startTime,
                        endTime
                    )
                )
            ];
            streamOrderLength--;
        }
        emit ExecuteCreateStream(
            receiver,
            msg.sender,
            superToken,
            startTime,
            flowRate,
            endTime,
            userData
        );
    }

    /**
     * @dev Executes an update stream order.
     * @param receiver The account who will be receiving the stream
     * @param superToken The superToken to be streamed
     * @param startTime The timestamp when the stream should start (or 0 if starting not required)
     * @param flowRate The flowRate for the stream (or 0 if starting not required)
     * @param endTime The timestamp when the stream should stop (or 0 if closing not required)
     * @param userData Arbitrary UserData to be added to the stream (or bytes(0) if no data needed)
     */
    function executeUpdateStream(
        address receiver,
        ISuperToken superToken,
        uint256 startTime,
        int96 flowRate,
        uint256 endTime,
        bytes memory userData
    ) external {
        require(
            // solhint-disable-next-line not-rely-on-time
            (startTime > block.timestamp && endTime > startTime) ||
                (startTime == 0 && endTime != 0) ||
                (startTime != 0 && endTime == 0),
            "Stream time window is invalid."
        );
        // Will work exactly as the create version, except this should be used if a stream already exists,
        require(
            streamOrderHashes[
                keccak256(
                    abi.encodePacked(
                        msg.sender,
                        receiver,
                        superToken,
                        startTime,
                        endTime
                    )
                )
            ],
            "Stream order does not exist."
        );
        // and will update the flowRate of the stream to match the stream order data.
        cfaV1.host.callAgreement(
            cfaV1.cfa,
            abi.encodeCall(
                cfaV1.cfa.updateFlowByOperator,
                (superToken, msg.sender, receiver, flowRate, new bytes(0))
            ),
            new bytes(0)
        );
        emit ExecuteUpdateStream(
            receiver,
            msg.sender,
            superToken,
            startTime,
            flowRate,
            endTime,
            userData
        );
    }

    /**
     * @dev Executes a delete stream order.
     * @param receiver The account who will be receiving the stream
     * @param superToken The superToken to be streamed
     * @param startTime The timestamp when the stream should start (or 0 if starting not required)
     * @param flowRate The flowRate for the stream (or 0 if starting not required)
     * @param endTime The timestamp when the stream should stop (or 0 if closing not required)
     * @param userData Arbitrary UserData to be added to the stream (or bytes(0) if no data needed)
     */
    function executeDeleteStream(
        address receiver,
        ISuperToken superToken,
        uint256 startTime,
        int96 flowRate,
        uint256 endTime,
        bytes memory userData
    ) external {
        // Check if the endTime is in the past. Close the stream. Delete the stream order data.
        require(
            // solhint-disable-next-line not-rely-on-time
            endTime > block.timestamp, // End time is in the past
            "Stream order end time is in the past."
        );

        require(
            streamOrderHashes[
                keccak256(
                    abi.encodePacked(
                        msg.sender,
                        receiver,
                        superToken,
                        startTime,
                        endTime
                    )
                )
            ],
            "Stream order does not exist."
        );
        cfaV1.host.callAgreement(
            cfaV1.cfa,
            abi.encodeCall(
                cfaV1.cfa.deleteFlowByOperator,
                (superToken, msg.sender, receiver, new bytes(0))
            ),
            new bytes(0)
        );
        delete streamOrderHashes[
            keccak256(
                abi.encodePacked(
                    msg.sender,
                    receiver,
                    superToken,
                    startTime,
                    endTime
                )
            )
        ];
        streamOrderLength--;
        emit ExecuteDeleteStream(
            receiver,
            msg.sender,
            superToken,
            startTime,
            flowRate,
            endTime,
            userData
        );
    }

    function getStreamOrderHashesLength() public view returns (uint256) {
        return streamOrderLength;
    }

    function getStreamOrderHashesByValue(bytes32 value)
        public
        view
        returns (bool)
    {
        return streamOrderHashes[value];
    }
}
