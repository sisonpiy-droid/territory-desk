// Confidence on every decision, fragile decisions (flip when a threshold moves 10%), and side-by-side scenarios.
// Pure functions of the app state S ({ apps, ters, cfg, run }).
(function (root) {
'use strict';
var E = root.Engine || require('../engine.js');

// Thresholds the brand sets. Each is nudged 10% down and up to find fragile decisions.
var THRESHOLDS = [
  { path: 'floors.Tier 1', label: 'Minimum investment, Tier 1', unit: 'lakh' },
  { path: 'floors.Tier 2', label: 'Minimum investment, Tier 2', unit: 'lakh' },
  { path: 'floors.Tier 3', label: 'Minimum investment, Tier 3', unit: 'lakh' },
  { path: 'rejectRatio', label: 'Reject below share of the floor', unit: '%', pct: true },
  { path: 'minSpace', label: 'Minimum space', unit: 'sq ft' },
  { path: 'idealMin', label: 'Ideal space from', unit: 'sq ft' },
  { path: 'idealMax', label: 'Ideal space up to', unit: 'sq ft' },
  { path: 'earliestWeeks', label: 'Earliest opening', unit: 'weeks' },
  { path: 'cannibNear', label: 'High spacing risk within', unit: 'pin numbers' },
  { path: 'cannibMid', label: 'Medium spacing risk within', unit: 'pin numbers' }
];
var NUDGE = 0.1;
// Display cut-offs for confidence: points clear of the next rival
var CONF = { high: 10, medium: 3 };
var OUTS = ['Approve', 'Waitlist', 'Hold', 'Reject'];

function get(o, path) { return path.split('.').reduce(function (x, k) { return x[k]; }, o); }
function set(o, path, v) { var p = path.split('.'), x = o; for (var i = 0; i < p.length - 1; i++) x = x[p[i]]; x[p[p.length - 1]] = v; }
function fmtVal(t, v) { return t.pct ? Math.round(v * 100) + '%' : (Math.round(v * 10) / 10) + ' ' + t.unit; }
function live(S) { return S.apps.filter(function (a) { return !a.withdrawn && S.run.res[a.id]; }); }
function outcomes(run, apps) { var m = {}; apps.forEach(function (a) { if (!a.withdrawn && run.res[a.id]) m[a.id] = run.res[a.id].outcome; }); return m; }

/* ---------- fragile decisions ---------- */
function fragile(S) {
  var base = outcomes(S.run, S.apps), out = {};
  THRESHOLDS.forEach(function (t) {
    [1 - NUDGE, 1 + NUDGE].forEach(function (f) {
      var cfg = E.clone(S.cfg), from = get(cfg, t.path), to = from * f;
      set(cfg, t.path, to);
      var o2 = outcomes(E.run(S.apps, S.ters, E.STORES, cfg), S.apps);
      Object.keys(base).forEach(function (id) {
        if (o2[id] && o2[id] !== base[id]) (out[id] = out[id] || []).push({ path: t.path, label: t.label, up: f > 1, from: fmtVal(t, from), to: fmtVal(t, to), was: base[id], now: o2[id] });
      });
    });
  });
  return out;
}

/* ---------- confidence ---------- */
function confidence(S, frag) {
  frag = frag || fragile(S);
  var out = {}, down = { high: 'medium', medium: 'low', low: 'low' };
  live(S).forEach(function (a) {
    var r = S.run.res[a.id], level, why = [];
    if (r.override && r.override.applied) { out[a.id] = { level: 'high', why: ['Set by the expansion team (override)'] }; return; }
    if ((r.outcome === 'Approve' || r.outcome === 'Waitlist') && r.margin != null && r.margin >= 0) {
      level = r.margin >= CONF.high ? 'high' : r.margin >= CONF.medium ? 'medium' : 'low';
      var rival = r.outcome === 'Approve' ? r.nextRival : r.winner || (r.beatenBy || []).slice(-1)[0];
      why.push(r.margin + ' points ' + (r.outcome === 'Approve' ? 'clear of' : 'behind') + ' ' + (rival || 'the next rival'));
    } else if (r.outcome === 'Approve' || r.outcome === 'Waitlist') { level = 'high'; why.push('No rival for the pin or the slot'); }
    else { level = 'high'; why.push(r.outcome === 'Hold' ? 'Held on facts in the form, not on a close score' : 'Clear-cut on the rules'); }
    var soft = r.issues.filter(function (i) { return i.level === 'soft'; });
    if (soft.length) { level = down[level]; why.push(soft.length + ' data flag' + (soft.length > 1 ? 's' : '') + ': ' + soft.map(function (i) { return i.title.toLowerCase(); }).join('; ')); }
    if (frag[a.id]) { level = 'low'; var f = frag[a.id][0]; why.push('Flips to ' + f.now + ' if ' + f.label.charAt(0).toLowerCase() + f.label.slice(1) + ' moves from ' + f.from + ' to ' + f.to + (frag[a.id].length > 1 ? ' (and ' + (frag[a.id].length - 1) + ' other change' + (frag[a.id].length > 2 ? 's' : '') + ')' : '')); }
    out[a.id] = { level: level, why: why };
  });
  return out;
}

/* ---------- scenarios ---------- */
// changes: [{ kind: 'cfg', path, value } | { kind: 'slots', ter, value }] (value is the new number; rejectRatio as a fraction)
function scenario(S, changes) {
  var cfg = E.clone(S.cfg), ters = E.clone(S.ters), apps = E.clone(S.apps);
  changes.forEach(function (c) {
    if (c.kind === 'cfg') set(cfg, c.path, c.value);
    else if (c.kind === 'slots') ters.forEach(function (t) { if (t.id === c.ter) t.slots = Math.max(0, c.value); });
  });
  var run2 = E.run(apps, ters, E.STORES, cfg), b = outcomes(S.run, S.apps), a2 = outcomes(run2, apps);
  var count = function (m) { var c = { Approve: 0, Waitlist: 0, Hold: 0, Reject: 0 }; Object.keys(m).forEach(function (k) { c[m[k]]++; }); return c; };
  var changed = Object.keys(b).filter(function (id) { return a2[id] !== b[id]; }).map(function (id) {
    var a = S.apps.filter(function (x) { return x.id === id; })[0];
    return { id: id, name: a.name, from: b[id], to: a2[id] };
  }).sort(function (p, q) { return OUTS.indexOf(p.to) - OUTS.indexOf(q.to) || (p.id < q.id ? -1 : 1); });
  return { before: count(b), after: count(a2), changed: changed, cfg: cfg, ters: ters };
}
function nudgeAll(S, f) { return THRESHOLDS.filter(function (t) { return t.path !== 'idealMax' && t.path !== 'earliestWeeks'; }).map(function (t) { return { kind: 'cfg', path: t.path, value: get(S.cfg, t.path) * f }; }); }

var api = { THRESHOLDS: THRESHOLDS, NUDGE: NUDGE, CONF: CONF, fragile: fragile, confidence: confidence, scenario: scenario, nudgeAll: nudgeAll, get: get };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.DeskWhatIf = api;
})(typeof window !== 'undefined' ? window : globalThis);
