import { sec } from "../theme";
import type { CaptionTiming } from "../ui/Caption";

/**
 * Scratch caption timings for cg-motion-ui's beats (VO_SCRIPT.md v5.3, final, verbatim), placed by hand on the pictures they
 * describe. Replace with whisper cues when Gabriel's voice-over arrives.
 */
const at = (text: string, from: number, to: number): CaptionTiming => ({ text, from: sec(from), to: sec(to) });

/** v4 timings, kept only for the unregistered v4 scenes in beat04/, beat05/, beat09/. */
export const VO_UI_V4: Record<4 | 5 | 9, CaptionTiming[]> = {
  4: [
    at("It's live on X Layer mainnet.", 0.3, 2.2),
    at("This wallet posted real NVDAx and borrowed real USDG.", 2.4, 5.2),
    at("Here's the transaction on OKLink,", 5.4, 7.6),
    at("against a verified contract.", 7.7, 10.7),
  ],
  5: [
    at("You can't wait for a weekend in a demo,", 0.3, 2.6),
    at("so we built a sandbox: a fork of X Layer mainnet,", 2.7, 5.4),
    at("same contracts, same state, and a clock we control.", 5.5, 7.9),
    at("Let's jump to Saturday.", 8.1, 11.6),
    at("I try to borrow more,", 13.6, 15.2),
    at("and the contract rejects it before I even sign.", 15.3, 19.0),
    at("Repaying still goes through.", 19.9, 21.5),
    at("Reducing risk is never blocked.", 21.6, 23.7),
  ],
  9: [
    at("It's built for OKX AI too,", 0.3, 1.9),
    at("so any agent can query a wallet's borrowing capacity in real time.", 2.0, 5.6),
    at("And our keeper reads the market every minute", 6.0, 8.4),
    at("and posts it onchain.", 8.5, 10.8),
  ],
};

/** Script v5.3 (final): Beat04 Live and forked (18 s), Beat05 Friday (18 s), Beat06 Saturday (24 s). Exact words. */
export const VO_UI: Record<4 | 5 | 6, CaptionTiming[]> = {
  4: [
    at("Intatto is live on X Layer mainnet right now.", 0.3, 3.4),
    at("For this demo, we forked mainnet,", 3.8, 6.2),
    at("so we can show you how it behaves at different points in the market week.", 6.3, 10.6),
    at("Everything you see in the demo, you can try yourself on the fork.", 11.0, 15.2),
  ],
  5: [
    at("Let's say it's a Friday afternoon right now, and the market's open.", 0.3, 3.8),
    at("I'm going to deposit some NVDAx and borrow USDG against it.", 4.1, 7.2),
    at("Since the market's open,", 7.5, 8.9),
    at("the protocol lets me borrow up to fifty percent of what my NVDAx is worth.", 9.0, 12.6),
  ],
  6: [
    at("Now let's jump ahead to Saturday.", 0.3, 2.6),
    at("With the stock market closed, the protocol has lowered my borrowing limit.", 2.9, 6.6),
    at("So when I try to borrow a little more,", 7.0, 8.9),
    at("the contract rejects the transaction before I even sign it.", 9.0, 12.2),
    at("Repaying still goes through, though,", 12.6, 14.4),
    at("because reducing your risk is never blocked.", 14.5, 17.2),
  ],
};
