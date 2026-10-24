// Overrides, backward plans and re-run triggers. Run: node test/phase2.js
const assert = require('assert');
const E = require('../src/engine.js'), SD = require('../src/sample.js'), P = require('../src/modules/plan.js'), T = require('../src/modules/triggers.js');
const fresh = f => { const S = { apps: E.parseApplications(SD.appsAoA), ters: E.parseTerritories(SD.tersAoA), cfg: E.clone(E.DEFAULT_CFG) }; if (f) f(S.apps); S.run = E.run(S.apps, S.ters, E.STORES, S.cfg); return S; };
const ov = (apps, id, to, at) => { apps.find(a => a.id === id).override = { to, reason: 'test', at: at || 1 }; };
let n = 0; const t = (name, fn) => { fn(); n++; };

t('approval override takes the pin; the displaced applicant is waitlisted', () => {
  const S = fresh(a => ov(a, 'APP-001', 'Approve'));
  assert.strictEqual(S.run.res['APP-001'].outcome, 'Approve'); assert.strictEqual(S.run.res['APP-002'].outcome, 'Waitlist');
  assert(/override/.test(E.explain(S.run.res['APP-002'], S.apps.find(a => a.id === 'APP-002'), { cfg: S.cfg, run: S.run }).lines[0]));
});
t('approval override on a pin with a store is refused', () => {
  const S = fresh(a => ov(a, 'APP-005', 'Approve'));
  assert.strictEqual(S.run.res['APP-005'].outcome, 'Hold'); assert(/never opens two stores/.test(S.run.res['APP-005'].override.refused));
});
t('a second approval override on the same pin is refused', () => {
  const S = fresh(a => { ov(a, 'APP-001', 'Approve', 1); ov(a, 'APP-002', 'Approve', 2); });
  assert.strictEqual(S.run.res['APP-001'].outcome, 'Approve'); assert.strictEqual(S.run.res['APP-002'].override.applied, false);
});
t('override never breaks one store per pin or territory slots', () => {
  const S = fresh(a => { ['APP-001', 'APP-002', 'APP-005', 'APP-019', 'APP-009', 'APP-015', 'APP-007'].forEach((id, i) => ov(a, id, 'Approve', i)); });
  const pins = {}; Object.values(S.run.res).filter(r => r.outcome === 'Approve').forEach(r => { const a = S.apps.find(x => x.id === r.id); assert(!pins[a.pin], 'dup ' + a.pin); assert(!E.STORES.some(s => s.pin === a.pin)); pins[a.pin] = 1; });
  S.ters.forEach(tr => assert((S.run.approvedByTer[tr.id] || 0) <= tr.slots, tr.id));
});
t('hold override on an approved applicant frees its pin for the runner-up', () => {
  const S = fresh(a => ov(a, 'APP-002', 'Hold'));
  assert.strictEqual(S.run.res['APP-002'].outcome, 'Hold'); assert.strictEqual(S.run.res['APP-001'].outcome, 'Approve');
  assert(/a short call/.test(E.letter(S.run.res['APP-002'], S.apps.find(a => a.id === 'APP-002'), 'English', S.cfg)));
});
t('backward plan: sign 9 weeks before opening, tight target flagged at risk', () => {
  const S = fresh(), today = new Date('2026-10-24T00:00:00'); S.loadedAt = today;
  const p = P.plans(S, today), p2 = p.find(x => x.id === 'APP-002'), p4 = p.find(x => x.id === 'APP-004');
  assert(p2.atRisk && /cannot be met/.test(p2.risks[0]), 'APP-002 wants 2 months, needs 10 weeks');
  assert.strictEqual((p4.open - p4.latestSign) / 86400000, 63);
  assert(!p4.atRisk); assert.deepStrictEqual(p4.steps.map(s => s.owner).filter((v, i, a) => a.indexOf(v) === i).sort(), P.OWNERS.slice().sort());
  const overdue = P.plan(S.apps.find(a => a.id === 'APP-004'), S.run.res['APP-004'], S.cfg, today, 0, new Date(p4.latestSign.getTime() + 20 * 86400000));
  assert(overdue.atRisk && overdue.steps.some(s => s.overdue));
});
t('every held or waitlisted application has a re-run trigger', () => {
  const S = fresh(), tr = T.triggers(S);
  Object.values(S.run.res).filter(r => r.outcome === 'Hold' || r.outcome === 'Waitlist').forEach(r => assert(tr[r.id] && tr[r.id].events.length, r.id));
  assert(/APP-002 withdraws/.test(tr['APP-001'].events[0])); assert(/slot is added in TER-02/.test(tr['APP-019'].events[0]));
});
console.log('  ok   overrides, backward plans, re-run triggers (' + n + ' checks)');
