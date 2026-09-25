// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ICollateralMarket} from "./interfaces/ICollateralMarket.sol";
import {IPriceSource} from "./interfaces/IPriceSource.sol";
import {ISessionRisk} from "./interfaces/ISessionRisk.sol";
import {ICorporateActionGuard} from "./interfaces/ICorporateActionGuard.sol";
import {IDepthCaps} from "./interfaces/IDepthCaps.sol";
import {IGapReserve} from "./interfaces/IGapReserve.sol";
import {IXStock, IWrappedXStock} from "./interfaces/external/IXStock.sol";
import {LendingVault} from "./LendingVault.sol";
import {InterestRateModel} from "./InterestRateModel.sol";

/// @notice Config, storage, interest and valuation for CollateralMarket (split out to keep files small).
abstract contract CollateralMarketBase is ICollateralMarket, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Config {
        string symbol;
        IXStock token;
        IWrappedXStock wrapper;
        IERC20 usdg;
        LendingVault vault;
        ISessionRisk sessionRisk;
        IPriceSource priceSource;
        ICorporateActionGuard corporateActionGuard;
        IDepthCaps depthCaps;
        IGapReserve gapReserve;
        InterestRateModel rateModel;
    }

    struct Position {
        uint256 shares;
        uint256 debtShares;
    }

    uint256 internal constant RAY = 1e27;
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 6500;
    uint256 public constant PENALTY_BPS = 500;
    uint256 public constant RESERVE_FACTOR_BPS = 2000;

    string public symbol;
    IXStock public immutable token;
    IWrappedXStock public immutable wrapper;
    IERC20 public immutable usdg;
    LendingVault public immutable vault;
    ISessionRisk public immutable sessionRisk;
    IPriceSource public immutable priceSource;
    ICorporateActionGuard public immutable corporateActionGuard;
    IDepthCaps public immutable depthCaps;
    IGapReserve public immutable gapReserve;
    InterestRateModel public immutable rateModel;
    address public liquidator;

    mapping(address => Position) public positions;
    uint256 public totalShares;
    uint256 public totalDebtShares;
    uint256 public borrowIndex = RAY;
    uint256 public lastAccrual;
    uint256 public reserveFeesOwed;

    event CollateralAdded(address indexed user, uint256 tokenAmount, uint256 shares);
    event CollateralWithdrawn(address indexed user, uint256 shares, uint256 tokenAmountOut, bool unwrapped);
    event Borrowed(address indexed user, uint256 amount, uint256 ltvAfterBps, uint256 maxLtvBps);
    event Repaid(address indexed payer, address indexed user, uint256 amount, uint256 toReserve);
    event LiquidatorSet(address liquidator);

    error ZeroAmount();
    error IssuerPaused();
    error UnknownSession();
    error SessionLimit(uint256 ltvAfterBps, uint256 maxLtvBps);
    error StalePrice();
    error PriceOutOfBand();
    error CorporateActionPending();
    error TickerCapReached(uint256 totalDebtAfter, uint256 cap);
    error UsdgOffPeg();
    error InsufficientLiquidity(uint256 idle, uint256 requested);
    error Unhealthy(uint256 ltvAfterBps, uint256 maxLtvBps);
    error NotLiquidator();

    constructor(Config memory c) Ownable(msg.sender) {
        symbol = c.symbol;
        (token, wrapper, usdg, vault) = (c.token, c.wrapper, c.usdg, c.vault);
        (sessionRisk, priceSource, corporateActionGuard) = (c.sessionRisk, c.priceSource, c.corporateActionGuard);
        (depthCaps, gapReserve, rateModel) = (c.depthCaps, c.gapReserve, c.rateModel);
        lastAccrual = block.timestamp;
    }

    function setLiquidator(address l) external onlyOwner {
        liquidator = l;
        emit LiquidatorSet(l);
    }

    // ───────────── interest ─────────────

    function _pending() internal view returns (uint256 index, uint256 fees) {
        index = borrowIndex;
        fees = reserveFeesOwed;
        uint256 dt = block.timestamp - lastAccrual;
        if (dt == 0 || totalDebtShares == 0) return (index, fees);
        uint256 debt = Math.mulDiv(totalDebtShares, index, RAY);
        uint256 factor = rateModel.borrowRatePerSecond(_utilizationBps(debt)) * dt; // 18 decimals
        uint256 interest = Math.mulDiv(debt, factor, 1e18);
        index += Math.mulDiv(index, factor, 1e18);
        fees += interest * RESERVE_FACTOR_BPS / 10_000;
    }

    function accrue() public {
        (borrowIndex, reserveFeesOwed) = _pending();
        lastAccrual = block.timestamp;
    }

    function _utilizationBps(uint256 debt) internal view returns (uint256) {
        uint256 total = debt + vault.idle();
        return total == 0 ? 0 : debt * 10_000 / total;
    }

    function totalDebt() public view returns (uint256) {
        (uint256 index,) = _pending();
        return Math.mulDiv(totalDebtShares, index, RAY, Math.Rounding.Ceil);
    }

    /// @notice USDG owed to the vault: total debt minus the reserve's share of interest.
    function vaultDebt() external view returns (uint256) {
        (uint256 index, uint256 fees) = _pending();
        uint256 debt = Math.mulDiv(totalDebtShares, index, RAY, Math.Rounding.Ceil);
        return debt > fees ? debt - fees : 0;
    }

    function debtOf(address user) public view returns (uint256) {
        (uint256 index,) = _pending();
        return Math.mulDiv(positions[user].debtShares, index, RAY, Math.Rounding.Ceil);
    }

    // ───────────── valuation ─────────────

    /// @notice USDG value (6 decimals) of wrapper shares at the relayed price: convertToAssets(shares) * price.
    function valueOf(uint256 shares) public view returns (uint256) {
        (uint256 price,) = priceSource.latestPrice();
        return Math.mulDiv(wrapper.convertToAssets(shares), price, 1e30);
    }

    function positionOf(address user) external view returns (uint256, uint256) {
        return (positions[user].shares, debtOf(user));
    }

    function isLiquidatable(address user) public view returns (bool) {
        uint256 debt = debtOf(user);
        return debt > 0 && debt * 10_000 > valueOf(positions[user].shares) * LIQUIDATION_THRESHOLD_BPS;
    }

    function issuerPaused() public view returns (bool) {
        return token.isPaused() || wrapper.isPaused();
    }

    function liquidationPaused() public view returns (bool) {
        return issuerPaused() || corporateActionGuard.isPaused();
    }

    function collateralWrapper() external view returns (address) {
        return address(wrapper);
    }

    function debtAsset() external view returns (address) {
        return address(usdg);
    }

    function _ltvBps(uint256 debt, uint256 value) internal pure returns (uint256) {
        if (debt == 0) return 0;
        return value == 0 ? type(uint256).max : Math.mulDiv(debt, 10_000, value, Math.Rounding.Ceil);
    }
}
