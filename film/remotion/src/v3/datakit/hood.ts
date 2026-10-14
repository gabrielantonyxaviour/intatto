import hood from "../../motion/data/hood.json";
import atCap from "../../motion/data/depth-at-cap.json";

/**
 * Beat 08/09 data from X Layer mainnet (motion/data/hood.json, fetch-hood.mjs): the keeper's price posts with the
 * pool TWAP each was checked against, the relay's band, the reserve factor, and a QuoterV2 sell-depth curve.
 */
const E18 = 1e18;
export const BAND_OPEN_BPS = Number(hood.params.bandOpenBps.value); // 300
export const RESERVE_FACTOR_BPS = Number(hood.params.reserveFactorBps.value); // 2000
export const TWAP_WINDOW_S = Number(hood.params.twapWindow.value); // 1800

/** 09:30 ET on 25 Sep 2026 (EDT): from here the relay checks against the open-market band. */
const OPEN_UNIX = Date.parse("2026-09-25T09:30:00-04:00") / 1000;

export type Post = { t: number; keeper: number; twap: number; deviationBps: number; tx: string };
export const POSTS: Post[] = hood.pricePosted.posts
  .map((p) => ({ t: p.fetchedAt, keeper: Number(p.wrapperPriceE18) / E18, twap: Number(p.twapWrapperPriceE18) / E18, deviationBps: p.deviationBps, tx: p.tx }))
  .filter((p) => p.t >= OPEN_UNIX)
  .sort((a, b) => a.t - b.t);

export const WIDEST = POSTS.reduce((m, p) => (p.deviationBps > m.deviationBps ? p : m), POSTS[0]);

/** "09:31 ET" for a unix time on 25 Sep 2026 (EDT, UTC−4). */
export const etClock = (t: number) => {
  const d = new Date((t - 4 * 3600) * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} ET`;
};

export type DepthPoint = { shares: number; out: number; price: number; slipBps: number };
/** The pool's depth at the block the keeper sampled for its latest posted cap (depth-at-cap.json). */
const raw = atCap.depth.filter((d) => d.out !== null).map((d) => ({ shares: d.shares, out: Number(d.out) / 1e6 }));
const base = raw[0].out / raw[0].shares;
export const DEPTH: DepthPoint[] = raw.map((d) => ({ ...d, price: d.out / d.shares, slipBps: (1 - d.out / d.shares / base) * 1e4 }));
export const DEPTH_BASE = base;

/** The keeper's rule (services/keeper steps/depth.ts): the largest of its sizes within 2% sets the cap at 50%. */
export const KEEPER = hood.keeperDefaults;
export const CAP_SIZE = DEPTH.find((d) => d.shares === Number(atCap.capPost.data.sizeShares))!;
/** The cap as the keeper posted it onchain (DepthCapRegistry.post), not recomputed. */
export const CAP_USDG = Number(atCap.capPost.data.capUsdg) / 1e6;
export const CAP_POST = { at: atCap.capPost.at, tx: atCap.capPost.txHash, block: atCap.capPost.block };
