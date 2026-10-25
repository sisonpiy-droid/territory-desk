// Real browser, fresh private context, laptop and phone: uploads every workbook through the file input.
// Run: node test/e2e.js            -> local dist/ with every outside host blocked (a CDN or font outage)
//      node test/e2e.js <url>      -> a deployed link, e.g. https://territory-desk.vercel.app
const { chromium, devices } = require('playwright'), path = require('path'), assert = require('assert');
const url = process.argv[2], target = url || 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
const files = {
  '../test-data/sample-judges-layout.xlsx': { rows: 20 },
  '../test-data/stress/blank-cells.xlsx': { rows: 20 },
  '../test-data/stress/numbers-as-text.xlsx': { rows: 20 },
  '../test-data/stress/odd-headers.xlsx': { rows: 20 },
  '../test-data/stress/trailing-spaces.xlsx': { rows: 20 },
  '../test-data/stress/big-150.xlsx': { rows: 150 },
  '../test-data/stress/missing-sheet.xlsx': { error: /No Territories sheet found/ }
};
(async () => {
  const b = await chromium.launch();
  for (const [label, ctxOpts] of [['laptop', { viewport: { width: 1366, height: 768 } }], ['phone', devices['iPhone 13']]]) {
    const ctx = await b.newContext(ctxOpts), errs = [], blocked = new Set();
    if (!url) await ctx.route(/^https?:/, r => { blocked.add(new URL(r.request().url()).host); r.abort(); });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(target);
    for (const [f, exp] of Object.entries(files)) {
      const t0 = Date.now();
      await p.setInputFiles('#file', path.join(__dirname, f));
      if (exp.error) {
        await p.waitForSelector('#err:not([hidden])');
        assert(exp.error.test(await p.locator('#err').innerText()), f + ' error message');
        console.log('  ok  ', label, path.basename(f), '-> clear error message');
      } else {
        await p.waitForFunction(n => document.querySelectorAll('.row').length === n && document.querySelector('.kpis'), exp.rows, { timeout: 20000 });
        assert(await p.locator('#err').isHidden(), f + ' showed an error');
        console.log('  ok  ', label, path.basename(f), '->', exp.rows, 'decisions in', Date.now() - t0, 'ms');
      }
    }
    if (!(await p.locator('#askin').isVisible())) await p.click('#askbtn');   // on a phone, Ask the desk opens from the top bar
    await p.locator('#askin').fill('APP-012 has now found a ground-floor space'); await p.locator('#askin').press('Enter');
    await p.setInputFiles('#file', path.join(__dirname, '../test-data/sample-judges-layout.xlsx'));
    await p.waitForFunction(() => document.querySelectorAll('.row').length === 20);
    if (!(await p.locator('#askin').isVisible())) await p.click('#askbtn');
    await p.locator('#askin').fill('APP-012 has now found a ground-floor space'); await p.locator('#askin').press('Enter');
    assert(/Hold\s*to\s*Approve/.test(await p.locator('.msg.desk').last().innerText()), 'follow-up works after uploads');
    assert.deepStrictEqual(errs, [], label + ' page errors');
    console.log('  ok  ', label, 'follow-up after uploads; no page errors' + (blocked.size ? '; blocked ' + [...blocked].join(', ') : ''));
    await ctx.close();
  }
  await b.close();
})().catch(e => { console.error('  FAIL', e.message); process.exit(1); });
