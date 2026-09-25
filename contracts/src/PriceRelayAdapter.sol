// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IPriceSource} from "./interfaces/IPriceSource.sol";
import {ISessionRisk} from "./interfaces/ISessionRisk.sol";
import {IWrappedXStock} from "./interfaces/external/IXStock.sol";
import {IUniswapV3Pool} from "./interfaces/external/IUniswapV3.sol";
import {IAggregatorV3} from "./interfaces/external/IAggregatorV3.sol";
import {OracleLibrary} from "./lib/OracleLibrary.sol";

/// @title PriceRelayAdapter
/// @notice Relays the issuer's indicative price for ONE underlying xStock token (USD, 18 decimals), the `quote`
/// of api.xstocks.fi price-data. One instance per ticker. The quote has NO source timestamp: the adapter stores
/// the keeper's fetch time, which proves keeper liveness only, and `sourceTimestamp` is always 0 in events.
/// Each post is guarded onchain against the keeper's fetch time, Chainlink USDG/USD, the pool's TWAP and the last
/// accepted post. A failed guard never reverts: it emits PriceRejected and leaves the stored price unchanged.
/// @dev Units. Wrapper price (USD per 1e18 wrapper shares, 18 dec) = quoteE18 * wrapper.convertToAssets(1e18) / 1e18;
/// the issuer multiplier is inside convertToAssets and is never applied again. TWAP: the pool's arithmetic-mean
/// tick over `twapWindow` gives USDG (6 dec) per 1e18 shares, converted to USD 18 dec with the 8-dec USDG/USD
/// answer: usdgPerShare * 1e12 * answer / 1e8. Deviations are rounded UP, so `bps > limit` is exact.
contract PriceRelayAdapter is IPriceSource, Ownable {
    /// Checked in this order; the first failure is the reported reason.
    enum RejectReason {FutureFetch, StaleFetch, NotNewer, UsdgStale, UsdgOffPeg, TwapUnavailable, OutOfBand, MaxMove}

    uint256 internal constant BPS = 10_000;
    int256 internal constant ONE_USD_E8 = 1e8;
    uint256 public constant MAX_BAND_BPS = 5_000;
    /// Wide enough for the owner to let a post through after a long keeper outage.
    uint256 public constant MAX_MOVE_BPS = 100_000;

    IWrappedXStock public immutable wrapper;
    address public immutable pool;
    address public immutable usdg;
    IAggregatorV3 public immutable usdgUsdFeed;
    ISessionRisk public immutable sessionRisk;

    address public keeper;
    uint256 public bandOpenBps = 300;
    uint256 public bandOtherBps = 800;
    uint256 public maxMoveBps = 1_500;
    uint256 public maxFetchAge = 5 minutes;
    uint256 public priceLiveness = 30 minutes;
    uint256 public usdgMaxAge = 26 hours;
    uint256 public pegBps = 100;
    uint32 public twapWindow = 1_800;

    uint256 internal _quoteE18;
    uint64 internal _fetchedAt;
    /// @notice Implied wrapper price at the last accepted post (the MaxMove reference). Zero before the first.
    uint256 public lastWrapperPrice;

    /// What one post evaluates to; every field is emitted.
    struct Eval {
        uint256 wrapperPrice;
        uint256 twap;
        uint256 deviation;
        uint256 move;
        int256 answer;
    }

    /// @param deviationBps |wrapper - twap| / twap in bps, rounded up.
    /// @param moveBps |wrapper - lastWrapperPrice| / lastWrapperPrice in bps, rounded up (0 on the first post).
    event PricePosted(uint256 quoteE18, uint256 wrapperPriceE18, uint256 twapWrapperPriceE18, uint256 deviationBps,
        uint256 moveBps, int256 usdgAnswer, uint64 fetchedAt, uint64 sourceTimestamp);
    /// @notice `reason` is a RejectReason. twap and deviation are 0 when the TWAP check was not reached.
    /// deviationBps is always vs the TWAP; a MaxMove's size follows from the last PricePosted wrapper price.
    event PriceRejected(uint8 reason, uint256 quoteE18, uint256 wrapperPriceE18, uint256 twapWrapperPriceE18,
        uint256 deviationBps, uint64 fetchedAt);
    event KeeperSet(address keeper);
    event BandsSet(uint256 openBps, uint256 otherBps);
    event MaxMoveSet(uint256 maxMoveBps);
    event LivenessSet(uint256 maxFetchAge, uint256 priceLiveness);
    event UsdgLimitsSet(uint256 maxAge, uint256 pegBps);
    event TwapWindowSet(uint32 twapWindow);

    error NotKeeper();
    error ZeroAddress();
    error PoolMismatch();
    error WrongDecimals();
    error InvalidBands();
    error InvalidMaxMove();
    error InvalidLiveness();
    error InvalidUsdgLimits();
    error InvalidTwapWindow();

    constructor(
        address keeper_,
        IWrappedXStock wrapper_,
        address pool_,
        address usdg_,
        IAggregatorV3 usdgUsdFeed_,
        ISessionRisk sessionRisk_
    ) Ownable(msg.sender) {
        if (
            keeper_ == address(0) || address(wrapper_) == address(0) || pool_ == address(0) || usdg_ == address(0)
                || address(usdgUsdFeed_) == address(0) || address(sessionRisk_) == address(0)
        ) revert ZeroAddress();
        (address t0, address t1) = (IUniswapV3Pool(pool_).token0(), IUniswapV3Pool(pool_).token1());
        if (!((t0 == address(wrapper_) && t1 == usdg_) || (t0 == usdg_ && t1 == address(wrapper_)))) {
            revert PoolMismatch();
        }
        if (wrapper_.decimals() != 18 || IERC20Metadata(usdg_).decimals() != 6 || usdgUsdFeed_.decimals() != 8) {
            revert WrongDecimals();
        }
        wrapper = wrapper_;
        pool = pool_;
        usdg = usdg_;
        usdgUsdFeed = usdgUsdFeed_;
        sessionRisk = sessionRisk_;
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    // ------------------------------------------------------------------ keeper

    /// @notice Keeper only. Relays `quoteE18` (USD per 1e18 underlying token units) fetched at `fetchedAt`.
    /// @return accepted False when a guard rejected the post (see PriceRejected); state is then unchanged.
    function post(uint256 quoteE18, uint64 fetchedAt) external returns (bool accepted) {
        if (msg.sender != keeper) revert NotKeeper();
        RejectReason reason;
        Eval memory e;
        (accepted, reason, e) = _evaluate(quoteE18, fetchedAt);
        if (!accepted) {
            emit PriceRejected(uint8(reason), quoteE18, e.wrapperPrice, e.twap, e.deviation, fetchedAt);
            return false;
        }
        _quoteE18 = quoteE18;
        _fetchedAt = fetchedAt;
        lastWrapperPrice = e.wrapperPrice;
        emit PricePosted(quoteE18, e.wrapperPrice, e.twap, e.deviation, e.move, e.answer, fetchedAt, 0);
    }

    // ------------------------------------------------------------------ views

    /// @inheritdoc IPriceSource
    function latestPrice() external view returns (uint256 priceE18, uint64 fetchedAt) {
        return (_quoteE18, _fetchedAt);
    }

    /// @inheritdoc IPriceSource
    /// @dev inBand compares the STORED quote's implied wrapper price (current multiplier) with the CURRENT TWAP
    /// under the current session's band; false when there is no price or no TWAP.
    function guardStatus() external view returns (GuardStatus memory status) {
        uint256 quote = _quoteE18;
        status.fresh = quote != 0 && block.timestamp - _fetchedAt <= priceLiveness;
        (int256 answer,, bool usdgFresh, bool onPeg) = _usdg();
        status.pegOk = usdgFresh && onPeg;
        if (quote != 0) {
            (bool ok, uint256 twap) = _twapWrapperPrice(answer);
            status.inBand = ok && _diffBps(_toWrapperPrice(quote), twap) <= _band();
        }
    }

    /// @notice Pool TWAP in USD per 1e18 wrapper shares (18 dec) at the current USDG answer. Never reverts:
    /// ok is false when the pool cannot supply `twapWindow`, the USDG answer is not positive, or the price is 0.
    function twapWrapperPrice() external view returns (bool ok, uint256 price) {
        (int256 answer,,,) = _usdg();
        return _twapWrapperPrice(answer);
    }

    /// @notice The stored quote's implied wrapper price at the CURRENT multiplier. Zero before the first post.
    function impliedWrapperPrice() external view returns (uint256) {
        return _toWrapperPrice(_quoteE18);
    }

    /// @notice Chainlink USDG/USD now. ok: positive, updated, not future-dated, within usdgMaxAge and pegBps of $1.
    function usdgStatus() external view returns (int256 answer, uint256 updatedAt, bool ok) {
        bool usdgFresh;
        bool onPeg;
        (answer, updatedAt, usdgFresh, onPeg) = _usdg();
        ok = usdgFresh && onPeg;
    }

    /// @notice Pool TWAP in USD per 1e18 wrapper shares at a USDG/USD answer of `usdgAnswerE8` (8 dec).
    /// Reverts when the pool cannot supply the window (e.g. "OLD"); external so the guards can try/catch it.
    function twapWrapperPriceAt(uint256 usdgAnswerE8) external view returns (uint256) {
        int24 tick = OracleLibrary.consult(pool, twapWindow);
        uint256 usdgPerShare = OracleLibrary.getQuoteAtTick(tick, 1e18, address(wrapper), usdg); // 6 dec
        return Math.mulDiv(usdgPerShare * 1e12, usdgAnswerE8, uint256(ONE_USD_E8));
    }

    // ------------------------------------------------------------------ owner

    function setKeeper(address keeper_) external onlyOwner {
        if (keeper_ == address(0)) revert ZeroAddress();
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    /// @notice Band around the TWAP: `openBps` in the OPEN session, `otherBps` otherwise. 0 < open <= other <= 50%.
    function setBands(uint256 openBps, uint256 otherBps) external onlyOwner {
        if (openBps == 0 || openBps > otherBps || otherBps > MAX_BAND_BPS) revert InvalidBands();
        bandOpenBps = openBps;
        bandOtherBps = otherBps;
        emit BandsSet(openBps, otherBps);
    }

    /// @notice Largest wrapper-price move vs the last accepted post. 0 < bps <= MAX_MOVE_BPS.
    function setMaxMove(uint256 bps) external onlyOwner {
        if (bps == 0 || bps > MAX_MOVE_BPS) revert InvalidMaxMove();
        maxMoveBps = bps;
        emit MaxMoveSet(bps);
    }

    /// @notice 0 < maxFetchAge <= 1h (post acceptance); maxFetchAge <= priceLiveness <= 1 day (guardStatus.fresh).
    function setLiveness(uint256 maxFetchAge_, uint256 priceLiveness_) external onlyOwner {
        if (maxFetchAge_ == 0 || maxFetchAge_ > 1 hours || priceLiveness_ < maxFetchAge_ || priceLiveness_ > 1 days) {
            revert InvalidLiveness();
        }
        maxFetchAge = maxFetchAge_;
        priceLiveness = priceLiveness_;
        emit LivenessSet(maxFetchAge_, priceLiveness_);
    }

    /// @notice USDG/USD answer age 1h..30 days (feed heartbeat is 24h; the wide cap is for a mainnet-fork sandbox that
    /// warps past the feed's last update); peg tolerance 0 < pegBps <= 10%, enforced at any age.
    function setUsdgLimits(uint256 maxAge, uint256 pegBps_) external onlyOwner {
        if (maxAge < 1 hours || maxAge > 30 days || pegBps_ == 0 || pegBps_ > 1_000) revert InvalidUsdgLimits();
        usdgMaxAge = maxAge;
        pegBps = pegBps_;
        emit UsdgLimitsSet(maxAge, pegBps_);
    }

    /// @notice TWAP window, 5 minutes..1 day. The pool's observation cardinality must cover it.
    function setTwapWindow(uint32 seconds_) external onlyOwner {
        if (seconds_ < 5 minutes || seconds_ > 1 days) revert InvalidTwapWindow();
        twapWindow = seconds_;
        emit TwapWindowSet(seconds_);
    }

    // ------------------------------------------------------------------ internal

    /// @dev The guards in RejectReason order; `reason` is meaningful only when `ok` is false.
    function _evaluate(uint256 quoteE18, uint64 fetchedAt)
        internal
        view
        returns (bool ok, RejectReason reason, Eval memory e)
    {
        e.wrapperPrice = _toWrapperPrice(quoteE18);
        if (fetchedAt > block.timestamp) return (false, RejectReason.FutureFetch, e);
        if (block.timestamp - fetchedAt > maxFetchAge) return (false, RejectReason.StaleFetch, e);
        if (fetchedAt <= _fetchedAt) return (false, RejectReason.NotNewer, e);
        (int256 answer,, bool usdgFresh, bool onPeg) = _usdg();
        e.answer = answer;
        if (!usdgFresh) return (false, RejectReason.UsdgStale, e);
        if (!onPeg) return (false, RejectReason.UsdgOffPeg, e);
        (bool twapOk, uint256 twap) = _twapWrapperPrice(answer);
        if (!twapOk) return (false, RejectReason.TwapUnavailable, e);
        e.twap = twap;
        e.deviation = _diffBps(e.wrapperPrice, twap);
        if (e.deviation > _band()) return (false, RejectReason.OutOfBand, e);
        uint256 last = lastWrapperPrice; // zero before the first accepted post: MaxMove is skipped
        if (last != 0) e.move = _diffBps(e.wrapperPrice, last);
        if (e.move > maxMoveBps) return (false, RejectReason.MaxMove, e);
        ok = true;
    }

    function _toWrapperPrice(uint256 quoteE18) internal view returns (uint256) {
        return Math.mulDiv(quoteE18, wrapper.convertToAssets(1e18), 1e18);
    }

    function _twapWrapperPrice(int256 answer) internal view returns (bool ok, uint256 price) {
        if (answer <= 0) return (false, 0);
        try this.twapWrapperPriceAt(uint256(answer)) returns (uint256 p) {
            return (p != 0, p);
        } catch {
            return (false, 0);
        }
    }

    /// @dev A reverting feed reads as stale. The peg test is |answer - 1e8| <= pegBps * 1e8 / 1e4 (exact).
    function _usdg() internal view returns (int256 answer, uint256 updatedAt, bool usdgFresh, bool onPeg) {
        try usdgUsdFeed.latestRoundData() returns (uint80, int256 a, uint256, uint256 u, uint80) {
            (answer, updatedAt) = (a, u);
        } catch {
            return (0, 0, false, false);
        }
        if (answer <= 0) return (answer, updatedAt, false, false);
        usdgFresh = updatedAt != 0 && updatedAt <= block.timestamp && block.timestamp - updatedAt <= usdgMaxAge;
        uint256 off = answer > ONE_USD_E8 ? uint256(answer - ONE_USD_E8) : uint256(ONE_USD_E8 - answer);
        onPeg = off <= pegBps * 1e4;
    }

    function _band() internal view returns (uint256) {
        return sessionRisk.currentSession() == ISessionRisk.Session.OPEN ? bandOpenBps : bandOtherBps;
    }

    /// @dev |a - ref| * 1e4 / ref rounded up; ref > 0.
    function _diffBps(uint256 a, uint256 ref) internal pure returns (uint256) {
        return Math.mulDiv(a > ref ? a - ref : ref - a, BPS, ref, Math.Rounding.Ceil);
    }
}
