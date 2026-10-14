import deployment from "../../../../../deployments/xlayer-mainnet.json";

/**
 * Intatto's contracts on X Layer mainnet, straight from deployments/xlayer-mainnet.json (chain 196, deployed at
 * block 71,562,056). Names are the Solidity contract names (contracts/src); CollateralMarket is source-verified
 * on OKLink.
 */
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const nvdax = deployment.markets.find((m) => m.symbol === "NVDAx")!;

export const MAINNET_CONTRACTS = [
  { name: "CollateralMarket · NVDAx", address: nvdax.market },
  { name: "LendingVault", address: deployment.vault },
  { name: "GapReserve", address: deployment.gapReserve },
  { name: "SessionRiskController", address: deployment.sessionRisk },
].map((c) => ({ ...c, short: short(c.address) }));

export const DEPLOY_BLOCK = deployment.block;
