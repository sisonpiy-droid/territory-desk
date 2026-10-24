// Cannibalisation overlap per applicant and the pipeline planner. Run: node test/planner.js
const assert = require('assert');
const E = require('../src/engine.js'), SD = require('../src/sample.js'), Geo = require('../src/modules/geo.js'), P = require('../src/modules/planner.js');
const S = { apps: E.parseApplications(SD.appsAoA), ters: E.parseTerritories(SD.tersAoA), cfg: E.clone(E.DEFAULT_CFG) };
S.run = E.run(S.apps, S.ters, E.STORES, S.cfg);
const appr = S.apps.filter(a => S.run.res[a.id].outcome === 'Approve').map(a => ({ id: a.id, pin: a.pin }));

// overlap: an applicant on a store's own pin is fully covered; one far from every store is not; unmapped pins say so
assert.strictEqual(Geo.applicantOverlap('570009', appr, null, 'APP-005').level, 'veto');
assert.strictEqual(Geo.applicantOverlap('577001', appr, null, 'APP-014').share, 0);
assert(!Geo.applicantOverlap('590002', appr, null, 'APP-013').ok);
// the tolerance is editable and only changes the level, never the decision
const cfg = Geo.clone(Geo.DEFAULTS); cfg.flagAt = 0.95; cfg.vetoAt = 0.99;
assert.strictEqual(Geo.applicantOverlap('560068', appr, cfg, 'APP-016').level, 'ok');
assert.strictEqual(S.run.res['APP-016'].outcome, 'Approve');

// planner: rate = placed / received; needed = ceil(open / rate); range from the 90% interval
const p = P.plan(S);
assert.strictEqual(p.received, 20); assert.strictEqual(p.placed, 8); assert.strictEqual(p.rate, 0.4);
assert(p.ci[0] < 0.4 && p.ci[1] > 0.4);
const t5 = p.rows.find(r => r.id === 'TER-05');
assert.strictEqual(t5.open, 1); assert.strictEqual(t5.needed, 3); assert.deepStrictEqual(t5.fixable, ['APP-007']);
assert(t5.range[0] <= 3 && t5.range[1] >= 3);
assert.strictEqual(p.rows[0].priority, 'High', 'short, high-priority territories first');
assert.strictEqual(p.rows.find(r => r.id === 'TER-01').needed, 0);
// counting holds as likely to clear reduces the need
const p2 = P.plan(S, Object.assign({}, P.DEFAULTS, { holdClear: 1 }));
assert.strictEqual(p2.rows.find(r => r.id === 'TER-05').needed, 0);
console.log('  ok   catchment overlap per applicant, pipeline planner');
