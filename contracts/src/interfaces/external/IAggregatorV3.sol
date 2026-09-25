// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Chainlink push feed (USDG/USD on X Layer: 8 decimals, 24h heartbeat).
interface IAggregatorV3 {
    function decimals() external view returns (uint8);

    function description() external view returns (string memory);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
