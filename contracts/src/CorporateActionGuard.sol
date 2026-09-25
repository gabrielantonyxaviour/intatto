// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ICorporateActionGuard} from "./interfaces/ICorporateActionGuard.sol";
import {IPriceSource} from "./interfaces/IPriceSource.sol";
import {IXStock} from "./interfaces/external/IXStock.sol";

/// @title CorporateActionGuard
/// @notice One instance per ticker. A split or dividend changes the issuer multiplier (1e18 = 1.0): balances
/// rebase by the multiplier ratio and the per-token quote moves by the inverse ratio. Around activation the
/// relayed quote and the onchain multiplier can disagree, so this guard pauses borrow and liquidation for
/// its ticker from `activationAt - window` until a price posted after activation is consistent:
///   - the price was fetched strictly after activation (`fetchedAt > activationAt`), and
///   - `token.getCurrentMultiplier()` equals `expectedMultiplier` exactly, and
///   - value per underlying share is continuous:
///     |price * currentMultiplier - preActionPrice * preActionMultiplier| * 10_000
///         <= toleranceBps * preActionPrice * preActionMultiplier
///     (the cross-multiplied, exact form of the ratio check: no rounding in the borrower's favour).
/// Prices are USD per 1e18 token units (18 decimals); multipliers are 1e18-scaled.
///
/// Pending actions come from two sources, the keeper's post taking precedence:
///   1. `postAction` (keeper) or `captureOnchainAction` (anyone, before activation) STORE the action with the
///      multiplier and price read at that moment. A stored action survives the issuer applying its schedule.
///   2. Otherwise an onchain issuer schedule (`newMultiplierActivationTime() > lastResolvedActivation` and
///      `newMultiplier() > 0`) is treated LAZILY as a pending action {activationAt: newMultiplierActivationTime,
///      expectedMultiplier: newMultiplier}. APPROXIMATION: its pre values are read at evaluation time
///      (`token.multiplier()` and the current relayed price), so the continuity check only compares
///      `multiplier()` with `getCurrentMultiplier()`; on the real token `multiplier()` already returns the new
///      value after activation, so resolution then only needs a price fetched after activation. The real
///      token also zeroes `newMultiplierActivationTime` on its first transfer after activation, which ends a
///      lazy action. Call `captureOnchainAction()` before activation to get the full check.
/// An issuer update with no future activation time is not visible onchain in advance; the keeper posts it.
contract CorporateActionGuard is ICorporateActionGuard, Ownable {
    uint256 public constant BPS = 10_000;

    IXStock public immutable token;
    IPriceSource public immutable priceSource;

    address public keeper;
    /// @notice Seconds before activation at which the pause starts. Default 30 minutes.
    uint64 public window = 30 minutes;
    /// @notice Allowed deviation of value per underlying share across the action. Default 1000 (10%).
    uint256 public toleranceBps = 1000;
    /// @notice Latest activation time resolved or dismissed; onchain schedules at or before it are ignored.
    uint64 public lastResolvedActivation;

    PendingAction internal _action;

    event KeeperSet(address keeper);
    event WindowSet(uint64 window);
    event ToleranceSet(uint256 toleranceBps);

    error NotKeeper();
    error NotKeeperOrOwner();
    error ZeroAddress();
    error ActivationInPast();
    error InvalidMultiplier();
    error InvalidTolerance();
    error NoPendingAction();
    error NotResolvable();
    error NoOnchainSchedule();
    error ActionActive();

    constructor(address keeper_, IXStock token_, IPriceSource priceSource_) Ownable(msg.sender) {
        if (keeper_ == address(0) || address(token_) == address(0) || address(priceSource_) == address(0)) {
            revert ZeroAddress();
        }
        keeper = keeper_;
        token = token_;
        priceSource = priceSource_;
        emit KeeperSet(keeper_);
    }

    // ---------------------------------------------------------------- keeper and permissionless actions

    /// @notice Keeper posts an upcoming multiplier change. Replaces any stored action.
    function postAction(uint64 activationAt, uint256 expectedMultiplier) external {
        if (msg.sender != keeper) revert NotKeeper();
        if (activationAt <= block.timestamp) revert ActivationInPast();
        if (expectedMultiplier == 0) revert InvalidMultiplier();
        _store(activationAt, expectedMultiplier);
    }

    /// @notice Stores the token's own future schedule with the multiplier and price read now, before
    /// activation, so the full continuity check applies. Anyone may call; it only copies onchain data.
    function captureOnchainAction() external {
        if (_action.active) revert ActionActive();
        (bool scheduled, uint64 activationAt, uint256 newMultiplier) = _onchainSchedule();
        if (!scheduled || activationAt <= block.timestamp) revert NoOnchainSchedule();
        _store(activationAt, newMultiplier);
    }

    /// @notice Ends the pending action once it is resolvable. Permissionless.
    function resolve() external {
        (PendingAction memory a, bool stored) = _effective();
        if (!a.active) revert NoPendingAction();
        (bool ok, uint256 current, uint256 price) = _check(a);
        if (!ok) revert NotResolvable();
        if (stored) _action.active = false;
        _settle(a.activationAt);
        emit ActionResolved(a.activationAt, current, price);
    }

    /// @notice Keeper or owner cancels the pending action. A stored action is deactivated (a lazy onchain
    /// schedule, if any, then applies); a lazy onchain schedule is dismissed by settling its activation time.
    function clearAction() external {
        if (msg.sender != keeper && msg.sender != owner()) revert NotKeeperOrOwner();
        (PendingAction memory a, bool stored) = _effective();
        if (!a.active) revert NoPendingAction();
        if (stored) _action.active = false;
        else _settle(a.activationAt);
        emit ActionCleared(a.activationAt);
    }

    // ---------------------------------------------------------------- owner parameters

    function setKeeper(address keeper_) external onlyOwner {
        if (keeper_ == address(0)) revert ZeroAddress();
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    function setWindow(uint64 window_) external onlyOwner {
        window = window_;
        emit WindowSet(window_);
    }

    function setToleranceBps(uint256 toleranceBps_) external onlyOwner {
        if (toleranceBps_ > BPS) revert InvalidTolerance();
        toleranceBps = toleranceBps_;
        emit ToleranceSet(toleranceBps_);
    }

    // ---------------------------------------------------------------- views

    /// @notice True from `activationAt - window` until the pending action is resolvable.
    function isPaused() external view returns (bool) {
        (PendingAction memory a,) = _effective();
        if (!a.active || block.timestamp < _windowStart(a.activationAt)) return false;
        (bool ok,,) = _check(a);
        return !ok;
    }

    /// @notice The effective action: the stored one if active, else the lazy onchain schedule (active, pre
    /// values read now), else the last stored action with active = false.
    function pendingAction() external view returns (PendingAction memory a) {
        (a,) = _effective();
    }

    /// @return start `activationAt - window` (floored at 0); both zero when nothing is pending.
    function pauseWindow() external view returns (uint64 start, uint64 activationAt) {
        (PendingAction memory a,) = _effective();
        if (!a.active) return (0, 0);
        return (_windowStart(a.activationAt), a.activationAt);
    }

    /// @notice True when a pending action passes the post-activation consistency check.
    function resolvable() external view returns (bool ok) {
        (PendingAction memory a,) = _effective();
        if (!a.active) return false;
        (ok,,) = _check(a);
    }

    /// @notice The token's current multiplier (first value of getCurrentMultiplier), 1e18 = 1.0.
    function currentMultiplier() external view returns (uint256 m) {
        (m,,) = token.getCurrentMultiplier();
    }

    // ---------------------------------------------------------------- internals

    function _store(uint64 activationAt, uint256 expectedMultiplier) internal {
        (uint256 preMultiplier,,) = token.getCurrentMultiplier();
        (uint256 prePrice,) = priceSource.latestPrice();
        _action = PendingAction(activationAt, expectedMultiplier, preMultiplier, prePrice, true);
        emit ActionPosted(activationAt, expectedMultiplier, preMultiplier, prePrice);
    }

    function _settle(uint64 activationAt) internal {
        if (activationAt > lastResolvedActivation) lastResolvedActivation = activationAt;
    }

    function _effective() internal view returns (PendingAction memory a, bool stored) {
        if (_action.active) return (_action, true);
        (bool scheduled, uint64 activationAt, uint256 newMultiplier) = _onchainSchedule();
        if (!scheduled) return (_action, false);
        (uint256 price,) = priceSource.latestPrice();
        a = PendingAction(activationAt, newMultiplier, token.multiplier(), price, true);
    }

    function _onchainSchedule() internal view returns (bool scheduled, uint64 activationAt, uint256 newMultiplier) {
        uint256 at = token.newMultiplierActivationTime();
        newMultiplier = token.newMultiplier();
        // An activation beyond uint64 is centuries away and cannot open a window yet.
        scheduled = at > lastResolvedActivation && at <= type(uint64).max && newMultiplier > 0;
        activationAt = uint64(at);
    }

    function _windowStart(uint64 activationAt) internal view returns (uint64) {
        return activationAt > window ? activationAt - window : 0;
    }

    /// @dev Fails closed: no post-activation price, a zero price or a multiplier that is not the expected one
    /// keeps the pause, and so does a zero pre-action reference (a positive `post` is never within 0 of 0).
    function _check(PendingAction memory a) internal view returns (bool ok, uint256 current, uint256 price) {
        uint64 fetchedAt;
        (price, fetchedAt) = priceSource.latestPrice();
        (current,,) = token.getCurrentMultiplier();
        if (block.timestamp <= a.activationAt || fetchedAt <= a.activationAt) return (false, current, price);
        if (price == 0 || current != a.expectedMultiplier) return (false, current, price);
        uint256 pre = a.preActionPrice * a.preActionMultiplier;
        uint256 post = price * current;
        uint256 diff = post > pre ? post - pre : pre - post;
        ok = diff * BPS <= toleranceBps * pre;
    }
}
