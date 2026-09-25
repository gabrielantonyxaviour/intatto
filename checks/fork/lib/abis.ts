/** Minimal human-readable ABIs the fork harness and sandbox drive. Contract ABIs for apps live in config/abi. */
import { parseAbi } from "viem"

export const erc20 = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
])

export const wrapper = parseAbi([
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
])

export const xstock = parseAbi([
  "function getCurrentMultiplier() view returns (uint256, uint256, uint256)",
  "function multiplierUpdater() view returns (address)",
  "function updateMultiplierValue(uint256 pendingNewMultiplier, uint256 oldMultiplier, uint256 activationTime)",
  "function balanceOf(address) view returns (uint256)",
])

export const sessionRisk = parseAbi([
  "function postSession(uint8 session, uint64 periodChangedAt)",
  "function currentSession() view returns (uint8)",
  "function maxLtvBps() view returns (uint256)",
])

export const priceRelay = parseAbi([
  "function post(uint256 quoteE18, uint64 fetchedAt) returns (bool)",
  "function latestPrice() view returns (uint256 priceE18, uint64 fetchedAt)",
  "event PricePosted(uint256 quoteE18, uint256 wrapperPriceE18, uint256 twapWrapperPriceE18, uint256 deviationBps, uint256 moveBps, int256 usdgAnswer, uint64 fetchedAt, uint64 sourceTimestamp)",
  "event PriceRejected(uint8 reason, uint256 quoteE18, uint256 wrapperPriceE18, uint256 twapWrapperPriceE18, uint256 deviationBps, uint64 fetchedAt)",
])

export const depthCaps = parseAbi([
  "function post(address market, uint256 targetCapUsdg, uint256 sliceUsdg)",
  "function capOf(address market) view returns (uint256)",
])

export const corporateAction = parseAbi([
  "function postAction(uint64 activationAt, uint256 expectedMultiplier)",
  "function isPaused() view returns (bool)",
  "function resolve()",
])

export const market = parseAbi([
  "function addCollateral(uint256 tokenAmount) returns (uint256)",
  "function borrow(uint256 amount)",
  "function repay(uint256 amount) returns (uint256)",
  "function positionOf(address) view returns (uint256 shares, uint256 debt)",
  "function debtOf(address) view returns (uint256)",
  "function isLiquidatable(address) view returns (bool)",
  "event LiquidationSettled(address indexed borrower, address indexed keeper, uint256 proceeds, uint256 repaid, uint256 penalty, uint256 surplus, uint256 reserveCovered, uint256 deficit)",
])

export const vault = parseAbi([
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function sharePrice() view returns (uint256)",
  "function totalDeficit() view returns (uint256)",
  "function totalAssets() view returns (uint256)",
])

export const reserve = parseAbi(["function fund(uint256 amount)", "function balance() view returns (uint256)"])

export const liquidator = parseAbi([
  "function liquidate(address market, address borrower) returns (uint256 sharesSold, uint256 proceeds)",
  "event SliceExecuted(address indexed market, address indexed borrower, uint8 session, uint256 sharesSold, uint256 proceeds, uint256 oraclePrice, uint256 floorPrice)",
  "event SliceWaiting(address indexed market, address indexed borrower, uint8 session, uint256 floorPrice)",
])

export const pool = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)",
  "function token0() view returns (address)",
])

export const swapRouter02 = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)",
])
