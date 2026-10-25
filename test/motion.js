// Motion layer: it runs, it finishes with everything visible, and it stays out of the way (no GSAP, reduced motion).
// Run: node test/motion.js
const { chromium } = require('playwright'), path = require('path'), assert = require('assert');
const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html'), xl = path.join(__dirname, '..', 'test-data', 'sample-judges-layout.xlsx');
const stuck = p => p.evaluate(() => [...document.querySelectorAll('.row, .attn, .detail, .msg, .page-h h1, #tabbody > *')].filter(e => { const c = getComputedStyle(e); return +c.opacity < 1 || c.visibility === 'hidden'; }).length);
(async () => {
  const b = await chromium.launch(), errs = [];
  const open = async (opts, block) => {
    const ctx = await b.newContext(opts || {}), p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    if (block) await ctx.route('**/gsap.min.js', r => r.abort());
    await p.goto(url); return p;
  };

  // 1. with GSAP: motion happens, then everything is fully visible and unstyled by GSAP
  let p = await open({ viewport: { width: 1366, height: 800 } });
  assert(await p.evaluate(() => !!window.gsap), 'gsap loaded');
  await p.setInputFiles('#file', xl); await p.waitForSelector('.row');
  const mid = await p.evaluate(() => { const r = [...document.querySelectorAll('.rows > .row')]; return { first: Math.min(...r.slice(0, 10).map(e => +getComputedStyle(e).opacity)) }; });
  assert(mid.first < 1, 'something is animating shortly after upload ' + JSON.stringify(mid));
  await p.waitForTimeout(2500);
  assert.strictEqual(await stuck(p), 0, 'nothing left half-faded after the intro');
  assert.strictEqual(await p.evaluate(() => document.querySelector('.seg-f button b').textContent), '20', 'filter counts show the true number');
  await p.click('#row-APP-002 .row-h'); await p.waitForTimeout(700);
  await p.click('[data-act=tab][data-v=overview]'); await p.waitForTimeout(1200);
  if (!(await p.locator('#askin').isVisible())) await p.click('#askbtn'); await p.fill('#askin', 'APP-012 has now found a ground-floor space'); await p.press('#askin', 'Enter'); await p.waitForTimeout(1500);
  assert.strictEqual(await stuck(p), 0, 'nothing stuck after pages, records and Ask');
  assert(/Hold\s*to\s*Approve/.test(await p.locator('.msg.desk').last().innerText()), 'answers still arrive');
  await p.close();

  // 2. reduced motion: nothing animates, the page is already in its final state
  p = await open({ viewport: { width: 1366, height: 800 }, reducedMotion: 'reduce' });
  await p.setInputFiles('#file', xl); await p.waitForSelector('.row');
  assert.strictEqual(await stuck(p), 0, 'reduced motion: nothing hidden at any point');
  assert.strictEqual(await p.evaluate(() => getComputedStyle(document.querySelector('.row')).transform), 'none');
  await p.close();

  // 3. GSAP missing (blocked): the app works exactly as before
  p = await open({ viewport: { width: 1366, height: 800 } }, true);
  assert(await p.evaluate(() => !window.gsap), 'gsap really blocked');
  await p.setInputFiles('#file', xl); await p.waitForSelector('.row');
  assert.strictEqual(await p.locator('.row').count(), 20); assert.strictEqual(await stuck(p), 0);
  await p.close();

  await b.close();
  assert.deepStrictEqual(errs, [], 'no page errors');
  console.log('  ok   motion: runs and finishes clean; reduced motion and a missing GSAP leave the page untouched');
})().catch(e => { console.error('  FAIL', e.message); process.exit(1); });
