// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {TickMath} from "./TickMath.sol";
import {IUniswapV3Pool} from "../interfaces/external/IUniswapV3.sol";

/// @notice Uniswap v3 OracleLibrary essentials (consult + getQuoteAtTick), 0.8 port.
/// consult() applies Uniswap's signed rounding: a negative average rounds toward negative infinity.
library OracleLibrary {
    error ZeroPeriod();

    function consult(address pool, uint32 secondsAgo) internal view returns (int24 arithmeticMeanTick) {
        if (secondsAgo == 0) revert ZeroPeriod();
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo;
        secondsAgos[1] = 0;
        (int56[] memory tickCumulatives,) = IUniswapV3Pool(pool).observe(secondsAgos);
        int56 delta = tickCumulatives[1] - tickCumulatives[0];
        arithmeticMeanTick = int24(delta / int56(uint56(secondsAgo)));
        if (delta < 0 && (delta % int56(uint56(secondsAgo)) != 0)) arithmeticMeanTick--;
    }

    /// @notice Amount of quoteToken received for baseAmount of baseToken at `tick`.
    function getQuoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken)
        internal
        pure
        returns (uint256 quoteAmount)
    {
        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);
        if (sqrtRatioX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;
            quoteAmount = baseToken < quoteToken
                ? Math.mulDiv(ratioX192, baseAmount, 1 << 192)
                : Math.mulDiv(1 << 192, baseAmount, ratioX192);
        } else {
            uint256 ratioX128 = Math.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);
            quoteAmount = baseToken < quoteToken
                ? Math.mulDiv(ratioX128, baseAmount, 1 << 128)
                : Math.mulDiv(1 << 128, baseAmount, ratioX128);
        }
    }
}
