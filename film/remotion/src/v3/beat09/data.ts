import credit from "../../motion/data/credit.json";
import keeper from "../../motion/data/keeper.json";
import { midTrim } from "../datakit/format";

/**
 * Beat 9's real data, read-only. credit.json: GET intatto.larinova.com/api/credit for the demo wallet on X Layer
 * mainnet (retrieved 25 Sep 2026 14:37:56 UTC). keeper.json: the keeper's action log
 * (intatto-keeper.larinova.com/log), 50 actions from 12:47:56 to 14:36:56 UTC; every post carries its tx hash.
 */

const p = credit.payload;

export const ANSWER = {
  wallet: "0x7F23…a415",
  request: "GET /api/credit?chain=196&market=NVDAx&wallet=0x7F23…a415",
  borrowable: Number(p.capacity.borrowableNowUsdg), // 0.146001
  session: p.session.state, // OPEN
  limitPct: p.capacity.limitBps / 100, // 50
  ltvPct: p.position.ltvBps / 100, // 36.63
  liquidationUsd: Number(p.liquidation.liquidationPriceUsd), // 126.156…
  priceUsd: p.price.usdPerToken, // "223.8645"
  block: p.block, // 71,578,040
  asOf: "25 Sep 2026 14:37:56 UTC",
};

export type Kind = "price" | "session" | "cap" | "skipped";
export type Post = { id: number; t: number; kind: Kind; detail: string; hash?: string };

const toSec = (iso: string) => Date.parse(iso) / 1000;

/** Oldest first. */
export const POSTS: Post[] = keeper.payload.actions
  .map((a) => ({
    id: a.id,
    t: toSec(a.at),
    kind: a.kind as Kind,
    detail: a.detail,
    hash: "txHash" in a && typeof a.txHash === "string" ? a.txHash : undefined,
  }))
  .sort((a, b) => a.t - b.t);

export const ONCHAIN = POSTS.filter((x) => x.hash);

/** The axis: 30 s either side of the log, in epoch seconds. */
export const T0 = POSTS[0].t - 30;
export const T1 = POSTS[POSTS.length - 1].t + 30;

/** The last price post: the one the answer card quoted ($223.8645 at 14:33:56 UTC). */
export const LAST_PRICE = [...POSTS].reverse().find((x) => x.kind === "price")!;
export const lastPriceHash = midTrim(LAST_PRICE.hash ?? "", 8, 5);

/** The session post where the US regular session opened (09:31 ET). */
export const OPEN_POST = POSTS.find((x) => x.kind === "session" && x.detail.includes("was CLOSED"))!;

export const utc = (t: number, seconds = true) => new Date(t * 1000).toISOString().slice(11, seconds ? 19 : 16);
