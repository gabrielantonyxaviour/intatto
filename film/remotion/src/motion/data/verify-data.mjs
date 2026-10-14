import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chartGeometry} from '../chart/geometry.ts';

const read = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url)));
const replay = read('nvda-minute-bars.json');
const chart = chartGeometry(replay.bars, 1260, 550);
assert.equal(chart.close, 142.596);
assert.equal(chart.open, 124.817);
assert.equal(replay.bars.length, 630);
assert.equal(replay.bars.filter((b) => new Date(b.t * 1000).getUTCDay() === 5).length, 240);
assert.equal(replay.bars.filter((b) => new Date(b.t * 1000).getUTCDay() === 1).length, 390);
assert.ok(chart.gapLeft < chart.gapRight);
assert.ok(chart.mondayPath.startsWith(`M${chart.gapRight.toFixed(2)},${chart.y(124.817).toFixed(2)}`));
assert.throws(() => chartGeometry([], 1260, 550));
assert.throws(() => chartGeometry([...replay.bars].reverse(), 1260, 550));
assert.throws(() => chartGeometry(replay.bars, 0, 0));
const proof = read('proof.json');
assert.equal(proof.rows.length, 7);
for (const r of proof.rows) {
  assert.equal(r.equal, r.mainnet.value === r.sandbox.value);
  assert.ok(r.mainnet.sourceCommand && r.sandbox.sourceCommand);
  if (r.group !== 'state') for (const col of ['mainnet', 'sandbox']) assert.match(r[col].value, /^0x[\da-f]{64}$/i);
}
for (const c of proof.checks) assert.equal(c.equal, proof.rows.filter((r) => r.group === c.group).every((r) => r.equal));
const credit = read('credit.json');
assert.equal(credit.payload.chainId, 196);
assert.ok(Number.isFinite(Number(credit.payload.capacity.borrowableNowUsdg)));
const keeper = read('keeper.json');
for (const action of keeper.payload.actions) {
  assert.ok(Number.isFinite(Date.parse(action.at)));
  if (action.txHash) assert.match(action.txHash, /^0x[\da-f]{64}$/i);
}
for (const t of read('mainnet-transactions.json').transactions) assert.equal(t.receipt.status, '0x1');
assert.ok(!/burnerKey|privateKey|mnemonic/.test(JSON.stringify(read('session-public.json'))));
process.stdout.write('Data and chart boundary checks passed: anchors, gap, timestamps, proof equality, API shape, receipts, public-only session.\n');
