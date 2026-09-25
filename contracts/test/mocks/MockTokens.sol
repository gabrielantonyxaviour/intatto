// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Plain mintable ERC-20 (USDG uses 6 decimals).
contract MockERC20 is ERC20 {
    uint8 private immutable _dec;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _dec = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

/// @notice xStock token mock: an 18-decimal ERC-20 with the issuer's multiplier and pause views.
contract MockXStock is MockERC20 {
    uint256 public multiplier = 1e18;
    uint256 public newMultiplier;
    uint256 public newMultiplierActivationTime;
    bool public isPaused;

    constructor(string memory symbol_) MockERC20(symbol_, symbol_, 18) {}

    function setMultiplier(uint256 m) external {
        multiplier = m;
    }

    function setPendingMultiplier(uint256 m, uint256 activationTime) external {
        newMultiplier = m;
        newMultiplierActivationTime = activationTime;
    }

    function setPaused(bool p) external {
        isPaused = p;
    }

    function getCurrentMultiplier() external view returns (uint256, uint256, uint256) {
        if (newMultiplierActivationTime != 0 && block.timestamp >= newMultiplierActivationTime) {
            return (newMultiplier, 0, 1);
        }
        return (multiplier, 0, 0);
    }

    function _update(address from, address to, uint256 value) internal override {
        require(!isPaused, "paused");
        super._update(from, to, value);
    }
}

/// @notice Issuer wrapper mock with the real conversion rule: shares = assets * 1e18 / multiplier,
/// assets = shares * multiplier / 1e18, where multiplier is the token's current multiplier.
contract MockWrappedXStock is ERC20 {
    MockXStock public immutable token;
    bool public isPaused;

    constructor(MockXStock token_) ERC20(string.concat("w", token_.symbol()), string.concat("w", token_.symbol())) {
        token = token_;
    }

    function asset() external view returns (address) {
        return address(token);
    }

    function setPaused(bool p) external {
        isPaused = p;
    }

    function _multiplier() internal view returns (uint256 m) {
        (m,,) = token.getCurrentMultiplier();
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return Math.mulDiv(assets, 1e18, _multiplier());
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return Math.mulDiv(shares, _multiplier(), 1e18);
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return convertToShares(assets);
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return convertToAssets(shares);
    }

    function totalAssets() external view returns (uint256) {
        return convertToAssets(totalSupply());
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        require(!isPaused, "paused");
        shares = convertToShares(assets);
        IERC20(address(token)).transferFrom(msg.sender, address(this), assets);
        _mint(receiver, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        require(!isPaused, "paused");
        if (msg.sender != owner) _spendAllowance(owner, msg.sender, shares);
        assets = convertToAssets(shares);
        _burn(owner, shares);
        uint256 held = token.balanceOf(address(this));
        // A multiplier increase rebases real balances; the mock mints the difference.
        if (held < assets) token.mint(address(this), assets - held);
        IERC20(address(token)).transfer(receiver, assets);
    }

    function _update(address from, address to, uint256 value) internal override {
        require(!isPaused, "paused");
        super._update(from, to, value);
    }
}
