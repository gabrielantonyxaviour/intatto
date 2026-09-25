// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Credit caps sized from sampled exit depth on the ticker's pool.
/// The keeper posts a target from QuoterV2 sell quotes inside a slippage budget times a haircut.
/// A lower cap applies immediately; a higher cap rises at most a fixed step per hour.
interface IDepthCaps {
    event CapPosted(address indexed market, uint256 targetCapUsdg, uint256 sliceUsdg, uint256 effectiveCapUsdg);

    /// @notice Effective cap on total USDG debt against `market` right now (6 decimals).
    function capOf(address market) external view returns (uint256);

    /// @notice Largest USDG value one liquidation slice may sell into the pool (6 decimals).
    function sliceOf(address market) external view returns (uint256);
}
