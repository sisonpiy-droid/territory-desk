// Go-live gate: the checks an approved partner must pass before the store can be marked open.
// Each gate has an owner and a due date counted back from the planned opening (src/modules/plan.js).
// State: S.gates[appId][gateKey] = true when green.
(function (root) {
'use strict';
var DAY = 86400000;
// days before opening each gate is due (assumptions, editable here only; based on the 10-week onboarding path)
var GATES = [
  { key: 'shop', short: 'Shop licence', title: 'Shop and establishment licence in hand', owner: 'Partner', before: 28 },
  { key: 'gst', short: 'GST', title: 'GST registration done', owner: 'Partner', before: 28 },
  { key: 'fitout', short: 'Fit-out', title: 'Fit-out signed off', owner: 'Fit-out vendor', before: 21 },
  { key: 'training', short: 'Training', title: 'Training completed and certified', owner: 'Training team', before: 14 },
  { key: 'stock', short: 'Opening stock', title: 'Opening stock delivered', owner: 'Expansion team', before: 10 },
  { key: 'signage', short: 'Signage', title: 'Signage installed', owner: 'Fit-out vendor', before: 7 },
  { key: 'pos', short: 'POS dry run', title: 'POS dry run passed', owner: 'Training team', before: 5 }
];

function gates(planned, done, now) {
  done = done || {};
  var t = new Date(now || Date.now()); t.setHours(0, 0, 0, 0);
  var list = GATES.map(function (g) {
    var due = new Date(planned.getTime() - g.before * DAY);
    return { key: g.key, title: g.title, owner: g.owner, due: due, done: !!done[g.key], overdue: !done[g.key] && due < t };
  });
  var n = list.filter(function (g) { return g.done; }).length;
  return { list: list, done: n, total: list.length, readiness: n / list.length, ready: n === list.length,
           overdue: list.filter(function (g) { return g.overdue; }).length,
           next: list.filter(function (g) { return !g.done; }).sort(function (a, b) { return a.due - b.due; })[0] || null };
}

var api = { GATES: GATES, gates: gates };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.DeskGoLive = api;
})(typeof window !== 'undefined' ? window : globalThis);
