// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IDepthCaps} from "./interfaces/IDepthCaps.sol";

/// @notice Per-market USDG credit caps (6 decimals). The keeper posts a target it computed off-chain from
/// QuoterV2 sell quotes inside a 2% slippage budget, times a haircut. This contract stores that result.
///
/// A lower target applies immediately. A higher target rises by whole hours from the last checkpoint:
///   step = max(lastEffective * stepBps / 10_000, minStepUsdg)
///   cap  = min(target, lastEffective + hours * step)
/// The step does not compound between posts. Each post checkpoints the effective cap and restarts the hour.
/// The first post for a market starts at zero so a new market ramps, unless the owner called setInitialCap.
contract DepthCapRegistry is IDepthCaps, Ownable {
    uint256 public constant BPS = 10_000;

    struct Checkpoint {
        uint256 target;
        uint256 lastEffective;
        uint256 slice;
        uint64 lastUpdate;
        bool initialized;
    }

    address public keeper;
    /// @notice Fraction of the checkpointed effective added per whole hour, in basis points. Default 25%.
    uint256 public stepBps = 2500;
    /// @notice Smallest USDG rise per whole hour (6 decimals). Default 100 USDG.
    uint256 public minStepUsdg = 100e6;

    mapping(address => Checkpoint) internal _markets;

    event KeeperSet(address keeper);
    event StepSet(uint256 stepBps, uint256 minStepUsdg);
    event InitialCapSet(address indexed market, uint256 capUsdg);

    error NotKeeper();
    error ZeroAddress();

    constructor(address keeper_) Ownable(msg.sender) {
        if (keeper_ == address(0)) revert ZeroAddress();
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    /// @notice Keeper posts the next target and the liquidation slice. Both are USDG with 6 decimals.
    function post(address market, uint256 targetCapUsdg, uint256 sliceUsdg) external {
        if (msg.sender != keeper) revert NotKeeper();
        uint256 effectiveNow = _checkpoint(market, targetCapUsdg);
        _markets[market].slice = sliceUsdg;
        emit CapPosted(market, targetCapUsdg, sliceUsdg, effectiveNow);
    }

    function setKeeper(address keeper_) external onlyOwner {
        if (keeper_ == address(0)) revert ZeroAddress();
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    function setStep(uint256 stepBps_, uint256 minStepUsdg_) external onlyOwner {
        stepBps = stepBps_;
        minStepUsdg = minStepUsdg_;
        emit StepSet(stepBps_, minStepUsdg_);
    }

    /// @notice Sets effective and target to `cap` immediately, skipping the ramp. Slice is left as posted.
    function setInitialCap(address market, uint256 cap) external onlyOwner {
        Checkpoint storage c = _markets[market];
        c.target = cap;
        c.lastEffective = cap;
        c.lastUpdate = uint64(block.timestamp);
        c.initialized = true;
        emit InitialCapSet(market, cap);
    }

    function capOf(address market) public view returns (uint256) {
        Checkpoint storage c = _markets[market];
        if (!c.initialized) return 0;
        return _cap(c);
    }

    function sliceOf(address market) external view returns (uint256) {
        uint256 slice = _markets[market].slice;
        uint256 cap = capOf(market);
        return slice > cap ? cap : slice;
    }

    /// @notice True when `totalDebtAfter` is strictly above the effective cap. Equal to the cap is allowed.
    function wouldExceed(address market, uint256 totalDebtAfter) external view returns (bool) {
        return totalDebtAfter > capOf(market);
    }

    function _checkpoint(address market, uint256 newTarget) internal returns (uint256 effectiveNow) {
        Checkpoint storage c = _markets[market];
        if (!c.initialized) {
            c.initialized = true;
            c.lastEffective = 0;
            c.lastUpdate = uint64(block.timestamp);
            c.target = newTarget;
            return 0;
        }
        effectiveNow = _cap(c);
        if (newTarget < effectiveNow) effectiveNow = newTarget;
        c.lastEffective = effectiveNow;
        // Keep the unfinished hour: frequent posts must not reset the ramp's clock.
        c.lastUpdate = uint64(block.timestamp - ((block.timestamp - c.lastUpdate) % 1 hours));
        c.target = newTarget;
    }

    /// @dev Whole hours since the checkpoint. Step is fixed from `lastEffective` until the next post.
    function _cap(Checkpoint storage c) internal view returns (uint256) {
        uint256 target = c.target;
        uint256 base = c.lastEffective;
        if (target <= base) return target;
        uint256 elapsedHours = (block.timestamp - c.lastUpdate) / 1 hours;
        if (elapsedHours == 0) return base;
        uint256 step = _step(base);
        if (step == 0) return base;
        if (elapsedHours > (type(uint256).max - base) / step) return target;
        uint256 allowed = base + elapsedHours * step;
        return allowed > target ? target : allowed;
    }

    function _step(uint256 effective) internal view returns (uint256) {
        uint256 proportional;
        if (stepBps == 0 || effective == 0) proportional = 0;
        else if (effective > type(uint256).max / stepBps) proportional = type(uint256).max;
        else proportional = effective * stepBps / BPS;
        return proportional > minStepUsdg ? proportional : minStepUsdg;
    }
}
