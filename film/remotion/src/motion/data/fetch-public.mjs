import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const dir = new URL('./', import.meta.url);
const save = (name, value) => writeFileSync(new URL(name, dir), JSON.stringify(value, null, 2) + '\n');
const retrievedAt = new Date().toISOString();
const sourcePath = new URL('../../../../../data/replays/nvda-2025-01-gap.json', import.meta.url);
const raw = readFileSync(sourcePath);
const replay = JSON.parse(raw);
if (replay.anchors.fridayClose.c !== 142.596 || replay.anchors.mondayOpen.o !== 124.817) {
  throw new Error('Unexpected replay anchors; review upstream data before proceeding');
}
const bars = replay.bars.filter((b) => b.t >= Date.parse('2025-01-24T17:00:00Z') / 1000);
for (const b of bars) {
  if (!['t', 'o', 'h', 'l', 'c'].every((k) => Number.isFinite(b[k]))) throw new Error('Invalid OHLC bar');
}
// Compact bars keep this data file below 300 lines without dropping minute observations.
const data = {...replay, bars: undefined, retrievedAt, sourceFile: fileURLToPath(sourcePath),
  sourceFileSha256: createHash('sha256').update(raw).digest('hex'),
  selection: 'Fri 24 Jan 2025 noon–15:59 ET and all Mon 27 regular-session minute bars',
  sourceCommand: 'node src/motion/data/fetch-public.mjs',
  gapPercent: (replay.anchors.mondayOpen.o / replay.anchors.fridayClose.c - 1) * 100};
writeFileSync(new URL('nvda-minute-bars.json', dir), JSON.stringify(data, null, 2).replace(/\n}$/, ',\n  "bars": ' + JSON.stringify(bars) + '\n}') + '\n');
save('recorded-run.json', {
  retrievedAt, source: '../../../../../film/storyboard/MOTION_BRIEF.md',
  sourceCommand: 'read film/storyboard/MOTION_BRIEF.md beats 5–7',
  evidenceKind: 'Coordinator-supplied recorded run; not refreshed by the collector',
  replay: {terminalLtvPercent: 59.57, liquidationThresholdPercent: 65, liquidations: 0},
  synthetic: {label: 'SYNTHETIC · not market data', crashPercent: 45, slices: 1,
    soldWnvdax: '19.966', receivedUsdg: '2037.58', floorHeld: true,
    reserveBeforeUsdg: '149.10', reserveAfterUsdg: '0.00', lenderLossUsdg: '147.69',
    shareBefore: '1.000008', shareAfter: '0.997054', shareChangePercent: '-0.2954'},
  saturday: {error: 'SESSIONLIMIT', repayment: 'Repay goes through', label: 'SANDBOX'},
});
for (const [name, url] of [
  ['credit.json', 'https://intatto.larinova.com/api/credit?chain=196&market=NVDAx&wallet=0x7F23b131F7312bd0f63EF79974E215Dc3E12a415'],
  ['keeper.json', 'https://intatto-keeper.larinova.com/log'],
]) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const payload = await res.json();
  if (name === 'credit.json' && (!payload.capacity || !payload.liquidation || payload.chainId !== 196)) throw new Error('Invalid credit response');
  if (name === 'keeper.json' && !Array.isArray(payload.actions)) throw new Error('Invalid keeper response');
  // Store only public returned fields. This collector never reads credentials.
  save(name, {sourceUrl: url, retrievedAt: new Date().toISOString(), payload});
}
process.stdout.write(`Saved minute bars (${bars.length}), recorded values, keeper and credit snapshots.\n`);
