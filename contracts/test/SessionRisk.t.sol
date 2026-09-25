// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SessionRiskController} from "../src/SessionRiskController.sol";
import {ISessionRisk} from "../src/interfaces/ISessionRisk.sol";

contract SessionRiskTest is Test {
    SessionRiskController risk;
    address keeper = makeAddr("keeper");
    address stranger = makeAddr("stranger");

    function setUp() public {
        risk = new SessionRiskController(keeper);
    }

    function test_defaults() public view {
        assertEq(risk.keeper(), keeper);
        assertEq(risk.owner(), address(this));
        assertEq(risk.livenessLimit(), 30 minutes);
        assertEq(risk.closedFloorBps(), 2_000);
        assertEq(risk.closedDecayDuration(), 64 hours);
        assertEq(risk.baseLtvBps(ISessionRisk.Session.OPEN), 5_000);
        assertEq(risk.baseLtvBps(ISessionRisk.Session.EXTENDED), 4_000);
        assertEq(risk.baseLtvBps(ISessionRisk.Session.CLOSED), 3_000);
        assertEq(_u(risk.currentSession()), _u(ISessionRisk.Session.UNKNOWN));
        assertEq(risk.maxLtvBps(), 0);
        (ISessionRisk.Session session, uint64 changedAt, uint64 postedAt) = risk.lastPost();
        assertEq(_u(session), _u(ISessionRisk.Session.UNKNOWN));
        assertEq(changedAt, 0);
        assertEq(postedAt, 0);
    }

    /// Every session at several ages, and the closed-market points named in the block.
    function test_ltv_table() public view {
        ISessionRisk.Session[6] memory sessions = [
            ISessionRisk.Session.UNKNOWN,
            ISessionRisk.Session.OPEN,
            ISessionRisk.Session.EXTENDED,
            ISessionRisk.Session.CLOSED,
            ISessionRisk.Session.HALTED,
            ISessionRisk.Session.CORPORATE_ACTION
        ];
        uint256[6] memory atZero = [uint256(0), 5_000, 4_000, 3_000, 0, 0];
        for (uint256 i = 0; i < sessions.length; i++) {
            assertEq(risk.maxLtvBpsFor(sessions[i], 0), atZero[i], "at 0");
            if (sessions[i] != ISessionRisk.Session.CLOSED) {
                assertEq(risk.maxLtvBpsFor(sessions[i], 16 hours), atZero[i], "at 16h");
                assertEq(risk.maxLtvBpsFor(sessions[i], 100 hours), atZero[i], "at 100h");
            }
        }

        uint256[5] memory elapsedHours = [uint256(0), 16, 32, 64, 100];
        uint256[5] memory closedBps = [uint256(3_000), 2_750, 2_500, 2_000, 2_000];
        for (uint256 i = 0; i < elapsedHours.length; i++) {
            assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.CLOSED, elapsedHours[i] * 1 hours), closedBps[i], "closed");
        }
    }

    /// Partial seconds stay on or below the line: 1000 bps over 64h is 230.4s per bps.
    function test_closed_decay_rounds_down() public view {
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.CLOSED, 64 hours - 1), 2_000);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.CLOSED, 230), 2_999);
    }

    function test_custom_duration_is_linear() public {
        risk.setClosedDecay(2_000, 2);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.CLOSED, 0), 3_000);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.CLOSED, 1), 2_500);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.CLOSED, 2), 2_000);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.CLOSED, 3), 2_000);
    }

    function test_post_stores_emits_and_rejects_future() public {
        vm.warp(1_000_000);
        uint64 changedAt = uint64(block.timestamp - 90);
        vm.expectEmit(address(risk));
        emit ISessionRisk.SessionPosted(ISessionRisk.Session.EXTENDED, changedAt, uint64(block.timestamp));
        _post(ISessionRisk.Session.EXTENDED, changedAt);

        (ISessionRisk.Session session, uint64 changed, uint64 posted) = risk.lastPost();
        assertEq(_u(session), _u(ISessionRisk.Session.EXTENDED));
        assertEq(changed, changedAt);
        assertEq(posted, uint64(block.timestamp));
        assertEq(_u(risk.currentSession()), _u(ISessionRisk.Session.EXTENDED));
        assertEq(risk.maxLtvBps(), 4_000);

        vm.prank(keeper);
        risk.postSession(ISessionRisk.Session.OPEN, uint64(block.timestamp));

        vm.prank(keeper);
        vm.expectRevert(SessionRiskController.FutureTimestamp.selector);
        risk.postSession(ISessionRisk.Session.CLOSED, uint64(block.timestamp + 1));
        (session,,) = risk.lastPost();
        assertEq(_u(session), _u(ISessionRisk.Session.OPEN));
    }

    function test_post_only_keeper() public {
        vm.expectRevert(SessionRiskController.NotKeeper.selector);
        risk.postSession(ISessionRisk.Session.OPEN, uint64(block.timestamp));

        vm.prank(stranger);
        vm.expectRevert(SessionRiskController.NotKeeper.selector);
        risk.postSession(ISessionRisk.Session.OPEN, uint64(block.timestamp));
    }

    function test_stale_post_is_unknown() public {
        vm.warp(1_000_000);
        _post(ISessionRisk.Session.OPEN, uint64(block.timestamp));

        vm.warp(block.timestamp + 30 minutes);
        assertEq(_u(risk.currentSession()), _u(ISessionRisk.Session.OPEN), "exact limit still live");
        assertEq(risk.maxLtvBps(), 5_000);

        vm.warp(block.timestamp + 1);
        assertEq(_u(risk.currentSession()), _u(ISessionRisk.Session.UNKNOWN));
        assertEq(risk.maxLtvBps(), 0);
        (ISessionRisk.Session session,,) = risk.lastPost();
        assertEq(_u(session), _u(ISessionRisk.Session.OPEN), "raw post kept");

        _post(ISessionRisk.Session.EXTENDED, uint64(block.timestamp));
        assertEq(_u(risk.currentSession()), _u(ISessionRisk.Session.EXTENDED));
        assertEq(risk.maxLtvBps(), 4_000);
    }

    function test_never_posted_stays_unknown() public {
        vm.warp(1 days);
        assertEq(_u(risk.currentSession()), _u(ISessionRisk.Session.UNKNOWN));
        risk.setLivenessLimit(type(uint256).max);
        assertEq(_u(risk.currentSession()), _u(ISessionRisk.Session.UNKNOWN));
        assertEq(risk.maxLtvBps(), 0);
    }

    /// Decay is measured from the issuer period change, not from the keeper's post.
    function test_closed_ltv_follows_period_age() public {
        vm.warp(10 days);
        risk.setLivenessLimit(7 days);
        uint64 changedAt = uint64(block.timestamp - 16 hours);
        _post(ISessionRisk.Session.CLOSED, changedAt);
        assertEq(risk.maxLtvBps(), 2_750);

        vm.warp(block.timestamp + 16 hours);
        assertEq(risk.maxLtvBps(), 2_500);

        vm.warp(changedAt + 64 hours);
        assertEq(risk.maxLtvBps(), 2_000);

        vm.warp(changedAt + 100 hours);
        assertEq(risk.maxLtvBps(), 2_000);
        assertEq(_u(risk.currentSession()), _u(ISessionRisk.Session.CLOSED));
    }

    function test_posted_session_drives_current_ltv() public {
        vm.warp(1_000_000);
        ISessionRisk.Session[5] memory sessions = [
            ISessionRisk.Session.OPEN,
            ISessionRisk.Session.EXTENDED,
            ISessionRisk.Session.CLOSED,
            ISessionRisk.Session.HALTED,
            ISessionRisk.Session.CORPORATE_ACTION
        ];
        uint256[5] memory bps = [uint256(5_000), 4_000, 3_000, 0, 0];
        for (uint256 i = 0; i < sessions.length; i++) {
            _post(sessions[i], uint64(block.timestamp));
            assertEq(_u(risk.currentSession()), _u(sessions[i]));
            assertEq(risk.maxLtvBps(), bps[i]);
        }
    }

    function test_owner_setters() public {
        vm.expectEmit(address(risk));
        emit SessionRiskController.LtvSet(ISessionRisk.Session.OPEN, 4_500);
        risk.setLtv(ISessionRisk.Session.OPEN, 4_500);
        risk.setLtv(ISessionRisk.Session.EXTENDED, 3_500);
        risk.setLtv(ISessionRisk.Session.CLOSED, 4_000);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.OPEN, 9 hours), 4_500);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.EXTENDED, 0), 3_500);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.CLOSED, 32 hours), 3_000);

        vm.expectEmit(address(risk));
        emit SessionRiskController.ClosedDecaySet(1_000, 32 hours);
        risk.setClosedDecay(1_000, 32 hours);
        assertEq(risk.closedFloorBps(), 1_000);
        assertEq(risk.closedDecayDuration(), 32 hours);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.CLOSED, 0), 4_000);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.CLOSED, 16 hours), 2_500);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.CLOSED, 32 hours), 1_000);

        vm.expectEmit(address(risk));
        emit SessionRiskController.LivenessLimitSet(10 minutes);
        risk.setLivenessLimit(10 minutes);

        vm.warp(1_000_000);
        _post(ISessionRisk.Session.OPEN, uint64(block.timestamp));
        assertEq(risk.maxLtvBps(), 4_500);
        vm.warp(block.timestamp + 10 minutes);
        assertEq(_u(risk.currentSession()), _u(ISessionRisk.Session.OPEN));
        vm.warp(block.timestamp + 1);
        assertEq(_u(risk.currentSession()), _u(ISessionRisk.Session.UNKNOWN));

        address next = makeAddr("next-keeper");
        vm.expectEmit(address(risk));
        emit SessionRiskController.KeeperSet(next);
        risk.setKeeper(next);
        assertEq(risk.keeper(), next);

        vm.prank(keeper);
        vm.expectRevert(SessionRiskController.NotKeeper.selector);
        risk.postSession(ISessionRisk.Session.OPEN, uint64(block.timestamp));
        vm.prank(next);
        risk.postSession(ISessionRisk.Session.HALTED, uint64(block.timestamp));
        assertEq(_u(risk.currentSession()), _u(ISessionRisk.Session.HALTED));
        assertEq(risk.maxLtvBps(), 0);
    }

    function test_setters_only_owner() public {
        address[2] memory callers = [keeper, stranger];
        for (uint256 i = 0; i < callers.length; i++) {
            vm.startPrank(callers[i]);
            vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, callers[i]));
            risk.setLtv(ISessionRisk.Session.OPEN, 1);
            vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, callers[i]));
            risk.setClosedDecay(1_000, 1 hours);
            vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, callers[i]));
            risk.setLivenessLimit(1);
            vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, callers[i]));
            risk.setKeeper(callers[i]);
            vm.stopPrank();
        }
        assertEq(risk.baseLtvBps(ISessionRisk.Session.OPEN), 5_000);
        assertEq(risk.keeper(), keeper);
    }

    function test_bps_cap_and_floor_bound() public {
        risk.setLtv(ISessionRisk.Session.OPEN, 0);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.OPEN, 0), 0);
        risk.setLtv(ISessionRisk.Session.CLOSED, 10_000);
        risk.setClosedDecay(10_000, 64 hours);
        risk.setLtv(ISessionRisk.Session.OPEN, 10_000);

        vm.expectRevert(abi.encodeWithSelector(SessionRiskController.BpsTooHigh.selector, 10_001));
        risk.setLtv(ISessionRisk.Session.EXTENDED, 10_001);
        assertEq(risk.baseLtvBps(ISessionRisk.Session.EXTENDED), 4_000);

        vm.expectRevert(abi.encodeWithSelector(SessionRiskController.BpsTooHigh.selector, 10_001));
        risk.setClosedDecay(10_001, 1 hours);
        assertEq(risk.closedFloorBps(), 10_000);

        // Floor is 100%. The CLOSED start cannot drop below it until the floor is lowered.
        vm.expectRevert(SessionRiskController.FloorAboveStart.selector);
        risk.setLtv(ISessionRisk.Session.CLOSED, 3_000);
        risk.setClosedDecay(2_000, 64 hours);
        vm.expectRevert(SessionRiskController.FloorAboveStart.selector);
        risk.setLtv(ISessionRisk.Session.CLOSED, 1_999);

        risk.setLtv(ISessionRisk.Session.CLOSED, 3_000);
        risk.setClosedDecay(3_000, 10 hours);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.CLOSED, 5 hours), 3_000);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.CLOSED, 10 hours), 3_000);
    }

    function test_zero_keeper_and_duration() public {
        vm.expectRevert(SessionRiskController.ZeroAddress.selector);
        new SessionRiskController(address(0));
        vm.expectRevert(SessionRiskController.ZeroAddress.selector);
        risk.setKeeper(address(0));
        vm.expectRevert(SessionRiskController.ZeroDuration.selector);
        risk.setClosedDecay(2_000, 0);
        assertEq(risk.closedDecayDuration(), 64 hours);
    }

    function test_halt_ltv_not_configurable() public {
        vm.expectRevert(SessionRiskController.LtvNotConfigurable.selector);
        risk.setLtv(ISessionRisk.Session.HALTED, 1);
        vm.expectRevert(SessionRiskController.LtvNotConfigurable.selector);
        risk.setLtv(ISessionRisk.Session.CORPORATE_ACTION, 1);
        vm.expectRevert(SessionRiskController.LtvNotConfigurable.selector);
        risk.setLtv(ISessionRisk.Session.UNKNOWN, 1);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.HALTED, 50 hours), 0);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.CORPORATE_ACTION, 1), 0);
        assertEq(risk.maxLtvBpsFor(ISessionRisk.Session.UNKNOWN, 1), 0);
    }

    function _post(ISessionRisk.Session session, uint64 changedAt) internal {
        vm.prank(keeper);
        risk.postSession(session, changedAt);
    }

    function _u(ISessionRisk.Session session) internal pure returns (uint8) {
        return uint8(session);
    }
}
