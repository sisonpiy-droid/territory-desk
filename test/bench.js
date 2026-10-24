// How decision time grows with the number of applications. Run: node test/bench.js
// Numbers feed docs/slide8-cost-and-scale.md. Machine-dependent: rerun before quoting.
const E = require('../src/engine.js'), W = require('../src/modules/whatif.js'), O = require('../src/modules/ops.js');
const fs = require('fs'), path = require('path'), zlib = require('zlib');
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = xs => xs[Math.floor(rnd() * xs.length)];
const cities = [['Bengaluru', '560', 30, 'Tier 1'], ['Mysuru', '570', 25, 'Tier 2'], ['Mangaluru', '575', 25, 'Tier 2'], ['Hubballi-Dharwad', '580', 25, 'Tier 2'], ['Belagavi', '590', 25, 'Tier 2'], ['Tumakuru', '572', 20, 'Tier 3'], ['Davanagere', '577', 20, 'Tier 3']];
function make(n) {
  const T = [['Territory ID', 'City', 'State', 'Pin codes covered', 'City tier', 'Open slots', 'Priority']], A = [['Application ID', 'Applicant name', 'City', 'State', 'Pin code', 'Investment capacity', 'Retail experience', 'Current / past business', 'Space available', 'Space size', 'Floor', 'Target launch', 'Preferred language', 'Notes']];
  const nt = Math.max(9, Math.round(n / 12));
  for (let i = 0; i < nt; i++) { const c = cities[i % 7], pins = []; for (let j = 0; j < 6; j++) pins.push(c[1] + String(100 + (i * 6 + j) % 899).padStart(3, '0')); T.push(['TER-' + (i + 1), c[0], 'Karnataka', pins.join(','), c[3], 1 + (i % 3), pick(['High', 'Medium', 'Low'])]); }
  for (let k = 1; k <= n; k++) { const t = T[1 + Math.floor(rnd() * nt)], c = cities.find(x => x[0] === t[1]), sp = pick(['Owned', 'Rented', 'Rented', 'Not yet identified']);
    A.push(['APP-' + k, 'Applicant ' + k, t[1], 'Karnataka', pick(t[3].split(',')), Math.round(c[2] * (0.6 + rnd() * 0.9)), Math.floor(rnd() * 9), pick(['Mobile shop', 'IT professional', 'Kirana store']), sp, sp === 'Not yet identified' ? '' : 200 + Math.floor(rnd() * 400), sp === 'Not yet identified' ? 'Not known' : pick(['Ground', 'Mall unit', 'Upper']), 1 + Math.floor(rnd() * 8), pick(['Kannada', 'English', 'Hindi']), '']); }
  return { apps: E.parseApplications(A), ters: E.parseTerritories(T) };
}
const time = fn => { const t = process.hrtime.bigint(); fn(); return Number(process.hrtime.bigint() - t) / 1e6; };
console.log('applications | territories | decide (ms) | fragility check, 20 re-runs (ms) | worklist and health (ms)');
[20, 100, 500, 1000, 2000].forEach(n => {
  const d = make(n), S = { apps: d.apps, ters: d.ters, cfg: E.clone(E.DEFAULT_CFG) };
  const t1 = time(() => { S.run = E.run(S.apps, S.ters, E.STORES, S.cfg); });
  const t2 = n <= 1000 ? time(() => W.fragile(S)) : NaN;
  const t3 = time(() => { O.worklist(S); O.territoryHealth(S); O.beforeAfter(S, O.DEFAULT_TIME); });
  console.log([n, d.ters.length, Math.round(t1), isNaN(t2) ? 'skipped' : Math.round(t2), Math.round(t3)].join(' | '));
});
const sz = f => { const b = fs.readFileSync(path.join(__dirname, '..', 'dist', f)); return Math.round(b.length / 1024) + ' KB (' + Math.round(zlib.gzipSync(b).length / 1024) + ' KB gzipped)'; };
console.log('page: index.html ' + sz('index.html') + ', xlsx.full.min.js ' + sz('xlsx.full.min.js'));
