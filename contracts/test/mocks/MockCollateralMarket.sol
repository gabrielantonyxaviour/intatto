// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ICollateralMarket} from "../../src/interfaces/ICollateralMarket.sol";
import {IPriceSource} from "../../src/interfaces/IPriceSource.sol";
import {IGapReserve} from "../../src/interfaces/IGapReserve.sol";

/// @notice A minimal market behind the liquidation seam, for BoundedLiquidator tests.
/// Holds wrapper shares per borrower, values them with convertToAssets * price, and settles
/// with the same waterfall shape as CollateralMarket (repay, penalty, surplus, reserve, deficit).
contract MockCollateralMarket is ICollateralMarket {
    address public immutable collateralWrapper;
    address public immutable debtAsset;
    IPriceSource public priceSource;
    IGapReserve public reserve;
    address public liquidator;
    uint256 public liquidationThresholdBps = 6500;
    uint256 public penaltyBps = 500;
    bool public liquidationPaused;
    uint256 public totalDeficit;

    struct Position {
        uint256 shares;
        uint256 debt;
    }

    mapping(address => Position) public positions;

    constructor(address wrapper_, address usdg_, IPriceSource price_, IGapReserve reserve_) {
        collateralWrapper = wrapper_;
        debtAsset = usdg_;
        priceSource = price_;
        reserve = reserve_;
    }

    function setLiquidator(address l) external {
        liquidator = l;
    }

    function setPaused(bool p) external {
        liquidationPaused = p;
    }

    /// Test setup: caller must have transferred `shares` of the wrapper to this contract.
    function open(address borrower, uint256 shares, uint256 debt) external {
        positions[borrower] = Position(shares, debt);
    }

    function positionOf(address b) external view returns (uint256, uint256) {
        return (positions[b].shares, positions[b].debt);
    }

    function valueUsdg(uint256 shares) public view returns (uint256) {
        (uint256 price,) = priceSource.latestPrice();
        uint256 assets = IERC4626(collateralWrapper).convertToAssets(shares);
        return Math.mulDiv(assets, price, 1e30); // 18 + 18 - 6
    }

    function isLiquidatable(address b) public view returns (bool) {
        Position memory p = positions[b];
        if (p.debt == 0) return false;
        return p.debt * 10_000 > valueUsdg(p.shares) * liquidationThresholdBps;
    }

    modifier onlyLiquidator() {
        require(msg.sender == liquidator, "not liquidator");
        _;
    }

    function seize(address b, uint256 shares) external onlyLiquidator {
        require(!liquidationPaused, "paused");
        positions[b].shares -= shares;
        IERC20(collateralWrapper).transfer(msg.sender, shares);
        emit Seized(b, msg.sender, shares);
    }

    function restore(address b, uint256 shares) external onlyLiquidator {
        IERC20(collateralWrapper).transferFrom(msg.sender, address(this), shares);
        positions[b].shares += shares;
        emit Restored(b, shares);
    }

    function settle(address b, uint256 proceeds, address keeper)
        external
        onlyLiquidator
        returns (uint256 repaid, uint256 covered, uint256 deficit)
    {
        IERC20(debtAsset).transferFrom(msg.sender, address(this), proceeds);
        Position storage p = positions[b];
        repaid = Math.min(p.debt, proceeds * 10_000 / (10_000 + penaltyBps));
        uint256 penalty = Math.min(proceeds - repaid, repaid * penaltyBps / 10_000);
        uint256 surplus = proceeds - repaid - penalty;
        p.debt -= repaid;
        if (penalty > 0) IERC20(debtAsset).transfer(keeper, penalty);
        if (surplus > 0) IERC20(debtAsset).transfer(b, surplus);
        if (p.shares == 0 && p.debt > 0) {
            covered = reserve.cover(p.debt);
            p.debt -= covered;
            deficit = p.debt;
            totalDeficit += deficit;
            p.debt = 0;
        }
        emit LiquidationSettled(b, keeper, proceeds, repaid, penalty, surplus, covered, deficit);
    }
}
