// Serves dist/ and api/place.js on localhost, then checks the Site finder's live lookup end to end in a browser.
// Needs internet (OpenStreetMap). Run: node test/live-local.js [pin-or-place]
const http = require('http'), fs = require('fs'), path = require('path'), { chromium } = require('playwright');
const handler = require('../api/place.js'), dist = path.join(__dirname, '..', 'dist');
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/api/place')) return handler(req, res);
  const f = path.join(dist, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', f.endsWith('.html') ? 'text/html' : 'application/javascript'); res.end(b); });
}).listen(0, async () => {
  const q = process.argv[2] || 'Hosapete', b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1360, height: 1000 } }), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:' + srv.address().port + '/');
  await p.setInputFiles('#file', path.join(__dirname, '..', 'test-data', 'sample-judges-layout.xlsx')); await p.waitForSelector('.row');
  await p.click('[data-act=tab][data-v=sites]'); await p.fill('#geo-pin', q); await p.press('#geo-pin', 'Enter');
  const t0 = Date.now(); await p.waitForSelector('.sf-picks > li, .sf-box b', { timeout: 90000 });
  await p.waitForFunction(() => !document.querySelector('.sf-wait'), null, { timeout: 90000 });
  const live = await p.locator('.sf-live, .sf-box').first().innerText();
  console.log(q + ': ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s; ' + (await p.locator('.sf-picks > li').count()) + ' picks; ' + live.slice(0, 160).replace(/\n/g, ' '));
  await p.evaluate(() => document.querySelector('.tabs').scrollIntoView()); await p.screenshot({ path: path.join(__dirname, '..', 'shots', 'g-live.png') });
  console.log(errs.length ? errs : 'no page errors'); await b.close(); srv.close();
});
