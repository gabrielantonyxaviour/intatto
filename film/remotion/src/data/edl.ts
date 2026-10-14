import type { FootageBeat, Segment } from "./types";

const LIVE = "https://intatto.larinova.com";
const MARKET = `${LIVE}/`;
const BORROW = `${LIVE}/borrow`;
const SANDBOX = `${LIVE}/sandbox`;
const RISK = `${LIVE}/risk`;
const LEND = `${LIVE}/lend`;
const AGENTS = `${LIVE}/agents`;
const KEEPER = `${LIVE}/risk#keeper`;
const MARKET_TX =
  "https://www.oklink.com/x-layer/address/0xE6708CC6598F17611f9A468f9907052688459D0D";
const KEEPER_TX =
  "https://www.oklink.com/x-layer/address/0xaBa1F7e4FB0500696855BF38012676c10e3ef808";

const what: Segment[] = [
  { take: "market", mark: "session", cue: "How much you can borrow", url: MARKET, label: "LIVE" },
  { take: "market", mark: "max-ltv", cue: "follows the US session", url: MARKET, label: "LIVE" },
  { take: "market", mark: "threshold", cue: "The liquidation line", url: MARKET, label: "LIVE" },
  { take: "market", mark: "relay", cue: "The price is our keeper", url: MARKET, label: "LIVE" },
];

const mainnet: Segment[] = [
  { take: "borrow-mainnet", mark: "connect", cue: null, url: BORROW, label: "LIVE" },
  { take: "borrow-mainnet", mark: "collateral", cue: "This wallet", url: BORROW, label: "LIVE" },
  { take: "borrow-mainnet", mark: "ltv-health", cue: "Thirty-six", url: BORROW, label: "LIVE" },
  { take: "borrow-mainnet", mark: "can-fall", cue: "NVIDIA would have to fall", url: BORROW, label: "LIVE" },
  { take: "borrow-mainnet", mark: "monday-gap", cue: "before this loan", url: BORROW, label: "LIVE" },
  { take: "explorer", mark: "borrow-row", cue: "Here's the borrow", url: MARKET_TX, label: "LIVE" },
  { take: "explorer", mark: "contracts-tab", cue: "on a verified contract", url: MARKET_TX, label: "LIVE" },
];

const saturday: Segment[] = [
  { take: "weekend", mark: "start-click", cue: null, url: SANDBOX, label: "SANDBOX" },
  { take: "weekend", mark: "session-ready", cue: "a fork of X Layer", url: SANDBOX, label: "SANDBOX" },
  { take: "weekend", mark: "loan-typed", cue: "I borrow", url: BORROW, label: "SANDBOX" },
  { take: "weekend", mark: "review", cue: "on a weekday", rate: 4, url: BORROW, label: "SANDBOX" },
  { take: "weekend", mark: "borrowed", cue: "let's make it", url: BORROW, label: "SANDBOX" },
  { take: "weekend", mark: "saturday-click", cue: "Saturday", offset: 0.6, url: SANDBOX, label: "SANDBOX" },
  { take: "weekend", mark: "saturday-done", cue: "The session closes", url: SANDBOX, label: "SANDBOX" },
  { take: "weekend", mark: "limit", cue: "drops below thirty", url: BORROW, label: "SANDBOX" },
  { take: "weekend", mark: "try-more", cue: "I ask for more", url: BORROW, label: "SANDBOX" },
  { take: "weekend", mark: "refused", cue: "SessionLimit", url: BORROW, label: "SANDBOX" },
  { take: "weekend", mark: "repay-tab", cue: "Repaying still works", url: BORROW, label: "SANDBOX" },
  { take: "weekend", mark: "repay", cue: "Reducing risk", rate: 3, url: BORROW, label: "SANDBOX" },
  { take: "weekend", mark: "repaid", cue: "never blocked", url: BORROW, label: "SANDBOX" },
];

const proof: Segment[] = [
  { take: "proof", mark: "proof-click", cue: null, rate: 4, url: SANDBOX, label: "SANDBOX" },
  { take: "proof", mark: "checks-done", cue: "These checks run", url: SANDBOX, label: "SANDBOX" },
  { take: "proof", mark: "ledger", cue: "and a ledger", url: SANDBOX, label: "SANDBOX" },
];

const replay: Segment[] = [
  { take: "replays", mark: "jan-click", cue: null, rate: 4, url: SANDBOX, label: "REPLAY", with: "SANDBOX" },
  { take: "replays", mark: "jan-done", cue: "NVIDIA closed on Friday", url: SANDBOX, label: "REPLAY", with: "SANDBOX" },
  { take: "replays", mark: "jan-ledger", cue: "opened Monday", url: SANDBOX, label: "REPLAY", with: "SANDBOX" },
  { take: "replays", mark: "risk-loans", cue: "Replayed on the fork", url: RISK, label: "REPLAY", with: "SANDBOX" },
  { take: "replays", mark: "risk-liqs", cue: "Nobody is liquidated", url: RISK, label: "REPLAY", with: "SANDBOX" },
];

const synthetic: Segment[] = [
  { take: "replays", mark: "syn-click", cue: null, rate: 4, url: SANDBOX, label: "SYNTHETIC", with: "SANDBOX" },
  { take: "replays", mark: "risk-liqs-2", cue: "The loan is sold", url: RISK, label: "SYNTHETIC", with: "SANDBOX" },
  { take: "replays", mark: "deficit", cue: "What it can't cover", url: LEND, label: "SYNTHETIC", with: "SANDBOX" },
  { take: "replays", mark: "primer-lose", cue: "They're told", url: LEND, label: "SYNTHETIC", with: "SANDBOX" },
];

const agents: Segment[] = [
  { take: "agents", mark: "loaded", cue: null, url: AGENTS, label: "LIVE" },
  { take: "agents", mark: "credit-card", cue: "Intatto's credit", url: AGENTS, label: "LIVE" },
  { take: "agents", mark: "submit", cue: "It answers", url: AGENTS, label: "LIVE" },
  { take: "agents", mark: "report", cue: "how much a wallet", url: AGENTS, label: "LIVE" },
  { take: "agents", mark: "response-details", cue: "from onchain reads", url: AGENTS, label: "LIVE" },
  {
    take: "keeper",
    mark: "keeper-sheet",
    cue: "And our keeper",
    url: KEEPER,
    label: "LIVE",
    fallback: { take: "keeper-explorer", mark: "rows", url: KEEPER_TX },
  },
  {
    take: "keeper-explorer",
    mark: "rows",
    cue: "Every post",
    url: KEEPER_TX,
    label: "LIVE",
    continue: true,
  },
];

export const EDL: Record<FootageBeat, Segment[]> = {
  what,
  mainnet,
  saturday,
  proof,
  replay,
  synthetic,
  agents,
};
