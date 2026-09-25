// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISessionRisk} from "../../src/interfaces/ISessionRisk.sol";
import {IPriceSource} from "../../src/interfaces/IPriceSource.sol";
import {ICorporateActionGuard} from "../../src/interfaces/ICorporateActionGuard.sol";
import {IDepthCaps} from "../../src/interfaces/IDepthCaps.sol";
import {IGapReserve} from "../../src/interfaces/IGapReserve.sol";

/// @notice Settable session: fixed LTV per state, no decay, no liveness.
contract MockSessionRisk is ISessionRisk {
    Session public session = Session.OPEN;
    mapping(Session => uint256) public ltv;
    address public keeper;
    uint256 public livenessLimit = 30 minutes;

    constructor() {
        ltv[Session.OPEN] = 5000;
        ltv[Session.EXTENDED] = 4000;
        ltv[Session.CLOSED] = 3000;
    }

    function setSession(Session s) external {
        session = s;
    }

    function setLtv(Session s, uint256 bps) external {
        ltv[s] = bps;
    }

    function postSession(Session s, uint64) external {
        session = s;
    }

    function currentSession() external view returns (Session) {
        return session;
    }

    function maxLtvBps() external view returns (uint256) {
        return ltv[session];
    }

    function maxLtvBpsFor(Session s, uint256) external view returns (uint256) {
        return ltv[s];
    }

    function lastPost() external view returns (Session, uint64, uint64) {
        return (session, uint64(block.timestamp), uint64(block.timestamp));
    }
}

/// @notice Settable price and guard results.
contract MockPriceSource is IPriceSource {
    uint256 public price;
    uint64 public fetchedAt;
    GuardStatus internal status = GuardStatus(true, true, true);

    constructor(uint256 priceE18) {
        price = priceE18;
        fetchedAt = uint64(block.timestamp);
    }

    function setPrice(uint256 priceE18) external {
        price = priceE18;
        fetchedAt = uint64(block.timestamp);
    }

    function setStatus(bool fresh, bool inBand, bool pegOk) external {
        status = GuardStatus(fresh, inBand, pegOk);
    }

    function latestPrice() external view returns (uint256, uint64) {
        return (price, fetchedAt);
    }

    function guardStatus() external view returns (GuardStatus memory) {
        return status;
    }
}

contract MockCorporateActionGuard is ICorporateActionGuard {
    bool public isPaused;
    PendingAction internal action;

    function setPaused(bool p) external {
        isPaused = p;
    }

    function pendingAction() external view returns (PendingAction memory) {
        return action;
    }
}

contract MockDepthCaps is IDepthCaps {
    uint256 public cap = type(uint128).max;
    uint256 public slice = type(uint128).max;

    function set(uint256 cap_, uint256 slice_) external {
        cap = cap_;
        slice = slice_;
    }

    function capOf(address) external view returns (uint256) {
        return cap;
    }

    function sliceOf(address) external view returns (uint256) {
        return slice;
    }
}

/// @notice Pays shortfalls to `vault` from its own USDG balance.
contract MockGapReserve is IGapReserve {
    IERC20 public immutable usdg;
    address public vault;

    constructor(IERC20 usdg_, address vault_) {
        usdg = usdg_;
        vault = vault_;
    }

    function setVault(address v) external {
        vault = v;
    }

    function cover(uint256 shortfall) external returns (uint256 covered) {
        uint256 bal = usdg.balanceOf(address(this));
        covered = shortfall < bal ? shortfall : bal;
        if (covered > 0) usdg.transfer(vault, covered);
        emit ShortfallCovered(msg.sender, shortfall, covered);
    }

    function balance() external view returns (uint256) {
        return usdg.balanceOf(address(this));
    }
}
