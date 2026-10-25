// Conditional offers: every approval is an offer with a deadline. When an offer is not signed in time (or is declined),
// the pin and slot are released and the next waitlisted applicant is promoted automatically, with a fresh deadline.
// No drop-off rate is needed: nothing is offered twice, so the one-store-per-pin rule always holds.
// State on S: S.offerAt { id: ISO date the offer was made }, S.signed { id: true }. Offers are derived from the decisions,
// so Undo and every what-if keep them consistent.
(function (root) {
'use strict';
var E = root.Engine || (typeof require !== 'undefined' ? require('../engine.js') : null);
var DAY = 86400000;
var DEFAULTS = { validDays: 7 };   // assumption: check against the median days from approval to signing in the brand's last approvals

function approvedIds(S) { return S.apps.filter(function (a) { return !a.withdrawn && S.run.res[a.id] && S.run.res[a.id].outcome === 'Approve'; }).map(function (a) { return a.id; }); }

// Called after every recompute: new approvals get an offer dated now; anything no longer approved loses its offer.
function sync(S, now) {
  S.offerAt = S.offerAt || {}; S.signed = S.signed || {};
  var ap = {}; approvedIds(S).forEach(function (id) { ap[id] = 1; if (!S.offerAt[id]) S.offerAt[id] = new Date(now).toISOString(); });
  Object.keys(S.offerAt).forEach(function (id) { if (!ap[id]) { delete S.offerAt[id]; delete S.signed[id]; } });
}

// who would be promoted if these offers lapsed: a what-if run on a copy, never touching the live decisions
function promotedIf(S, ids) {
  var gone = {}; ids.forEach(function (id) { gone[id] = 1; });
  var apps = S.apps.map(function (a) { if (!gone[a.id]) return a; var b = JSON.parse(JSON.stringify(a)); b.withdrawn = true; return b; });
  var r2 = E.run(apps, S.ters, E.STORES, S.cfg), out = [];
  apps.forEach(function (a) {
    if (a.withdrawn || gone[a.id] || !r2.res[a.id] || r2.res[a.id].outcome !== 'Approve') return;
    var was = S.run.res[a.id]; if (was && was.outcome === 'Approve') return;
    out.push({ id: a.id, name: a.name, pin: a.pin, ter: r2.res[a.id].ter ? r2.res[a.id].ter.id : '' });
  });
  return out;
}

function list(S, now, cfg) {
  cfg = cfg || DEFAULTS;
  var t = new Date(now).getTime();
  var rows = approvedIds(S).map(function (id) {
    var a = S.apps.filter(function (x) { return x.id === id; })[0], r = S.run.res[id];
    var at = new Date(S.offerAt && S.offerAt[id] ? S.offerAt[id] : now), dl = new Date(at.getTime() + cfg.validDays * DAY);
    var left = Math.ceil((dl.getTime() - t) / DAY), signed = !!(S.signed && S.signed[id]);
    return { id: id, name: a.name, pin: a.pin, ter: r.ter ? r.ter.id : '', lang: a.lang || 'English', offeredAt: at, deadline: dl, daysLeft: left,
             status: signed ? 'Signed' : t > dl.getTime() ? 'Expired' : left <= 2 ? 'Due soon' : 'Open', signed: signed,
             next: signed ? [] : promotedIf(S, [id]) };
  });
  var rank = { Expired: 0, 'Due soon': 1, Open: 2, Signed: 3 };
  return rows.sort(function (p, q) { return rank[p.status] - rank[q.status] || p.deadline - q.deadline || (p.id < q.id ? -1 : 1); });
}

// all expired, unsigned offers at once, and who is promoted because of them
function expire(S, now, cfg) {
  var ex = list(S, now, cfg).filter(function (o) { return o.status === 'Expired'; }).map(function (o) { return o.id; });
  return { lapsed: ex, promoted: ex.length ? promotedIf(S, ex) : [] };
}

var SENT = {
  en: ' Please confirm and sign by {date}; after that the place goes to the next applicant.',
  hi: ' कृपया {date} तक पुष्टि करें और हस्ताक्षर करें; उसके बाद यह स्थान अगले आवेदक को दे दिया जाएगा।',
  kn: ' ದಯವಿಟ್ಟು {date} ರೊಳಗೆ ದೃಢೀಕರಿಸಿ ಮತ್ತು ಸಹಿ ಮಾಡಿ; ಅದರ ನಂತರ ಈ ಸ್ಥಾನ ಮುಂದಿನ ಅರ್ಜಿದಾರರಿಗೆ ಹೋಗುತ್ತದೆ.'
};
function fmt(d) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
// the approval letter, in the applicant's language, with the deadline
function message(S, id, deadline, lang) {
  var a = S.apps.filter(function (x) { return x.id === id; })[0], r = S.run.res[id];
  lang = lang || a.lang || 'English';
  return E.letter(r, a, lang, S.cfg) + fill(SENT[E.LANGKEY[lang] || 'en'], { date: fmt(deadline) });
}
function fill(s, m) { return s.replace(/\{(\w+)\}/g, function (_, k) { return m[k]; }); }

var api = { DEFAULTS: DEFAULTS, sync: sync, list: list, promotedIf: promotedIf, expire: expire, message: message, fmt: fmt };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.DeskOffers = api;
})(typeof window !== 'undefined' ? window : globalThis);
