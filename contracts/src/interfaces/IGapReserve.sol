// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Seeded USDG reserve that pays a liquidation shortfall before lenders do.
/// Funded by the operator's seed, the reserve factor on interest and half of each liquidation penalty.
/// The penalty is income, not loss capital: it only ever arrives here after a slice settles.
interface IGapReserve {
    event ShortfallCovered(address indexed market, uint256 requested, uint256 covered);

    /// @notice Registered markets only. Sends min(shortfall, balance) USDG to the lending vault.
    /// @return covered USDG actually sent.
    function cover(uint256 shortfall) external returns (uint256 covered);

    /// @notice USDG held (6 decimals).
    function balance() external view returns (uint256);
}
