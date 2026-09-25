// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {BoundedLiquidator} from "../src/BoundedLiquidator.sol";
import {ICollateralMarket} from "../src/interfaces/ICollateralMarket.sol";
import {ISessionRisk} from "../src/interfaces/ISessionRisk.sol";
import {IGapReserve} from "../src/interfaces/IGapReserve.sol";
import {IUniswapV3Pool, IQuoterV2} from "../src/interfaces/external/IUniswapV3.sol";
import {MockCollateralMarket} from "./mocks/MockCollateralMarket.sol";
import {MockSessionRisk, MockPriceSource, MockDepthCaps, MockGapReserve} from "./mocks/MockControllers.sol";

interface IPoolLiquidity {
    function liquidity() external view returns (uint128);
}

/// @notice Real wNVDAx sold through the real wNVDAx/USDG pool on an X Layer mainnet fork, behind a mock market.
/// Runs only with `--fork-url` of X Layer mainnet (chain 196); skipped otherwise.
/// NVDAx comes from a real holder (impersonated), is wrapped through the issuer's real ERC-4626 wrapper,
/// and nothing is minted or written into token storage.
contract LiquidationForkTest is Test {
    address constant NVDAX = 0xc845b2894dBddd03858fd2D643B4eF725fE0849d;
    address constant WNVDAX = 0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5;
    address constant USDG = 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8;
    address constant POOL = 0x2a2B11730C2b6d99a58034A869dd810D7300a7b2;
    IQuoterV2 constant QUOTER = IQuoterV2(0xD1b797D92d87B688193A2B976eFc8D577D204343);
    address constant PREFLIGHT_HOLDER = 0x6aE9Ec7Cf89266652373a9831EC5F8cA84F96E05;
    uint24 constant FEE = 500;
    uint256 constant NVDAX_AMOUNT = 0.05e18;

    BoundedLiquidator liq;
    MockCollateralMarket market;
    MockPriceSource price;
    MockSessionRisk sessionRisk;
    MockDepthCaps caps;
    address borrower = makeAddr("borrower");
    address keeper = makeAddr("keeper");
    uint256 shares;

    function setUp() public {
        vm.skip(block.chainid != 196, "needs --fork-url of X Layer mainnet");
        if (block.chainid != 196) return;
        // The real pool: USDG (6 dec) is token0 and wNVDAx (18 dec) token1, so selling wNVDAx is oneForZero.
        assertEq(IUniswapV3Pool(POOL).token0(), USDG);
        assertEq(IUniswapV3Pool(POOL).token1(), WNVDAX);
        assertEq(IUniswapV3Pool(POOL).fee(), FEE);

        address holder = _findHolder();
        emit log_named_address("NVDAx holder impersonated", holder);
        vm.prank(holder);
        assertTrue(IERC20(NVDAX).transfer(address(this), NVDAX_AMOUNT));

        sessionRisk = new MockSessionRisk();
        caps = new MockDepthCaps();
        price = new MockPriceSource(0);
        _setOracle(_spotWrapperPrice());
        MockGapReserve reserve = new MockGapReserve(IERC20(USDG), makeAddr("vault"));
        market = new MockCollateralMarket(WNVDAX, USDG, price, IGapReserve(address(reserve)));
        liq = new BoundedLiquidator(sessionRisk, caps);
        liq.setMarket(m(), POOL);
        market.setLiquidator(address(liq));

        uint256 assets = IERC20(NVDAX).balanceOf(address(this));
        IERC20(NVDAX).approve(WNVDAX, assets);
        shares = IERC4626(WNVDAX).deposit(assets, address(market));
        assertEq(IERC20(WNVDAX).balanceOf(address(market)), shares);
        // 90% of the collateral's value at the pool price, against a 65% liquidation threshold.
        market.open(borrower, shares, market.valueUsdg(shares) * 90 / 100);
        assertTrue(market.isLiquidatable(borrower));
    }

    function m() internal view returns (ICollateralMarket) {
        return ICollateralMarket(address(market));
    }

    /// @dev A recent NVDAx recipient that still holds enough, from Transfer logs read in 100-block windows.
    function _findHolder() internal view returns (address) {
        bytes32[] memory topics = new bytes32[](1);
        topics[0] = keccak256("Transfer(address,address,uint256)");
        uint256 to = block.number;
        for (uint256 i; i < 60; i++) {
            Vm.EthGetLogs[] memory logs = vm.eth_getLogs(to - 99, to, NVDAX, topics);
            for (uint256 j = logs.length; j > 0; j--) {
                if (logs[j - 1].topics.length < 3) continue;
                address h = address(uint160(uint256(logs[j - 1].topics[2])));
                if (h != WNVDAX && h != address(0) && IERC20(NVDAX).balanceOf(h) >= NVDAX_AMOUNT) return h;
            }
            to -= 100;
        }
        // Fall back to the holder recorded in the preflight fork notes.
        require(IERC20(NVDAX).balanceOf(PREFLIGHT_HOLDER) >= NVDAX_AMOUNT, "no NVDAx holder with enough balance");
        return PREFLIGHT_HOLDER;
    }

    /// @dev USDG (6 dec) per 1e18 wNVDAx at the pool's spot: token1/token0 = shares per USDG unit, so invert.
    function _spotWrapperPrice() internal view returns (uint256) {
        (uint160 sqrtP,,,,,,) = IUniswapV3Pool(POOL).slot0();
        return Math.mulDiv(1e18, 1 << 192, uint256(sqrtP) * sqrtP);
    }

    /// @dev Posts the NVDAx quote whose wrapper price (quote x convertToAssets(1e18)) is `wrapperPrice`.
    function _setOracle(uint256 wrapperPrice) internal {
        uint256 assetsPerShare = IERC4626(WNVDAX).convertToAssets(1e18);
        price.setPrice(Math.mulDiv(wrapperPrice, 1e30, assetsPerShare, Math.Rounding.Ceil));
    }

    function _quote(BoundedLiquidator.Plan memory p) internal returns (uint256 quoted) {
        uint256 snap = vm.snapshotState(); // QuoterV2 is non-view: quote, then drop any state it touched
        (quoted,,,) = QUOTER.quoteExactInputSingle(
            IQuoterV2.QuoteExactInputSingleParams(WNVDAX, USDG, p.shares, FEE, p.sqrtPriceLimitX96)
        );
        vm.revertToState(snap);
    }

    function _liquidate() internal returns (uint256 sold, uint256 out) {
        vm.prank(keeper);
        return liq.liquidate(m(), borrower);
    }

    /// @dev One slice: bounded by the depth slice while CLOSED, amount out equal to QuoterV2's quote for that
    /// exact amount taken just before the swap, minOut honoured, and proceeds settled back through the seam.
    function _slice(bool closed) internal returns (uint256 sold) {
        BoundedLiquidator.Plan memory p = liq.previewSlice(m(), borrower);
        assertFalse(p.waiting);
        assertFalse(p.zeroForOne);
        uint256 bound = caps.slice() * 1e18 / p.oraclePrice;
        (uint256 sharesBefore, uint256 debtBefore) = market.positionOf(borrower);
        uint256 quoted = _quote(p);

        uint256 out;
        (sold, out) = _liquidate();
        assertEq(sold, p.shares, "full fill");
        if (closed) assertLe(sold, bound, "slice bound");
        assertApproxEqRel(out, quoted, 0.005e18, "QuoterV2");
        assertGe(out, sold * p.floorPrice / 1e18, "minOut");
        (uint256 sharesAfter, uint256 debtAfter) = market.positionOf(borrower);
        assertEq(sharesAfter, sharesBefore - sold);
        if (sharesAfter > 0) assertEq(debtBefore - debtAfter, out * 10_000 / 10_500, "repaid");
        else assertEq(debtAfter, 0, "closed: repaid, then reserve and deficit");
        emit log_named_uint("slice shares", sold);
        emit log_named_uint("slice USDG out", out);
    }

    function test_fork_closed_slices_then_reopen() public {
        uint256 spot = _spotWrapperPrice();
        emit log_named_uint("pool spot USDG per wNVDAx (6 dec)", spot);

        // CLOSED with the oracle 5% above the pool: the 3% floor sits above spot, so nothing sells.
        sessionRisk.setSession(ISessionRisk.Session.CLOSED);
        _setOracle(spot * 105 / 100);
        (uint160 before,,,,,,) = IUniswapV3Pool(POOL).slot0();
        (uint256 sold, uint256 out) = _liquidate();
        assertEq(sold + out, 0);
        (uint160 afterWait,,,,,,) = IUniswapV3Pool(POOL).slot0();
        assertEq(afterWait, before);
        (uint256 held,) = market.positionOf(borrower);
        assertEq(held, shares);

        // Oracle at the pool price, depth slice a quarter of the position: bounded slices while CLOSED.
        _setOracle(spot);
        caps.set(type(uint128).max, market.valueUsdg(shares) / 4);
        _slice(true);
        _slice(true);
        (held,) = market.positionOf(borrower);
        assertGt(held, 0);

        // Reopen: the rest sells and the position is closed.
        sessionRisk.setSession(ISessionRisk.Session.OPEN);
        _slice(false);
        (uint256 left, uint256 debt) = market.positionOf(borrower);
        assertEq(left + debt, 0);
        assertEq(IERC20(WNVDAX).balanceOf(address(liq)) + IERC20(USDG).balanceOf(address(liq)), 0);
        assertGt(IERC20(USDG).balanceOf(keeper), 0);
    }

    /// The real pool stops exactly at the converted floor: a slice larger than the depth above the floor
    /// fills partly, nets at least the floor, and the unsold shares go back to the position.
    function test_fork_price_limit_stops_at_floor() public {
        sessionRisk.setSession(ISessionRisk.Session.OPEN);
        (uint160 spotSqrt,,,,,,) = IUniswapV3Pool(POOL).slot0();
        uint256 liquidity = IPoolLiquidity(POOL).liquidity();
        // Selling token1 moves sqrtP up by amountIn * 2^96 / L: aim the limit at half the whole position's move.
        uint256 limitTarget = spotSqrt + Math.mulDiv(shares, 1 << 96, liquidity) / 2;
        uint256 netFloor = Math.mulDiv(1e18 * uint256(1e6 - FEE), 1 << 192, limitTarget * limitTarget) / 1e6;
        _setOracle(Math.mulDiv(netFloor, 10_000, 8_500, Math.Rounding.Ceil)); // OPEN floor is 15% under

        BoundedLiquidator.Plan memory p = liq.previewSlice(m(), borrower);
        assertFalse(p.waiting);
        assertGt(p.sqrtPriceLimitX96, spotSqrt); // oneForZero: the limit sits above spot
        assertApproxEqRel(p.sqrtPriceLimitX96, limitTarget, 1e10);
        uint256 quoted = _quote(p);

        (uint256 sold, uint256 out) = _liquidate();
        (uint160 sqrtAfter,,,,,,) = IUniswapV3Pool(POOL).slot0();
        assertEq(sqrtAfter, p.sqrtPriceLimitX96, "pool stopped at the limit");
        assertGt(sold, 0);
        assertLt(sold, p.shares, "partial fill");
        assertGe(out, sold * p.floorPrice / 1e18, "minOut");
        assertApproxEqRel(out, quoted, 0.005e18, "QuoterV2");
        (uint256 held,) = market.positionOf(borrower);
        assertEq(held, shares - sold, "unsold restored");
        assertEq(IERC20(WNVDAX).balanceOf(address(liq)), 0);
        emit log_named_uint("planned shares", p.shares);
        emit log_named_uint("sold shares", sold);
        emit log_named_uint("USDG out", out);
        emit log_named_uint("minOut", sold * p.floorPrice / 1e18);
    }
}
