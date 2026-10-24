// Answer-key tests for the decision engine. Run: node test/run.js
const assert = require('assert');
const E = require('../src/engine.js'), S = require('../src/sample.js');
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ok  ', name); } catch (e) { fail++; console.log('  FAIL', name, '\n       ', e.message); } };
const fresh = () => ({ apps: E.parseApplications(S.appsAoA), ters: E.parseTerritories(S.tersAoA), cfg: E.clone(E.DEFAULT_CFG) });
const go = s => E.run(s.apps, s.ters, E.STORES, s.cfg);
const out = r => Object.fromEntries(Object.entries(r.res).map(([k, v]) => [k, v.outcome]));

const KEY = { 'APP-001':'Waitlist','APP-002':'Approve','APP-003':'Approve','APP-004':'Approve','APP-005':'Hold','APP-006':'Hold','APP-007':'Hold','APP-008':'Approve','APP-009':'Hold','APP-010':'Hold','APP-011':'Reject','APP-012':'Hold','APP-013':'Hold','APP-014':'Approve','APP-015':'Waitlist','APP-016':'Approve','APP-017':'Hold','APP-018':'Approve','APP-019':'Waitlist','APP-020':'Approve' };

console.log('Base decisions');
const base = go(fresh());
Object.keys(KEY).forEach(id => t(id + ' is ' + KEY[id], () => assert.strictEqual(base.res[id].outcome, KEY[id])));

console.log('Hard rules');
t('never two approvals on one pin', () => { const pins = {}; Object.values(base.res).filter(r => r.outcome === 'Approve').forEach(r => { const a = fresh().apps.find(x => x.id === r.id); assert(!pins[a.pin], 'duplicate pin ' + a.pin); pins[a.pin] = 1; }); });
t('no approval on a pin that already has a store', () => { const stores = E.STORES.map(s => s.pin); fresh().apps.forEach(a => { if (base.res[a.id].outcome === 'Approve') assert(!stores.includes(a.pin), a.id); }); });
t('approvals never exceed territory slots', () => { fresh().ters.forEach(tr => assert((base.approvedByTer[tr.id] || 0) <= tr.slots, tr.id)); });

console.log('What-if scenarios');
t('APP-012 finds a ground-floor space -> Approve', () => { const s = fresh(); const a = s.apps.find(x => x.id === 'APP-012'); a.space = 'Rented'; a.floor = 'Ground'; a.sizeAssumed = true; a.notesSuperseded = true; assert.strictEqual(go(s).res['APP-012'].outcome, 'Approve'); });
t('APP-002 withdraws -> APP-001 takes the pin', () => { const s = fresh(); s.apps.find(x => x.id === 'APP-002').withdrawn = true; assert.strictEqual(go(s).res['APP-001'].outcome, 'Approve'); });
t('TER-02 gets one more slot -> APP-019 approved', () => { const s = fresh(); s.ters.find(x => x.id === 'TER-02').slots = 2; assert.strictEqual(go(s).res['APP-019'].outcome, 'Approve'); });
t('APP-010 reaches the floor -> Approve', () => { const s = fresh(); s.apps.find(x => x.id === 'APP-010').invest = 25; assert.strictEqual(go(s).res['APP-010'].outcome, 'Approve'); });

console.log('Messy input');
t('aliases, text numbers, semicolon pins', () => {
  const H = S.appsAoA[1];
  const aoa = [['t'], H, ['APP-1', 'X', 'mysore', 'Karnataka', '570002.0', '28 lakh', '', '', 'owned', '', 'ground floor', '', 'hindi', '']];
  const a = E.parseApplications(aoa)[0];
  assert.strictEqual(a.city, 'Mysuru'); assert.strictEqual(a.pin, '570002'); assert.strictEqual(a.invest, 28); assert.strictEqual(a.space, 'Owned'); assert.strictEqual(a.floor, 'Ground'); assert.strictEqual(a.lang, 'Hindi');
  const t2 = E.parseTerritories([['t'], ['Territory ID', 'City', 'State', 'Pin codes covered', 'City tier', 'Open slots', 'Priority'], ['TER-9', 'Tumkur', 'Karnataka', '572101;572102 572103', 'Tier 3', '2', 'high']])[0];
  assert.deepStrictEqual(t2.pins, ['572101', '572102', '572103']); assert.strictEqual(t2.priority, 'High');
});
t('missing header row gives a clear error', () => assert.throws(() => E.parseApplications([['nothing here']]), /Application ID/));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
