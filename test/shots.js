// Uploads the judges-layout workbook into dist/index.html and screenshots it at 1360px and 390px, light and dark.
// Run: node test/shots.js [label]   -> shots/<label>-<width>-<scheme>.png
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
const label = process.argv[2] || 'now', out = path.join(__dirname, '..', 'shots');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch(), errs = [];
  for (const width of [1360, 390]) for (const scheme of ['light', 'dark']) {
    const p = await b.newPage({ viewport: { width, height: 900 }, colorScheme: scheme });
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html'));
    await p.setInputFiles('#file', path.join(__dirname, '..', 'test-data', 'sample-judges-layout.xlsx'));
    await p.waitForSelector('.row');
    await p.screenshot({ path: path.join(out, `${label}-${width}-${scheme}.png`), fullPage: true });
    await p.close();
  }
  await b.close();
  console.log(errs.length ? 'page errors: ' + errs.join('; ') : 'screenshots saved to shots/, no page errors');
  process.exit(errs.length ? 1 : 0);
})();
