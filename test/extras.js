// Confidence, fragile decisions and scenarios. Run: node test/extras.js
const assert = require('assert');
const E = require('../src/engine.js'), SD = require('../src/sample.js'), W = require('../src/modules/whatif.js');
const S = { apps: E.parseApplications(SD.appsAoA), ters: E.parseTerritories(SD.tersAoA), cfg: E.clone(E.DEFAULT_CFG) };
S.run = E.run(S.apps, S.ters, E.STORES, S.cfg);

const frag = W.fragile(S);
assert.deepStrictEqual(Object.keys(frag).sort(), ['APP-001', 'APP-010', 'APP-018', 'APP-019'], 'fragile set');
assert(frag['APP-018'].some(f => f.path === 'floors.Tier 3' && f.now === 'Hold'), 'APP-018 at Rs 21 lakh flips if the Tier 3 floor rises to 22');
assert.deepStrictEqual(S.cfg, E.DEFAULT_CFG, 'fragility check does not touch the live assumptions');

const c = W.confidence(S, frag);
assert.strictEqual(Object.keys(c).length, 20);
assert.strictEqual(c['APP-002'].level, 'high');     // 20.6 points clear
assert.strictEqual(c['APP-008'].level, 'medium');   // 4.2 points clear
assert.strictEqual(c['APP-014'].level, 'medium');   // no rival, but a loan flag
assert.strictEqual(c['APP-018'].level, 'low');      // fragile

const sc = W.scenario(S, [{ kind: 'slots', ter: 'TER-02', value: 2 }]);
assert.deepStrictEqual(sc.changed.map(x => x.id + ':' + x.to), ['APP-019:Approve']);
assert.strictEqual(sc.after.Approve, sc.before.Approve + 1);
assert.strictEqual(S.ters.find(t => t.id === 'TER-02').slots, 1, 'scenario leaves the live data alone');
const strict = W.scenario(S, W.nudgeAll(S, 1.1));
assert(strict.after.Approve < strict.before.Approve);
console.log('  ok   confidence, fragile decisions, scenarios');
