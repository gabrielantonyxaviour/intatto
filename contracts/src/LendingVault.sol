// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ILendingVault} from "./interfaces/ILendingVault.sol";

/// @notice What the vault asks each market: the USDG it is owed (debt net of reserve fees owed).
interface IVaultDebtor {
    function vaultDebt() external view returns (uint256);
}

/// @notice ERC-4626 USDG vault. Assets = idle USDG + what markets owe it. When a market writes off a
/// remainder the reserve could not cover, its debt falls, so share value falls pro rata for every lender.
/// Lenders can lose money in a gap larger than the reserve, and are told so.
contract LendingVault is ERC4626, Ownable, ILendingVault {
    using SafeERC20 for IERC20;

    struct DeficitRecord {
        uint64 at;
        address market;
        address borrower;
        uint256 amount;
        uint256 sharePriceBefore;
        uint256 sharePriceAfter;
    }

    address[] public markets;
    mapping(address => bool) public isMarket;
    uint256 public totalDeficit;
    DeficitRecord[] internal deficits;

    event MarketAdded(address indexed market);

    error NotMarket();
    error InsufficientLiquidity(uint256 idle, uint256 requested);

    constructor(IERC20 usdg) ERC20("Intatto USDG Vault", "iUSDG") ERC4626(usdg) Ownable(msg.sender) {}

    modifier onlyMarket() {
        if (!isMarket[msg.sender]) revert NotMarket();
        _;
    }

    function addMarket(address market) external onlyOwner {
        if (isMarket[market]) return;
        isMarket[market] = true;
        markets.push(market);
        emit MarketAdded(market);
    }

    function marketCount() external view returns (uint256) {
        return markets.length;
    }

    function idle() public view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    /// @notice USDG owed to the vault by all markets.
    function totalLent() public view returns (uint256 sum) {
        for (uint256 i; i < markets.length; i++) {
            sum += IVaultDebtor(markets[i]).vaultDebt();
        }
    }

    function totalAssets() public view override returns (uint256) {
        return idle() + totalLent();
    }

    /// @notice USDG value of one whole share (10 ** decimals), 6 decimals.
    function sharePrice() public view returns (uint256) {
        return convertToAssets(10 ** decimals());
    }

    function utilizationBps() external view returns (uint256) {
        uint256 lent = totalLent();
        uint256 total = lent + idle();
        return total == 0 ? 0 : lent * 10_000 / total;
    }

    /// @notice Withdrawals are limited to idle USDG; the rest is lent out.
    function maxWithdraw(address owner) public view override returns (uint256) {
        return Math.min(super.maxWithdraw(owner), idle());
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        return Math.min(super.maxRedeem(owner), convertToShares(idle()));
    }

    function lend(address to, uint256 amount) external onlyMarket {
        uint256 available = idle();
        if (amount > available) revert InsufficientLiquidity(available, amount);
        IERC20(asset()).safeTransfer(to, amount);
        emit Lent(msg.sender, to, amount);
    }

    function recordDeficit(address borrower, uint256 amount, uint256 sharePriceBefore) external onlyMarket {
        totalDeficit += amount;
        uint256 afterPrice = sharePrice();
        deficits.push(DeficitRecord(uint64(block.timestamp), msg.sender, borrower, amount, sharePriceBefore, afterPrice));
        emit DeficitRecognised(msg.sender, borrower, amount, sharePriceBefore, afterPrice);
    }

    function deficitCount() external view returns (uint256) {
        return deficits.length;
    }

    function deficitAt(uint256 i) external view returns (DeficitRecord memory) {
        return deficits[i];
    }
}
