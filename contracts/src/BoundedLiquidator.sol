// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ICollateralMarket} from "./interfaces/ICollateralMarket.sol";
import {IDepthCaps} from "./interfaces/IDepthCaps.sol";
import {ISessionRisk} from "./interfaces/ISessionRisk.sol";
import {IUniswapV3Pool, IUniswapV3SwapCallback} from "./interfaces/external/IUniswapV3.sol";
import {TickMath} from "./lib/TickMath.sol";

/// @notice Liquidates unhealthy positions by selling seized wrapper shares straight into the ticker's
/// Uniswap v3 pool with a price limit at a floor below the oracle. While the market is CLOSED each slice is
/// capped by the depth slice and a floor close to the oracle; a slice that cannot fill at the floor waits,
/// and after `closedTimeout` of waiting the floor widens. OPEN/EXTENDED liquidate the rest at a wider floor.
/// Prices are USDG (6 decimals) per 1e18 wrapper shares throughout.
contract BoundedLiquidator is Ownable, ReentrancyGuard, IUniswapV3SwapCallback {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_FLOOR_BPS = 5_000;
    uint256 public constant MAX_PENALTY_BPS = 2_000;
    uint256 public constant MIN_CLOSED_TIMEOUT = 15 minutes;
    uint256 public constant MAX_CLOSED_TIMEOUT = 7 days;

    ISessionRisk public immutable session;
    IDepthCaps public immutable caps;

    uint256 public openFloorBps = 1_500;
    uint256 public closedFloorBps = 300;
    uint256 public closedTimeoutFloorBps = 800;
    uint256 public closedTimeout = 6 hours;
    /// @notice The market's liquidation penalty, used only to size the shares to sell.
    uint256 public penaltyBps = 500;

    mapping(ICollateralMarket => address) public poolOf;
    /// @notice First time a slice for this borrower had to wait (0 when not waiting).
    mapping(ICollateralMarket => mapping(address => uint256)) public waitingSince;

    struct Plan {
        ISessionRisk.Session session;
        uint256 oraclePrice;
        uint256 floorPrice;
        uint256 shares;
        uint160 sqrtPriceLimitX96;
        bool zeroForOne;
        bool waiting;
    }

    struct ActiveSwap {
        address pool;
        address wrapper;
        bool zeroForOne;
        uint256 maxIn;
    }

    /// Set only for the duration of a swap this contract started; the callback accepts nothing else.
    ActiveSwap private _active;

    event MarketSet(address indexed market, address indexed pool);
    event FloorsSet(uint256 openFloorBps, uint256 closedFloorBps, uint256 closedTimeoutFloorBps);
    event ClosedTimeoutSet(uint256 closedTimeout);
    event PenaltySet(uint256 penaltyBps);
    event SliceWaiting(address indexed market, address indexed borrower, uint8 session, uint256 floorPrice);
    event SliceExecuted(
        address indexed market,
        address indexed borrower,
        uint8 session,
        uint256 sharesSold,
        uint256 proceeds,
        uint256 oraclePrice,
        uint256 floorPrice
    );
    event WaitingCleared(address indexed market, address indexed borrower);

    error UnknownMarket();
    error PoolMismatch();
    error InvalidParam();
    error NotLiquidatable();
    error LiquidationPaused();
    error StalePrice();
    error NothingToSell();
    error MinOutNotMet(uint256 proceeds, uint256 minOut);
    error UnauthorizedCallback();
    error BadCallbackAmount();
    error StillLiquidatable();

    constructor(ISessionRisk session_, IDepthCaps caps_) Ownable(msg.sender) {
        if (address(session_) == address(0) || address(caps_) == address(0)) revert InvalidParam();
        session = session_;
        caps = caps_;
    }

    // ───────────── owner ─────────────

    /// @notice Registers `market` with the Uniswap v3 pool pairing its wrapper with its debt asset.
    /// `pool == address(0)` deregisters the market.
    function setMarket(ICollateralMarket market, address pool) external onlyOwner {
        if (pool != address(0)) {
            address t0 = IUniswapV3Pool(pool).token0();
            address t1 = IUniswapV3Pool(pool).token1();
            address w = market.collateralWrapper();
            address d = market.debtAsset();
            if (!((t0 == w && t1 == d) || (t0 == d && t1 == w))) revert PoolMismatch();
        }
        poolOf[market] = pool;
        emit MarketSet(address(market), pool);
    }

    function setFloors(uint256 openBps, uint256 closedBps, uint256 closedTimeoutBps) external onlyOwner {
        if (openBps > MAX_FLOOR_BPS || closedTimeoutBps > MAX_FLOOR_BPS || closedBps > closedTimeoutBps) {
            revert InvalidParam();
        }
        openFloorBps = openBps;
        closedFloorBps = closedBps;
        closedTimeoutFloorBps = closedTimeoutBps;
        emit FloorsSet(openBps, closedBps, closedTimeoutBps);
    }

    function setClosedTimeout(uint256 timeout) external onlyOwner {
        if (timeout < MIN_CLOSED_TIMEOUT || timeout > MAX_CLOSED_TIMEOUT) revert InvalidParam();
        closedTimeout = timeout;
        emit ClosedTimeoutSet(timeout);
    }

    function setPenaltyBps(uint256 bps) external onlyOwner {
        if (bps > MAX_PENALTY_BPS) revert InvalidParam();
        penaltyBps = bps;
        emit PenaltySet(bps);
    }

    // ───────────── liquidation ─────────────

    /// @notice Permissionless. Sells one slice of `borrower`'s collateral; the caller receives the keeper
    /// half of the penalty. Returns (0, 0) and emits SliceWaiting when the pool cannot fill at the floor.
    function liquidate(ICollateralMarket market, address borrower)
        external
        nonReentrant
        returns (uint256 sharesSold, uint256 proceeds)
    {
        Plan memory p = previewSlice(market, borrower);
        if (p.waiting) {
            _wait(market, borrower, p);
            return (0, 0);
        }
        (sharesSold, proceeds) = _sell(market, borrower, p);
        if (sharesSold == 0) {
            _wait(market, borrower, p);
            return (0, 0);
        }
        uint256 minOut = sharesSold * p.floorPrice / 1e18;
        if (proceeds < minOut) revert MinOutNotMet(proceeds, minOut);

        IERC20(market.debtAsset()).forceApprove(address(market), proceeds);
        market.settle(borrower, proceeds, msg.sender);
        if (waitingSince[market][borrower] != 0) delete waitingSince[market][borrower];
        emit SliceExecuted(
            address(market), borrower, uint8(p.session), sharesSold, proceeds, p.oraclePrice, p.floorPrice
        );
    }

    /// @notice Permissionless: drops a stale waiting clock once the borrower is healthy again.
    function clearWaiting(ICollateralMarket market, address borrower) external {
        if (market.isLiquidatable(borrower)) revert StillLiquidatable();
        delete waitingSince[market][borrower];
        emit WaitingCleared(address(market), borrower);
    }

    /// @notice What `liquidate` would do now; reverts with the same errors.
    function previewSlice(ICollateralMarket market, address borrower) public view returns (Plan memory p) {
        address pool = poolOf[market];
        if (pool == address(0)) revert UnknownMarket();
        if (!market.isLiquidatable(borrower)) revert NotLiquidatable();
        p.session = session.currentSession();
        if (
            market.liquidationPaused() || p.session == ISessionRisk.Session.UNKNOWN
                || p.session == ISessionRisk.Session.HALTED || p.session == ISessionRisk.Session.CORPORATE_ACTION
        ) revert LiquidationPaused();
        if (!market.priceSource().guardStatus().fresh) revert StalePrice();

        p.oraclePrice = oracleWrapperPrice(market);
        p.floorPrice = p.oraclePrice * (BPS - floorBpsFor(market, borrower, p.session)) / BPS;
        if (p.floorPrice == 0) revert StalePrice();
        (p.sqrtPriceLimitX96, p.zeroForOne) = priceLimitOf(market, p.floorPrice);
        (uint160 spot,,,,,,) = IUniswapV3Pool(pool).slot0();
        p.waiting = p.zeroForOne ? spot <= p.sqrtPriceLimitX96 : spot >= p.sqrtPriceLimitX96;

        (uint256 collateral, uint256 debt) = market.positionOf(borrower);
        uint256 owed = Math.mulDiv(debt, BPS + penaltyBps, BPS, Math.Rounding.Ceil);
        p.shares = Math.min(Math.mulDiv(owed, 1e18, p.floorPrice, Math.Rounding.Ceil), collateral);
        if (p.session == ISessionRisk.Session.CLOSED) {
            p.shares = Math.min(p.shares, caps.sliceOf(address(market)) * 1e18 / p.oraclePrice);
        }
        if (p.shares == 0) revert NothingToSell();
    }

    /// @notice Oracle value of 1e18 wrapper shares in USDG (6 decimals), treating USDG as $1.
    function oracleWrapperPrice(ICollateralMarket market) public view returns (uint256 price) {
        (uint256 quoteE18,) = market.priceSource().latestPrice();
        uint256 assetsPerShare = IERC4626(market.collateralWrapper()).convertToAssets(1e18);
        price = Math.mulDiv(quoteE18, assetsPerShare, 1e30);
        if (price == 0) revert StalePrice();
    }

    /// @notice Discount below the oracle for `borrower` in `s`.
    function floorBpsFor(ICollateralMarket market, address borrower, ISessionRisk.Session s)
        public
        view
        returns (uint256)
    {
        if (s != ISessionRisk.Session.CLOSED) return openFloorBps;
        uint256 since = waitingSince[market][borrower];
        if (since != 0 && block.timestamp >= since + closedTimeout) return closedTimeoutFloorBps;
        return closedFloorBps;
    }

    /// @notice The pool price limit at which selling one more wrapper share nets exactly `floorPrice` after
    /// the pool fee, in the pool's sqrt(token1/token0) X96 space, rounded so the swap never goes below it.
    /// Wrapper = token0: the sale pushes the price down (zeroForOne) and the limit sits below spot.
    /// Wrapper = token1 (the real NVDA pool): the price rises (oneForZero) and the limit sits above spot.
    function priceLimitOf(ICollateralMarket market, uint256 floorPrice)
        public
        view
        returns (uint160 sqrtPriceLimitX96, bool zeroForOne)
    {
        IUniswapV3Pool pool = IUniswapV3Pool(poolOf[market]);
        if (address(pool) == address(0)) revert UnknownMarket();
        if (floorPrice == 0) revert InvalidParam();
        zeroForOne = pool.token0() == market.collateralWrapper();
        uint256 feeKeep = 1e6 - pool.fee();
        uint256 sqrtLimit;
        if (zeroForOne) {
            // token1/token0 = USDG units per share unit = floor * 1e6 / feeKeep / 1e18; round the limit up.
            uint256 ratioX192 = Math.mulDiv(floorPrice * 1e6, 1 << 192, feeKeep * 1e18, Math.Rounding.Ceil);
            sqrtLimit = Math.sqrt(ratioX192, Math.Rounding.Ceil);
        } else {
            // token1/token0 = share units per USDG unit = 1e18 * feeKeep / (floor * 1e6); round the limit down.
            uint256 ratioX192 = Math.mulDiv(feeKeep * 1e18, 1 << 192, floorPrice * 1e6, Math.Rounding.Floor);
            sqrtLimit = Math.sqrt(ratioX192, Math.Rounding.Floor);
        }
        if (sqrtLimit <= TickMath.MIN_SQRT_RATIO) sqrtLimit = TickMath.MIN_SQRT_RATIO + 1;
        if (sqrtLimit >= TickMath.MAX_SQRT_RATIO) sqrtLimit = TickMath.MAX_SQRT_RATIO - 1;
        sqrtPriceLimitX96 = uint160(sqrtLimit);
    }

    /// @notice Pays the pool in wrapper shares. Only the pool of a swap this contract started, once,
    /// and never more than the shares offered.
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata) external {
        ActiveSwap memory a = _active;
        if (a.pool == address(0) || msg.sender != a.pool) revert UnauthorizedCallback();
        delete _active;
        int256 owed = a.zeroForOne ? amount0Delta : amount1Delta;
        if (owed <= 0 || uint256(owed) > a.maxIn) revert BadCallbackAmount();
        IERC20(a.wrapper).safeTransfer(msg.sender, uint256(owed));
    }

    // ───────────── internal ─────────────

    function _wait(ICollateralMarket market, address borrower, Plan memory p) internal {
        if (waitingSince[market][borrower] == 0) waitingSince[market][borrower] = block.timestamp;
        emit SliceWaiting(address(market), borrower, uint8(p.session), p.floorPrice);
    }

    /// @dev Seizes `p.shares`, swaps them with the floor as price limit and restores what did not fill.
    function _sell(ICollateralMarket market, address borrower, Plan memory p)
        internal
        returns (uint256 sold, uint256 proceeds)
    {
        IERC20 wrapper = IERC20(market.collateralWrapper());
        IERC20 usdg = IERC20(market.debtAsset());
        address pool = poolOf[market];

        market.seize(borrower, p.shares);
        uint256 sharesBefore = wrapper.balanceOf(address(this));
        uint256 usdgBefore = usdg.balanceOf(address(this));
        _active = ActiveSwap(pool, address(wrapper), p.zeroForOne, p.shares);
        IUniswapV3Pool(pool).swap(address(this), p.zeroForOne, SafeCast.toInt256(p.shares), p.sqrtPriceLimitX96, "");
        delete _active;
        sold = sharesBefore - wrapper.balanceOf(address(this));
        proceeds = usdg.balanceOf(address(this)) - usdgBefore;

        if (sold < p.shares) {
            wrapper.forceApprove(address(market), p.shares - sold);
            market.restore(borrower, p.shares - sold);
        }
    }
}
