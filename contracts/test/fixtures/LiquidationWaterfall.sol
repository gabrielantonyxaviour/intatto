// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Vm} from "forge-std/Vm.sol";
import {BoundedLiquidator} from "../../src/BoundedLiquidator.sol";
import {ICollateralMarket} from "../../src/interfaces/ICollateralMarket.sol";
import {ILendingVault} from "../../src/interfaces/ILendingVault.sol";
import {IGapReserve} from "../../src/interfaces/IGapReserve.sol";
import {ISessionRisk} from "../../src/interfaces/ISessionRisk.sol";
import {IntattoFixture} from "./IntattoFixture.sol";

/// @notice The keeper's liquidation runs through the real BoundedLiquidator and pool, and the loss waterfall read
/// back from the events: slice proceeds -> debt repaid + penalty -> gap reserve -> lender deficit.
abstract contract LiquidationWaterfall is IntattoFixture {
    struct Waterfall {
        uint256 slices;
        uint256 sold;
        uint256 proceeds;
        uint256 repaid;
        uint256 penalty;
        uint256 covered;
        uint256 deficit;
        uint256 shortfall;
        uint256 recognised;
    }

    function _expectNotLiquidatable(address borrower) internal {
        vm.expectRevert(BoundedLiquidator.NotLiquidatable.selector);
        vm.prank(keeper);
        liquidator.liquidate(market, borrower);
    }

    /// @dev The keeper liquidates until no collateral is left. Each slice's USDG out must equal QuoterV2's quote
    /// for that exact sale taken just before it: the collateral sold at the real pool's price.
    function _liquidateAll(address borrower) internal returns (Waterfall memory) {
        vm.recordLogs();
        for (uint256 left = 1; left > 0;) {
            BoundedLiquidator.Plan memory p = liquidator.previewSlice(market, borrower);
            assertFalse(p.waiting, "pool above the floor");
            uint256 quoted = _quoteSell(p.shares, p.sqrtPriceLimitX96);
            vm.prank(keeper);
            (uint256 sold, uint256 proceeds) = liquidator.liquidate(market, borrower);
            assertEq(sold, p.shares, "full fill");
            assertEq(proceeds, quoted, "QuoterV2 quote for the same sale");
            (left,) = market.positionOf(borrower);
        }
        return _waterfall(vm.getRecordedLogs());
    }

    /// @dev Checks each slice against its settlement and sums the loss waterfall from the recorded events.
    function _waterfall(Vm.Log[] memory logs) internal view returns (Waterfall memory w) {
        uint256 settled;
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].topics.length == 0) continue;
            bytes32 topic = logs[i].topics[0];
            if (topic == ICollateralMarket.LiquidationSettled.selector) {
                // proceeds, repaid, penalty, surplus, reserveCovered, deficit
                uint256[6] memory v = abi.decode(logs[i].data, (uint256[6]));
                assertEq(v[1] + v[2] + v[3], v[0], "proceeds = repaid + penalty + surplus");
                (settled, w.repaid, w.penalty) = (v[0], w.repaid + v[1], w.penalty + v[2]);
                (w.covered, w.deficit) = (w.covered + v[4], w.deficit + v[5]);
            } else if (topic == BoundedLiquidator.SliceExecuted.selector) {
                // session, sharesSold, proceeds, oraclePrice, floorPrice
                uint256[5] memory v = abi.decode(logs[i].data, (uint256[5]));
                assertEq(v[0], uint256(ISessionRisk.Session.OPEN), "OPEN-session slice");
                assertEq(v[4], v[3] * (10_000 - liquidator.openFloorBps()) / 10_000, "the open floor");
                assertGe(v[2], v[1] * v[4] / 1e18, "proceeds at or above the floor");
                assertEq(v[2], settled, "slice proceeds settled");
                (w.slices, w.sold, w.proceeds) = (w.slices + 1, w.sold + v[1], w.proceeds + v[2]);
            } else if (topic == IGapReserve.ShortfallCovered.selector) {
                (uint256 requested,) = abi.decode(logs[i].data, (uint256, uint256));
                w.shortfall += requested;
            } else if (topic == ILendingVault.DeficitRecognised.selector) {
                (uint256 amount,,) = abi.decode(logs[i].data, (uint256, uint256, uint256));
                w.recognised += amount;
            }
        }
    }
}
