// Stress workbooks (made by test/make-stress.js) go through the same path as an upload. Run: node test/stress.js
const assert = require('assert'), path = require('path');
const XLSX = require('xlsx'), E = require('../src/engine.js');
const dir = path.join(__dirname, '..', 'test-data', 'stress');
function load(file) {
  const wb = XLSX.readFile(path.join(dir, file)), sheets = {};
  wb.SheetNames.forEach(n => { sheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); });
  const pk = E.pickSheets(sheets), apps = E.parseApplications(pk.apps), ters = E.parseTerritories(pk.ters);
  const t0 = Date.now(), run = E.run(apps, ters, E.STORES, E.clone(E.DEFAULT_CFG));
  return { apps, ters, run, ms: Date.now() - t0, get: id => apps.find(a => a.id === id), out: id => run.res[id].outcome };
}
function rules(x) {
  const pins = {};
  Object.values(x.run.res).filter(r => r.outcome === 'Approve').forEach(r => { const a = x.get(r.id); assert(!pins[a.pin], 'two approvals on ' + a.pin); assert(!E.STORES.some(s => s.pin === a.pin), 'approval on a store pin'); pins[a.pin] = 1; });
  x.ters.forEach(t => assert((x.run.approvedByTer[t.id] || 0) <= t.slots, t.id + ' over its slots'));
  x.apps.forEach(a => assert(['Approve', 'Waitlist', 'Hold', 'Reject'].includes(x.run.res[a.id].outcome), a.id + ' has no outcome'));
}
let n = 0; const t = (name, fn) => { fn(); n++; console.log('  ok  ', name); };

t('blank cells: every row decided, blanks become holds with a plain reason', () => {
  const x = load('blank-cells.xlsx'); rules(x);
  assert.strictEqual(x.apps.length, 20); assert.strictEqual(x.ters.length, 9);
  assert.strictEqual(x.out('APP-002'), 'Hold'); assert(x.run.res['APP-002'].issues.some(i => i.code === 'INVEST_MISSING'));
  assert(x.run.res['APP-003'].issues.some(i => i.title === 'Pin code missing'));
  assert(x.run.res['APP-006'].issues.some(i => i.title === 'City missing'));
  assert(x.run.res['APP-008'].issues.some(i => i.code === 'SIZE_MISSING'));
});
t('numbers as text: lakh, rupees, crore, units and spaced pins read correctly', () => {
  const x = load('numbers-as-text.xlsx'); rules(x);
  assert.deepStrictEqual(['APP-001', 'APP-002', 'APP-003', 'APP-004'].map(id => x.get(id).invest), [25, 40, 30, 28]);
  assert.strictEqual(x.get('APP-003').pin, '570002'); assert.strictEqual(x.get('APP-004').pin, '570008');
  assert.strictEqual(x.get('APP-001').size, 450); assert.strictEqual(x.get('APP-001').launch, 3);
  assert.deepStrictEqual(x.ters[0].pins, ['570001', '570002', '570008', '570009']); assert.strictEqual(x.ters[1].slots, 1);
  assert.strictEqual(x.out('APP-002'), 'Approve'); assert.strictEqual(x.out('APP-001'), 'Waitlist');
});
t('odd headers, other column order, generic sheet names: same decisions as the sample', () => {
  const x = load('odd-headers.xlsx'), base = load('numbers-as-text.xlsx'); rules(x);
  const S = require('../src/sample.js'), ref = E.run(E.parseApplications(S.appsAoA), E.parseTerritories(S.tersAoA), E.STORES, E.clone(E.DEFAULT_CFG));
  Object.keys(ref.res).forEach(id => assert.strictEqual(x.out(id), ref.res[id].outcome, id));
  assert(base);
});
t('leading and trailing spaces, mixed case', () => {
  const x = load('trailing-spaces.xlsx'); rules(x);
  assert.strictEqual(x.get('APP-001').city, 'Mysuru'); assert.strictEqual(x.get('APP-002').space, 'Owned');
  assert.strictEqual(x.get('APP-003').floor, 'Mall unit'); assert(x.get('APP-006'));
  assert.strictEqual(x.out('APP-002'), 'Approve');
});
t('150 applications decide fast and keep every rule', () => {
  const x = load('big-150.xlsx'); rules(x);
  assert.strictEqual(x.apps.length, 150); assert(x.ms < 3000, 'took ' + x.ms + ' ms');
  const c = {}; Object.values(x.run.res).forEach(r => { c[r.outcome] = (c[r.outcome] || 0) + 1; });
  assert(c.Approve > 0 && c.Hold > 0 && c.Waitlist > 0, JSON.stringify(c));
});
t('missing Territories sheet gives a clear message', () => {
  assert.throws(() => load('missing-sheet.xlsx'), /No Territories sheet found.*Territory ID, City/);
});
console.log('  ' + n + ' stress workbooks ok');
