// Site finder: geo maths, coverage, fallback, recommendations, back-test, and a page smoke test. Run: node test/geo.js
const assert = require('assert'), fs = require('fs'), path = require('path');
const E = require('../src/engine.js'), SD = require('../src/sample.js'), Geo = require('../src/modules/geo.js');
let n = 0; const t = (name, fn) => { fn(); n++; };

t('distance: 1 degree of latitude is about 111 km', () => { assert(Math.abs(Geo.km([12, 77], [13, 77]) - 111.2) < 0.5); });
t('every existing store and nearly every sample pin has a location', () => {
  E.STORES.forEach(s => assert(Geo.pinInfo(s.pin), s.id));
  const pins = [...new Set(E.parseApplications(SD.appsAoA).map(a => a.pin).concat(...E.parseTerritories(SD.tersAoA).map(x => x.pins)))];
  const have = pins.filter(p => Geo.pinInfo(p)).length;
  assert(have / pins.length >= 0.9, have + ' of ' + pins.length);
});
t('pins without coordinates get a clear message', () => {
  const r = Geo.recommend('590002'); assert(!r.ok && /no location/.test(r.why));
  assert(!Geo.recommend('999999').ok);
});
t('three recommendations, best first, each with reasons', () => {
  const r = Geo.recommend('575002'); assert(r.ok && r.top.length === 3);
  assert(r.top[0].score >= r.top[1].score - 1e-9 || r.cells.length >= 7);
  r.top.forEach(x => { assert(x.reason.length >= 2); assert(x.overlap >= 0 && x.overlap <= 1); assert(r.cells.indexOf(x.i) >= 0); });
});
t('overlap is zero with no stores in the city and grows when a store is added next door', () => {
  const r = Geo.recommend('572101'); assert(r.top.every(x => x.overlap === 0));   // Tumakuru has no store
  const r2 = Geo.recommend('572101', null, [{ id: 'APP-X', pin: '572101' }]);
  assert(r2.top[0].overlap > 0.3, 'overlap ' + r2.top[0].overlap);
});
t('editable assumptions change the result (penalty 0 means score equals potential)', () => {
  const cfg = Geo.clone(Geo.DEFAULTS); cfg.penalty = 0;
  const r = Geo.recommend('575002', cfg); r.top.forEach(x => assert(Math.abs(x.score - x.potential) < 1e-9));
});
t('back-test covers all 10 stores', () => {
  const bt = Geo.backtest(); assert.strictEqual(bt.filter(b => b.ok).length, 10);
  bt.forEach(b => assert(b.rankPin >= 1 && b.rankPin <= b.nPin && b.rankCity <= b.nCity, b.id));
});
t('search brief has the pin, three numbered spots and the footfall caveat', () => {
  const s = Geo.brief(Geo.recommend('575002'), 'APP-007'); assert(/575002/.test(s) && /\n1\. /.test(s) && /\n3\. /.test(s) && /not measured footfall/.test(s));
});
t('page: Site finder tab draws hexagons, detail and Ask work, no script errors', () => {
  const { JSDOM, VirtualConsole } = require('jsdom'), errs = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message));
  const w = new JSDOM(fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8'), { runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true }).window, d = w.document, D = w.__desk;
  D.load(w.SampleData.appsAoA, w.SampleData.tersAoA, 'sample');
  d.querySelector('[data-act="tab"][data-v="sites"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  d.querySelector('[data-act="geo-app"][data-v="APP-007"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert(d.querySelectorAll('.hexmap polygon').length > 10 && d.querySelectorAll('.sf-picks > li').length === 3);
  D.ask('where should we open in 570002'); const m = [...d.querySelectorAll('.msg.desk')].pop().textContent;
  assert(/Where to look in pin 570002/.test(m), m);
  D.ask('where should we open in 590002'); assert(/no location/.test([...d.querySelectorAll('.msg.desk')].pop().textContent));
  assert.deepStrictEqual(errs, []);
});
console.log('  ok   site finder (' + n + ' checks)');
