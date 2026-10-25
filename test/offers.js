// Offers: deadlines, expiry, automatic promotion of the next waitlisted applicant. Run: node test/offers.js
const assert = require('assert');
const E = require('../src/engine.js'), SD = require('../src/sample.js'), OF = require('../src/modules/offers.js');
const mk = () => { const S = { apps: E.parseApplications(SD.appsAoA), ters: E.parseTerritories(SD.tersAoA), cfg: E.clone(E.DEFAULT_CFG) }; S.run = E.run(S.apps, S.ters, E.STORES, S.cfg); return S; };
const day = 86400000, t0 = new Date('2026-10-25T00:00:00Z');
let S = mk(); OF.sync(S, t0);

assert.strictEqual(Object.keys(S.offerAt).length, 8, 'one offer per approval');
let L = OF.list(S, t0, OF.DEFAULTS);
assert(L.every(o => o.status === 'Open' && o.daysLeft === 7), 'a fresh offer has the full window');
assert.deepStrictEqual(L.find(o => o.id === 'APP-002').next.map(p => p.id), ['APP-001'], 'APP-002 lapsing promotes APP-001 onto the same pin');
assert.deepStrictEqual(L.find(o => o.id === 'APP-020').next.map(p => p.id), ['APP-019'], 'APP-020 lapsing promotes APP-019 into the slot');
assert.deepStrictEqual(L.find(o => o.id === 'APP-004').next, [], 'nobody is waiting behind APP-004');

// the clock moves: one day left, then expired
assert.strictEqual(OF.list(S, new Date(t0.getTime() + 6 * day), OF.DEFAULTS)[0].status, 'Due soon');
const late = new Date(t0.getTime() + 8 * day);
assert(OF.list(S, late, OF.DEFAULTS).every(o => o.status === 'Expired'));
S.signed['APP-002'] = true;
const ex = OF.expire(S, late, OF.DEFAULTS);
assert(!ex.lapsed.includes('APP-002'), 'a signed offer never lapses');
assert.strictEqual(ex.lapsed.length, 7);
assert(ex.promoted.map(p => p.id).includes('APP-019'), 'the waitlisted applicant is promoted');
assert(!ex.promoted.map(p => p.id).includes('APP-001'), 'APP-002 signed, so APP-001 stays waitlisted');

// apply the lapse the way the page does: withdrawn, recompute, sync. Promoted applicants get new offers dated now.
ex.lapsed.forEach(id => { const a = S.apps.find(x => x.id === id); a.withdrawn = true; });
S.run = E.run(S.apps, S.ters, E.STORES, S.cfg); OF.sync(S, late);
assert.strictEqual(S.run.res['APP-019'].outcome, 'Approve');
assert.strictEqual(S.offerAt['APP-019'], late.toISOString(), 'the promoted applicant starts a fresh window');
assert(!S.offerAt['APP-003'], 'lapsed offers are gone');
// hard rule still holds after every promotion
const pins = {}; Object.values(S.run.res).filter(r => r.outcome === 'Approve').forEach(r => { const a = S.apps.find(x => x.id === r.id); assert(!pins[a.pin]); pins[a.pin] = 1; });
// messages carry the deadline in all three languages
['English', 'Hindi', 'Kannada'].forEach(l => assert(/\S/.test(OF.message(S, 'APP-019', new Date(late.getTime() + 7 * day), l))));
assert(/by 8 Nov|8 Nov/.test(OF.message(S, 'APP-019', new Date('2026-11-08T00:00:00Z'), 'English')));
// offers follow the decisions: a what-if that removes an approval removes its offer
S = mk(); OF.sync(S, t0); S.apps.find(a => a.id === 'APP-003').invest = 5; S.run = E.run(S.apps, S.ters, E.STORES, S.cfg); OF.sync(S, t0);
assert(!S.offerAt['APP-003']);
console.log('  ok   offers: deadlines, expiry, automatic promotion, fresh windows, messages');

// territory levers: qualitative, named owner, no rupee figures unless the team types its own numbers
const LV = require('../src/modules/levers.js'), PN = require('../src/modules/planner.js'), PB = require('../src/modules/payback.js');
{
  const S2 = mk(), plan = PN.plan(S2, PN.DEFAULTS), row = id => plan.rows.find(r => r.id === id);
  const l05 = LV.levers(S2, row('TER-05')); assert(l05.some(l => l.key === 'holds' && /APP-007/.test(l.why)), 'TER-05: APP-007 is one fix away');
  const l04 = LV.levers(S2, row('TER-04')); assert(l04.some(l => l.key === 'outreach') && l04.some(l => l.key === 'referrals'), 'TER-04 has no applicants: outreach and referrals');
  assert(LV.levers(S2, row('TER-08')).some(l => l.key === 'support'), 'Tumakuru has no store: launch support');
  assert(LV.levers(S2, row('TER-02')).some(l => l.key === 'capacity' && /APP-019/.test(l.why)), 'TER-02 is full with APP-019 waiting');
  assert.strictEqual(LV.levers(S2, row('TER-09')).length, 0, 'a balanced territory needs no lever');
  assert(LV.levers(S2, row('TER-04'), { outreach: 'Priya' }).find(l => l.key === 'outreach').owner === 'Priya', 'owners are editable');
  l04.concat(l05).forEach(l => assert(!/\bRs\b|₹|\d+ lakh/.test(l.why), 'no money in a lever: ' + l.why));
  assert.strictEqual(LV.breakEven('', ''), null, 'no break-even until both numbers are typed');
  assert.strictEqual(LV.breakEven(6, 2), 3);
}
// bad six months: covers its costs at the calibrated numbers, drains when costs are high
{
  const t = PB.stress(30, 15); assert.strictEqual(t.breakEvenPct, 33); assert(t.rows.every(r => r.monthly > 0 && r.runway === null));
  const t2 = PB.stress(30, 15, Object.assign({}, PB.DEFAULTS, { running: 4 })); assert(t2.rows.every(r => r.monthly < 0 && r.runway > 0));
  assert.strictEqual(PB.stress(30, 0, Object.assign({}, PB.DEFAULTS, { running: 4 })).rows[0].runway, 0, 'no spare capital means no runway');
}
console.log('  ok   territory levers (owners, no money) and the bad-six-months test');
