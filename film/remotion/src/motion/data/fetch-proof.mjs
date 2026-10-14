import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';

const session = z.object({rpcUrl: z.string().url(), forkBlock: z.number().int().positive(),
  sessionId: z.string(), deployment: z.object({markets: z.array(z.object({symbol: z.string(), market: z.string()}))}),
}).parse(JSON.parse(readFileSync(new URL('./session-public.json', import.meta.url))));
const mainnet = 'https://rpc.xlayer.tech';
const hexHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const addresses = [
  ['NVDAx', '0xc845b2894dBddd03858fd2D643B4eF725fE0849d'],
  ['wNVDAx', '0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5'],
  ['Pool', '0x2a2B11730C2b6d99a58034A869dd810D7300a7b2'],
  ['USDG', '0x4ae46a509F6b1D9056937BA4500cb143933D2dc8'],
  ['CollateralMarket', '0xE6708CC6598F17611f9A468f9907052688459D0D'],
];
const read = async (args) => {
  // Sequential requests, at most two RPC calls per second, with bounded retry.
  for (let attempt = 0; attempt < 3; attempt++) {
    await delay(attempt ? 3000 : 550);
    try {
      const value = execFileSync('cast', args, {encoding: 'utf8', timeout: 45000}).trim();
      return {value, sourceCommand: ['cast', ...args].join(' '), retrievedAt: new Date().toISOString()};
    } catch (e) {if (attempt === 2) throw e;}
  }
};
const block = async (rpc) => {
  const r = await read(['block', String(session.forkBlock), '--rpc-url', rpc, '--json']);
  const b = JSON.parse(r.value);
  return {...r, value: hexHash.parse(b.hash), number: b.number, timestamp: b.timestamp};
};
const blockReference = await block(mainnet);
const blockSandbox = await block(session.rpcUrl);
const rows = [{id: 'fork-block', label: `Fork block ${session.forkBlock}`, group: 'block',
  mainnet: blockReference, sandbox: blockSandbox, equal: blockReference.value === blockSandbox.value}];
for (const [name, address] of addresses) {
  const forkAddress = name === 'CollateralMarket'
    ? session.deployment.markets.find((m) => m.symbol === 'NVDAx')?.market : address;
  if (!forkAddress) throw new Error('Missing sandbox market address');
  const reference = await read(['code', address, '--block', String(session.forkBlock), '--rpc-url', mainnet]);
  const sandbox = await read(['code', forkAddress, '--rpc-url', session.rpcUrl]);
  for (const r of [reference, sandbox]) {
    if (!/^0x[0-9a-fA-F]+$/.test(r.value) || r.value.length < 4) throw new Error(`Empty/invalid ${name} code`);
    r.byteLength = (r.value.length - 2) / 2;
    r.value = hexHash.parse(execFileSync('cast', ['keccak', r.value], {encoding: 'utf8'}).trim());
    r.hashCommand = 'cast keccak <bytecode returned by sourceCommand>';
  }
  rows.push({id: name, label: `${name} · bytecode keccak`, group: name === 'CollateralMarket' ? 'intatto' : 'code',
    address, forkAddress, masked: false, mainnet: reference, sandbox, equal: reference.value === sandbox.value});
}
const usdg = addresses.find(([n]) => n === 'USDG')[1];
const stateMainnet = await read(['call', usdg, 'totalSupply()(uint256)', '--block', String(session.forkBlock), '--rpc-url', mainnet]);
const stateSandbox = await read(['call', usdg, 'totalSupply()(uint256)', '--rpc-url', session.rpcUrl]);
// cast adds a human scientific annotation after large integers: preserve only exact decimal digits.
for (const r of [stateMainnet, stateSandbox]) {
  r.value = r.value.split(/\s/)[0];
  if (!/^\d+$/.test(r.value)) throw new Error('Invalid supply');
}
rows.push({id: 'usdg-supply', label: 'USDG · totalSupply (raw units)', group: 'state',
  mainnet: stateMainnet, sandbox: stateSandbox, equal: stateMainnet.value === stateSandbox.value});
writeFileSync(new URL('./proof.json', import.meta.url), JSON.stringify({
  retrievedAt: new Date().toISOString(), sourceCommand: 'node src/motion/data/fetch-proof.mjs',
  sourceUrls: [mainnet, session.rpcUrl], sessionId: session.sessionId, forkBlock: session.forkBlock,
  comparison: 'Mainnet pinned to fork block; live sandbox latest. Raw bytecode keccak, no immutable masking.',
  scope: 'Selected block, four external bytecodes, one state value, and CollateralMarket bytecode; not the full browser proof suite.',
  rows, checks: ['block', 'code', 'state', 'intatto'].map((group) => ({group,
    equal: rows.filter((r) => r.group === group).every((r) => r.equal)})),
}, null, 2) + '\n');
process.stdout.write(`Saved ${rows.length} comparisons; ${rows.filter((r) => r.equal).length} equal.\n`);
