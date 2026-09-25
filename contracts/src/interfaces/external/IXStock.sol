// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

/// @notice The subset of the xStocks (Backed auto-fee) token Intatto reads.
/// balanceOf is already rebased by the multiplier.
interface IXStock is IERC20 {
    /// @notice The correct pause getter is isPaused(), not paused().
    function isPaused() external view returns (bool);

    function multiplier() external view returns (uint256);

    function newMultiplier() external view returns (uint256);

    function newMultiplierActivationTime() external view returns (uint256);

    function getCurrentMultiplier()
        external
        view
        returns (uint256 currentMultiplier, uint256 periodsPassed, uint256 currentMultiplierNonce);
}

/// @notice The issuer's non-rebasing ERC-4626 wrapper (e.g. wNVDAx).
/// shares = assets * 1e18 / multiplier; previewWithdraw rounds DOWN, so exits use redeem().
interface IWrappedXStock is IERC4626 {
    function isPaused() external view returns (bool);
}
