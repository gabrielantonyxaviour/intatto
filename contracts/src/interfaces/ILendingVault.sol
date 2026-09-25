// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice The USDG side: an ERC-4626 vault whose assets are idle USDG plus what its markets lent out.
interface ILendingVault {
    event Lent(address indexed market, address indexed to, uint256 amount);
    event DeficitRecognised(address indexed market, address indexed borrower, uint256 amount, uint256 sharePriceBefore, uint256 sharePriceAfter);

    /// @notice Registered markets only: sends `amount` idle USDG to `to` as a loan.
    function lend(address to, uint256 amount) external;

    /// @notice Registered markets only: records a written-off remainder (the market already reduced its debt).
    function recordDeficit(address borrower, uint256 amount, uint256 sharePriceBefore) external;

    /// @notice USDG held by the vault and available to lend or withdraw.
    function idle() external view returns (uint256);

    /// @notice Sum of every deficit ever recognised (6 decimals).
    function totalDeficit() external view returns (uint256);
}
