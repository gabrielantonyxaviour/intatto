// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Kinked utilization model. Rates are annual, in basis points; the market converts to per second.
/// Below the kink: base + slope1 * u / kink. Above: base + slope1 + slope2 * (u - kink) / (1 - kink).
contract InterestRateModel is Ownable {
    uint256 public constant YEAR = 365 days;

    uint256 public baseBps = 200; // 2% APR at zero utilization
    uint256 public slope1Bps = 800; // +8% up to the kink
    uint256 public slope2Bps = 10_000; // +100% from the kink to full utilization
    uint256 public kinkBps = 8000; // 80%

    event ParamsSet(uint256 baseBps, uint256 slope1Bps, uint256 slope2Bps, uint256 kinkBps);

    error BadParams();

    constructor() Ownable(msg.sender) {}

    function setParams(uint256 base, uint256 slope1, uint256 slope2, uint256 kink) external onlyOwner {
        if (kink == 0 || kink >= 10_000 || base + slope1 + slope2 > 50_000) revert BadParams();
        (baseBps, slope1Bps, slope2Bps, kinkBps) = (base, slope1, slope2, kink);
        emit ParamsSet(base, slope1, slope2, kink);
    }

    /// @param utilizationBps borrowed / (idle + borrowed), in basis points.
    /// @return annual borrow rate in basis points.
    function borrowRateBps(uint256 utilizationBps) public view returns (uint256) {
        if (utilizationBps > 10_000) utilizationBps = 10_000;
        if (utilizationBps <= kinkBps) return baseBps + slope1Bps * utilizationBps / kinkBps;
        return baseBps + slope1Bps + slope2Bps * (utilizationBps - kinkBps) / (10_000 - kinkBps);
    }

    /// @return per-second borrow rate, 18 decimals.
    function borrowRatePerSecond(uint256 utilizationBps) external view returns (uint256) {
        return borrowRateBps(utilizationBps) * 1e14 / YEAR;
    }

    /// @return annual supply rate in basis points after the reserve factor.
    function supplyRateBps(uint256 utilizationBps, uint256 reserveFactorBps) external view returns (uint256) {
        return borrowRateBps(utilizationBps) * utilizationBps / 10_000 * (10_000 - reserveFactorBps) / 10_000;
    }
}
