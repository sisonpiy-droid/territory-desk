// Pipeline planner: from the uploaded file only, how many more applicants each territory needs to fill its open slots.
// Placement rate = placed / received. Every setting below is an editable assumption.
(function (root) {
'use strict';
var DEFAULTS = {
  ownRateFrom: 8,       // a territory uses its own placement rate once it has at least this many applications; otherwise the overall rate
  holdClear: 0,         // share of fixable holds expected to clear and take a slot (0 = count none; no data in the file to set it)
  weeks: 8              // weeks to recruit in, for a weekly target
};
var PR = { High: 0, Medium: 1, Low: 2 };

// Wilson 90% interval for a proportion: honest about small samples
function interval(k, n) {
  if (!n) return [0, 1];
  var z = 1.645, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
function need(open, rate) { return open <= 0 ? 0 : rate > 0 ? Math.ceil(open / rate) : null; }

function plan(S, cfg, crowdAt) {
  cfg = cfg || DEFAULTS;
  var res = S.run.res, received = S.apps.length;
  var placed = S.apps.filter(function (a) { return !a.withdrawn && res[a.id] && res[a.id].outcome === 'Approve'; }).length;
  var rate = received ? placed / received : 0, ci = interval(placed, received);
  var rows = S.ters.map(function (t) {
    var inT = S.apps.filter(function (a) { return t.pins.indexOf(a.pin) >= 0; });
    var rT = inT.filter(function (a) { return !a.withdrawn && res[a.id] && res[a.id].outcome === 'Approve'; }).length;
    var filled = Math.min(t.slots, S.run.approvedByTer[t.id] || 0), open = t.slots - filled;
    var fixable = inT.filter(function (a) { var r = res[a.id]; return r && r.outcome === 'Hold' && r.ifFixed && r.ifFixed.possible && r.ifFixed.outcome === 'Approve'; });
    var fromHolds = Math.min(open, Math.floor(fixable.length * cfg.holdClear));
    var own = inT.length >= cfg.ownRateFrom, r = own ? rT / inT.length : rate, ciT = own ? interval(rT, inT.length) : ci;
    var gap = open - fromHolds, n = need(gap, r);
    var pins = t.pins.filter(function (p) { return !S.run.ctx.storeByPin[p] && !S.run.approvedPins[p]; })
      .map(function (p) { return { pin: p, crowd: crowdAt ? crowdAt(p) : null }; })
      .sort(function (x, y) { return (y.crowd == null ? -1 : y.crowd) - (x.crowd == null ? -1 : x.crowd) || (x.pin < y.pin ? -1 : 1); });
    return { id: t.id, city: t.city, priority: t.priority, slots: t.slots, filled: filled, open: open, received: inT.length, placed: rT,
             rate: r, ownRate: own, range: gap > 0 ? [need(gap, ciT[1]), need(gap, ciT[0])] : [0, 0], fixable: fixable.map(function (a) { return a.id; }), fromHolds: fromHolds,
             gap: gap, needed: n, perWeek: n == null ? null : Math.ceil(n / Math.max(1, cfg.weeks)), pins: pins };
  }).sort(function (x, y) { return (y.gap > 0) - (x.gap > 0) || PR[x.priority] - PR[y.priority] || (y.needed || 0) - (x.needed || 0) || (x.id < y.id ? -1 : 1); });
  var tot = { open: 0, needed: 0, unknown: false };
  rows.forEach(function (x) { tot.open += x.open; if (x.needed == null && x.gap > 0) tot.unknown = true; else tot.needed += x.needed || 0; });
  return { received: received, placed: placed, rate: rate, ci: ci, rows: rows, total: tot, cfg: cfg };
}

var api = { DEFAULTS: DEFAULTS, plan: plan, interval: interval };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.DeskPlanner = api;
})(typeof window !== 'undefined' ? window : globalThis);
