// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPriceSource} from "./interfaces/IPriceSource.sol";
import {ISessionRisk} from "./interfaces/ISessionRisk.sol";
import {CollateralMarketBase} from "./CollateralMarketBase.sol";

/// @notice One xStock collateral market (ticker-generic: token, wrapper, price relay and guard are constructor
/// config, so SPYx is a second deployment). Collateral is held as the issuer's wrapper shares and valued as
/// convertToAssets(shares) * relayed price. New borrowing follows the session; the liquidation threshold never does.
/// repay() and addCollateral() never read a price guard.
contract CollateralMarket is CollateralMarketBase {
    using SafeERC20 for IERC20;

    constructor(Config memory c) CollateralMarketBase(c) {}

    // ───────────── collateral ─────────────

    /// @notice Deposit the xStock; it is wrapped through the issuer's ERC-4626 wrapper and held as shares.
    function addCollateral(uint256 tokenAmount) external nonReentrant returns (uint256 shares) {
        if (tokenAmount == 0) revert ZeroAmount();
        IERC20(address(token)).safeTransferFrom(msg.sender, address(this), tokenAmount);
        uint256 before = wrapper.balanceOf(address(this));
        IERC20(address(token)).forceApprove(address(wrapper), tokenAmount);
        wrapper.deposit(tokenAmount, address(this));
        shares = wrapper.balanceOf(address(this)) - before;
        _credit(msg.sender, shares);
        emit CollateralAdded(msg.sender, tokenAmount, shares);
    }

    /// @notice Deposit wrapper shares directly.
    function addCollateralShares(uint256 shares) external nonReentrant {
        if (shares == 0) revert ZeroAmount();
        IERC20(address(wrapper)).safeTransferFrom(msg.sender, address(this), shares);
        _credit(msg.sender, shares);
        emit CollateralAdded(msg.sender, 0, shares);
    }

    function _credit(address user, uint256 shares) internal {
        positions[user].shares += shares;
        totalShares += shares;
    }

    /// @notice Withdraw collateral. With no debt this needs no price. With debt it adds risk, so the price must be
    /// fresh and the position must stay within the current session's limit. `unwrap` redeems to the xStock.
    function withdrawCollateral(uint256 shares, bool unwrap) external nonReentrant returns (uint256 out) {
        if (shares == 0) revert ZeroAmount();
        accrue();
        Position storage p = positions[msg.sender];
        p.shares -= shares;
        totalShares -= shares;
        uint256 debt = debtOf(msg.sender);
        if (debt > 0) {
            if (!priceSource.guardStatus().fresh) revert StalePrice();
            uint256 maxLtv = sessionRisk.maxLtvBps();
            uint256 ltv = _ltvBps(debt, valueOf(p.shares));
            if (ltv > maxLtv) revert Unhealthy(ltv, maxLtv);
        }
        if (unwrap) {
            uint256 before = IERC20(address(token)).balanceOf(msg.sender);
            wrapper.redeem(shares, msg.sender, address(this));
            out = IERC20(address(token)).balanceOf(msg.sender) - before;
        } else {
            IERC20(address(wrapper)).safeTransfer(msg.sender, shares);
            out = shares;
        }
        emit CollateralWithdrawn(msg.sender, shares, out, unwrap);
    }

    // ───────────── debt ─────────────

    /// @notice Borrow USDG. Checks, in order: issuer pause, session, session limit, price freshness, TWAP band,
    /// corporate action, ticker cap, USDG peg, vault liquidity. Each refusal is a named error.
    function borrow(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        accrue();
        if (issuerPaused()) revert IssuerPaused();
        if (sessionRisk.currentSession() == ISessionRisk.Session.UNKNOWN) revert UnknownSession();
        uint256 debtAfter = debtOf(msg.sender) + amount;
        uint256 maxLtv = sessionRisk.maxLtvBps();
        uint256 ltv = _ltvBps(debtAfter, valueOf(positions[msg.sender].shares));
        if (ltv > maxLtv) revert SessionLimit(ltv, maxLtv);
        IPriceSource.GuardStatus memory g = priceSource.guardStatus();
        if (!g.fresh) revert StalePrice();
        if (!g.inBand) revert PriceOutOfBand();
        if (corporateActionGuard.isPaused()) revert CorporateActionPending();
        uint256 totalAfter = totalDebt() + amount;
        uint256 cap = depthCaps.capOf(address(this));
        if (totalAfter > cap) revert TickerCapReached(totalAfter, cap);
        if (!g.pegOk) revert UsdgOffPeg();
        uint256 idle = vault.idle();
        if (amount > idle) revert InsufficientLiquidity(idle, amount);
        uint256 debtShares = Math.mulDiv(amount, RAY, borrowIndex, Math.Rounding.Ceil);
        positions[msg.sender].debtShares += debtShares;
        totalDebtShares += debtShares;
        vault.lend(msg.sender, amount);
        emit Borrowed(msg.sender, amount, ltv, maxLtv);
    }

    /// @notice Repay (type(uint256).max repays everything). Never depends on price, session or pauses.
    function repay(uint256 amount) external nonReentrant returns (uint256 paid) {
        return _repayFor(msg.sender, msg.sender, amount);
    }

    function repayFor(address user, uint256 amount) external nonReentrant returns (uint256 paid) {
        return _repayFor(msg.sender, user, amount);
    }

    function _repayFor(address payer, address user, uint256 amount) internal returns (uint256 paid) {
        accrue();
        paid = Math.min(amount, debtOf(user));
        if (paid == 0) revert ZeroAmount();
        usdg.safeTransferFrom(payer, address(this), paid);
        uint256 toReserve = _reduceDebt(user, paid);
        emit Repaid(payer, user, paid, toReserve);
    }

    /// @dev Burns debt worth `amount` (USDG already held here) and routes it: the reserve's pro-rata share of
    /// interest owed to GapReserve, the rest to the vault.
    function _reduceDebt(address user, uint256 amount) internal returns (uint256 toReserve) {
        uint256 debtBefore = totalDebt();
        toReserve = debtBefore == 0 ? 0 : Math.min(reserveFeesOwed, Math.mulDiv(amount, reserveFeesOwed, debtBefore));
        _burnDebt(user, amount, toReserve);
        if (toReserve > 0) usdg.safeTransfer(address(gapReserve), toReserve);
        usdg.safeTransfer(address(vault), amount - toReserve);
    }

    function _burnDebt(address user, uint256 amount, uint256 feesCleared) internal {
        Position storage p = positions[user];
        uint256 s = amount >= debtOf(user) ? p.debtShares : Math.mulDiv(amount, RAY, borrowIndex);
        p.debtShares -= s;
        totalDebtShares -= s;
        reserveFeesOwed -= feesCleared;
    }

    // ───────────── liquidation seam ─────────────

    modifier onlyLiquidator() {
        if (msg.sender != liquidator) revert NotLiquidator();
        _;
    }

    function seize(address user, uint256 shares) external onlyLiquidator nonReentrant {
        if (issuerPaused()) revert IssuerPaused();
        if (corporateActionGuard.isPaused()) revert CorporateActionPending();
        positions[user].shares -= shares;
        totalShares -= shares;
        IERC20(address(wrapper)).safeTransfer(msg.sender, shares);
        emit Seized(user, msg.sender, shares);
    }

    function restore(address user, uint256 shares) external onlyLiquidator nonReentrant {
        IERC20(address(wrapper)).safeTransferFrom(msg.sender, address(this), shares);
        _credit(user, shares);
        emit Restored(user, shares);
    }

    /// @notice The loss waterfall: proceeds repay debt, then pay the penalty (half keeper, half reserve), any
    /// surplus returns to the borrower; with no collateral left, GapReserve covers the shortfall and any
    /// remainder is written off as a lender deficit that lowers share value pro rata.
    function settle(address user, uint256 proceeds, address keeper)
        external
        onlyLiquidator
        nonReentrant
        returns (uint256 repaid, uint256 covered, uint256 deficit)
    {
        accrue();
        usdg.safeTransferFrom(msg.sender, address(this), proceeds);
        repaid = Math.min(debtOf(user), proceeds * 10_000 / (10_000 + PENALTY_BPS));
        uint256 penalty = Math.min(proceeds - repaid, repaid * PENALTY_BPS / 10_000);
        uint256 surplus = proceeds - repaid - penalty;
        if (repaid > 0) _reduceDebt(user, repaid);
        if (penalty > 0) {
            usdg.safeTransfer(keeper, penalty / 2);
            usdg.safeTransfer(address(gapReserve), penalty - penalty / 2);
        }
        if (surplus > 0) usdg.safeTransfer(user, surplus);
        uint256 remaining = debtOf(user);
        if (positions[user].shares == 0 && remaining > 0) (covered, deficit) = _writeOff(user, remaining);
        emit LiquidationSettled(user, keeper, proceeds, repaid, penalty, surplus, covered, deficit);
    }

    /// @dev The remaining debt includes the reserve's share of its interest, which lenders never counted as assets:
    /// that share is forgone, and only the lenders' part is covered by the reserve or recognised as a deficit.
    function _writeOff(address user, uint256 remaining) internal returns (uint256 covered, uint256 deficit) {
        uint256 feesShare = Math.min(reserveFeesOwed, Math.mulDiv(remaining, reserveFeesOwed, totalDebt()));
        uint256 lendersPart = remaining - feesShare;
        uint256 priceBefore = vault.sharePrice();
        covered = gapReserve.cover(lendersPart); // paid straight to the vault
        deficit = lendersPart - covered;
        _burnDebt(user, remaining, feesShare);
        if (deficit > 0) vault.recordDeficit(user, deficit, priceBefore);
    }
}
