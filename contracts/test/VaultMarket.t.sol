// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CollateralMarket} from "../src/CollateralMarket.sol";
import {CollateralMarketBase} from "../src/CollateralMarketBase.sol";
import {LendingVault} from "../src/LendingVault.sol";
import {ILendingVault} from "../src/interfaces/ILendingVault.sol";
import {GapReserve} from "../src/GapReserve.sol";
import {InterestRateModel} from "../src/InterestRateModel.sol";
import {MarketLens} from "../src/MarketLens.sol";
import {ISessionRisk} from "../src/interfaces/ISessionRisk.sol";
import {IXStock, IWrappedXStock} from "../src/interfaces/external/IXStock.sol";
import {MockERC20, MockXStock, MockWrappedXStock} from "./mocks/MockTokens.sol";
import {
    MockSessionRisk, MockPriceSource, MockCorporateActionGuard, MockDepthCaps
} from "./mocks/MockControllers.sol";

contract VaultMarketTest is Test {
    MockERC20 usdg;
    MockXStock token;
    MockWrappedXStock wrapper;
    LendingVault vault;
    GapReserve reserve;
    MockSessionRisk session;
    MockPriceSource price;
    MockCorporateActionGuard guard;
    MockDepthCaps caps;
    InterestRateModel rates;
    CollateralMarket market;
    MarketLens lens;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address keeper = makeAddr("keeper");

    uint256 constant MULT = 1.5e18; // a non-1 multiplier: 1 wrapper share = 1.5 tokens
    uint256 constant PRICE = 200e18; // $200 per token

    function setUp() public {
        usdg = new MockERC20("USDG", "USDG", 6);
        token = new MockXStock("NVDAx");
        token.setMultiplier(MULT);
        wrapper = new MockWrappedXStock(token);
        vault = new LendingVault(IERC20(address(usdg)));
        reserve = new GapReserve(IERC20(address(usdg)), address(vault));
        session = new MockSessionRisk();
        price = new MockPriceSource(PRICE);
        guard = new MockCorporateActionGuard();
        caps = new MockDepthCaps();
        rates = new InterestRateModel();
        market = new CollateralMarket(
            CollateralMarketBase.Config({
                symbol: "NVDAx",
                token: IXStock(address(token)),
                wrapper: IWrappedXStock(address(wrapper)),
                usdg: IERC20(address(usdg)),
                vault: vault,
                sessionRisk: session,
                priceSource: price,
                corporateActionGuard: guard,
                depthCaps: caps,
                gapReserve: reserve,
                rateModel: rates
            })
        );
        vault.addMarket(address(market));
        reserve.setMarket(address(market), true);
        market.setLiquidator(address(this));
        lens = new MarketLens();

        _lend(alice, 1000e6);
        _lend(bob, 1000e6);
        token.mint(carol, 100e18);
        usdg.mint(carol, 10_000e6);
        vm.startPrank(carol);
        token.approve(address(market), type(uint256).max);
        usdg.approve(address(market), type(uint256).max);
        vm.stopPrank();
    }

    function _lend(address who, uint256 amount) internal {
        usdg.mint(who, amount);
        vm.startPrank(who);
        usdg.approve(address(vault), amount);
        vault.deposit(amount, who);
        vm.stopPrank();
    }

    function _depositAndBorrow(uint256 tokens, uint256 debt) internal {
        vm.startPrank(carol);
        market.addCollateral(tokens);
        if (debt > 0) market.borrow(debt);
        vm.stopPrank();
    }

    function test_deposit() public {
        vm.prank(carol);
        uint256 shares = market.addCollateral(10e18);
        assertEq(shares, 10e18 * 1e18 / MULT, "shares = assets * 1e18 / multiplier");
        (uint256 held,) = market.positionOf(carol);
        assertEq(held, shares);
        assertEq(wrapper.balanceOf(address(market)), shares, "held as wrapper shares");
        uint256 assets = wrapper.convertToAssets(shares);
        assertEq(market.valueOf(shares), assets * PRICE / 1e30, "value = convertToAssets(shares) * price");
        assertApproxEqAbs(market.valueOf(shares), 2000e6, 1, "10 tokens at $200, multiplier not applied twice");
        MarketLens.Account memory a = lens.account(market, carol);
        assertEq(a.valueUsdg, market.valueOf(shares));
        assertEq(a.borrowCapacity, a.valueUsdg * 5000 / 10_000);
    }

    function _expectRefusal(bytes memory err) internal {
        vm.prank(carol);
        vm.expectRevert(err);
        market.borrow(10e6);
        // repay and addCollateral never depend on the refusing guard
        vm.startPrank(carol);
        market.repay(1e6);
        market.addCollateral(1e18);
        vm.stopPrank();
    }

    function test_guards() public {
        _depositAndBorrow(10e18, 500e6);

        session.setSession(ISessionRisk.Session.UNKNOWN);
        _expectRefusal(abi.encodeWithSelector(CollateralMarketBase.UnknownSession.selector));
        session.setSession(ISessionRisk.Session.CLOSED);

        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(CollateralMarketBase.SessionLimit.selector, 3178, 3000));
        market.borrow(200e6); // (499 + 200) / 2200 = 31.8% > 30% closed-market limit
        session.setSession(ISessionRisk.Session.HALTED);
        vm.prank(carol);
        vm.expectPartialRevert(CollateralMarketBase.SessionLimit.selector);
        market.borrow(1e6);
        session.setSession(ISessionRisk.Session.OPEN);

        price.setStatus(false, true, true);
        _expectRefusal(abi.encodeWithSelector(CollateralMarketBase.StalePrice.selector));
        price.setStatus(true, false, true);
        _expectRefusal(abi.encodeWithSelector(CollateralMarketBase.PriceOutOfBand.selector));
        price.setStatus(true, true, true);

        guard.setPaused(true);
        _expectRefusal(abi.encodeWithSelector(CollateralMarketBase.CorporateActionPending.selector));
        guard.setPaused(false);

        uint256 debt = market.totalDebt();
        caps.set(debt + 5e6, 1e6);
        _expectRefusal(abi.encodeWithSelector(CollateralMarketBase.TickerCapReached.selector, debt + 10e6, debt + 5e6));
        caps.set(type(uint128).max, type(uint128).max);

        price.setStatus(true, true, false);
        _expectRefusal(abi.encodeWithSelector(CollateralMarketBase.UsdgOffPeg.selector));
        price.setStatus(true, true, true);

        vm.prank(carol);
        market.borrow(10e6); // all guards pass again
    }

    function test_threshold_fixed() public {
        _depositAndBorrow(10e18, 990e6); // 49.5% LTV at $200
        price.setPrice(160e18); // 61.9% LTV: below the 65% threshold
        ISessionRisk.Session[5] memory states = [
            ISessionRisk.Session.OPEN,
            ISessionRisk.Session.EXTENDED,
            ISessionRisk.Session.CLOSED,
            ISessionRisk.Session.HALTED,
            ISessionRisk.Session.CORPORATE_ACTION
        ];
        for (uint256 i; i < states.length; i++) {
            session.setSession(states[i]);
            assertFalse(market.isLiquidatable(carol), "safe position stays safe in every session");
        }
        price.setPrice(150e18); // 66% LTV: above the threshold
        for (uint256 i; i < states.length; i++) {
            session.setSession(states[i]);
            assertTrue(market.isLiquidatable(carol), "unsafe position is liquidatable in every session");
        }
    }

    function test_waterfall() public {
        uint256 debt = 990e6;
        _depositAndBorrow(10e18, debt);
        usdg.mint(address(this), 100e6);
        usdg.approve(address(reserve), 100e6);
        reserve.fund(100e6);

        price.setPrice(100e18); // collateral now worth $1000 against $990 debt
        (uint256 shares,) = market.positionOf(carol);
        market.seize(carol, shares);
        uint256 proceeds = 700e6; // a gap: the sale recovers $700
        usdg.mint(address(this), proceeds);
        usdg.approve(address(market), proceeds);

        uint256 assetsBefore = vault.totalAssets();
        uint256 aliceBefore = vault.convertToAssets(vault.balanceOf(alice));
        uint256 bobBefore = vault.convertToAssets(vault.balanceOf(bob));

        vm.expectEmit(true, true, false, false, address(vault));
        emit ILendingVault.DeficitRecognised(address(market), carol, 0, 0, 0);
        (uint256 repaid, uint256 covered, uint256 deficit) = market.settle(carol, proceeds, keeper);

        uint256 penalty = proceeds - repaid < repaid * 500 / 10_000 ? proceeds - repaid : repaid * 500 / 10_000;
        assertEq(repaid, proceeds * 10_000 / 10_500, "repay first, penalty from proceeds");
        assertEq(usdg.balanceOf(keeper), penalty / 2, "keeper gets half the penalty");
        assertEq(covered, 100e6 + penalty - penalty / 2, "reserve (seed + penalty half) pays first");
        assertEq(reserve.balance(), 0, "reserve drained");
        assertEq(deficit, debt - repaid - covered, "remainder is the deficit");
        assertEq(vault.totalAssets(), assetsBefore - deficit, "share value falls by exactly the remainder");
        assertEq(market.debtOf(carol), 0);
        assertEq(vault.totalDeficit(), deficit);
        uint256 aliceLoss = aliceBefore - vault.convertToAssets(vault.balanceOf(alice));
        uint256 bobLoss = bobBefore - vault.convertToAssets(vault.balanceOf(bob));
        assertEq(aliceLoss, bobLoss, "equal loss per share");
        assertApproxEqAbs(aliceLoss + bobLoss, deficit, 2, "pro rata");
        assertEq(vault.deficitCount(), 1);
    }

    function test_issuer_pause() public {
        _depositAndBorrow(10e18, 500e6);
        token.setPaused(true);
        vm.prank(carol);
        vm.expectRevert(CollateralMarketBase.IssuerPaused.selector);
        market.borrow(10e6);
        vm.expectRevert(CollateralMarketBase.IssuerPaused.selector);
        market.seize(carol, 1);
        assertTrue(market.liquidationPaused());
        vm.prank(carol);
        market.repay(100e6);
        assertApproxEqAbs(market.debtOf(carol), 400e6, 1);
        token.setPaused(false);
        wrapper.setPaused(true);
        vm.prank(carol);
        vm.expectRevert(CollateralMarketBase.IssuerPaused.selector);
        market.borrow(10e6);
        vm.prank(carol);
        market.repay(type(uint256).max);
        assertEq(market.debtOf(carol), 0);
    }

    function test_withdraw_and_interest() public {
        _depositAndBorrow(10e18, 500e6);
        vm.warp(block.timestamp + 365 days);
        uint256 debt = market.debtOf(carol);
        assertGt(debt, 500e6, "interest accrues");
        price.setStatus(false, true, true);
        vm.prank(carol);
        vm.expectRevert(CollateralMarketBase.StalePrice.selector);
        market.withdrawCollateral(1e18, false);
        vm.prank(carol);
        market.repay(type(uint256).max);
        assertGt(reserve.balance(), 0, "reserve factor funds GapReserve");
        assertApproxEqAbs(vault.totalAssets() + reserve.balance(), 2000e6 + (debt - 500e6), 2);
        (uint256 shares,) = market.positionOf(carol);
        vm.prank(carol);
        uint256 out = market.withdrawCollateral(shares, true); // no debt: no price needed
        assertApproxEqAbs(out, 10e18, 1);
    }
}
