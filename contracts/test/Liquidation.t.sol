// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {BoundedLiquidator} from "../src/BoundedLiquidator.sol";
import {ICollateralMarket} from "../src/interfaces/ICollateralMarket.sol";
import {ISessionRisk} from "../src/interfaces/ISessionRisk.sol";
import {IGapReserve} from "../src/interfaces/IGapReserve.sol";
import {IUniswapV3SwapCallback} from "../src/interfaces/external/IUniswapV3.sol";
import {TickMath} from "../src/lib/TickMath.sol";
import {OracleLibrary} from "../src/lib/OracleLibrary.sol";
import {MockCollateralMarket} from "./mocks/MockCollateralMarket.sol";
import {MockSessionRisk, MockPriceSource, MockDepthCaps, MockGapReserve} from "./mocks/MockControllers.sol";
import {MockERC20, MockXStock, MockWrappedXStock} from "./mocks/MockTokens.sol";
import {MockUniswapV3Pool} from "./mocks/MockUniswap.sol";

/// @dev A registered pool that pays no USDG and misbehaves: mode 1 asks for more than offered, 2 calls back twice.
contract EvilPool {
    address public immutable token0;
    address public immutable token1;
    uint24 public constant fee = 500;
    uint256 public immutable mode;

    constructor(address usdg, address wrapper, uint256 mode_) {
        (token0, token1, mode) = (usdg, wrapper, mode_);
    }

    function slot0() external pure returns (uint160, int24, uint16, uint16, uint16, uint8, bool) {
        return (TickMath.MIN_SQRT_RATIO + 1, 0, 0, 0, 0, 0, true); // any limit above this passes
    }

    function swap(address, bool, int256 amount, uint160, bytes calldata data) external returns (int256, int256) {
        int256 ask = mode == 1 ? amount + 1 : amount;
        IUniswapV3SwapCallback(msg.sender).uniswapV3SwapCallback(0, ask, data);
        if (mode == 2) IUniswapV3SwapCallback(msg.sender).uniswapV3SwapCallback(0, ask, data);
        return (0, ask);
    }
}

contract LiquidationTest is Test {
    BoundedLiquidator liq;
    MockCollateralMarket market;
    MockUniswapV3Pool pool;
    MockERC20 usdg;
    MockXStock nvda;
    MockWrappedXStock wrapper;
    MockPriceSource price;
    MockSessionRisk sessionRisk;
    MockDepthCaps caps;
    MockGapReserve reserve;
    uint256 saltNonce;
    address borrower = makeAddr("borrower");
    address keeper = makeAddr("keeper");
    uint256 constant ORACLE = 200.4e6; // 200 USD quote x 1.002 multiplier, USDG per 1e18 shares
    uint256 constant SLICE_USDG = 300e6;
    uint256 constant SLICE_SHARES = SLICE_USDG * 1e18 / ORACLE;
    ISessionRisk.Session constant OPEN = ISessionRisk.Session.OPEN;

    function setUp() public {
        _deploy(true); // the real NVDA pool order: USDG token0, wNVDAx token1
    }

    function _deploy(bool usdgIsToken0) internal {
        nvda = new MockXStock("NVDAx");
        nvda.setMultiplier(1.002e18);
        wrapper = new MockWrappedXStock(nvda);
        do {
            usdg = new MockERC20{salt: bytes32(saltNonce++)}("USDG", "USDG", 6);
        } while ((address(usdg) < address(wrapper)) != usdgIsToken0);
        price = new MockPriceSource(200e18);
        sessionRisk = new MockSessionRisk();
        caps = new MockDepthCaps();
        caps.set(type(uint128).max, SLICE_USDG);
        reserve = new MockGapReserve(IERC20(address(usdg)), makeAddr("vault"));
        market = new MockCollateralMarket(address(wrapper), address(usdg), price, IGapReserve(address(reserve)));
        pool = new MockUniswapV3Pool(address(wrapper), address(usdg), 500);
        liq = new BoundedLiquidator(sessionRisk, caps);
        liq.setMarket(m(), address(pool));
        market.setLiquidator(address(liq));
        usdg.mint(address(pool), 1e15);
        nvda.mint(address(this), 10.02e18);
        nvda.approve(address(wrapper), 10.02e18);
        assertEq(wrapper.deposit(10.02e18, address(market)), 10e18);
        market.open(borrower, 10e18, 1_800e6); // worth 2,004 USDG against a 65% threshold
    }

    function m() internal view returns (ICollateralMarket) {
        return ICollateralMarket(address(market));
    }

    function _liquidate() internal returns (uint256, uint256) {
        vm.prank(keeper);
        return liq.liquidate(m(), borrower);
    }

    function _liquidateReverts(bytes memory err) internal {
        vm.expectRevert(err);
        _liquidate();
    }

    /// @dev Spot at the tick nearest `usdgPerShare`; `_spotPrice` reads it back through OracleLibrary.
    function _setSpot(uint256 usdgPerShare) internal {
        bool usdg0 = pool.token0() == address(usdg);
        uint256 x192 = usdg0 ? Math.mulDiv(1e18, 1 << 192, usdgPerShare) : Math.mulDiv(usdgPerShare, 1 << 192, 1e18);
        int24 tick = TickMath.getTickAtSqrtRatio(uint160(Math.sqrt(x192)));
        pool.setTicks(tick, tick);
    }

    function _spotPrice() internal view returns (uint256) {
        return OracleLibrary.getQuoteAtTick(pool.spotTick(), 1e18, address(wrapper), address(usdg));
    }

    function _assertPosition(uint256 shares, uint256 debt) internal view {
        (uint256 s, uint256 d) = market.positionOf(borrower);
        assertEq(s, shares, "shares");
        assertEq(d, debt, "debt");
    }

    function test_closed_then_reopen() public {
        sessionRisk.setSession(ISessionRisk.Session.CLOSED);
        assertEq(liq.oracleWrapperPrice(m()), ORACLE);
        uint256 floor = ORACLE * 9_700 / 10_000;
        // CLOSED, spot below the floor: nothing sells, the slice waits and the position is untouched.
        _setSpot(190e6);
        assertLt(_spotPrice(), floor);
        vm.expectEmit(address(liq));
        emit BoundedLiquidator.SliceWaiting(address(market), borrower, 3, floor);
        (uint256 sold, uint256 out) = _liquidate();
        assertEq(sold + out, 0);
        _assertPosition(10e18, 1_800e6);
        assertEq(liq.waitingSince(m(), borrower), block.timestamp);
        // CLOSED, spot back above the floor: exactly one slice, no larger than the depth slice.
        vm.warp(block.timestamp + 1 hours);
        _setSpot(199e6);
        vm.expectEmit(true, true, false, false, address(liq));
        emit BoundedLiquidator.SliceExecuted(address(market), borrower, 3, 0, 0, ORACLE, floor);
        (sold, out) = _liquidate();
        assertEq(sold, SLICE_SHARES);
        assertGe(out, sold * floor / 1e18);
        _assertPosition(10e18 - sold, 1_800e6 - out * 10_000 / 10_500);
        assertEq(liq.waitingSince(m(), borrower), 0);
        // Still CLOSED: each further slice is bounded the same way.
        for (uint256 i; i < 2; i++) {
            vm.warp(block.timestamp + 10 minutes);
            (uint256 sharesBefore, uint256 debtBefore) = market.positionOf(borrower);
            (sold, out) = _liquidate();
            assertGt(sold, 0);
            assertLe(sold, SLICE_SHARES);
            assertGe(out, sold * floor / 1e18);
            _assertPosition(sharesBefore - sold, debtBefore - out * 10_000 / 10_500);
        }
        (uint256 left,) = market.positionOf(borrower);
        assertGt(left, SLICE_SHARES); // more than a slice remains while closed
        // Reopen: the rest is liquidated and the position is fully closed.
        sessionRisk.setSession(OPEN);
        (sold,) = _liquidate();
        assertEq(sold, left);
        _assertPosition(0, 0);
        assertEq(wrapper.balanceOf(address(liq)) + usdg.balanceOf(address(liq)), 0);
        assertGt(usdg.balanceOf(keeper), 0); // the caller was paid the keeper penalty
        assertGt(usdg.balanceOf(borrower), 0); // surplus returned
    }

    function test_paused_stale_or_healthy_revert() public {
        _setSpot(199e6);
        price.setStatus(false, true, true);
        _liquidateReverts(abi.encodeWithSelector(BoundedLiquidator.StalePrice.selector));
        price.setStatus(true, true, true);
        price.setPrice(0); // no accepted post yet
        _liquidateReverts(abi.encodeWithSelector(BoundedLiquidator.StalePrice.selector));
        price.setPrice(200e18);
        ISessionRisk.Session[3] memory paused =
            [ISessionRisk.Session.UNKNOWN, ISessionRisk.Session.HALTED, ISessionRisk.Session.CORPORATE_ACTION];
        for (uint256 i; i < 3; i++) {
            sessionRisk.setSession(paused[i]);
            _liquidateReverts(abi.encodeWithSelector(BoundedLiquidator.LiquidationPaused.selector));
        }
        sessionRisk.setSession(OPEN);
        market.setPaused(true); // issuer pause or pending corporate action
        _liquidateReverts(abi.encodeWithSelector(BoundedLiquidator.LiquidationPaused.selector));
        market.open(borrower, 10e18, 1_300e6); // healthy: 1,300 <= 65% of 2,004
        _liquidateReverts(abi.encodeWithSelector(BoundedLiquidator.NotLiquidatable.selector));
    }

    function test_timeout_widens_closed_floor() public {
        sessionRisk.setSession(ISessionRisk.Session.CLOSED);
        _setSpot(190e6); // ~5.2% under the oracle: below the 3% floor, above the 8% floor
        (uint256 sold, uint256 out) = _liquidate();
        uint256 t0 = block.timestamp;
        vm.warp(t0 + 6 hours - 1);
        (sold,) = _liquidate();
        assertEq(sold, 0);
        assertEq(liq.waitingSince(m(), borrower), t0); // the first wait keeps the clock
        vm.warp(t0 + 6 hours);
        uint256 wideFloor = ORACLE * 9_200 / 10_000;
        assertEq(liq.previewSlice(m(), borrower).floorPrice, wideFloor);
        (sold, out) = _liquidate();
        assertEq(sold, SLICE_SHARES);
        assertGe(out, sold * wideFloor / 1e18);
        assertEq(liq.waitingSince(m(), borrower), 0);
        // After a slice executes the floor is back at 3%: the next attempt waits and restarts the clock.
        (sold,) = _liquidate();
        assertEq(sold, 0);
        assertEq(liq.waitingSince(m(), borrower), block.timestamp);
        // A stale clock can be dropped once the borrower is healthy again, not before.
        vm.expectRevert(BoundedLiquidator.StillLiquidatable.selector);
        liq.clearWaiting(m(), borrower);
        price.setPrice(400e18);
        liq.clearWaiting(m(), borrower);
        assertEq(liq.waitingSince(m(), borrower), 0);
    }

    function test_partial_fill_restores_unsold() public {
        sessionRisk.setSession(OPEN);
        _setSpot(199e6);
        market.open(borrower, 10e18, 1_400e6); // debt + 5% penalty at the 15% floor needs < 10e18 shares
        uint256 planned = Math.mulDiv(1_470e6, 1e18, ORACLE * 8_500 / 10_000, Math.Rounding.Ceil);
        assertEq(liq.previewSlice(m(), borrower).shares, planned);
        pool.setMaxInput(0.5e18); // the pool fills only part of the slice
        vm.expectEmit(address(market));
        emit ICollateralMarket.Restored(borrower, planned - 0.5e18);
        (uint256 sold, uint256 out) = _liquidate();
        assertEq(sold, 0.5e18);
        assertGe(out, sold * (ORACLE * 8_500 / 10_000) / 1e18);
        _assertPosition(9.5e18, 1_400e6 - out * 10_000 / 10_500);
        assertEq(wrapper.balanceOf(address(market)), 9.5e18); // physically back; the pool holds the 0.5e18 sold
    }

    /// Both token orders: the limit nets exactly the floor after the fee (never less); the pool sells
    /// just past it on the good side and waits just past it on the bad side.
    function test_price_limit_both_token_orders() public {
        for (uint256 i; i < 2; i++) {
            _deploy(i == 0);
            sessionRisk.setSession(OPEN);
            usdg.mint(address(reserve), 100e6);
            uint256 floor = ORACLE * 8_500 / 10_000;
            (uint160 limit, bool zeroForOne) = liq.priceLimitOf(m(), floor);
            assertEq(zeroForOne, i == 1); // selling the wrapper as token0 pushes the price down
            uint256 limitNetE6 = zeroForOne  // USDG per 1e18 shares at the limit, net of the 0.05% fee, x 1e6
                ? Math.mulDiv(uint256(limit) * limit, 1e18 * uint256(999_500), 1 << 192)
                : Math.mulDiv(1e18 * uint256(999_500), 1 << 192, uint256(limit) * limit);
            assertGe(limitNetE6, floor * 1e6);
            assertApproxEqRel(limitNetE6, floor * 1e6, 1e6); // within 1e-12
            int24 t = TickMath.getTickAtSqrtRatio(limit);
            (int24 waitTick, int24 sellTick) = zeroForOne ? (t - 1, t + 2) : (t + 2, t - 1);
            pool.setTicks(waitTick, waitTick);
            assertLe(_spotPrice() * 9_995 / 10_000, floor);
            (uint256 sold, uint256 out) = _liquidate();
            assertEq(sold, 0);
            pool.setTicks(sellTick, sellTick);
            assertGt(_spotPrice() * 9_995 / 10_000, floor);
            (sold, out) = _liquidate();
            assertEq(sold, 10e18);
            assertGe(out, sold * floor / 1e18);
            _assertPosition(0, 0); // closed out: the shortfall drained the reserve, then became deficit
            assertTrue(usdg.balanceOf(address(reserve)) == 0 && market.totalDeficit() > 0);
        }
    }

    function test_callback_access_control() public {
        vm.prank(address(pool)); // the registered pool, outside a liquidation
        vm.expectRevert(BoundedLiquidator.UnauthorizedCallback.selector);
        liq.uniswapV3SwapCallback(0, 1, "");
        sessionRisk.setSession(OPEN);
        liq.setMarket(m(), address(new EvilPool(address(usdg), address(wrapper), 1)));
        _liquidateReverts(abi.encodeWithSelector(BoundedLiquidator.BadCallbackAmount.selector));
        liq.setMarket(m(), address(new EvilPool(address(usdg), address(wrapper), 2)));
        _liquidateReverts(abi.encodeWithSelector(BoundedLiquidator.UnauthorizedCallback.selector));
        liq.setMarket(m(), address(new EvilPool(address(usdg), address(wrapper), 0)));
        _liquidateReverts(abi.encodeWithSelector(BoundedLiquidator.MinOutNotMet.selector, 0, 1_703_400_000));
    }

    function test_admin_defaults_and_bounds() public {
        assertEq(liq.openFloorBps(), 1_500);
        assertEq(liq.closedFloorBps(), 300);
        assertEq(liq.closedTimeoutFloorBps(), 800);
        assertEq(liq.closedTimeout(), 6 hours);
        assertEq(liq.penaltyBps(), 500);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, keeper));
        liq.setFloors(1_000, 200, 500);
        vm.expectRevert(BoundedLiquidator.InvalidParam.selector);
        liq.setFloors(5_001, 300, 800);
        vm.expectRevert(BoundedLiquidator.InvalidParam.selector);
        liq.setFloors(1_500, 900, 800); // the closed floor may not exceed the timeout floor
        vm.expectRevert(BoundedLiquidator.InvalidParam.selector);
        liq.setClosedTimeout(14 minutes);
        vm.expectRevert(BoundedLiquidator.InvalidParam.selector);
        liq.setPenaltyBps(2_001);
        MockUniswapV3Pool wrong = new MockUniswapV3Pool(address(wrapper), address(nvda), 500);
        vm.expectRevert(BoundedLiquidator.PoolMismatch.selector); // the pool must pair the wrapper with USDG
        liq.setMarket(m(), address(wrong));
        liq.setMarket(m(), address(0));
        _liquidateReverts(abi.encodeWithSelector(BoundedLiquidator.UnknownMarket.selector));
    }
}
