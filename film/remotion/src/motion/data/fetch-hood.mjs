import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

/**
 * Beat 08/09 data ("under the hood", "the model"), read from X Layer mainnet with cast. Read-only.
 * - each keeper price post in keeper.json: its PricePosted event (keeper quote, pool 30-min TWAP, deviation)
 * - the relay's own band and window, the market's reserve factor, the live depth cap and slice
 * - a QuoterV2 sell-depth curve for wNVDAx → USDG at the keeper's sizes and beyond
 * Usage: node src/motion/data/fetch-hood.mjs   (writes hood.json next to this file)
 */
const RPC = 'https://rpc.xlayer.tech';
const M = {
  relay: '0xf69c0EA60a6f6b94fF3C0F40af8bA3B97A4567a4',
  market: '0xE6708CC6598F17611f9A468f9907052688459D0D',
  depthCaps: '0x30279C37B299b51f03F4b2b5898902670e13F986',
  wrapper: '0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5',
  usdg: '0x4ae46a509F6b1D9056937BA4500cb143933D2dc8',
  pool: '0x2a2B11730C2b6d99a58034A869dd810D7300a7b2',
  quoterV2: '0xd1b797d92d87b688193a2b976efc8d577d204343',
  deployBlock: 71562056,
};
const POSTED = 'PricePosted(uint256,uint256,uint256,uint256,uint256,int256,uint64,uint64)';

const run = async (args) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    await delay(attempt ? 3000 : 400);
    try {
      const value = execFileSync('cast', [...args, '--rpc-url', RPC], {encoding: 'utf8', timeout: 60000}).trim();
      return {value, sourceCommand: ['cast', ...args, '--rpc-url', RPC].join(' '), retrievedAt: new Date().toISOString()};
    } catch (e) {if (attempt === 2) throw e;}
  }
};
const first = (s) => s.split(/\s+/)[0];

// eth_getLogs is capped at 100 blocks on this RPC, so read each keeper price post's receipt instead
// (the tx hashes come from keeper.json, the keeper's own log).
const keeper = JSON.parse(readFileSync(new URL('./keeper.json', import.meta.url), 'utf8'));
const topic = execFileSync('cast', ['sig-event', POSTED], {encoding: 'utf8'}).trim().toLowerCase();
const latest = Number((await run(['block-number'])).value);
const posts = [];
const logCommands = [];
for (const a of keeper.payload.actions.filter((x) => x.kind === 'price' && x.txHash)) {
  const r = await run(['receipt', a.txHash, '--json']);
  logCommands.push(r.sourceCommand);
  const rc = JSON.parse(r.value);
  const log = rc.logs.find((l) => l.address.toLowerCase() === M.relay.toLowerCase() && l.topics[0].toLowerCase() === topic);
  if (!log) continue;
  const w = log.data.slice(2).match(/.{64}/g).map((h) => BigInt('0x' + h));
  posts.push({
    block: Number(rc.blockNumber), tx: a.txHash, keeperAt: a.at,
    quoteE18: w[0].toString(), wrapperPriceE18: w[1].toString(), twapWrapperPriceE18: w[2].toString(),
    deviationBps: Number(w[3]), moveBps: Number(w[4]), fetchedAt: Number(w[6]),
  });
}
posts.sort((a, b) => a.fetchedAt - b.fetchedAt);

const call = (to, sig, ...a) => run(['call', to, sig, ...a]);
const params = {
  bandOpenBps: await call(M.relay, 'bandOpenBps()(uint256)'),
  bandOtherBps: await call(M.relay, 'bandOtherBps()(uint256)'),
  twapWindow: await call(M.relay, 'twapWindow()(uint32)'),
  reserveFactorBps: await call(M.market, 'RESERVE_FACTOR_BPS()(uint256)'),
  capUsdg: await call(M.depthCaps, 'capOf(address)(uint256)', M.market),
  sliceUsdg: await call(M.depthCaps, 'sliceOf(address)(uint256)', M.market),
};
for (const v of Object.values(params)) v.value = first(v.value);

const fee = first((await call(M.pool, 'fee()(uint24)')).value);
const depth = [];
for (const shares of ['0.5', '2', '10', '50', '200', '400', '800', '1600']) {
  const wei = execFileSync('cast', ['to-wei', shares], {encoding: 'utf8'}).trim();
  try {
    const r = await call(M.quoterV2, 'quoteExactInputSingle((address,address,uint256,uint24,uint160))(uint256,uint160,uint32,uint256)',
      `(${M.wrapper},${M.usdg},${wei},${fee},0)`);
    depth.push({shares: Number(shares), outUsdg: first(r.value), sourceCommand: r.sourceCommand, retrievedAt: r.retrievedAt});
  } catch {
    depth.push({shares: Number(shares), outUsdg: null, note: 'QuoterV2 could not fill this size'});
  }
}

writeFileSync(new URL('./hood.json', import.meta.url), JSON.stringify({
  retrievedAt: new Date().toISOString(), rpc: RPC, latestBlock: latest, contracts: M,
  keeperDefaults: {source: 'services/keeper/src/context.ts', depthSizes: ['0.5', '2', '10', '50', '200'], depthSlippageBps: 200, capHaircutBps: 5000, sliceBps: 2500},
  pricePosted: {event: POSTED, sourceCommands: logCommands, posts},
  params, poolFee: fee, depth,
}, null, 1));
process.stdout.write(`posts ${posts.length}, depth ${depth.filter((d) => d.outUsdg).length}/${depth.length}\n`);
