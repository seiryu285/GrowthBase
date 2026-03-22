// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ReceiptAnchor {
    event ReceiptAnchored(
        bytes32 indexed receiptHash,
        bytes32 indexed policyHash,
        bytes32 indexed artifactHash,
        uint256 timestamp
    );

    function anchor(
        bytes32 receiptHash,
        bytes32 policyHash,
        bytes32 artifactHash
    ) external {
        emit ReceiptAnchored(receiptHash, policyHash, artifactHash, block.timestamp);
    }
}
