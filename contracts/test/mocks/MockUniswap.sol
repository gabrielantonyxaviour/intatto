// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {TickMath} from "../../src/lib/TickMath.sol";
import {IUniswapV3SwapCallback, IQuoterV2} from "../../src/interfaces/external/IUniswapV3.sol";

/// @notice Uniswap v3 pool mock.
/// - observe(): tick cumulatives for a constant `twapTick`; reverts "OLD" beyond `maxObservationAge`.
/// - swap(): fills at the spot price (from `spotTick`) minus the fee, up to `maxInput` per swap,
///   and reverts "SPL" when the price limit is already on the wrong side, like the real pool.
contract MockUniswapV3Pool {
    address public immutable token0;
    address public immutable token1;
    uint24 public immutable fee;

    int24 public twapTick;
    int24 public spotTick;
    uint32 public maxObservationAge = 3600;
    uint256 public maxInput = type(uint256).max;

    constructor(address tokenA, address tokenB, uint24 fee_) {
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        fee = fee_;
    }

    function setTicks(int24 twap, int24 spot) external {
        twapTick = twap;
        spotTick = spot;
    }

    function setMaxObservationAge(uint32 age) external {
        maxObservationAge = age;
    }

    function setMaxInput(uint256 amount) external {
        maxInput = amount;
    }

    function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool) {
        return (TickMath.getSqrtRatioAtTick(spotTick), spotTick, 0, 256, 256, 0, true);
    }

    function observe(uint32[] calldata secondsAgos) external view returns (int56[] memory tc, uint160[] memory spl) {
        tc = new int56[](secondsAgos.length);
        spl = new uint160[](secondsAgos.length);
        for (uint256 i; i < secondsAgos.length; i++) {
            require(secondsAgos[i] <= maxObservationAge, "OLD");
            tc[i] = int56(twapTick) * int56(uint56(block.timestamp - secondsAgos[i]));
        }
    }

    function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96, bytes calldata data)
        external
        returns (int256 amount0, int256 amount1)
    {
        require(amountSpecified > 0, "exact input only");
        uint160 sqrtP = TickMath.getSqrtRatioAtTick(spotTick);
        // Selling token0 pushes the price down, so the limit must sit below spot; selling token1, above.
        require(zeroForOne ? sqrtPriceLimitX96 < sqrtP : sqrtPriceLimitX96 > sqrtP, "SPL");
        uint256 amountIn = Math.min(uint256(amountSpecified), maxInput);
        uint256 afterFee = amountIn * (1e6 - fee) / 1e6;
        uint256 ratioX192 = uint256(sqrtP) * sqrtP;
        uint256 out = zeroForOne ? Math.mulDiv(afterFee, ratioX192, 1 << 192) : Math.mulDiv(afterFee, 1 << 192, ratioX192);
        if (zeroForOne) {
            amount0 = int256(amountIn);
            amount1 = -int256(out);
            IERC20(token1).transfer(recipient, out);
            uint256 before = IERC20(token0).balanceOf(address(this));
            IUniswapV3SwapCallback(msg.sender).uniswapV3SwapCallback(amount0, amount1, data);
            require(IERC20(token0).balanceOf(address(this)) >= before + amountIn, "IIA");
        } else {
            amount0 = -int256(out);
            amount1 = int256(amountIn);
            IERC20(token0).transfer(recipient, out);
            uint256 before = IERC20(token1).balanceOf(address(this));
            IUniswapV3SwapCallback(msg.sender).uniswapV3SwapCallback(amount0, amount1, data);
            require(IERC20(token1).balanceOf(address(this)) >= before + amountIn, "IIA");
        }
    }
}

/// @notice QuoterV2 mock: quotes against a MockUniswapV3Pool's spot price and fee, ignoring depth.
contract MockQuoterV2 is IQuoterV2 {
    MockUniswapV3Pool public immutable pool;

    constructor(MockUniswapV3Pool pool_) {
        pool = pool_;
    }

    function quoteExactInputSingle(QuoteExactInputSingleParams memory p)
        external
        view
        returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32, uint256)
    {
        uint160 sqrtP = TickMath.getSqrtRatioAtTick(pool.spotTick());
        uint256 afterFee = p.amountIn * (1e6 - pool.fee()) / 1e6;
        uint256 ratioX192 = uint256(sqrtP) * sqrtP;
        amountOut = p.tokenIn == pool.token0()
            ? Math.mulDiv(afterFee, ratioX192, 1 << 192)
            : Math.mulDiv(afterFee, 1 << 192, ratioX192);
        sqrtPriceX96After = sqrtP;
    }
}

/// @notice Chainlink aggregator mock.
contract MockAggregatorV3 {
    uint8 public decimals = 8;
    string public description = "USDG / USD";
    int256 public answer = 1e8;
    uint256 public updatedAt;
    uint80 public roundId = 1;

    constructor() {
        updatedAt = block.timestamp;
    }

    function set(int256 answer_, uint256 updatedAt_) external {
        answer = answer_;
        updatedAt = updatedAt_;
        roundId++;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, updatedAt, updatedAt, roundId);
    }
}
