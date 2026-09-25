/** ABIs the keeper calls: Intatto's from @intatto/config/abi, plus the external contracts it reads. */
import { parseAbi } from "viem"

export {
  boundedLiquidatorAbi,
  collateralMarketAbi,
  corporateActionGuardAbi,
  depthCapRegistryAbi,
  priceRelayAdapterAbi,
  sessionRiskControllerAbi,
} from "@intatto/config/abi"

/** Uniswap v3 QuoterV2 (nonpayable; always called with eth_call). */
export const quoterV2Abi = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
])

export const poolAbi = parseAbi(["function fee() view returns (uint24)"])

/** The issuer's ERC-4626 wrapper. */
export const wrapperAbi = parseAbi(["function convertToAssets(uint256 shares) view returns (uint256)"])

/** The xStocks token's onchain multiplier schedule. */
export const xstockAbi = parseAbi([
  "function newMultiplier() view returns (uint256)",
  "function newMultiplierActivationTime() view returns (uint256)",
])
