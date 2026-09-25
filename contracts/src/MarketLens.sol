// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPriceSource} from "./interfaces/IPriceSource.sol";
import {ISessionRisk} from "./interfaces/ISessionRisk.sol";
import {CollateralMarket} from "./CollateralMarket.sol";
import {LendingVault} from "./LendingVault.sol";

/// @notice Read-only aggregate views for the web app, keeper and credit API: one call per screen.
contract MarketLens {
    struct Account {
        uint256 shares;
        uint256 assets;
        uint256 valueUsdg;
        uint256 debt;
        uint256 ltvBps;
        uint256 maxLtvBps;
        uint256 borrowCapacity;
        uint256 healthFactorE18;
        uint256 liquidationPriceE18;
        bool liquidatable;
        uint256 walletToken;
        uint256 walletUsdg;
        uint256 vaultShares;
        uint256 vaultAssets;
    }

    struct Market {
        uint8 session;
        uint64 periodChangedAt;
        uint64 sessionPostedAt;
        uint256 maxLtvBps;
        uint256 priceE18;
        uint64 fetchedAt;
        bool fresh;
        bool inBand;
        bool pegOk;
        bool corporateActionPaused;
        bool issuerPaused;
        uint256 capUsdg;
        uint256 sliceUsdg;
        uint256 totalDebt;
        uint256 totalShares;
        uint256 totalCollateralValue;
        uint256 assetsPerShare;
        uint256 liquidationThresholdBps;
    }

    struct Vault {
        uint256 idle;
        uint256 totalAssets;
        uint256 totalSupply;
        uint256 sharePrice;
        uint256 utilizationBps;
        uint256 borrowRateBps;
        uint256 supplyRateBps;
        uint256 reserveBalance;
        uint256 totalDeficit;
        uint256 deficitCount;
    }

    function account(CollateralMarket m, address user) external view returns (Account memory a) {
        (a.shares, a.debt) = m.positionOf(user);
        a.assets = m.wrapper().convertToAssets(a.shares);
        a.valueUsdg = m.valueOf(a.shares);
        a.maxLtvBps = m.sessionRisk().maxLtvBps();
        a.ltvBps = a.debt == 0 ? 0 : (a.valueUsdg == 0 ? type(uint256).max : a.debt * 10_000 / a.valueUsdg);
        uint256 limit = a.valueUsdg * a.maxLtvBps / 10_000;
        a.borrowCapacity = limit > a.debt ? limit - a.debt : 0;
        uint256 headroom = _capHeadroom(m);
        uint256 idle = m.vault().idle();
        a.borrowCapacity = Math.min(a.borrowCapacity, Math.min(headroom, idle));
        uint256 lt = m.LIQUIDATION_THRESHOLD_BPS();
        a.healthFactorE18 = a.debt == 0 ? type(uint256).max : Math.mulDiv(a.valueUsdg * lt, 1e18, a.debt * 10_000);
        // Price per token at which debt = assets * price * LT: debt(6) * 1e30 / (assets(18) * LT/1e4).
        a.liquidationPriceE18 = a.assets == 0 ? 0 : Math.mulDiv(a.debt * 1e30, 10_000, a.assets * lt);
        a.liquidatable = m.isLiquidatable(user);
        a.walletToken = IERC20(address(m.token())).balanceOf(user);
        a.walletUsdg = m.usdg().balanceOf(user);
        LendingVault v = m.vault();
        a.vaultShares = v.balanceOf(user);
        a.vaultAssets = v.convertToAssets(a.vaultShares);
    }

    function market(CollateralMarket m) external view returns (Market memory k) {
        ISessionRisk s = m.sessionRisk();
        k.session = uint8(s.currentSession());
        (, k.periodChangedAt, k.sessionPostedAt) = s.lastPost();
        k.maxLtvBps = s.maxLtvBps();
        (k.priceE18, k.fetchedAt) = m.priceSource().latestPrice();
        IPriceSource.GuardStatus memory g = m.priceSource().guardStatus();
        (k.fresh, k.inBand, k.pegOk) = (g.fresh, g.inBand, g.pegOk);
        k.corporateActionPaused = m.corporateActionGuard().isPaused();
        k.issuerPaused = m.issuerPaused();
        k.capUsdg = m.depthCaps().capOf(address(m));
        k.sliceUsdg = m.depthCaps().sliceOf(address(m));
        k.totalDebt = m.totalDebt();
        k.totalShares = m.totalShares();
        k.totalCollateralValue = m.valueOf(k.totalShares);
        k.assetsPerShare = m.wrapper().convertToAssets(1e18);
        k.liquidationThresholdBps = m.LIQUIDATION_THRESHOLD_BPS();
    }

    function vault(CollateralMarket m) external view returns (Vault memory v) {
        LendingVault lv = m.vault();
        v.idle = lv.idle();
        v.totalAssets = lv.totalAssets();
        v.totalSupply = lv.totalSupply();
        v.sharePrice = lv.sharePrice();
        v.utilizationBps = lv.utilizationBps();
        v.borrowRateBps = m.rateModel().borrowRateBps(v.utilizationBps);
        v.supplyRateBps = m.rateModel().supplyRateBps(v.utilizationBps, m.RESERVE_FACTOR_BPS());
        v.reserveBalance = m.gapReserve().balance();
        v.totalDeficit = lv.totalDeficit();
        v.deficitCount = lv.deficitCount();
    }

    function _capHeadroom(CollateralMarket m) internal view returns (uint256) {
        uint256 cap = m.depthCaps().capOf(address(m));
        uint256 debt = m.totalDebt();
        return cap > debt ? cap - debt : 0;
    }
}
