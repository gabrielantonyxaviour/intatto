// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {CollateralMarketBase} from "../src/CollateralMarketBase.sol";
import {MarketLens} from "../src/MarketLens.sol";
import {PriceRelayAdapter} from "../src/PriceRelayAdapter.sol";
import {ISessionRisk} from "../src/interfaces/ISessionRisk.sol";
import {IXStock} from "../src/interfaces/external/IXStock.sol";
import {LiquidationWaterfall} from "./fixtures/LiquidationWaterfall.sol";
import {UsCalendar} from "./fixtures/UsCalendar.sol";
import {ReplayData} from "./fixtures/ReplayData.sol";

/// Issuer-side calls of the real NVDAx (Backed auto-fee token) used to schedule a multiplier change.
interface IMultiplierAdmin {
    function multiplierUpdater() external view returns (address);
    function updateMultiplierValue(uint256 newMultiplier, uint256 oldMultiplier, uint256 activationTime) external;
}

/// @notice The protocol's five fork scenarios on X Layer mainnet at block 71,559,900 (the Solidity twin of
/// checks/fork/lib/scenarios.ts): real NVDAx, wNVDAx wrapper, wNVDAx/USDG pool, SwapRouter02, QuoterV2, USDG and
/// Chainlink USDG/USD; Intatto deployed fresh in setUp. Expected values are computed from contract reads.
/// forge test --root contracts --match-contract ForkScenarios --fork-url "${XLAYER_RPC_URL:-https://xlayerrpc.okx.com}"
contract ForkScenariosTest is LiquidationWaterfall {
    ISessionRisk.Session constant OPEN = ISessionRisk.Session.OPEN;

    function test_normal_borrow_repay() public {
        address burner = makeAddr("burner");
        uint256 okb = HOLDER.balance;
        _fund(burner, 10e18, 0, GAS_OKB);
        assertEq(HOLDER.balance, okb - GAS_OKB, "gas OKB came from the holder");
        uint256 nvdax = IERC20(NVDAX).balanceOf(burner);
        assertApproxEqAbs(nvdax, 10e18, 1, "10 NVDAx (the rebasing token rounds)");

        // Friday 05:35 ET, pre-market: EXTENDED allows 40%; borrow 39%.
        assertEq(uint8(session.currentSession()), uint8(ISessionRisk.Session.EXTENDED));
        uint256 maxLtv = session.maxLtvBps();
        assertEq(maxLtv, session.baseLtvBps(ISessionRisk.Session.EXTENDED));
        vm.startPrank(burner);
        IERC20(NVDAX).approve(address(market), nvdax);
        uint256 shares = market.addCollateral(nvdax);
        uint256 value = market.valueOf(shares);
        uint256 amount = value * (maxLtv - 100) / 10_000;
        market.borrow(amount);
        vm.stopPrank();

        MarketLens.Account memory a = lens.account(market, burner);
        assertEq(wrapper.balanceOf(address(market)), shares, "held as wrapper shares");
        assertEq(a.shares, shares);
        assertApproxEqAbs(a.assets, nvdax, 1);
        assertEq(a.valueUsdg, value);
        assertEq(a.debt, amount);
        assertEq(a.walletUsdg, amount, "USDG received");
        assertEq(a.ltvBps, amount * 10_000 / value);
        assertApproxEqAbs(a.ltvBps, maxLtv - 100, 1);
        assertEq(a.maxLtvBps, maxLtv);
        assertEq(a.borrowCapacity, value * maxLtv / 10_000 - amount);
        assertEq(a.healthFactorE18, Math.mulDiv(value * market.LIQUIDATION_THRESHOLD_BPS(), 1e18, amount * 10_000));
        assertFalse(a.liquidatable);

        skip(6 hours);
        uint256 owed = market.debtOf(burner);
        assertGt(owed, amount, "interest accrued");
        _fund(burner, 0, owed - amount, 0); // the interest, from the holder
        uint256 reserveBefore = reserve.balance();
        assertEq(_repay(burner, type(uint256).max), owed, "repaid in full");
        assertEq(market.debtOf(burner), 0);
        uint256 interest = owed - amount;
        uint256 toReserve = reserve.balance() - reserveBefore;
        assertApproxEqAbs(toReserve, interest * market.RESERVE_FACTOR_BPS() / 10_000, 1, "reserve factor");
        assertEq(vault.totalAssets(), LENDER_A_USDG + LENDER_B_USDG + interest - toReserve, "lenders earn the rest");

        vm.prank(burner);
        uint256 out = market.withdrawCollateral(shares, true);
        assertApproxEqAbs(out, nvdax, 2, "~10 NVDAx back, unwrapped");
        assertApproxEqAbs(IERC20(NVDAX).balanceOf(burner), nvdax, 2);
        assertEq(market.totalShares(), 0);
    }

    function test_weekend_refuses_borrow_repay_works() public {
        address b = makeAddr("weekendBorrower");
        (uint256 shares, uint256 borrowed) = _openPosition(b, 10e18, 3_500);
        assertApproxEqAbs(lens.account(market, b).ltvBps, 3_500, 1);

        vm.warp(UsCalendar.SATURDAY_NOON);
        assertTrue(_tick(), "fresh weekend price accepted");
        (ISessionRisk.Session s, uint64 changedAt,) = session.lastPost();
        assertEq(uint8(s), uint8(ISessionRisk.Session.CLOSED));
        assertEq(changedAt, UsCalendar.WEEKEND_CLOSE, "period began Friday 20:00 ET");
        // CLOSED decays linearly from its start to the floor over the decay window: 3000 - 1000 * 12h / 64h.
        uint256 start = session.baseLtvBps(ISessionRisk.Session.CLOSED);
        uint256 floorBps = session.closedFloorBps();
        uint256 window = session.closedDecayDuration();
        uint256 maxLtv = floorBps + (start - floorBps) * (window - 12 hours) / window;
        assertEq(session.maxLtvBps(), maxLtv);

        uint256 debt = market.debtOf(b);
        assertGt(debt, borrowed, "weekend interest");
        uint256 ltvAfter = Math.mulDiv(debt + 1e6, 10_000, market.valueOf(shares), Math.Rounding.Ceil);
        vm.expectRevert(abi.encodeWithSelector(CollateralMarketBase.SessionLimit.selector, ltvAfter, maxLtv));
        vm.prank(b);
        market.borrow(1e6);

        assertEq(_repay(b, debt / 2), debt / 2, "repay needs no session or price");
        assertApproxEqAbs(market.debtOf(b), debt - debt / 2, 1);
        _fund(b, 1e18, 0, 0);
        uint256 extra = IERC20(NVDAX).balanceOf(b);
        vm.startPrank(b);
        IERC20(NVDAX).approve(address(market), extra);
        uint256 added = market.addCollateral(extra);
        vm.stopPrank();
        (uint256 held,) = market.positionOf(b);
        assertEq(held, shares + added, "collateral added on the weekend");
    }

    function test_corporate_action_pauses_then_resumes() public {
        address b = makeAddr("actionBorrower");
        (uint256 shares,) = _openPosition(b, 10e18, 3_000);
        (uint256 m0,,) = IXStock(NVDAX).getCurrentMultiplier();
        (uint256 quote,) = relay.latestPrice();
        uint256 holderTokens = IERC20(NVDAX).balanceOf(HOLDER);
        uint256 assets = wrapper.convertToAssets(shares);
        uint256 value = market.valueOf(shares);
        uint256 wrapperPrice = relay.lastWrapperPrice();

        // Simulated issuer action: the token's real multiplier updater schedules 10-for-1 in 20 minutes.
        uint64 at = uint64(block.timestamp + 20 minutes);
        vm.prank(IMultiplierAdmin(NVDAX).multiplierUpdater());
        IMultiplierAdmin(NVDAX).updateMultiplierValue(m0 * 10, m0, at);
        vm.prank(keeper);
        guard.postAction(at, m0 * 10);
        assertTrue(guard.isPaused(), "inside the 30-minute window");
        assertTrue(market.liquidationPaused());
        vm.expectRevert(CollateralMarketBase.CorporateActionPending.selector);
        vm.prank(b);
        market.borrow(1e6);
        // The seize path is closed: not even the registered liquidator can take collateral.
        vm.expectRevert(CollateralMarketBase.CorporateActionPending.selector);
        vm.prank(address(liquidator));
        market.seize(b, 1);

        vm.warp(at + 1 minutes);
        (uint256 current,,) = IXStock(NVDAX).getCurrentMultiplier();
        assertEq(current, m0 * 10, "activated");
        assertApproxEqAbs(IERC20(NVDAX).balanceOf(HOLDER), holderTokens * 10, 10, "holder balance rebased x10");
        assertApproxEqAbs(wrapper.convertToAssets(shares), assets * 10, 10, "same shares, 10x the tokens");

        _postSession();
        _expectOutOfBand(quote); // the stale pre-split quote implies 10x the pool's TWAP wrapper price
        assertTrue(guard.isPaused(), "still paused: no consistent post-activation price");
        // Borrow checks run in order; the stored pre-split quote fails the TWAP band before the guard is read.
        vm.expectRevert(CollateralMarketBase.PriceOutOfBand.selector);
        vm.prank(b);
        market.borrow(1e6);

        assertTrue(_postPrice(quote / 10), "post-split quote accepted");
        assertFalse(guard.isPaused());
        guard.resolve();
        assertFalse(guard.pendingAction().active);
        assertEq(guard.lastResolvedActivation(), at);
        assertApproxEqAbs(relay.lastWrapperPrice(), wrapperPrice, 10, "wrapper share value unchanged");
        assertApproxEqAbs(market.valueOf(shares), value, 1, "collateral value unchanged");
        uint256 usdg = IERC20(USDG).balanceOf(b);
        vm.prank(b);
        market.borrow(1e6);
        assertEq(IERC20(USDG).balanceOf(b), usdg + 1e6, "borrowing resumed");
    }

    function _expectOutOfBand(uint256 quote) internal {
        uint256 implied = Math.mulDiv(quote, wrapper.convertToAssets(1e18), 1e18);
        (, uint256 twap) = relay.twapWrapperPrice();
        vm.expectEmit(address(relay));
        emit PriceRelayAdapter.PriceRejected(uint8(PriceRelayAdapter.RejectReason.OutOfBand), quote, implied, twap,
            Math.mulDiv(implied - twap, 10_000, twap, Math.Rounding.Ceil), uint64(block.timestamp));
        assertFalse(_postPrice(quote), "relay rejected the quote");
    }

    function test_gap_2025_01_replay() public {
        _januaryGap(makeAddr("gapBorrower"));
    }

    /// @dev Friday OPEN borrower at 49.5% -> weekend CLOSED -> Monday open gap -> Monday close, the replay's moves
    /// applied to the fork's pool price. Returns the borrower's collateral shares.
    function _januaryGap(address b) internal returns (uint256 shares) {
        (uint256 fridayClose, uint256 mondayOpen, uint256 mondayClose) = ReplayData.januaryGap();
        vm.warp(UsCalendar.FRIDAY_OPEN + 1 minutes);
        assertTrue(_tick());
        assertEq(session.maxLtvBps(), session.baseLtvBps(OPEN), "Friday regular hours: 50%");
        (shares,) = _openPosition(b, 20e18, 4_950);
        uint256 seed = reserve.balance();

        vm.warp(UsCalendar.SATURDAY_NOON);
        assertTrue(_tick());
        assertEq(uint8(session.currentSession()), uint8(ISessionRisk.Session.CLOSED));
        _expectNotLiquidatable(b);

        emit log_named_uint("Monday open gap bps", 10_000 - mondayOpen * 10_000 / fridayClose);
        vm.warp(UsCalendar.MONDAY_OPEN); // the arbitrageur moves the pool at the open
        uint256 before = relay.lastWrapperPrice();
        assertEq(_stepDown(mondayOpen * 1e18 / fridayClose), 1, "one step: the open gap is under 14%");
        assertApproxEqRel(relay.lastWrapperPrice(), before * mondayOpen / fridayClose, 1e14, "relay moved by the gap");
        MarketLens.Account memory a = lens.account(market, b);
        assertEq(a.maxLtvBps, session.baseLtvBps(OPEN));
        assertGt(a.ltvBps, a.maxLtvBps, "above the OPEN borrow limit");
        assertLt(a.ltvBps, market.LIQUIDATION_THRESHOLD_BPS(), "below the fixed liquidation threshold");
        assertFalse(a.liquidatable);
        _expectNotLiquidatable(b);
        uint256 ltvAfter = Math.mulDiv(a.debt + 1e6, 10_000, a.valueUsdg, Math.Rounding.Ceil);
        vm.expectRevert(abi.encodeWithSelector(CollateralMarketBase.SessionLimit.selector, ltvAfter, a.maxLtvBps));
        vm.prank(b);
        market.borrow(1e6);
        assertEq(reserve.balance(), seed, "reserve untouched");
        assertEq(vault.totalDeficit(), 0);
        assertEq(_repay(b, a.debt / 100), a.debt / 100, "repay works");
        emit log_named_uint("Monday open LTV bps", a.ltvBps);

        vm.warp(UsCalendar.MONDAY_CLOSE - 1 hours);
        assertEq(_stepDown(mondayClose * 1e18 / mondayOpen), 1, "one step: the close move is under 14%");
        assertEq(uint8(session.currentSession()), uint8(OPEN));
        a = lens.account(market, b);
        assertLt(a.ltvBps, market.LIQUIDATION_THRESHOLD_BPS(), "the Jan 2025 gap is absorbed by the 65% threshold");
        _expectNotLiquidatable(b);
        assertEq(vault.totalDeficit(), 0);
        assertEq(reserve.totalCovered(), 0);
        emit log_named_uint("Monday close LTV bps", a.ltvBps);
    }

    function test_synthetic_gap_reserve_then_deficit() public {
        address b = makeAddr("gapBorrower");
        uint256 shares = _januaryGap(b);
        uint256 gapBps = ReplayData.syntheticGapBps();

        // Tuesday open: a 45% overnight gap. The relay admits at most 15% per post, so it is stepped in.
        vm.warp(UsCalendar.TUESDAY_OPEN);
        uint256 before = relay.lastWrapperPrice();
        emit log_named_uint("synthetic gap steps", _stepDown((10_000 - gapBps) * 1e14));
        assertApproxEqRel(relay.lastWrapperPrice(), before * (10_000 - gapBps) / 10_000, 1e14, "relay moved 45%");
        assertEq(uint8(session.currentSession()), uint8(OPEN));
        uint256 debt = market.debtOf(b);
        assertGt(debt, market.valueOf(shares), "under water");
        emit log_named_uint("LTV before liquidation bps", debt * 10_000 / market.valueOf(shares));

        uint256 reserveBefore = reserve.balance();
        uint256 feesBefore = market.reserveFeesOwed();
        uint256 vaultBefore = vault.totalAssets();
        uint256 supply = vault.totalSupply();
        uint256[2] memory held = [vault.balanceOf(lenderA), vault.balanceOf(lenderB)];
        uint256[2] memory worth = [vault.convertToAssets(held[0]), vault.convertToAssets(held[1])];
        Waterfall memory w = _liquidateAll(b);

        (uint256 left, uint256 owed) = market.positionOf(b);
        assertEq(left + owed, 0, "collateral gone, debt closed");
        assertEq(w.sold, shares);
        // The reserve's own accrued-interest share of the written-off debt is forgone (never a lender asset).
        uint256 forgone = debt - w.repaid - w.covered - w.deficit;
        assertLe(forgone, feesBefore, "only reserve interest is forgone");
        assertApproxEqAbs(w.repaid + w.covered + w.deficit + forgone, debt, 1, "debt = repaid + reserve + deficit + forgone reserve interest");
        assertEq(w.shortfall, w.covered + w.deficit, "reserve asked for the whole shortfall");
        assertGt(w.covered, reserveBefore, "reserve paid first: seed plus the penalty half");
        assertEq(reserve.balance(), 0, "reserve drained");
        assertEq(reserve.totalCovered(), w.covered);
        assertGt(w.deficit, 0);
        assertEq(w.recognised, w.deficit);
        assertEq(vault.totalDeficit(), w.deficit);
        assertEq(IERC20(USDG).balanceOf(keeper), w.penalty / 2, "keeper earned half the penalty");

        emit log_named_uint("slices", w.slices);
        emit log_named_uint("reserve covered", w.covered);
        emit log_named_uint("deficit recognised", w.deficit);

        // Lenders absorb what the vault lost, pro rata: the second lender loses the same per share.
        uint256 lost = vaultBefore - vault.totalAssets();
        emit log_named_uint("vault assets lost", lost);
        assertApproxEqAbs(worth[0] - vault.convertToAssets(held[0]), lost * held[0] / supply, 1, "lender A pro rata");
        assertApproxEqAbs(worth[1] - vault.convertToAssets(held[1]), lost * held[1] / supply, 1, "lender B pro rata");
        // The recognised deficit is exactly what lenders lost: the reserve's accrued-interest share of the written-off
        // debt was never a vault asset, so it is forgone rather than counted (fixed in CollateralMarket._writeOff).
        assertApproxEqAbs(lost, w.deficit, 2, "lenders lose exactly the recognised deficit");
    }
}
