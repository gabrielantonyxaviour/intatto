// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ISessionRisk} from "./interfaces/ISessionRisk.sol";

/// @title SessionRiskController
/// @notice Keeper-posted market session and the max LTV a new borrow may reach in that session.
/// The liquidation threshold does not live here. A post older than `livenessLimit` reads as UNKNOWN.
/// While CLOSED, LTV moves linearly from the CLOSED start down to `closedFloorBps` over
/// `closedDecayDuration`, measured from the issuer's period change (`periodChangedAt`).
/// The move rounds down, so offered capacity never sits above that line.
contract SessionRiskController is ISessionRisk, Ownable {
    uint256 public constant BPS = 10_000;

    struct Post {
        Session session;
        uint64 periodChangedAt;
        uint64 postedAt;
    }

    address public keeper;
    /// @notice A post older than this reads as UNKNOWN. Default 30 minutes.
    uint256 public livenessLimit = 30 minutes;
    /// @notice Configured LTV in bps for OPEN, EXTENDED, and the start of CLOSED.
    mapping(Session => uint256) public baseLtvBps;
    /// @notice CLOSED LTV after `closedDecayDuration`. Default 2000 (20%).
    uint256 public closedFloorBps = 2_000;
    /// @notice Seconds over which CLOSED decays from its start to `closedFloorBps`. Default 64 hours.
    uint256 public closedDecayDuration = 64 hours;

    Post internal _post;

    event KeeperSet(address keeper);
    event LtvSet(Session session, uint256 bps);
    event ClosedDecaySet(uint256 floorBps, uint256 duration);
    event LivenessLimitSet(uint256 limit);

    error NotKeeper();
    error FutureTimestamp();
    error ZeroAddress();
    error BpsTooHigh(uint256 bps);
    error ZeroDuration();
    error LtvNotConfigurable();
    /// @notice CLOSED floor must stay at or below the CLOSED start. Lower the floor first, or raise the start first.
    error FloorAboveStart();

    constructor(address keeper_) Ownable(msg.sender) {
        if (keeper_ == address(0)) revert ZeroAddress();
        keeper = keeper_;
        baseLtvBps[Session.OPEN] = 5_000;
        baseLtvBps[Session.EXTENDED] = 4_000;
        baseLtvBps[Session.CLOSED] = 3_000;
        emit KeeperSet(keeper_);
    }

    /// @inheritdoc ISessionRisk
    function postSession(Session session, uint64 periodChangedAt) external {
        if (msg.sender != keeper) revert NotKeeper();
        if (periodChangedAt > block.timestamp) revert FutureTimestamp();
        uint64 postedAt = uint64(block.timestamp);
        _post = Post(session, periodChangedAt, postedAt);
        emit SessionPosted(session, periodChangedAt, postedAt);
    }

    /// @inheritdoc ISessionRisk
    function currentSession() public view returns (Session) {
        uint64 postedAt = _post.postedAt;
        if (block.timestamp < postedAt) return Session.UNKNOWN;
        if (block.timestamp - postedAt > livenessLimit) return Session.UNKNOWN;
        return _post.session;
    }

    /// @inheritdoc ISessionRisk
    function maxLtvBps() external view returns (uint256) {
        uint64 changedAt = _post.periodChangedAt;
        uint256 elapsed = block.timestamp > changedAt ? block.timestamp - changedAt : 0;
        return maxLtvBpsFor(currentSession(), elapsed);
    }

    /// @inheritdoc ISessionRisk
    function maxLtvBpsFor(Session session, uint256 elapsed) public view returns (uint256) {
        if (session == Session.OPEN || session == Session.EXTENDED) return baseLtvBps[session];
        if (session == Session.CLOSED) return _closedLtv(elapsed);
        return 0;
    }

    /// @inheritdoc ISessionRisk
    function lastPost() external view returns (Session session, uint64 periodChangedAt, uint64 postedAt) {
        Post memory p = _post;
        return (p.session, p.periodChangedAt, p.postedAt);
    }

    function setKeeper(address keeper_) external onlyOwner {
        if (keeper_ == address(0)) revert ZeroAddress();
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    /// @notice OPEN, EXTENDED, or the CLOSED start. HALTED, CORPORATE_ACTION and UNKNOWN stay 0.
    /// CLOSED start cannot drop below `closedFloorBps`.
    function setLtv(Session session, uint256 bps) external onlyOwner {
        if (session != Session.OPEN && session != Session.EXTENDED && session != Session.CLOSED) {
            revert LtvNotConfigurable();
        }
        if (bps > BPS) revert BpsTooHigh(bps);
        if (session == Session.CLOSED && bps < closedFloorBps) revert FloorAboveStart();
        baseLtvBps[session] = bps;
        emit LtvSet(session, bps);
    }

    /// @notice CLOSED moves from its start LTV to `floorBps` over `duration` (must be non-zero).
    /// `floorBps` cannot exceed the current CLOSED start.
    function setClosedDecay(uint256 floorBps, uint256 duration) external onlyOwner {
        if (floorBps > BPS) revert BpsTooHigh(floorBps);
        if (duration == 0) revert ZeroDuration();
        if (floorBps > baseLtvBps[Session.CLOSED]) revert FloorAboveStart();
        closedFloorBps = floorBps;
        closedDecayDuration = duration;
        emit ClosedDecaySet(floorBps, duration);
    }

    function setLivenessLimit(uint256 limit) external onlyOwner {
        livenessLimit = limit;
        emit LivenessLimitSet(limit);
    }

    /// @dev `start >= floor` is kept by the setters. If it is ever broken, capacity stays at `start` until
    /// `duration` and only then steps to the floor, so a closed session cannot gain LTV early.
    function _closedLtv(uint256 elapsed) internal view returns (uint256) {
        uint256 start = baseLtvBps[Session.CLOSED];
        uint256 floorBps = closedFloorBps;
        uint256 duration = closedDecayDuration;
        if (start <= floorBps) return elapsed >= duration ? floorBps : start;
        if (elapsed >= duration) return floorBps;
        return floorBps + Math.mulDiv(start - floorBps, duration - elapsed, duration);
    }
}
