import type { ToneName } from "./theme";

/** VO_SCRIPT.md v5.3 (final, Gabriel 25 Sep), verbatim. One entry per beat; `vo` is the paragraphs as spoken. */
export type BeatScript = {
  n: number;
  id: string;
  title: string;
  seconds: number;
  /** Tone at the start and the end of the beat. */
  tones: [ToneName, ToneName];
  vo: string[];
};

export const SCRIPT: BeatScript[] = [
  {
    n: 1,
    id: "hook",
    title: "Hook",
    seconds: 14,
    tones: ["light", "light"],
    vo: [
      "Tokenized stocks trade twenty-four seven, but the stocks underneath them don't.",
      "There's about ninety million dollars of them on X Layer, and right now you can't borrow against any of it.",
    ],
  },
  {
    n: 2,
    id: "hard",
    title: "Why it's hard",
    seconds: 25,
    tones: ["light", "dark"],
    vo: [
      "Bybit, Kraken and Bitget already lend against these tokens, but doing it onchain is harder, because the weekend breaks pricing.",
      "Price discovery stops Friday at 8 p.m. Eastern. The token keeps trading on thin liquidity, and even the issuer stops quoting until the open. Lend into that, and you're carrying gap risk with no real price.",
    ],
  },
  {
    n: 3,
    id: "intatto",
    title: "Intatto",
    seconds: 30,
    tones: ["light", "dark"],
    vo: [
      "So we built Intatto, a lending market that lives natively on X Layer. You just put in your tokenized stocks and borrow USDG against them, any day of the week.",
      "The key thing is that Intatto knows when the actual stock market is open. Your borrowing limit tracks the market session: it's higher while the stock is actually trading, and it tightens once the market closes.",
      "And the liquidation threshold never moves, so a market close never pushes an existing loan toward liquidation.",
    ],
  },
  {
    n: 4,
    id: "forked",
    title: "Live, and forked for this demo",
    seconds: 18,
    tones: ["light", "light"],
    vo: [
      "Intatto is live on X Layer mainnet right now. For this demo, we forked mainnet, so we can show you how it behaves at different points in the market week. Everything you see in the demo, you can try yourself on the fork.",
    ],
  },
  {
    n: 5,
    id: "friday",
    title: "Friday",
    seconds: 18,
    tones: ["light", "light"],
    vo: [
      "Let's say it's a Friday afternoon right now, and the market's open. I'm going to deposit some NVDAx and borrow USDG against it. Since the market's open, the protocol lets me borrow up to fifty percent of what my NVDAx is worth.",
    ],
  },
  {
    n: 6,
    id: "saturday",
    title: "Saturday",
    seconds: 24,
    tones: ["light", "dark"],
    vo: [
      "Now let's jump ahead to Saturday. With the stock market closed, the protocol has lowered my borrowing limit. So when I try to borrow a little more, the contract rejects the transaction before I even sign it. Repaying still goes through, though, because reducing your risk is never blocked.",
    ],
  },
  {
    n: 7,
    id: "replay",
    title: "The real weekend",
    seconds: 24,
    tones: ["dark", "light"],
    vo: [
      "Now here's a real example. In January 2025, after DeepSeek's new AI model took off over a weekend, NVIDIA opened twelve and a half percent down that Monday. Replayed on our fork, a loan taken at the weekday limit goes up to about sixty percent LTV, which is still under the sixty-five percent liquidation threshold, so nobody gets liquidated.",
    ],
  },
  {
    n: 8,
    id: "risk",
    title: "How it handles risk",
    seconds: 29,
    tones: ["light", "light"],
    vo: [
      "Under the hood, we've been really careful about risk. The price comes onchain through our keeper, and the contracts check it against the pool before accepting it. For production, we've already built an adapter for Chainlink Data Streams, so that price becomes fully verifiable. We only lend what X Layer's pools could absorb in a sale.",
    ],
  },
  {
    n: 9,
    id: "model",
    title: "The model",
    seconds: 20,
    tones: ["light", "light"],
    vo: [
      "The model is pretty simple: borrowers pay interest, eighty percent of it goes to lenders, and twenty percent goes into the gap reserve. We make money by running the keeper, which earns half of the five percent liquidation penalty, and the credit API is built for pay-per-call through x402, so agents can pay per query once we switch it on.",
      "Every stock is its own isolated market, so adding the next stock is just a deployment away. We already run NVDAx and SPYx on our fork, and NVDAx on mainnet.",
    ],
  },
  {
    n: 10,
    id: "agents",
    title: "Agents",
    seconds: 27,
    tones: ["light", "light"],
    vo: [
      "We've also registered Intatto on the OKX AI marketplace. It provides an A2MCP service called Borrow capacity and health, so anyone can have their agent call it and ask how much a wallet can borrow right now. It reads straight from the chain, works out the numbers, and responds with the session, the limit, the LTV and the liquidation price.",
    ],
  },
  {
    n: 11,
    id: "close",
    title: "Close",
    seconds: 13,
    tones: ["light", "light"],
    vo: [
      "That's Intatto. You can borrow against your tokenized stocks on X Layer twenty-four seven, and it's live right now at intatto dot larinova dot com.",
    ],
  },
];

export const beat = (n: number): BeatScript => {
  const found = SCRIPT.find((b) => b.n === n);
  if (!found) throw new Error(`no beat ${n}`);
  return found;
};
