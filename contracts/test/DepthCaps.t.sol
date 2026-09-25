// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {DepthCapRegistry} from "../src/DepthCapRegistry.sol";
import {IDepthCaps} from "../src/interfaces/IDepthCaps.sol";

/// @notice Stands in for the market's borrow check: refuse when the registry says the debt would exceed the cap.
contract BorrowerStub {
    DepthCapRegistry public immutable caps;

    error TickerCapReached(uint256 totalDebtAfter, uint256 cap);

    constructor(DepthCapRegistry caps_) {
        caps = caps_;
    }

    function borrow(address market, uint256 totalDebtAfter) external view {
        if (caps.wouldExceed(market, totalDebtAfter)) revert TickerCapReached(totalDebtAfter, caps.capOf(market));
    }
}

contract DepthCapsTest is Test {
    DepthCapRegistry caps;
    BorrowerStub borrower;

    address keeper = makeAddr("keeper");
    address market = makeAddr("market");
    address other = makeAddr("other");

    uint256 constant HOUR = 1 hours;

    function setUp() public {
        vm.warp(1_700_000_000);
        caps = new DepthCapRegistry(keeper);
        borrower = new BorrowerStub(caps);
    }

    function test_defaults() public view {
        assertEq(caps.keeper(), keeper);
        assertEq(caps.owner(), address(this));
        assertEq(caps.stepBps(), 2500);
        assertEq(caps.minStepUsdg(), 100e6);
        assertEq(caps.capOf(market), 0);
        assertEq(caps.sliceOf(market), 0);
    }

    function test_decreaseAppliesImmediately() public {
        caps.setInitialCap(market, 1_000e6);
        caps.setInitialCap(other, 50e6);

        vm.expectEmit(true, false, false, true, address(caps));
        emit IDepthCaps.CapPosted(market, 400e6, 80e6, 400e6);
        _post(market, 400e6, 80e6);

        assertEq(caps.capOf(market), 400e6);
        assertEq(caps.sliceOf(market), 80e6);

        _post(market, 0, 50e6);
        assertEq(caps.capOf(market), 0);
        assertEq(caps.sliceOf(market), 0);
        assertEq(caps.capOf(other), 50e6);
        assertEq(caps.sliceOf(other), 0);
    }

    function test_frequentPostsDoNotStallTheRamp() public {
        // A keeper re-posting every 20 minutes must not reset the hourly ramp.
        caps.setInitialCap(market, 1_000e6);
        uint256 t = block.timestamp;
        for (uint256 i = 1; i <= 9; i++) {
            vm.warp(t + i * 20 minutes);
            _post(market, 10_000e6, 1);
        }
        // 3 whole hours elapsed: 1000 → 1250 → 1562.5 → 1953.125 (each step 25% of the checkpointed cap)
        assertGe(caps.capOf(market), 1_750e6);
        assertLe(caps.capOf(market), 2_000e6);
    }

    function test_increaseIsRateLimited() public {
        // 25% of the 1_000e6 checkpoint = 250e6 per whole hour, and the cap never passes the target.
        caps.setInitialCap(market, 1_000e6);
        vm.expectEmit(true, false, false, true, address(caps));
        emit IDepthCaps.CapPosted(market, 10_000e6, 1, 1_000e6);
        _post(market, 10_000e6, 1);

        uint256 t = block.timestamp;
        assertEq(caps.capOf(market), 1_000e6);
        vm.warp(t + HOUR - 1);
        assertEq(caps.capOf(market), 1_000e6);
        vm.warp(t + HOUR);
        assertEq(caps.capOf(market), 1_250e6);
        vm.warp(t + 2 * HOUR);
        assertEq(caps.capOf(market), 1_500e6);
        vm.warp(t + 10 * HOUR);
        assertEq(caps.capOf(market), 3_500e6);
        vm.warp(t + 36 * HOUR);
        assertEq(caps.capOf(market), 10_000e6);
        vm.warp(t + 1_000 * HOUR);
        assertEq(caps.capOf(market), 10_000e6);
    }

    function test_firstPostRampsFromZero() public {
        vm.expectEmit(true, false, false, true, address(caps));
        emit IDepthCaps.CapPosted(market, 250e6, 10e6, 0);
        _post(market, 250e6, 10e6);

        uint256 t = block.timestamp;
        assertEq(caps.capOf(market), 0);
        assertEq(caps.sliceOf(market), 0);
        vm.warp(t + HOUR);
        assertEq(caps.capOf(market), 100e6);
        assertEq(caps.sliceOf(market), 10e6);
        vm.warp(t + 2 * HOUR);
        assertEq(caps.capOf(market), 200e6);
        vm.warp(t + 10 * HOUR);
        assertEq(caps.capOf(market), 250e6);
    }

    function test_repostCheckpointsRisenCap() public {
        caps.setInitialCap(market, 1_000e6);
        _post(market, 10_000e6, 1);
        vm.warp(block.timestamp + 4 * HOUR);
        assertEq(caps.capOf(market), 2_000e6);

        // A refresh keeps the risen effective and restarts the hour. The next step is 25% of 2_000e6.
        _post(market, 10_000e6, 1);
        assertEq(caps.capOf(market), 2_000e6);
        vm.warp(block.timestamp + HOUR - 1);
        assertEq(caps.capOf(market), 2_000e6);
        vm.warp(block.timestamp + 1);
        assertEq(caps.capOf(market), 2_500e6);
    }

    function test_decreaseAfterRampAppliesImmediately() public {
        caps.setInitialCap(market, 1_000e6);
        _post(market, 10_000e6, 100e6);
        vm.warp(block.timestamp + 4 * HOUR);
        assertEq(caps.capOf(market), 2_000e6);

        _post(market, 1_500e6, 2_000e6);
        assertEq(caps.capOf(market), 1_500e6);
        assertEq(caps.sliceOf(market), 1_500e6);
        vm.warp(block.timestamp + 10 * HOUR);
        assertEq(caps.capOf(market), 1_500e6);
        assertEq(caps.sliceOf(market), 1_500e6);
    }

    function test_minStepFloor() public {
        address at = makeAddr("at");
        address below = makeAddr("below");
        caps.setInitialCap(at, 400e6); // 25% == 100e6, equal to the floor
        caps.setInitialCap(below, 200e6); // 25% == 50e6, so the 100e6 floor wins
        _post(at, 10_000e6, 0);
        _post(below, 10_000e6, 0);
        vm.warp(block.timestamp + 2 * HOUR);
        assertEq(caps.capOf(at), 600e6);
        assertEq(caps.capOf(below), 400e6);
    }

    function test_sliceIsImmediateAndCapped() public {
        caps.setInitialCap(market, 1_000e6);
        _post(market, 10_000e6, 1_500e6);
        assertEq(caps.sliceOf(market), 1_000e6);

        uint256 t = block.timestamp;
        vm.warp(t + HOUR);
        assertEq(caps.capOf(market), 1_250e6);
        assertEq(caps.sliceOf(market), 1_250e6);
        vm.warp(t + 3 * HOUR);
        assertEq(caps.capOf(market), 1_750e6);
        assertEq(caps.sliceOf(market), 1_500e6);

        _post(market, 10_000e6, 100e6);
        assertEq(caps.sliceOf(market), 100e6);
    }

    function test_setStepRepricesOpenRamp() public {
        caps.setInitialCap(market, 1_000e6);
        _post(market, 100_000e6, 0);
        vm.warp(block.timestamp + 4 * HOUR);
        assertEq(caps.capOf(market), 2_000e6);

        vm.expectEmit(false, false, false, true, address(caps));
        emit DepthCapRegistry.StepSet(5000, 1);
        caps.setStep(5000, 1);
        assertEq(caps.stepBps(), 5000);
        assertEq(caps.minStepUsdg(), 1);
        // Same four hours, now 50% of the 1_000e6 checkpoint.
        assertEq(caps.capOf(market), 3_000e6);
    }

    function test_setInitialCapBypassesRamp() public {
        _post(market, 10_000e6, 1);
        vm.warp(block.timestamp + 5 * HOUR);
        assertEq(caps.capOf(market), 500e6);

        vm.expectEmit(true, false, false, true, address(caps));
        emit DepthCapRegistry.InitialCapSet(market, 4_000e6);
        caps.setInitialCap(market, 4_000e6);
        assertEq(caps.capOf(market), 4_000e6);
        vm.warp(block.timestamp + 10 * HOUR);
        assertEq(caps.capOf(market), 4_000e6);
    }

    function test_borrowRefusedAtCap() public {
        assertTrue(caps.wouldExceed(market, 1));
        assertFalse(caps.wouldExceed(market, 0));
        vm.expectRevert(abi.encodeWithSelector(BorrowerStub.TickerCapReached.selector, 1, 0));
        borrower.borrow(market, 1);

        caps.setInitialCap(market, 1_000e6);
        assertFalse(caps.wouldExceed(market, 1_000e6));
        assertTrue(caps.wouldExceed(market, 1_000e6 + 1));
        borrower.borrow(market, 1_000e6);
        vm.expectRevert(abi.encodeWithSelector(BorrowerStub.TickerCapReached.selector, 1_000e6 + 1, 1_000e6));
        borrower.borrow(market, 1_000e6 + 1);
    }

    function test_accessControl() public {
        address stranger = makeAddr("stranger");
        vm.expectRevert(DepthCapRegistry.NotKeeper.selector);
        caps.post(market, 1, 1);
        vm.prank(stranger);
        vm.expectRevert(DepthCapRegistry.NotKeeper.selector);
        caps.post(market, 1, 1);

        _expectOwnerOnly(stranger);
        _expectOwnerOnly(keeper);

        vm.expectRevert(DepthCapRegistry.ZeroAddress.selector);
        new DepthCapRegistry(address(0));
        vm.expectRevert(DepthCapRegistry.ZeroAddress.selector);
        caps.setKeeper(address(0));

        address next = makeAddr("next");
        vm.expectEmit(false, false, false, true, address(caps));
        emit DepthCapRegistry.KeeperSet(next);
        caps.setKeeper(next);
        assertEq(caps.keeper(), next);

        vm.prank(keeper);
        vm.expectRevert(DepthCapRegistry.NotKeeper.selector);
        caps.post(market, 1, 1);
        vm.prank(next);
        caps.post(market, 500e6, 10e6);
        assertEq(caps.capOf(market), 0);
    }

    function testFuzz_capBounds(uint128 initial, uint128 target, uint32 hoursFwd) public {
        initial = uint128(bound(initial, 0, 1e24));
        target = uint128(bound(target, 0, 1e24));
        hoursFwd = uint32(bound(hoursFwd, 0, 100_000));

        caps.setInitialCap(market, initial);
        _post(market, target, target);
        vm.warp(block.timestamp + uint256(hoursFwd) * HOUR);

        uint256 cap = caps.capOf(market);
        assertLe(cap, target);
        if (target <= initial) {
            assertEq(cap, target);
        } else {
            uint256 step = uint256(initial) * 2500 / 10_000;
            if (step < 100e6) step = 100e6;
            uint256 allowed = uint256(initial) + uint256(hoursFwd) * step;
            if (allowed > target) allowed = target;
            assertEq(cap, allowed);
        }
        uint256 slice = caps.sliceOf(market);
        assertLe(slice, cap);
        assertLe(slice, target);
    }

    function _post(address m, uint256 target, uint256 slice) internal {
        vm.prank(keeper);
        caps.post(m, target, slice);
    }

    function _expectOwnerOnly(address caller) internal {
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, caller));
        caps.setKeeper(caller);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, caller));
        caps.setStep(1, 1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, caller));
        caps.setInitialCap(market, 1);
        vm.stopPrank();
    }
}
