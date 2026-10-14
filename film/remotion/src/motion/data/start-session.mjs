import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';

const browser = await chromium.launch({headless: true});
try {
  const page = await browser.newPage();
  await page.goto('https://intatto.larinova.com/sandbox', {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: 'Start a session', exact: true}).click({timeout: 120000});
  await page.getByTestId('sandbox-session').waitFor({timeout: 180000});
  // Deliberately select public fields in the browser. Never export the burner key.
  const session = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('intatto:sandbox') || 'null');
    if (!s) throw new Error('No sandbox session');
    return {sessionId: s.sessionId, rpcUrl: s.rpcUrl, apiUrl: s.apiUrl,
      forkBlock: s.forkBlock, chainId: s.chainId, deployment: s.deployment};
  });
  if (!Number.isInteger(session.forkBlock) || !/^https:\/\//.test(session.rpcUrl)) throw new Error('Invalid session');
  writeFileSync(new URL('./session-public.json', import.meta.url), JSON.stringify({
    sourceUrl: 'https://intatto.larinova.com/sandbox', retrievedAt: new Date().toISOString(),
    sourceCommand: 'node src/motion/data/start-session.mjs', ...session,
  }, null, 2) + '\n');
  process.stdout.write('Saved public session metadata only.\n');
} finally {
  await browser.close();
}
