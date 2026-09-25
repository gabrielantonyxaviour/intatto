// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {CorporateActionGuard as Guard} from "../src/CorporateActionGuard.sol";
import {ICorporateActionGuard as IGuard} from "../src/interfaces/ICorporateActionGuard.sol";
import {IXStock} from "../src/interfaces/external/IXStock.sol";
import {MockXStock} from "./mocks/MockTokens.sol";
import {MockPriceSource} from "./mocks/MockControllers.sol";

/// Prices are USD per 1e18 NVDAx units (18 decimals); multipliers are 1e18-scaled (1e18 = 1.0).
contract CorporateActionTest is Test {
    uint256 constant PRICE = 180e18; // $180 pre-split quote
    uint256 constant ONE = 1e18; // multiplier 1.0
    uint256 constant SPLIT = 10e18; // 10-for-1 split: multiplier 1.0 -> 10.0, quote 180 -> 18
    uint64 constant WINDOW = 30 minutes;

    MockXStock token;
    MockPriceSource ps;
    Guard guard;
    address keeper = makeAddr("keeper");
    address stranger = makeAddr("stranger");
    uint64 T;

    function setUp() public {
        vm.warp(1_750_000_000);
        token = new MockXStock("NVDAx");
        ps = new MockPriceSource(PRICE);
        guard = new Guard(keeper, IXStock(address(token)), ps);
        T = uint64(block.timestamp + 2 hours);
    }

    function _post(uint64 at, uint256 m) internal {
        vm.prank(keeper);
        guard.postAction(at, m);
    }

    /// One minute after activation, with the issuer multiplier switched to `m`.
    function _activate(uint256 m) internal {
        vm.warp(T + 60);
        token.setMultiplier(m);
    }

    function _assertAction(IGuard.PendingAction memory expected) internal view {
        assertEq(abi.encode(guard.pendingAction()), abi.encode(expected));
    }

    function test_defaultsAndConstructor() public {
        bytes memory params = abi.encode(guard.window(), guard.toleranceBps(), guard.keeper(), guard.owner());
        assertEq(params, abi.encode(WINDOW, 1000, keeper, address(this)));
        assertEq(guard.currentMultiplier(), ONE);
        assertFalse(guard.isPaused() || guard.resolvable() || guard.pendingAction().active);
        (uint64 s, uint64 a) = guard.pauseWindow();
        assertEq(s + a, 0);
        vm.expectRevert(Guard.ZeroAddress.selector);
        new Guard(address(0), IXStock(address(token)), ps);
        vm.expectRevert(Guard.ZeroAddress.selector);
        new Guard(keeper, IXStock(address(0)), ps);
        vm.expectRevert(Guard.ZeroAddress.selector);
        new Guard(keeper, IXStock(address(token)), MockPriceSource(address(0)));
    }

    function test_postAction_captureAccessAndValidation() public {
        token.setMultiplier(1.0017e18);
        vm.expectEmit(address(guard));
        emit IGuard.ActionPosted(T, SPLIT, 1.0017e18, PRICE);
        _post(T, SPLIT);
        _assertAction(IGuard.PendingAction(T, SPLIT, 1.0017e18, PRICE, true));
        (uint64 start, uint64 at) = guard.pauseWindow();
        assertEq(abi.encode(start, at), abi.encode(T - WINDOW, T));
        _post(T + 1 days, 2e18); // a re-post replaces the stored action
        _assertAction(IGuard.PendingAction(T + 1 days, 2e18, 1.0017e18, PRICE, true));
        vm.expectRevert(Guard.NotKeeper.selector);
        vm.prank(stranger);
        guard.postAction(T, SPLIT);
        vm.expectRevert(Guard.NotKeeper.selector);
        guard.postAction(T, SPLIT); // the owner is not the keeper
        vm.startPrank(keeper);
        vm.expectRevert(Guard.ActivationInPast.selector);
        guard.postAction(uint64(block.timestamp), SPLIT);
        vm.expectRevert(Guard.InvalidMultiplier.selector);
        guard.postAction(T, 0);
        vm.stopPrank();
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        guard.setWindow(1 hours);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        guard.setKeeper(stranger);
        vm.expectRevert(Guard.ZeroAddress.selector);
        guard.setKeeper(address(0));
        address next = makeAddr("nextKeeper");
        vm.expectEmit(address(guard));
        emit Guard.KeeperSet(next);
        guard.setKeeper(next);
        vm.expectRevert(Guard.NotKeeper.selector);
        _post(T, SPLIT); // the old keeper
        vm.prank(next);
        guard.postAction(T, SPLIT);
    }

    /// Every state of a 10-for-1 split on the keeper path.
    function test_split_fullLifecycle() public {
        _post(T, SPLIT);
        vm.warp(T - WINDOW - 1);
        assertFalse(guard.isPaused(), "before the window");
        vm.warp(T - WINDOW);
        assertTrue(guard.isPaused(), "window opens");
        vm.warp(T - 1);
        assertTrue(guard.isPaused(), "inside the window before activation");
        _activate(SPLIT);
        assertTrue(guard.isPaused(), "after activation, no new price");
        ps.setPrice(PRICE); // stale pre-split quote relayed after activation: value per share 10x
        assertTrue(guard.isPaused(), "inconsistent post-activation price");
        assertFalse(guard.resolvable());
        vm.expectRevert(Guard.NotResolvable.selector);
        guard.resolve();
        ps.setPrice(PRICE / 10); // consistent: 18 * 10.0 == 180 * 1.0
        assertFalse(guard.isPaused(), "consistent post-activation price");
        assertTrue(guard.resolvable());
        vm.expectEmit(address(guard));
        emit IGuard.ActionResolved(T, SPLIT, PRICE / 10);
        vm.prank(stranger); // permissionless
        guard.resolve();
        assertFalse(guard.isPaused() || guard.pendingAction().active);
        assertEq(abi.encode(guard.lastResolvedActivation(), guard.currentMultiplier()), abi.encode(T, SPLIT));
        vm.expectRevert(Guard.NoPendingAction.selector);
        guard.resolve();
    }

    function test_priceAtActivationAndMultiplierMustMatch() public {
        _post(T, SPLIT);
        vm.warp(T);
        token.setMultiplier(SPLIT);
        ps.setPrice(PRICE / 10); // fetchedAt == activationAt is not "after activation"
        vm.warp(T + 60);
        assertTrue(guard.isPaused(), "price fetched at activation");
        token.setMultiplier(ONE);
        ps.setPrice(PRICE / 10);
        assertTrue(guard.isPaused(), "issuer multiplier not switched yet");
        token.setMultiplier(5e18);
        ps.setPrice(PRICE / 5); // continuous for 5x, but 5x is not the posted 10x
        assertTrue(guard.isPaused(), "different multiplier than expected");
        token.setMultiplier(SPLIT);
        ps.setPrice(PRICE / 10);
        assertFalse(guard.isPaused());
        MockPriceSource empty = new MockPriceSource(0); // no reference price when posted: never resolves
        Guard g = new Guard(keeper, IXStock(address(token)), empty);
        vm.prank(keeper);
        g.postAction(uint64(block.timestamp + 1), SPLIT);
        vm.warp(block.timestamp + 60);
        empty.setPrice(PRICE / 10);
        assertTrue(g.isPaused() && !g.resolvable());
    }

    /// Exact bound: |post - pre| * 10_000 <= toleranceBps * pre, no rounding slack.
    function test_toleranceBoundary() public {
        _post(T, SPLIT);
        _activate(SPLIT);
        uint256[4] memory prices = [uint256(19.8e18), 19.8e18 + 1, 16.2e18, 16.2e18 - 1];
        bool[4] memory paused = [false, true, false, true];
        for (uint256 i; i < 4; ++i) {
            ps.setPrice(prices[i]);
            assertEq(guard.isPaused(), paused[i]);
        }
        vm.expectEmit(address(guard));
        emit Guard.ToleranceSet(0);
        guard.setToleranceBps(0);
        assertTrue(guard.isPaused(), "zero tolerance");
        ps.setPrice(PRICE / 10);
        assertFalse(guard.isPaused());
        vm.expectRevert(Guard.InvalidTolerance.selector);
        guard.setToleranceBps(10_001);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        guard.setToleranceBps(500);
    }

    /// Splits, reverse splits and dividends: the inverse-ratio quote resolves; the stale quote does not
    /// once the multiplier moves more than the 10% tolerance.
    function testFuzz_multiplierChange(uint256 m) public {
        m = bound(m, 0.01e18, 100e18);
        _post(T, m);
        _activate(m);
        ps.setPrice(PRICE);
        if (m * 10 < 9 * ONE || m * 10 > 11 * ONE) assertTrue(guard.isPaused());
        ps.setPrice(PRICE * ONE / m);
        assertFalse(guard.isPaused());
    }

    function testFuzz_windowStart(uint32 w, uint32 dt) public {
        uint64 win = uint64(bound(w, 0, 1 days));
        vm.expectEmit(address(guard));
        emit Guard.WindowSet(win);
        guard.setWindow(win);
        uint64 at = uint64(block.timestamp + 2 days);
        _post(at, SPLIT);
        uint256 t = block.timestamp + bound(dt, 0, 2 days - 1);
        vm.warp(t);
        assertEq(guard.isPaused(), t >= at - win);
    }

    /// Onchain schedule with no keeper post: pre values read lazily (documented approximation).
    function test_onchainSchedule_lazyPath() public {
        token.setPendingMultiplier(SPLIT, T);
        _assertAction(IGuard.PendingAction(T, SPLIT, ONE, PRICE, true));
        vm.warp(T - WINDOW - 1);
        assertFalse(guard.isPaused());
        vm.warp(T - WINDOW);
        assertTrue(guard.isPaused());
        vm.warp(T + 60);
        assertTrue(guard.isPaused(), "no post-activation price");
        ps.setPrice(PRICE / 10);
        assertTrue(guard.isPaused(), "mock multiplier() still 1.0: lazy check fails closed");
        token.setMultiplier(SPLIT); // the real token's multiplier() returns newMultiplier after activation
        assertFalse(guard.isPaused());
        vm.expectEmit(address(guard));
        emit IGuard.ActionResolved(T, SPLIT, PRICE / 10);
        guard.resolve();
        assertEq(guard.lastResolvedActivation(), T);
        assertFalse(guard.pendingAction().active, "resolved schedule is ignored");
        token.setPendingMultiplier(2 * SPLIT, T + 1 days); // a later schedule is picked up again
        assertEq(guard.pendingAction().activationAt, T + 1 days);
    }

    /// Captured before activation, the onchain schedule keeps the full check even after the issuer
    /// applies it (the real token zeroes newMultiplierActivationTime on its first transfer).
    function test_onchainSchedule_captureKeepsFullCheck() public {
        vm.expectRevert(Guard.NoOnchainSchedule.selector);
        guard.captureOnchainAction();
        token.setPendingMultiplier(0, T);
        vm.expectRevert(Guard.NoOnchainSchedule.selector);
        guard.captureOnchainAction();
        token.setPendingMultiplier(SPLIT, block.timestamp);
        vm.expectRevert(Guard.NoOnchainSchedule.selector);
        guard.captureOnchainAction();
        token.setPendingMultiplier(SPLIT, T);
        vm.expectEmit(address(guard));
        emit IGuard.ActionPosted(T, SPLIT, ONE, PRICE);
        vm.prank(stranger);
        guard.captureOnchainAction();
        token.setPendingMultiplier(SPLIT, 0);
        _activate(SPLIT);
        assertTrue(guard.isPaused(), "schedule applied, no new price");
        ps.setPrice(PRICE);
        assertTrue(guard.isPaused(), "stale pre-split quote");
        ps.setPrice(PRICE / 10);
        assertFalse(guard.isPaused());
        guard.resolve();
        assertEq(guard.lastResolvedActivation(), T);
    }

    function test_keeperActionTakesPrecedenceOverOnchain() public {
        token.setPendingMultiplier(5e18, T + 1 days);
        _post(T, SPLIT);
        vm.expectRevert(Guard.ActionActive.selector); // a stored keeper action wins
        guard.captureOnchainAction();
        _activate(SPLIT);
        ps.setPrice(PRICE / 10);
        guard.resolve(); // the later onchain schedule is next, pre values read lazily
        _assertAction(IGuard.PendingAction(T + 1 days, 5e18, SPLIT, PRICE / 10, true));
        assertFalse(guard.isPaused());
        vm.warp(T + 1 days - WINDOW);
        assertTrue(guard.isPaused());
    }

    function test_clearAction() public {
        vm.expectRevert(Guard.NoPendingAction.selector);
        guard.clearAction();
        _post(T, SPLIT);
        vm.warp(T - 60);
        assertTrue(guard.isPaused());
        vm.expectRevert(Guard.NotKeeperOrOwner.selector);
        vm.prank(stranger);
        guard.clearAction();
        vm.expectEmit(address(guard));
        emit IGuard.ActionCleared(T);
        vm.prank(keeper);
        guard.clearAction();
        assertFalse(guard.isPaused() || guard.pendingAction().active);
        assertEq(guard.lastResolvedActivation(), 0, "cancel is not a resolution");
        token.setPendingMultiplier(SPLIT, T);
        guard.captureOnchainAction();
        guard.clearAction(); // the owner may cancel too
        assertTrue(guard.isPaused(), "the token's own schedule still applies");
        vm.expectEmit(address(guard));
        emit IGuard.ActionCleared(T);
        vm.prank(keeper);
        guard.clearAction();
        assertEq(guard.lastResolvedActivation(), T);
        _post(T - 30, SPLIT); // an earlier keeper action resolving later keeps the dismissal
        vm.warp(T);
        ps.setPrice(PRICE / 10);
        guard.resolve();
        assertEq(guard.lastResolvedActivation(), T);
        assertFalse(guard.isPaused() || guard.pendingAction().active);
    }
}
