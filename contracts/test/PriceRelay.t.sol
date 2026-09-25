// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PriceRelayAdapter} from "../src/PriceRelayAdapter.sol";
import {IPriceSource} from "../src/interfaces/IPriceSource.sol";
import {ISessionRisk} from "../src/interfaces/ISessionRisk.sol";
import {IWrappedXStock} from "../src/interfaces/external/IXStock.sol";
import {IAggregatorV3} from "../src/interfaces/external/IAggregatorV3.sol";
import {TickMath} from "../src/lib/TickMath.sol";
import {MockERC20, MockXStock, MockWrappedXStock} from "./mocks/MockTokens.sol";
import {MockUniswapV3Pool, MockAggregatorV3} from "./mocks/MockUniswap.sol";
import {MockSessionRisk} from "./mocks/MockControllers.sol";

/// Mocks only. The issuer multiplier is 1.0017 so a doubled multiplier or a missing one shows up in every value.
contract PriceRelayTest is Test {
    uint256 constant MULT = 1.0017e18;
    uint256 constant QUOTE = 180e18; // $180 per NVDAx
    uint64 constant T0 = 1_790_000_000;
    uint64 constant NOW = T0 + 60;

    address keeper = makeAddr("keeper");
    MockXStock xstock;
    MockWrappedXStock wrapper;
    MockERC20 usdg;
    MockAggregatorV3 feed;
    MockSessionRisk session;
    MockUniswapV3Pool pool;
    PriceRelayAdapter relay;

    function setUp() public {
        vm.warp(T0);
        xstock = new MockXStock("NVDAx");
        xstock.setMultiplier(MULT);
        wrapper = new MockWrappedXStock(xstock);
        usdg = new MockERC20("USDG", "USDG", 6);
        feed = new MockAggregatorV3();
        session = new MockSessionRisk(); // OPEN
        (pool, relay) = _deploy(address(usdg));
        _setTwap(pool, _wrap(QUOTE));
        assertTrue(_post(QUOTE, T0)); // first post: no MaxMove comparison
        vm.warp(NOW);
        feed.set(1e8, NOW);
    }

    function _deploy(address usdg_) internal returns (MockUniswapV3Pool p, PriceRelayAdapter r) {
        p = new MockUniswapV3Pool(address(wrapper), usdg_, 500);
        r = _relay(address(p), usdg_);
    }

    function _relay(address p, address usdg_) internal returns (PriceRelayAdapter) {
        return new PriceRelayAdapter(keeper, IWrappedXStock(address(wrapper)), p, usdg_, IAggregatorV3(address(feed)),
            ISessionRisk(address(session)));
    }

    /// Implied wrapper price: quote x convertToAssets(1e18) / 1e18, never the multiplier twice.
    function _wrap(uint256 quote) internal pure returns (uint256) {
        return quote * MULT / 1e18;
    }

    /// Sets the TWAP to the floor tick for `wrapperUsdE18` USD per 1e18 shares at USDG = $1, either token order.
    function _setTwap(MockUniswapV3Pool p, uint256 wrapperUsdE18) internal {
        uint256 usdgUnits = wrapperUsdE18 / 1e12; // 6-decimal USDG per 1e18 shares
        (uint256 amt0, uint256 amt1) =
            p.token0() == address(wrapper) ? (uint256(1e18), usdgUnits) : (usdgUnits, uint256(1e18));
        int24 tick = TickMath.getTickAtSqrtRatio(uint160(Math.sqrt(Math.mulDiv(amt1, 1 << 192, amt0))));
        p.setTicks(tick, tick);
    }

    function _twap(PriceRelayAdapter r) internal view returns (uint256 twap) {
        bool ok;
        (ok, twap) = r.twapWrapperPrice();
        assertTrue(ok, "twap unavailable");
    }

    function _bps(uint256 a, uint256 ref) internal pure returns (uint256) {
        return Math.mulDiv(a > ref ? a - ref : ref - a, 10_000, ref, Math.Rounding.Ceil);
    }

    function _post(uint256 quote, uint64 at) internal returns (bool) {
        vm.prank(keeper);
        return relay.post(quote, at);
    }

    /// Expects PriceRejected with exact fields, and that the stored price is untouched.
    function _rejects(PriceRelayAdapter.RejectReason why, uint256 quote, uint64 at, uint256 twap, uint256 dev)
        internal
    {
        vm.expectEmit(address(relay));
        emit PriceRelayAdapter.PriceRejected(uint8(why), quote, _wrap(quote), twap, dev, at);
        assertFalse(_post(quote, at));
        (uint256 price, uint64 fetchedAt) = relay.latestPrice();
        assertTrue(price == QUOTE && fetchedAt == T0 && relay.lastWrapperPrice() == _wrap(QUOTE), "state changed");
    }

    function test_post_revertsForNonKeeper() public {
        vm.expectRevert(PriceRelayAdapter.NotKeeper.selector);
        relay.post(QUOTE, NOW);
    }

    function test_reject_futureFetch() public {
        _rejects(PriceRelayAdapter.RejectReason.FutureFetch, QUOTE, NOW + 1, 0, 0);
    }

    function test_reject_staleFetch_olderThanLimit() public {
        vm.warp(T0 + 3600);
        feed.set(1e8, T0 + 3600);
        _rejects(PriceRelayAdapter.RejectReason.StaleFetch, QUOTE, T0 + 3600 - 301, 0, 0);
        _rejects(PriceRelayAdapter.RejectReason.StaleFetch, QUOTE * 2, T0 + 1, 0, 0); // stale is checked first
        assertTrue(_post(QUOTE, T0 + 3600 - 300)); // exactly at the limit is live
    }

    function test_reject_notNewer() public {
        _rejects(PriceRelayAdapter.RejectReason.NotNewer, QUOTE, T0, 0, 0);
    }

    function test_reject_usdgStale_beyond26h() public {
        feed.set(1e8, NOW - 26 hours - 1);
        _rejects(PriceRelayAdapter.RejectReason.UsdgStale, QUOTE, NOW, 0, 0);
        feed.set(1e8, NOW - 26 hours);
        assertTrue(_post(QUOTE, NOW));
    }

    function test_reject_usdgNonPositive() public {
        feed.set(0, NOW);
        _rejects(PriceRelayAdapter.RejectReason.UsdgStale, QUOTE, NOW, 0, 0);
        feed.set(-1, NOW);
        _rejects(PriceRelayAdapter.RejectReason.UsdgStale, QUOTE, NOW, 0, 0);
        assertFalse(relay.guardStatus().pegOk);
    }

    function test_reject_usdgFutureDatedOrNeverUpdated() public {
        feed.set(1e8, NOW + 1);
        _rejects(PriceRelayAdapter.RejectReason.UsdgStale, QUOTE, NOW, 0, 0);
        feed.set(1e8, 0);
        _rejects(PriceRelayAdapter.RejectReason.UsdgStale, QUOTE, NOW, 0, 0);
    }

    function test_reject_usdgOffPegBeyondOnePercent() public {
        feed.set(0.9899e8, NOW);
        _rejects(PriceRelayAdapter.RejectReason.UsdgOffPeg, QUOTE, NOW, 0, 0);
        feed.set(1.0101e8, NOW);
        _rejects(PriceRelayAdapter.RejectReason.UsdgOffPeg, QUOTE, NOW, 0, 0);
        (,, bool ok) = relay.usdgStatus();
        assertFalse(ok);
        feed.set(0.99e8, NOW); // exactly 1% is on peg
        assertTrue(_post(QUOTE, NOW));
    }

    function test_reject_twapUnavailable() public {
        pool.setMaxObservationAge(1799); // observe(1800) reverts "OLD"
        _rejects(PriceRelayAdapter.RejectReason.TwapUnavailable, QUOTE, NOW, 0, 0);
        (bool ok, uint256 twap) = relay.twapWrapperPrice();
        assertTrue(!ok && twap == 0);
        assertFalse(relay.guardStatus().inBand);
    }

    function test_reject_outOfBand_open_exactBoundary() public {
        uint256 twap = _twap(relay);
        uint256 inside = Math.mulDiv(twap * 10_300 / 10_000, 1e18, MULT); // wrapper price <= twap + 3.00%
        // Two wei more puts the wrapper price just past +3%: rounded UP it is 301 bps, so a floor would pass it.
        _rejects(PriceRelayAdapter.RejectReason.OutOfBand, inside + 2, NOW, twap, 301);
        assertTrue(_post(inside, NOW));
    }

    function test_band_widerWhenClosed() public {
        session.setSession(ISessionRisk.Session.CLOSED);
        uint256 far = QUOTE * 1090 / 1000; // 9% is outside even the 8% band
        _rejects(PriceRelayAdapter.RejectReason.OutOfBand, far, NOW, _twap(relay), _bps(_wrap(far), _twap(relay)));
        assertTrue(_post(QUOTE * 1035 / 1000, NOW)); // 3.5% passes the CLOSED band
    }

    function test_twap_convertsWithUsdgAnswerAndTokenOrder() public {
        uint256 target = _wrap(QUOTE);
        assertApproxEqRel(_twap(relay), target, 1e14); // within one tick (1 bp)
        // USDG below and above the wrapper address: the price must not invert.
        address[2] memory spots = [address(0x1000), address(type(uint160).max - 15)];
        for (uint256 i; i < 2; i++) {
            deployCodeTo("MockTokens.sol:MockERC20", abi.encode("USDG", "USDG", uint8(6)), spots[i]);
            (MockUniswapV3Pool p, PriceRelayAdapter r) = _deploy(spots[i]);
            assertEq(p.token0() == address(wrapper), i == 1);
            _setTwap(p, target);
            assertApproxEqRel(_twap(r), target, 1e14);
            vm.prank(keeper);
            assertTrue(r.post(QUOTE, NOW));
        }
        feed.set(0.995e8, NOW); // USDG at $0.995: the USD TWAP scales with the answer
        assertApproxEqRel(_twap(relay), target * 995 / 1000, 1e14);
    }

    function test_reject_maxMove() public {
        // The keeper alone cannot move the price more than maxMove: the TWAP moved only 14%, the quote 20%.
        session.setSession(ISessionRisk.Session.CLOSED); // 8% band, so the 20% quote is in band vs the +14% TWAP
        _setTwap(pool, _wrap(QUOTE * 114 / 100));
        uint256 quote = QUOTE * 120 / 100;
        uint256 twap = _twap(relay);
        _rejects(PriceRelayAdapter.RejectReason.MaxMove, quote, NOW, twap, _bps(_wrap(quote), twap));
        uint256 ok = QUOTE * 114 / 100;
        assertTrue(_post(ok, NOW));
    }

    function test_gapConfirmedByTwap_isFollowed() public {
        // A 45% gap the pool's own TWAP confirms is accepted in one post, so liquidation never stalls.
        uint256 quote = QUOTE * 55 / 100;
        _setTwap(pool, _wrap(quote));
        assertTrue(_post(quote, NOW));
        assertEq(relay.lastWrapperPrice(), _wrap(quote));
    }

    function test_multiplierChange_isNotAMove() public {
        xstock.setMultiplier(MULT * 2); // 2:1 split: each token now holds half the value
        assertTrue(_post(QUOTE / 2, NOW));
        assertEq(relay.impliedWrapperPrice(), _wrap(QUOTE)); // quote x multiplier once
    }

    function test_accept_storesValuesAndGuardStatus() public {
        uint256 quote = QUOTE * 101 / 100;
        uint256 twap = _twap(relay);
        vm.expectEmit(address(relay));
        uint256 move = _bps(_wrap(quote), _wrap(QUOTE));
        emit PriceRelayAdapter.PricePosted(quote, _wrap(quote), twap, _bps(_wrap(quote), twap), move, 1e8, NOW, 0);
        assertTrue(_post(quote, NOW));
        (uint256 price, uint64 fetchedAt) = relay.latestPrice();
        assertEq(price, quote);
        assertEq(fetchedAt, NOW);
        assertEq(relay.impliedWrapperPrice(), _wrap(quote));
        IPriceSource.GuardStatus memory s = relay.guardStatus();
        assertTrue(s.fresh && s.inBand && s.pegOk);
        (int256 answer, uint256 updatedAt, bool ok) = relay.usdgStatus();
        assertTrue(ok && answer == 1e8 && updatedAt == NOW);
        _setTwap(pool, _wrap(QUOTE * 110 / 100)); // stored price is now ~8% under the TWAP
        assertFalse(relay.guardStatus().inBand);
        vm.warp(NOW + 30 minutes); // priceLiveness boundary
        assertTrue(relay.guardStatus().fresh);
        vm.warp(NOW + 30 minutes + 1);
        assertFalse(relay.guardStatus().fresh);
    }

    function test_constructor_wiringGuardsDefaultsAndNoPrice() public {
        MockERC20 usdg18 = new MockERC20("USDG", "USDG", 18);
        address badDecimals = address(new MockUniswapV3Pool(address(wrapper), address(usdg18), 500));
        address wrongPair = address(new MockUniswapV3Pool(address(xstock), address(usdg), 500));
        vm.expectRevert(PriceRelayAdapter.WrongDecimals.selector);
        _relay(badDecimals, address(usdg18));
        vm.expectRevert(PriceRelayAdapter.PoolMismatch.selector);
        _relay(wrongPair, address(usdg));
        vm.expectRevert(PriceRelayAdapter.ZeroAddress.selector);
        _relay(address(pool), address(0));
        (, PriceRelayAdapter r) = _deploy(address(usdg));
        (uint256 price, uint64 at) = r.latestPrice();
        assertEq(price + at + r.impliedWrapperPrice(), 0);
        IPriceSource.GuardStatus memory s = r.guardStatus();
        assertFalse(s.fresh || s.inBand);
        assertTrue(s.pegOk);
        assertEq(r.keeper(), keeper);
        assertEq(r.owner(), address(this));
        assertEq(abi.encode(r.twapWindow(), r.maxFetchAge(), r.priceLiveness(), r.usdgMaxAge(), r.pegBps(),
            r.bandOpenBps(), r.bandOtherBps(), r.maxMoveBps()),
            abi.encode(1800, 5 minutes, 30 minutes, 26 hours, 100, 300, 800, 1500));
    }

    function test_setters_ownerOnlyBoundedAndEmit() public {
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, keeper));
        relay.setMaxMove(1000);
        vm.expectRevert(PriceRelayAdapter.ZeroAddress.selector);
        relay.setKeeper(address(0));
        vm.expectRevert(PriceRelayAdapter.InvalidBands.selector);
        relay.setBands(900, 800);
        vm.expectRevert(PriceRelayAdapter.InvalidBands.selector);
        relay.setBands(0, 800);
        vm.expectRevert(PriceRelayAdapter.InvalidMaxMove.selector);
        relay.setMaxMove(0);
        vm.expectRevert(PriceRelayAdapter.InvalidLiveness.selector);
        relay.setLiveness(31 minutes, 30 minutes);
        vm.expectRevert(PriceRelayAdapter.InvalidUsdgLimits.selector);
        relay.setUsdgLimits(26 hours, 0);
        vm.expectRevert(PriceRelayAdapter.InvalidUsdgLimits.selector);
        relay.setUsdgLimits(30 days + 1, 100);
        vm.expectRevert(PriceRelayAdapter.InvalidTwapWindow.selector);
        relay.setTwapWindow(59);
        vm.expectEmit(address(relay));
        emit PriceRelayAdapter.KeeperSet(address(this));
        relay.setKeeper(address(this));
        vm.expectEmit(address(relay));
        emit PriceRelayAdapter.BandsSet(200, 600);
        relay.setBands(200, 600);
        vm.expectEmit(address(relay));
        emit PriceRelayAdapter.MaxMoveSet(1000);
        relay.setMaxMove(1000);
        vm.expectEmit(address(relay));
        emit PriceRelayAdapter.LivenessSet(2 minutes, 10 minutes);
        relay.setLiveness(2 minutes, 10 minutes);
        vm.expectEmit(address(relay));
        emit PriceRelayAdapter.UsdgLimitsSet(30 days, 50); // the sandbox's widest staleness limit
        relay.setUsdgLimits(30 days, 50);
        vm.expectEmit(address(relay));
        emit PriceRelayAdapter.TwapWindowSet(900);
        relay.setTwapWindow(900);
        assertEq(abi.encode(relay.twapWindow(), relay.maxFetchAge(), relay.priceLiveness(), relay.usdgMaxAge(),
            relay.pegBps(), relay.bandOpenBps(), relay.bandOtherBps(), relay.maxMoveBps()),
            abi.encode(900, 2 minutes, 10 minutes, 30 days, 50, 200, 600, 1000));
        feed.set(1e8, NOW - 10 days); // older than 26h, inside the widened 30-day limit
        assertTrue(relay.post(QUOTE, NOW)); // the new keeper posts
    }
}
