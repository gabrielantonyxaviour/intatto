// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {PriceRelayAdapter} from "../src/PriceRelayAdapter.sol";
import {IPriceSource} from "../src/interfaces/IPriceSource.sol";
import {ISessionRisk} from "../src/interfaces/ISessionRisk.sol";
import {IWrappedXStock} from "../src/interfaces/external/IXStock.sol";
import {IUniswapV3Pool} from "../src/interfaces/external/IUniswapV3.sol";
import {IAggregatorV3} from "../src/interfaces/external/IAggregatorV3.sol";
import {MockSessionRisk} from "./mocks/MockControllers.sol";

/// The adapter against the REAL wNVDAx/USDG pool, wrapper and Chainlink USDG/USD feed on X Layer mainnet.
/// Runs only on a fork of chain 196: forge test --match-contract PriceRelayForkTest --fork-url <X Layer RPC>.
/// Without a fork every test is skipped.
contract PriceRelayForkTest is Test {
    IWrappedXStock constant WNVDAX = IWrappedXStock(0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5);
    address constant USDG = 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8;
    IUniswapV3Pool constant POOL = IUniswapV3Pool(0x2a2B11730C2b6d99a58034A869dd810D7300a7b2);
    IAggregatorV3 constant USDG_USD = IAggregatorV3(0x385C6bDDE06b0E438319bF4ddBfFe51C521ABf3D);

    address keeper = makeAddr("keeper");
    MockSessionRisk session;
    PriceRelayAdapter relay;

    function setUp() public {
        if (block.chainid != 196) {
            vm.skip(true, "needs --fork-url of X Layer mainnet (chain 196)");
            return;
        }
        session = new MockSessionRisk(); // OPEN: the 3% band
        relay = new PriceRelayAdapter(keeper, WNVDAX, address(POOL), USDG, USDG_USD, ISessionRisk(address(session)));
    }

    /// The pool must hold observations for the configured window, else every post is TwapUnavailable.
    function _requireWindow() internal view {
        (,,, uint16 cardinality,,,) = POOL.slot0();
        uint32[] memory ago = new uint32[](2);
        ago[0] = relay.twapWindow();
        try POOL.observe(ago) returns (int56[] memory, uint160[] memory) {}
        catch {
            revert(string.concat("pool observations cannot supply the ", vm.toString(ago[0]),
                "s TWAP window (cardinality ", vm.toString(cardinality), ")"));
        }
    }

    function _twap() internal view returns (uint256 twap) {
        _requireWindow();
        bool ok;
        (ok, twap) = relay.twapWrapperPrice();
        assertTrue(ok, "twapWrapperPrice not ok");
        assertGt(twap, 20e18, "TWAP wrapper price below $20");
        assertLt(twap, 5_000e18, "TWAP wrapper price above $5,000");
    }

    function test_realPool_layoutAndTwapIsSane() public view {
        assertEq(POOL.token0(), USDG, "USDG is token0");
        assertEq(POOL.token1(), address(WNVDAX));
        assertEq(POOL.fee(), 500);
        (,,, uint16 cardinality,,,) = POOL.slot0();
        assertGe(cardinality, 256);
        _twap();
        (int256 answer, uint256 updatedAt, bool ok) = relay.usdgStatus();
        assertTrue(ok, "USDG/USD not fresh or off peg");
        assertGt(answer, 0.99e8);
        assertGt(updatedAt, 0);
    }

    function test_realPool_acceptsQuoteAtTwap() public {
        uint256 twap = _twap();
        uint256 assetsPerShare = WNVDAX.convertToAssets(1e18);
        uint256 quote = Math.mulDiv(twap, 1e18, assetsPerShare); // USD per 1 NVDAx, the multiplier removed once
        vm.prank(keeper);
        assertTrue(relay.post(quote, uint64(block.timestamp)), "quote at the TWAP rejected");
        (uint256 price, uint64 fetchedAt) = relay.latestPrice();
        assertEq(price, quote);
        assertEq(fetchedAt, block.timestamp);
        assertApproxEqRel(relay.lastWrapperPrice(), twap, 1e14);
        IPriceSource.GuardStatus memory s = relay.guardStatus();
        assertTrue(s.fresh && s.inBand && s.pegOk);
    }

    function test_realPool_rejectsQuote20PctAboveTwap() public {
        uint256 twap = _twap();
        uint256 quote = Math.mulDiv(twap, 1e18, WNVDAX.convertToAssets(1e18)) * 120 / 100;
        uint256 wrapperPrice = Math.mulDiv(quote, WNVDAX.convertToAssets(1e18), 1e18);
        uint256 dev = Math.mulDiv(wrapperPrice - twap, 10_000, twap, Math.Rounding.Ceil);
        vm.expectEmit(address(relay));
        emit PriceRelayAdapter.PriceRejected(uint8(PriceRelayAdapter.RejectReason.OutOfBand), quote, wrapperPrice, twap,
            dev, uint64(block.timestamp));
        vm.prank(keeper);
        assertFalse(relay.post(quote, uint64(block.timestamp)));
        (uint256 price,) = relay.latestPrice();
        assertEq(price, 0);
    }
}
