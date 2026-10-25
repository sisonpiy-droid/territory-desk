// Cannibalisation limit (flag and suggestion only; decisions are not changed).
// For each applicant: the share of the crowd within the catchment of their pin that existing stores and partners approved
// this session already reach. Uses the Site finder's data and settings (src/modules/geo.js, Geo.cfg).
(function () {
'use strict';
var D = window.__desk, S = D.S, esc = D.esc, Geo = window.DeskGeo;
if (!Geo || !Geo.data) return;
var cache = { key: null, m: {} };

function approved() { return S.apps.filter(function (a) { return !a.withdrawn && S.run.res[a.id] && S.run.res[a.id].outcome === 'Approve'; }).map(function (a) { return { id: a.id, pin: a.pin }; }); }
function get(a) {
  var key = JSON.stringify(Geo.cfg) + '|' + approved().map(function (x) { return x.id + x.pin; }).join(',');
  if (cache.key !== key || cache.run !== S.run) { cache = { key: key, run: S.run, m: {} }; }
  if (!(a.id in cache.m)) cache.m[a.id] = Geo.applicantOverlap(a.pin, approved(), Geo.cfg, a.id);
  return cache.m[a.id];
}
function pct(x) { return Math.round(100 * x) + '%'; }

window.DeskExt.rowBadges.push(function (a, r) {
  if (r.outcome !== 'Approve' && r.outcome !== 'Waitlist') return '';   // only where a store would actually open
  var o = get(a); if (!o.ok || o.level === 'ok') return '';
  return '<span class="ovl ' + o.level + '" title="' + esc(pct(o.share) + ' of the crowd within ' + o.radius + ' km is already within reach of another store') + '">Overlap ' + pct(o.share) + '</span>';
});

window.DeskExt.afterDetail.unshift(function (a, r) {
  var o = get(a), h = '<h4>Catchment overlap</h4>';
  if (!o.ok) return h + '<p class="muted sm">Pin ' + esc(a.pin) + ' is not in the built-in map data. <button class="link" data-act="geo-open" data-v="' + esc(a.pin) + '">Look it up in the Site finder</button>.</p>';
  var who = o.near.slice(0, 4).map(function (n) { return n.id + (n.kind === 'approved' ? ' (approved)' : '') + ' ' + n.km.toFixed(1) + ' km'; }).join(', ');
  var lvl = o.level === 'veto' ? '<p class="ovl-v">Above the ' + pct(Geo.cfg.vetoAt) + ' limit. <b>Suggested outcome: hold</b> until the partner finds a site with less overlap' + (o.bestInPin != null && o.bestInPin < Geo.cfg.vetoAt ? ' (the least-overlapping hexagon in this pin is at ' + pct(o.bestInPin) + ')' : '') + '. This is a suggestion only; the decision above is unchanged.</p>'
    : o.level === 'flag' ? '<p class="ovl-f">Above the ' + pct(Geo.cfg.flagAt) + ' flag: check the exact site before signing. Decision unchanged.</p>'
    : '<p class="muted sm">Below the ' + pct(Geo.cfg.flagAt) + ' flag.</p>';
  return h + '<p>About <b>' + pct(o.share) + '</b> of the estimated crowd within ' + o.radius + ' km of pin ' + esc(a.pin) + ' is already within reach of ' + (who ? esc(who) : 'no store') + '.</p>' + lvl +
    '<p class="muted sm">Measured from the pin centre (no street address in the form). Radius and limits are placeholders, editable in Site finder, Assumptions.</p>';
});

window.DeskExt.exportSheets.push(function () {
  return { name: 'Catchment overlap', rows: [['Application ID', 'Applicant', 'Pin', 'Decision', 'Overlap', 'Level', 'Within reach of']].concat(S.apps.filter(function (a) { return !a.withdrawn && S.run.res[a.id]; }).map(function (a) {
    var o = get(a); return [a.id, a.name, a.pin, S.run.res[a.id].outcome, o.ok ? pct(o.share) : 'not mapped', o.ok ? { ok: 'below flag', flag: 'flag', veto: 'suggest hold' }[o.level] : '', o.ok ? o.near.map(function (n) { return n.id + ' ' + n.km.toFixed(1) + ' km'; }).join(', ') : ''];
  })) };
});

var css = document.createElement('style');
css.textContent = '.ovl { font-size: 12px; font-weight: 600; white-space: nowrap; } .ovl.flag { color: var(--hold); } .ovl.veto { color: var(--no); }' +
  ' .ovl-v, .ovl-f { padding: 6px 10px; border-radius: 8px; font-size: 14px; } .ovl-v { background: color-mix(in srgb, var(--no) 8%, var(--surface)); border: 1px solid color-mix(in srgb, var(--no) 30%, transparent); } .ovl-f { background: color-mix(in srgb, var(--hold) 8%, var(--surface)); border: 1px solid color-mix(in srgb, var(--hold) 30%, transparent); }';
document.head.appendChild(css);
})();
