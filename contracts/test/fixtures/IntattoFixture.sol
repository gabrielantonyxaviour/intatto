// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {LendingVault} from "../../src/LendingVault.sol";
import {GapReserve} from "../../src/GapReserve.sol";
import {InterestRateModel} from "../../src/InterestRateModel.sol";
import {CollateralMarket} from "../../src/CollateralMarket.sol";
import {CollateralMarketBase} from "../../src/CollateralMarketBase.sol";
import {MarketLens} from "../../src/MarketLens.sol";
import {SessionRiskController} from "../../src/SessionRiskController.sol";
import {DepthCapRegistry} from "../../src/DepthCapRegistry.sol";
import {PriceRelayAdapter} from "../../src/PriceRelayAdapter.sol";
import {CorporateActionGuard} from "../../src/CorporateActionGuard.sol";
import {BoundedLiquidator} from "../../src/BoundedLiquidator.sol";
import {ISessionRisk} from "../../src/interfaces/ISessionRisk.sol";
import {IXStock, IWrappedXStock} from "../../src/interfaces/external/IXStock.sol";
import {IAggregatorV3} from "../../src/interfaces/external/IAggregatorV3.sol";
import {IUniswapV3Pool, IQuoterV2} from "../../src/interfaces/external/IUniswapV3.sol";
import {UsCalendar} from "./UsCalendar.sol";

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @notice Intatto deployed and wired exactly as script/Deploy.s.sol does, on an X Layer mainnet fork pinned at
/// block 71,559,900, with this test contract as owner and `keeper` as the keeper. Every actor is funded by
/// impersonating one real holder and moving balances it already has: no deal(), no minting, no storage writes.
/// The keeper only acts through the real contracts, and every price it posts is the one the real pool implies.
abstract contract IntattoFixture is Test {
    address internal constant USDG = 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8;
    address internal constant USDG_USD = 0x385C6bDDE06b0E438319bF4ddBfFe51C521ABf3D;
    address internal constant NVDAX = 0xc845b2894dBddd03858fd2D643B4eF725fE0849d;
    address internal constant WNVDAX = 0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5;
    /// wNVDAx/USDG 0.05%: USDG is token0, wNVDAx token1, so selling wNVDAx raises sqrtPrice.
    address internal constant POOL = 0x2a2B11730C2b6d99a58034A869dd810D7300a7b2;
    uint24 internal constant POOL_FEE = 500;
    address internal constant ROUTER = 0x4f0C28f5926AFDA16bf2506D5D9e57Ea190f9bcA; // SwapRouter02
    address internal constant QUOTER = 0xD1b797D92d87B688193A2B976eFc8D577D204343; // QuoterV2
    /// Real holder of ~3,976 NVDAx, ~60.8M USDG and ~374 OKB at the fork block.
    address internal constant HOLDER = 0x5075FF68A0Efb54dB13423AD924bd680327D305E;
    uint256 internal constant FORK_BLOCK = 71_559_900;
    uint256 internal constant INITIAL_CAP = 50_000e6; // Deploy.s.sol DEPLOY_INITIAL_CAP_USDG default
    uint256 internal constant HOLDER_KEEPS = 200e18; // NVDAx the arbitrageur never wraps, kept for funding
    uint256 internal constant MAX_STEP = 0.86e18; // largest single price step: a 14% drop (the relay admits 15%)
    uint256 internal constant GAS_OKB = 0.01 ether;

    LendingVault internal vault;
    GapReserve internal reserve;
    InterestRateModel internal rates;
    SessionRiskController internal session;
    DepthCapRegistry internal caps;
    BoundedLiquidator internal liquidator;
    MarketLens internal lens;
    PriceRelayAdapter internal relay;
    CorporateActionGuard internal guard;
    CollateralMarket internal market;
    IWrappedXStock internal constant wrapper = IWrappedXStock(WNVDAX);

    address internal keeper = makeAddr("keeper");
    address internal lenderA = makeAddr("lenderA");
    address internal lenderB = makeAddr("lenderB");
    uint256 internal constant LENDER_A_USDG = 30_000e6;
    uint256 internal constant LENDER_B_USDG = 20_000e6;
    uint256 internal constant RESERVE_SEED = 50e6;

    function setUp() public virtual {
        vm.createSelectFork(vm.envOr("XLAYER_RPC_URL", string("https://xlayerrpc.okx.com")), FORK_BLOCK);
        _deploy();
        // Fork only, as the sandbox does: the forked Chainlink USDG/USD feed cannot update in warped time, so its
        // staleness limit goes from 26 hours to 30 days. The 1% peg band is unchanged.
        relay.setUsdgLimits(30 days, 100);

        _lend(lenderA, LENDER_A_USDG);
        _lend(lenderB, LENDER_B_USDG);
        vm.startPrank(HOLDER); // the operator's launch seed, here from the real holder
        IERC20(USDG).approve(address(reserve), RESERVE_SEED);
        reserve.fund(RESERVE_SEED);
        vm.stopPrank();

        _postDepthCap();
        assertTrue(_tick(), "first keeper price post");
    }

    // ───────────── deployment (script/Deploy.s.sol _core + _market) ─────────────

    function _deploy() internal {
        vault = new LendingVault(IERC20(USDG));
        reserve = new GapReserve(IERC20(USDG), address(vault));
        rates = new InterestRateModel();
        session = new SessionRiskController(keeper);
        caps = new DepthCapRegistry(keeper);
        liquidator = new BoundedLiquidator(session, caps);
        lens = new MarketLens();
        relay = new PriceRelayAdapter(keeper, wrapper, POOL, USDG, IAggregatorV3(USDG_USD), session);
        guard = new CorporateActionGuard(keeper, IXStock(NVDAX), relay);
        market = new CollateralMarket(
            CollateralMarketBase.Config({
                symbol: "NVDAx",
                token: IXStock(NVDAX),
                wrapper: wrapper,
                usdg: IERC20(USDG),
                vault: vault,
                sessionRisk: session,
                priceSource: relay,
                corporateActionGuard: guard,
                depthCaps: caps,
                gapReserve: reserve,
                rateModel: rates
            })
        );
        vault.addMarket(address(market));
        reserve.setMarket(address(market), true);
        market.setLiquidator(address(liquidator));
        liquidator.setMarket(market, POOL);
        caps.setInitialCap(address(market), INITIAL_CAP);
    }

    // ───────────── actors ─────────────

    /// @dev Moves existing NVDAx, USDG and OKB from the real holder (impersonated).
    function _fund(address to, uint256 nvdax, uint256 usdg, uint256 okb) internal {
        vm.startPrank(HOLDER);
        if (okb > 0) {
            (bool ok,) = payable(to).call{value: okb}("");
            assertTrue(ok, "OKB transfer");
        }
        if (nvdax > 0) assertTrue(IERC20(NVDAX).transfer(to, nvdax), "NVDAx transfer");
        if (usdg > 0) assertTrue(IERC20(USDG).transfer(to, usdg), "USDG transfer");
        vm.stopPrank();
    }

    function _lend(address lender, uint256 usdg) internal returns (uint256 shares) {
        _fund(lender, 0, usdg, GAS_OKB);
        vm.startPrank(lender);
        IERC20(USDG).approve(address(vault), usdg);
        shares = vault.deposit(usdg, lender);
        vm.stopPrank();
    }

    /// @dev Funds `who` with NVDAx and gas from the holder, deposits it all as collateral and borrows
    /// `ltvBps` of its value at the relayed price.
    function _openPosition(address who, uint256 nvdax, uint256 ltvBps) internal returns (uint256 shares, uint256 debt) {
        _fund(who, nvdax, 0, GAS_OKB);
        uint256 amount = IERC20(NVDAX).balanceOf(who);
        vm.startPrank(who);
        IERC20(NVDAX).approve(address(market), amount);
        shares = market.addCollateral(amount);
        debt = market.valueOf(shares) * ltvBps / 10_000;
        market.borrow(debt);
        vm.stopPrank();
    }

    function _repay(address who, uint256 amount) internal returns (uint256 paid) {
        vm.startPrank(who);
        IERC20(USDG).approve(address(market), amount);
        paid = market.repay(amount);
        vm.stopPrank();
    }

    // ───────────── the real pool ─────────────

    /// @dev USDG (6 dec) per 1e18 wNVDAx at spot: sqrtP^2 / 2^192 is wNVDAx units per USDG unit, inverted.
    function _spotWrapperPrice() internal view returns (uint256) {
        (uint160 sqrtP,,,,,,) = IUniswapV3Pool(POOL).slot0();
        return Math.mulDiv(1e18, 1 << 192, uint256(sqrtP) * sqrtP);
    }

    /// @dev The issuer-unit quote (USD per NVDAx, 18 dec) the pool implies: wrapper price / convertToAssets(1e18).
    /// USDG is taken at $1 as in the TypeScript twin; the relay's USDG/USD conversion of the TWAP moves it ~1 bp.
    function _poolQuote() internal view returns (uint256) {
        return Math.mulDiv(_spotWrapperPrice() * 1e12, 1e18, wrapper.convertToAssets(1e18));
    }

    /// @dev A simulated arbitrageur (the real holder) wraps NVDAx through the real wrapper and sells it through
    /// SwapRouter02 until the pool's price is `factorE18` of what it was: the limit is sqrtP * sqrt(1 / factor).
    function _arbitrageDown(uint256 factorE18) internal returns (uint256 sold) {
        (uint160 sqrtP,,,,,,) = IUniswapV3Pool(POOL).slot0();
        uint160 limit = uint160(Math.mulDiv(sqrtP, Math.sqrt(1e54 / factorE18), 1e18));
        uint256 held = IERC20(NVDAX).balanceOf(HOLDER);
        vm.startPrank(HOLDER);
        if (held > HOLDER_KEEPS) {
            IERC20(NVDAX).approve(WNVDAX, held - HOLDER_KEEPS);
            wrapper.deposit(held - HOLDER_KEEPS, HOLDER);
        }
        uint256 shares = wrapper.balanceOf(HOLDER);
        wrapper.approve(ROUTER, shares);
        ISwapRouter02(ROUTER).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams(WNVDAX, USDG, POOL_FEE, HOLDER, shares, 0, limit)
        );
        vm.stopPrank();
        sold = shares - wrapper.balanceOf(HOLDER);
        (uint160 reached,,,,,,) = IUniswapV3Pool(POOL).slot0();
        assertEq(reached, limit, "the arbitrageur moved the pool to the target");
    }

    /// @dev Moves pool and relay to `factorE18` of the current price in steps of at most 14%: each step the
    /// arbitrageur sells, 31 minutes pass so the 30-minute TWAP holds only the new price, and the keeper ticks.
    function _stepDown(uint256 factorE18) internal returns (uint256 steps) {
        while (factorE18 < 1e18) {
            uint256 step = factorE18 < MAX_STEP ? MAX_STEP : factorE18;
            emit log_named_decimal_uint("arbitrageur sold wNVDAx", _arbitrageDown(step), 18);
            factorE18 = step == factorE18 ? 1e18 : Math.mulDiv(factorE18, 1e18, step);
            skip(31 minutes);
            assertTrue(_tick(), "the relay admitted the step");
            ++steps;
        }
    }

    // ───────────── keeper ─────────────

    /// @dev The keeper's tick: the calendar session, then the pool-implied quote fetched now.
    function _tick() internal returns (bool accepted) {
        _postSession();
        return _postPrice(_poolQuote());
    }

    function _postSession() internal {
        (ISessionRisk.Session s, uint64 periodChangedAt) = UsCalendar.sessionAt(block.timestamp);
        vm.prank(keeper);
        session.postSession(s, periodChangedAt);
    }

    function _postPrice(uint256 quoteE18) internal returns (bool accepted) {
        vm.prank(keeper);
        return relay.post(quoteE18, uint64(block.timestamp));
    }

    /// @dev The keeper's depth step (services/keeper/src/steps/depth.ts): QuoterV2 sells of 0.5..200 wNVDAx; the
    /// largest whose average price is within 2% of the smallest's sets cap = out x 50% and slice = out x 25%.
    function _postDepthCap() internal returns (uint256 cap, uint256 slice) {
        uint256[5] memory sizes = [uint256(0.5e18), 2e18, 10e18, 50e18, 200e18];
        uint256 basePrice;
        uint256 bestOut;
        for (uint256 i; i < sizes.length; i++) {
            uint256 out = _quoteSell(sizes[i], 0);
            uint256 price = out * 1e18 / sizes[i];
            if (i == 0) basePrice = price;
            if (price * 10_000 >= basePrice * 9_800) bestOut = out;
        }
        (cap, slice) = (bestOut * 5_000 / 10_000, bestOut * 2_500 / 10_000);
        vm.prank(keeper);
        caps.post(address(market), cap, slice);
    }

    /// @dev QuoterV2's USDG out for selling `shares` wNVDAx into the real pool now (limit 0 = none).
    function _quoteSell(uint256 shares, uint160 sqrtPriceLimitX96) internal returns (uint256 out) {
        uint256 snap = vm.snapshotState(); // QuoterV2 is non-view: drop anything it touched
        (out,,,) = IQuoterV2(QUOTER).quoteExactInputSingle(
            IQuoterV2.QuoteExactInputSingleParams(WNVDAX, USDG, shares, POOL_FEE, sqrtPriceLimitX96)
        );
        vm.revertToState(snap);
    }
}
