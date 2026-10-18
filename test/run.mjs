// npm test: abre test/massa.html num Chromium headless e lê o resultado.
import { openPage } from './cdp.mjs';

const page = await openPage('test/massa.html');
let results;
try {
  results = JSON.parse(await page.waitFor('JSON.stringify(window.__result ?? null) !== "null" && JSON.stringify(window.__result)'));
} catch (e) {
  console.error(e.message);
} finally {
  await page.close();
}
if (!results) process.exit(1);
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}\n    ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} falharam` : `\n${results.length} ok`);
process.exit(failed ? 1 : 0);
