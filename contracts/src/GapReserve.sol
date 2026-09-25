// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IGapReserve} from "./interfaces/IGapReserve.sol";

/// @notice The seeded USDG reserve: second in the loss waterfall, after recovered collateral and before lenders.
/// There is no owner withdrawal: once seeded, the reserve only ever pays shortfalls to the vault.
contract GapReserve is IGapReserve, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdg;
    address public immutable vault;
    mapping(address => bool) public isMarket;
    uint256 public totalCovered;

    event Funded(address indexed from, uint256 amount);
    event MarketSet(address indexed market, bool enabled);

    error NotMarket();

    constructor(IERC20 usdg_, address vault_) Ownable(msg.sender) {
        usdg = usdg_;
        vault = vault_;
    }

    function setMarket(address market, bool enabled) external onlyOwner {
        isMarket[market] = enabled;
        emit MarketSet(market, enabled);
    }

    /// @notice Anyone can seed the reserve (the operator does at launch).
    function fund(uint256 amount) external {
        usdg.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(msg.sender, amount);
    }

    function cover(uint256 shortfall) external returns (uint256 covered) {
        if (!isMarket[msg.sender]) revert NotMarket();
        uint256 bal = usdg.balanceOf(address(this));
        covered = shortfall < bal ? shortfall : bal;
        if (covered > 0) {
            totalCovered += covered;
            usdg.safeTransfer(vault, covered);
        }
        emit ShortfallCovered(msg.sender, shortfall, covered);
    }

    function balance() external view returns (uint256) {
        return usdg.balanceOf(address(this));
    }
}
