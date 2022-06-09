// SPDX-License-Identifier: AGPLv3
pragma solidity ^0.8.0;

import { ISuperToken } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperToken.sol";
import { IConstantFlowAgreementV1 } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";

/**
 * @title Stream scheduler contract
 * @author Superfluid
 */
contract StreamScheduler {
    IConstantFlowAgreementV1 public cfa;
    mapping(bytes32 => bool) public streamOrderHashes;
    uint256 public streamOrderLength;

    constructor(IConstantFlowAgreementV1 _cfa) {
        cfa = _cfa;
        streamOrderLength = 0;
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
        address receiver,
        address sender,
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
        address receiver,
        address sender,
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
        address receiver,
        address sender,
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
        // Check if hash exists first.
        require(
            !streamOrderHashes[
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
            "Stream order already exists."
        );
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
        // Create a flow accordingly as per the stream order data.
        cfa.createFlow(superToken, receiver, flowRate, userData);
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
        cfa.updateFlow(superToken, receiver, flowRate, userData);
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
            endTime == 0 || endTime <= block.timestamp, // End time is in the past
            "Stream order end time is in the past."
        );
        cfa.deleteFlow(superToken, msg.sender, receiver, userData);
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
