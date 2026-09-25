// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPriceSource} from "./IPriceSource.sol";

/// @notice The liquidation seam between one collateral market and BoundedLiquidator.
/// Collateral is held as the issuer's non-rebasing ERC-4626 wrapper shares (e.g. wNVDAx);
/// debt is USDG (6 decimals).
interface ICollateralMarket {
    event Seized(address indexed borrower, address indexed liquidator, uint256 shares);
    event Restored(address indexed borrower, uint256 shares);
    event LiquidationSettled(
        address indexed borrower,
        address indexed keeper,
        uint256 proceeds,
        uint256 repaid,
        uint256 penalty,
        uint256 surplus,
        uint256 reserveCovered,
        uint256 deficit
    );

    /// @notice The wrapper token collateral is held in (what the liquidator sells).
    function collateralWrapper() external view returns (address);

    /// @notice USDG.
    function debtAsset() external view returns (address);

    function priceSource() external view returns (IPriceSource);

    /// @return collateralShares Wrapper shares held for the borrower.
    /// @return debt USDG owed including accrued interest (6 decimals).
    function positionOf(address borrower) external view returns (uint256 collateralShares, uint256 debt);

    /// @notice Debt above the fixed liquidation threshold of the collateral's value. Same in every session.
    function isLiquidatable(address borrower) external view returns (bool);

    /// @notice True when the issuer paused the token or wrapper, or a corporate action is pending.
    function liquidationPaused() external view returns (bool);

    /// @notice Liquidator only: moves `shares` of the borrower's collateral to the liquidator.
    function seize(address borrower, uint256 shares) external;

    /// @notice Liquidator only: returns unsold shares to the borrower's collateral.
    function restore(address borrower, uint256 shares) external;

    /// @notice Liquidator only: pulls `proceeds` USDG from the liquidator and runs the waterfall:
    /// repay debt, pay the penalty (keeper and reserve), return any surplus to the borrower, and when
    /// no collateral is left draw the gap reserve for the shortfall and recognise the remainder as a deficit.
    function settle(address borrower, uint256 proceeds, address keeper)
        external
        returns (uint256 repaid, uint256 reserveCovered, uint256 deficit);
}
