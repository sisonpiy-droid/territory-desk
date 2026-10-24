// Operations view numbers for the sample data. Run: node test/ops.js
const assert = require('assert');
const E = require('../src/engine.js'), SD = require('../src/sample.js'), O = require('../src/modules/ops.js');
const fresh = () => { const S = { apps: E.parseApplications(SD.appsAoA), ters: E.parseTerritories(SD.tersAoA), cfg: E.clone(E.DEFAULT_CFG) }; S.run = E.run(S.apps, S.ters, E.STORES, S.cfg); return S; };
const S = fresh();

const p = O.pipeline(S);
assert.deepStrictEqual(p.map(s => s.n), [20, 18, 11, 8], 'pipeline counts');
assert.deepStrictEqual(p[1].leakIds.sort(), ['APP-009', 'APP-017']);
assert.strictEqual(p.reduce((n, s) => n + s.leakIds.length, 0) + p[3].n, 20, 'every application ends at exactly one step');

const wl = Object.fromEntries(O.worklist(S).map(g => [g.key, g.items]));
assert.strictEqual(wl.chase[0].priority, 'High', 'high-priority territories first');
assert(wl.chase.some(x => x.id === 'APP-009' && /clarification/.test(x.title)), 'APP-009 chased for the contradiction');
assert(wl.contest.some(x => /570001/.test(x.title) && x.msgs[0].id === 'APP-001'), 'contested pin 570001, message goes to APP-001');
assert(wl.contest.some(x => /^TER-02/.test(x.title)), 'TER-02 oversubscribed');
assert(wl.alt.some(x => x.id === 'APP-015' && x.msgs[0].alt === '560100'), 'APP-015 offered 560100');
assert(/560100/.test(O.message(S, wl.alt[0].msgs[0], 'Kannada')), 'alternative-pin message in Kannada');

const h = Object.fromEntries(O.territoryHealth(S).map(t => [t.id, t]));
assert(h['TER-02'].flags.some(f => f.k === 'over') && !h['TER-01'].flags.some(f => f.k === 'over') && h['TER-04'].flags.some(f => f.k === 'under') && h['TER-03'].locked === 2);

const b = O.beforeAfter(S, O.DEFAULT_TIME);
assert.strictEqual(b.follow, 9);
assert(Math.abs(b.manualHours - (20 * 25 + 9 * 15) / 60) < 1e-9 && Math.abs(b.deskHours - (20 * 3 + 9 * 2) / 60) < 1e-9);

// a hold that clears is timed
const ev = O.newTracker(); O.track(S, ev, 0);
const S2 = fresh(); const a = S2.apps.find(x => x.id === 'APP-010'); a.invest = 25; S2.run = E.run(S2.apps, S2.ters, E.STORES, S2.cfg);
O.track(S2, ev, 120000);
const ad = O.adoption(S2, ev);
assert.strictEqual(ad.holds.resolved, 1); assert.strictEqual(ad.holds.medianMin, 2);
assert.deepStrictEqual(ad.slotFill, { filled: 9, slots: 15 });
console.log('  ok   operations view: pipeline, worklist, territory health, before and after, adoption');
