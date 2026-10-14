import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

/**
 * The pool's sell-depth curve at the moment the keeper posted its latest depth cap (read-only, X Layer mainnet).
 * Takes the newest `cap` action in keeper.json, finds the block whose QuoterV2 quote for its sale size reproduces
 * the posted proceeds exactly (searching back from the post's block), then quotes every size at that block.
 * Usage: node src/motion/data/fetch-depth-at-cap.mjs   (writes depth-at-cap.json next to this file)
 */
const RPC = 'https://rpc.xlayer.tech';
const QUOTER = '0xd1b797d92d87b688193a2b976efc8d577d204343';
const WRAPPER = '0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5';
const USDG = '0x4ae46a509F6b1D9056937BA4500cb143933D2dc8';
const POOL = '0x2a2B11730C2b6d99a58034A869dd810D7300a7b2';
const SIG = 'quoteExactInputSingle((address,address,uint256,uint24,uint160))(uint256,uint160,uint32,uint256)';

const cast = (args) => execFileSync('cast', [...args, '--rpc-url', RPC], {encoding: 'utf8', timeout: 60000}).trim();
const first = (s) => s.split(/\s+/)[0];

const keeper = JSON.parse(readFileSync(new URL('./keeper.json', import.meta.url), 'utf8'));
const post = keeper.payload.actions.filter((a) => a.kind === 'cap').sort((a, b) => b.at.localeCompare(a.at))[0];
const postBlock = Number(cast(['receipt', post.txHash, 'blockNumber']));
const fee = first(cast(['call', POOL, 'fee()(uint24)']));
const quote = (shares, block) => {
  const wei = execFileSync('cast', ['to-wei', shares], {encoding: 'utf8'}).trim();
  const args = ['call', QUOTER, SIG, `(${WRAPPER},${USDG},${wei},${fee},0)`, '--block', String(block)];
  try {
    return {out: first(cast(args)), sourceCommand: ['cast', ...args, '--rpc-url', RPC].join(' ')};
  } catch {
    return {out: null, sourceCommand: ['cast', ...args, '--rpc-url', RPC].join(' ')};
  }
};

let block = null;
for (let d = 1; d <= 60 && block === null; d++) {
  if (quote(post.data.sizeShares, postBlock - d).out === post.data.outUsdg) block = postBlock - d;
}
if (block === null) throw new Error(`no block within 60 of ${postBlock} reproduces ${post.data.outUsdg}`);

const depth = ['0.5', '2', '10', '50', '200', '400', '800', '1600'].map((s) => ({shares: Number(s), ...quote(s, block)}));
writeFileSync(new URL('./depth-at-cap.json', import.meta.url), JSON.stringify({
  retrievedAt: new Date().toISOString(), rpc: RPC,
  capPost: {at: post.at, txHash: post.txHash, block: postBlock, detail: post.detail, data: post.data},
  sampledAtBlock: block, note: 'The block whose 200-share quote equals the posted proceeds exactly.',
  poolFee: fee, depth,
}, null, 1));
process.stdout.write(`cap post block ${postBlock}, sampled at ${block}, ${depth.filter((d) => d.out).length}/${depth.length} quotes\n`);
