// Random examiner-style workbooks: every module must cope, and the hard rules must hold on all of them.
// Run: node test/fuzz.js [count]   (deterministic: the same seed gives the same files)
const assert = require('assert');
const E = require('../src/engine.js'), SD = require('../src/sample.js');
const O = require('../src/modules/ops.js'), PL = require('../src/modules/plan.js'), TR = require('../src/modules/triggers.js'), R = require('../src/modules/report.js');
const PN = require('../src/modules/planner.js'), W = require('../src/modules/whatif.js'), G = require('../src/modules/geo.js'), GL = require('../src/modules/golive.js'), PB = require('../src/modules/payback.js');
const LV = require('../src/modules/levers.js');
let OF = null; try { OF = require('../src/modules/offers.js'); } catch (e) { /* added later in the build */ }
const N = +process.argv[2] || 250;
let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = xs => xs[Math.floor(rnd() * xs.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), chance = p => rnd() < p;

const CITIES = Object.keys(E.CITIES), PREFIX = Object.fromEntries(CITIES.map(c => [c, E.CITIES[c].prefix]));
const NOTES = ['', '', '', 'Wants to open before Diwali', 'Already have a ground floor shop, lease signed', 'Will rent once approved', 'Bank loan sanction expected next month', 'Looking for a shop near the market',
  'Shop is 200 sq ft on the first floor', 'Can invest 40 lakh in total', 'Brother will add 10 lakh as co-investor', 'ಅಂಗಡಿ ಇದೆ', 'दुकान मिल गई है', 'student, first business', 'Not yet, searching for space', 'x'.repeat(300), '<b>bold</b> & "quotes"'];
const BIZ = ['Runs a footwear store', 'IT professional', 'Homemaker', 'Garment retail', 'Kirana store', '', 'Optical shop assistant', 'student'];
const SPACE = ['Owned', 'Rented', 'Not yet identified', 'rented ', 'OWNED', '', 'lease', 'none'];
const FLOOR = ['Ground', 'Upper', 'Mall unit', 'Not known', 'first floor', '', 'ground floor'];
const LANG = ['Kannada', 'Hindi', 'English', '', 'kannada ', 'Tamil'];

function dataset(mess) {
  const m = (clean, messy) => chance(mess) ? messy : clean;
  const nT = int(1, 12), ters = [], usedPins = new Set();
  for (let i = 0; i < nT; i++) {
    const city = pick(CITIES), pins = [], n = mess > 0.5 ? int(0, 6) : int(2, 6);
    for (let j = 0; j < n; j++) { const p = chance(0.08) ? pick(E.STORES).pin : chance(0.05) && usedPins.size ? [...usedPins][0] : PREFIX[city] + String(int(1, 999)).padStart(3, '0'); pins.push(p); usedPins.add(p); }
    ters.push(['TER-' + String(i + 1).padStart(2, '0'), city, 'Karnataka', pins.join(pick([', ', ';', ' ', ','])), pick(['Tier 1', 'Tier 2', 'Tier 3', '', 'tier 2']), m(pick([1, 2, 3]), pick([0, 1, 1, 2, 3, '2 slots', '', 5])), m(pick(['High', 'Medium', 'Low']), pick(['High', 'Medium', 'Low', '', 'urgent']))]);
  }
  const allPins = ters.flatMap(t => String(t[3]).match(/\d{6}/g) || []);
  const nA = mess > 0.5 ? int(0, 60) : int(8, 60), apps = [];
  for (let i = 0; i < nA; i++) {
    const pinT = allPins.length ? pick(allPins) : null, terOf = pinT ? ters.find(t => String(t[3]).includes(pinT)) : null;
    const city = terOf && !chance(mess * 0.2) ? terOf[1] : chance(mess * 0.2) ? pick(['Hosapete', 'Chennai', '', 'bangalore', ' Mysore ']) : pick(CITIES);
    const pin = chance(mess * 0.2) ? pick(['', 'abc', '12345', '5600011', 570001.0, '570 002', null]) : pinT && chance(1 - mess * 0.3) ? pinT : (PREFIX[city] || '560') + String(int(1, 999)).padStart(3, '0');
    apps.push([chance(0.04) ? 'APP-' + int(1, 5) : 'APP-' + String(i + 1).padStart(3, '0'), chance(0.9) ? 'Applicant ' + int(1, 30) : '', city, m('Karnataka', pick(['Karnataka', 'KA', '', 'Tamil Nadu'])), pin,
      m(int(22, 60), pick([int(5, 90), '25 lakh', '₹30L', '', 0, -5, 'abc', 2500000, '1 crore'])), m(int(0, 8), pick([int(0, 12), 0, '', '4 yrs', -1, 99])), m(pick(BIZ.slice(0, 4)), pick(BIZ)), m(pick(['Owned', 'Rented']), pick(SPACE)),
      m(int(260, 600), pick([int(100, 800), '', 'n/a', 0, '450 sq ft'])), m(pick(['Ground', 'Mall unit']), pick(FLOOR)), m(int(2, 9), pick([int(1, 12), '', 0, '3 months', 100])), m(pick(['Kannada', 'Hindi', 'English']), pick(LANG)), m('', pick(NOTES))]);
  }
  const H = SD.appsAoA[1], HT = SD.tersAoA[1];
  return { apps: E.parseApplications([['title'], H].concat(apps)), ters: E.parseTerritories([['title'], HT].concat(ters)) };
}

let ran = 0, approvals = 0, held = 0;
for (let k = 0; k < N; k++) {
  const d = dataset(k % 2 ? 1 : 0.12);
  if (!d.apps.length) continue;
  const where = 'dataset ' + k;
  const cfg = E.clone(E.DEFAULT_CFG), S = { apps: d.apps, ters: d.ters, cfg };
  S.run = E.run(S.apps, S.ters, E.STORES, S.cfg);
  // hard rules
  const pins = {};
  Object.values(S.run.res).forEach(r => {
    assert(['Approve', 'Waitlist', 'Hold', 'Reject'].includes(r.outcome), where + ' outcome ' + r.id);
    if (r.outcome === 'Approve') {
      const a = S.apps.find(x => x.id === r.id); approvals++;
      assert(!pins[a.pin], where + ' two approvals on pin ' + a.pin); pins[a.pin] = 1;
      assert(!E.STORES.some(s => s.pin === a.pin), where + ' approval on a store pin');
    } else if (r.outcome === 'Hold') held++;
  });
  S.ters.forEach(t => assert((S.run.approvedByTer[t.id] || 0) <= t.slots, where + ' ' + t.id + ' over slots'));
  assert.strictEqual(Object.keys(S.run.res).length, S.apps.filter(a => !a.withdrawn).length, where + ' every application decided');
  // everything built on top must cope with this file
  S.apps.forEach(a => { const r = S.run.res[a.id]; if (!r) return; E.explain(r, a, { cfg: S.cfg, run: S.run }); ['English', 'Hindi', 'Kannada'].forEach(l => assert(typeof E.letter(r, a, l, S.cfg) === 'string')); if (r.outcome === 'Approve') E.onboardingPlan(r, a, { cfg: S.cfg, run: S.run }); });
  S.loadedAt = new Date('2026-10-25'); S.stages = {}; S.gates = {};
  O.pipeline(S); O.worklist(S).forEach(g => g.items.forEach(i => i.msgs.forEach(m => O.message(S, m)))); O.territoryHealth(S); O.beforeAfter(S, O.DEFAULT_TIME); O.adoption(S, O.newTracker());
  PL.plans(S, new Date('2026-10-25')).forEach(p => GL.gates(p.open, {}, new Date('2026-10-25')));
  TR.triggers(S); R.questions(S); R.questionRows(S); R.weekly(S, new Date('2026-10-25'), { health: O.territoryHealth(S), plans: PL.plans(S, new Date('2026-10-25')), questions: 0 });
  const plan = PN.plan(S, PN.DEFAULTS, p => G.pinCrowd(p)); plan.rows.forEach(r => LV.levers(S, r));
  W.confidence(S, {}); if (S.apps.length <= 25) W.scenario(S, W.nudgeAll(S, 1.1));
  S.apps.forEach(a => { const r = S.run.res[a.id]; if (r && r.tier) { const b = PB.band(a, S.cfg.floors[r.tier]); if (b) PB.stress(b.invest, (a.invest || 0) - S.cfg.floors[r.tier]); } if (G.pinInfo(a.pin)) G.applicantOverlap(a.pin, [], G.cfg, a.id); });
  S.ters.forEach(t => t.pins.slice(0, 2).forEach(p => G.recommend(p)));
  if (OF) { S.offerAt = {}; S.signed = {}; OF.sync(S, new Date('2026-10-25')); OF.list(S, new Date('2026-10-26'), OF.DEFAULTS); OF.expire(S, new Date('2027-01-01'), OF.DEFAULTS); }
  ran++;
}
console.log('  ok   ' + ran + ' random workbooks: hard rules held and every module coped (' + approvals + ' approvals, ' + held + ' holds)');
