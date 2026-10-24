// Questions for applicants and the weekly summary. Run: node test/report.js
const assert = require('assert');
const E = require('../src/engine.js'), SD = require('../src/sample.js'), R = require('../src/modules/report.js');
const O = require('../src/modules/ops.js'), P = require('../src/modules/plan.js'), W = require('../src/modules/whatif.js');
const S = { apps: E.parseApplications(SD.appsAoA), ters: E.parseTerritories(SD.tersAoA), cfg: E.clone(E.DEFAULT_CFG) };
S.run = E.run(S.apps, S.ters, E.STORES, S.cfg);

const q = R.questions(S), by = Object.fromEntries(q.map(g => [g.id, g]));
assert.strictEqual(q.length, 10);
assert(!by['APP-011'], 'rejected applicants are not chased');
Object.values(S.run.res).filter(r => r.outcome === 'Hold').forEach(r => assert(by[r.id] && by[r.id].items.some(i => i.blocks), r.id + ' has a blocking question'));
assert(/Rs 25 lakh.*Rs 18 lakh/.test(by['APP-010'].items[0].text));
assert(by['APP-014'].items.some(i => /sanction letter/.test(i.text) && !i.blocks));
const rows = R.questionRows(S);
assert.deepStrictEqual(rows[0].slice(0, 2), ['Application ID', 'Applicant']);
assert.strictEqual(rows.slice(1).filter(r => r[5]).length, q.reduce((n, g) => n + g.items.length, 0), 'one row per question');

const now = new Date('2026-10-24'); S.loadedAt = now;
const rep = R.weekly(S, now, { health: O.territoryHealth(S), plans: P.plans(S, now), fragile: W.fragile(S), ba: O.beforeAfter(S, O.DEFAULT_TIME), questions: q.length });
const txt = R.asText(rep);
assert(/20 applications decided: 8 approved, 3 waitlisted, 8 on hold, 1 not taken forward/.test(txt));
assert(/Add a slot in TER-02 Mysuru\? APP-019/.test(txt));
assert(/2 of 8 approved partners are at risk/.test(txt));
assert(/9\.3 hours of screening saved/.test(txt));
console.log('  ok   questions for applicants, weekly summary');
