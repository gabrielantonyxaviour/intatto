// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Pauses one ticker around a split or dividend multiplier activation.
/// Paused from `activationAt - window` until a price posted after activation is consistent
/// with the new multiplier. The pause blocks borrow and liquidation for that ticker only.
interface ICorporateActionGuard {
    struct PendingAction {
        uint64 activationAt;
        uint256 expectedMultiplier;
        /// Multiplier and price captured when the keeper posted the action.
        uint256 preActionMultiplier;
        uint256 preActionPrice;
        bool active;
    }

    event ActionPosted(uint64 activationAt, uint256 expectedMultiplier, uint256 preActionMultiplier, uint256 preActionPrice);
    event ActionResolved(uint64 activationAt, uint256 newMultiplier, uint256 postActionPrice);
    event ActionCleared(uint64 activationAt);

    function isPaused() external view returns (bool);

    function pendingAction() external view returns (PendingAction memory);
}
