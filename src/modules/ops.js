// Operations view logic: pipeline and leakage, the team's worklist, territory health, before and after, adoption metrics.
// Pure functions of the app state S ({ apps, ters, run, cfg, overrides? }). No DOM here.
(function (root) {
'use strict';
var E = root.Engine || require('../engine.js');

// Issues that mean the form itself is wrong or incomplete (vs. a real gap in the partner's readiness)
var DATA_CODES = ['PIN_BAD', 'PIN_MISMATCH', 'CITY_UNKNOWN', 'INVEST_MISSING', 'SIZE_MISSING', 'NOTES_CONFLICT'];
var PIN_CODES = ['PIN_HAS_STORE', 'PIN_OUTSIDE'];
var PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

// Editable assumptions for the before-and-after panel. Our own estimates, shown and editable on screen.
var DEFAULT_TIME = {
  screenMin: 20,    // manual: read one application, check investment, space and notes
  pinMin: 5,        // manual: cross-check one pin against existing stores, territories and other applicants
  followMin: 15,    // manual: write and send one follow-up to an applicant
  reviewMin: 3,     // with the desk: read a decided application and its reason
  sendMin: 2,       // with the desk: copy a drafted message and send it
  teamHours: 3      // hours a day the expansion team spends on screening
};

function live(S) { return S.apps.filter(function (a) { return !a.withdrawn && S.run.res[a.id]; }); }
function has(r, codes) { return r.issues.some(function (i) { return codes.indexOf(i.code) >= 0; }); }
function tally(list) {
  var m = {}; list.forEach(function (k) { m[k] = (m[k] || 0) + 1; });
  return Object.keys(m).map(function (k) { return { reason: k, n: m[k] }; }).sort(function (a, b) { return b.n - a.n || (a.reason < b.reason ? -1 : 1); });
}

/* ---------- 1. Pipeline and leakage ---------- */
function pipeline(S) {
  var all = S.apps, L = live(S), res = S.run.res;
  var clean = L.filter(function (a) { return !has(res[a.id], DATA_CODES); });
  var eligible = clean.filter(function (a) { var o = res[a.id].outcome; return o === 'Approve' || o === 'Waitlist'; });
  var placed = eligible.filter(function (a) { return res[a.id].outcome === 'Approve'; });
  var ids = function (xs) { return xs.map(function (a) { return a.id; }); };
  var minus = function (from, to) { var k = {}; to.forEach(function (a) { k[a.id] = 1; }); return from.filter(function (a) { return !k[a.id]; }); };

  var gone = all.filter(function (a) { return a.withdrawn; });
  var leak1 = minus(L, clean), leak2 = minus(clean, eligible), leak3 = minus(eligible, placed);
  var r1 = [];
  leak1.forEach(function (a) { res[a.id].issues.forEach(function (i) { if (DATA_CODES.indexOf(i.code) >= 0) r1.push(i.title); }); });
  gone.forEach(function () { r1.push('Withdrawn by applicant'); });
  var r2 = [];
  leak2.forEach(function (a) { res[a.id].issues.forEach(function (i) { if (i.level === 'hold' || i.level === 'reject') r2.push(i.title); }); });
  var r3 = leak3.map(function (a) { return res[a.id].waitReason === 'pin_lost' ? 'Lost the pin to a higher score' : 'Territory slots already taken'; });

  return [
    { key: 'received', label: 'Received', n: all.length, ids: ids(all), leakIds: [], reasons: [] },
    { key: 'clean', label: 'Data clean', n: clean.length, ids: ids(clean), leakIds: ids(gone.concat(leak1)), reasons: tally(r1) },
    { key: 'eligible', label: 'Eligible', n: eligible.length, ids: ids(eligible), leakIds: ids(leak2), reasons: tally(r2) },
    { key: 'placed', label: 'Placed', n: placed.length, ids: ids(placed), leakIds: ids(leak3), reasons: tally(r3) }
  ];
}

/* ---------- 2. The expansion team's worklist ---------- */
function prioOf(S, a, r) {
  var t = r.ter || (r.alternatives && r.alternatives[0] && S.ters.filter(function (x) { return x.id === r.alternatives[0].ter; })[0]);
  return t ? t.priority : null;
}
function askText(i, cfg) { var q = E.ASK[i.code]; return q ? E.fill(q.en, { min: cfg.minSpace, need: i.need || '' }) : i.title.toLowerCase(); }

function worklist(S) {
  var res = S.run.res, cfg = S.cfg;
  var groups = {
    chase: { key: 'chase', label: 'Chase an applicant for a missing item', items: [] },
    verify: { key: 'verify', label: 'Verify a condition before signing', items: [] },
    contest: { key: 'contest', label: 'Confirm a contested pin or territory', items: [] },
    alt: { key: 'alt', label: 'Offer an alternative pin', items: [] }
  };
  function item(g, a, r, x) {
    x.id = a.id; x.name = a.name; x.lang = a.lang || 'English';
    x.priority = prioOf(S, a, r); x.score = r.score;
    groups[g].items.push(x);
  }
  live(S).forEach(function (a) {
    var r = res[a.id];
    if (r.outcome === 'Hold') {
      var chase = r.issues.filter(function (i) { return i.level === 'hold' && PIN_CODES.indexOf(i.code) < 0; });
      var pinIssue = r.issues.filter(function (i) { return PIN_CODES.indexOf(i.code) >= 0; })[0];
      if (pinIssue && r.alternatives && r.alternatives.length) {
        item('alt', a, r, { title: pinIssue.title + ' (' + a.pin + ')', detail: 'Offer ' + r.alternatives.map(function (p) { return p.pin + ' (' + p.ter + ')'; }).join(', ') + '.', msgs: [{ id: a.id, kind: 'alt', alt: r.alternatives[0].pin }] });
      } else if (pinIssue) chase.unshift(Object.assign({}, pinIssue, { title: pinIssue.title + '; no open pin is left in ' + a.city + ' right now' }));
      if (chase.length) item('chase', a, r, { title: 'Ask for ' + chase.map(function (i) { return askText(i, cfg); }).join('; '), detail: chase.map(function (i) { return i.title; }).join('. ') + '.', msgs: [{ id: a.id, kind: 'letter' }] });
    } else if (r.outcome === 'Approve' && r.conditions.length) {
      item('verify', a, r, { title: r.conditions.join('; '), detail: 'Approved for pin ' + a.pin + (r.ter ? ' in ' + r.ter.id : '') + '. Clear these before the agreement is signed.', msgs: [{ id: a.id, kind: 'letter' }] });
    } else if (r.outcome === 'Waitlist' && r.alternatives && r.alternatives.length) {
      item('alt', a, r, { title: 'Pin ' + a.pin + ' is taken', detail: 'Eligible (score ' + r.score + '). Open in ' + a.city + ': ' + r.alternatives.map(function (p) { return p.pin + ' (' + p.ter + ')'; }).join(', ') + '.', msgs: [{ id: a.id, kind: 'alt', alt: r.alternatives[0].pin }] });
    }
  });

  // Contested pins: two or more eligible applicants on one pin
  var byPin = {};
  live(S).forEach(function (a) { var r = res[a.id]; if (r.pinN > 1) (byPin[a.pin] = byPin[a.pin] || []).push(a); });
  Object.keys(byPin).forEach(function (pin) {
    var g = byPin[pin].sort(function (p, q) { return res[p.id].rankPin - res[q.id].rankPin; }), top = g[0], rt = res[top.id];
    var losers = g.slice(1);
    groups.contest.items.push({ id: top.id, name: top.name, lang: top.lang || 'English', priority: rt.ter ? rt.ter.priority : null, score: rt.score,
      title: 'Pin ' + pin + ': ' + g.length + ' eligible applicants',
      detail: top.id + ' (' + rt.score + ') ' + (rt.outcome === 'Approve' ? 'takes it' : 'leads but its territory is full') + ', ahead of ' + losers.map(function (b) { return b.id + ' (' + res[b.id].score + ')'; }).join(', ') + '. One store per pin code.',
      msgs: losers.map(function (b) { return { id: b.id, kind: 'letter' }; }) });
  });
  // Contested territories: more pin winners than open slots
  Object.keys(S.run.byTer).forEach(function (tid) {
    var g = S.run.byTer[tid], t = g[0].ev.ter;
    if (g.length <= t.slots) return;
    var out = g.slice(t.slots), cut = g[t.slots - 1];
    groups.contest.items.push({ id: g[0].a.id, name: '', lang: '', priority: t.priority, score: g[0].ev.score,
      title: tid + ' ' + t.city + ': ' + g.length + ' eligible for ' + t.slots + ' slot' + (t.slots === 1 ? '' : 's'),
      detail: (cut ? 'Cut-off at ' + cut.a.id + ' (' + cut.ev.score + '). ' : 'No open slots. ') + 'Waitlisted: ' + out.map(function (x) { return x.a.id + ' (' + x.ev.score + ')'; }).join(', ') + '. Adding a slot would place the next in line.',
      msgs: out.map(function (x) { return { id: x.a.id, kind: 'letter' }; }) });
  });

  var order = function (p, q) { return ((PRIORITY_RANK[p.priority] == null ? 3 : PRIORITY_RANK[p.priority]) - (PRIORITY_RANK[q.priority] == null ? 3 : PRIORITY_RANK[q.priority])) || (q.score - p.score) || (p.id < q.id ? -1 : 1); };
  return ['chase', 'verify', 'contest', 'alt'].map(function (k) { groups[k].items.sort(order); return groups[k]; });
}

var ALT = {
  en: 'Dear {name}, about your application {id}: pin code {pin} is not available, but we have an open place in pin code {alt} ({city}). If you can find a ground-floor or mall space there, we can take your application forward. Please reply to let us know.',
  hi: 'प्रिय {name}, आपके आवेदन {id} के बारे में: पिन कोड {pin} उपलब्ध नहीं है, लेकिन पिन कोड {alt} ({city}) में हमारे पास जगह खाली है। अगर आप वहाँ ग्राउंड फ्लोर या मॉल में दुकान ढूँढ सकें, तो हम आपका आवेदन आगे बढ़ा सकते हैं। कृपया जवाब देकर बताएँ।',
  kn: 'ಆತ್ಮೀಯ {name}, ನಿಮ್ಮ ಅರ್ಜಿ {id} ಕುರಿತು: ಪಿನ್ ಕೋಡ್ {pin} ಲಭ್ಯವಿಲ್ಲ, ಆದರೆ ಪಿನ್ ಕೋಡ್ {alt} ({city}) ನಲ್ಲಿ ನಮ್ಮಲ್ಲಿ ಸ್ಥಾನ ಖಾಲಿ ಇದೆ. ಅಲ್ಲಿ ನೆಲ ಮಹಡಿ ಅಥವಾ ಮಾಲ್‌ನಲ್ಲಿ ಜಾಗ ಸಿಕ್ಕರೆ, ನಿಮ್ಮ ಅರ್ಜಿಯನ್ನು ಮುಂದುವರಿಸಬಹುದು. ದಯವಿಟ್ಟು ಉತ್ತರಿಸಿ ತಿಳಿಸಿ.'
};
function message(S, m, lang) {
  var a = S.apps.filter(function (x) { return x.id === m.id; })[0], r = S.run.res[m.id];
  lang = lang || a.lang || 'English';
  if (m.kind === 'alt') return E.fill(ALT[E.LANGKEY[lang] || 'en'], { name: a.name, id: a.id, pin: a.pin, alt: m.alt, city: a.city });
  return E.letter(r, a, lang, S.cfg);
}

/* ---------- 3. Territory health ---------- */
function territoryHealth(S) {
  var run = S.run, res = run.res, L = live(S);
  return S.ters.map(function (t) {
    var filled = Math.min(t.slots, run.approvedByTer[t.id] || 0), open = t.slots - filled;
    var locked = t.pins.filter(function (p) { return run.ctx.storeByPin[p]; });
    var freePins = t.pins.filter(function (p) { return !run.ctx.storeByPin[p] && !run.approvedPins[p]; });
    var inT = L.filter(function (a) { return res[a.id].ter && res[a.id].ter.id === t.id; });
    var eligible = inT.filter(function (a) { var o = res[a.id].outcome; return o === 'Approve' || o === 'Waitlist'; });
    var couldFill = inT.filter(function (a) { var r = res[a.id]; return r.outcome === 'Hold' && r.ifFixed && r.ifFixed.possible && r.ifFixed.outcome === 'Approve'; });
    var flags = [];
    // oversubscribed counts eligible applicants on different pins: two on one pin compete for the pin, not for a slot
    var pinsWanted = {}; eligible.forEach(function (a) { pinsWanted[a.pin] = 1; });
    var wanted = Object.keys(pinsWanted).length;
    if (wanted > t.slots) flags.push({ k: 'over', text: 'Oversubscribed: ' + wanted + ' eligible applicants on different pins for ' + t.slots + ' slot' + (t.slots === 1 ? '' : 's') });
    if (open > 0) flags.push({ k: 'under', text: 'Undersubscribed: ' + open + ' open slot' + (open === 1 ? '' : 's') + ', no eligible applicant on a free pin' + (couldFill.length ? ' (' + couldFill.map(function (a) { return a.id; }).join(', ') + ' could, once fixed)' : '') });
    if (open > freePins.length) flags.push({ k: 'short', text: 'Only ' + freePins.length + ' free pin' + (freePins.length === 1 ? '' : 's') + ' left for ' + open + ' open slot' + (open === 1 ? '' : 's') });
    if (locked.length) flags.push({ k: 'locked', text: locked.length + ' of ' + t.pins.length + ' pins locked by existing stores (' + locked.join(', ') + ')' });
    return { id: t.id, city: t.city, tier: t.tier, priority: t.priority, slots: t.slots, filled: filled, open: open, pins: t.pins.length,
             locked: locked.length, eligible: eligible.length, flags: flags };
  }).sort(function (p, q) { return PRIORITY_RANK[p.priority] - PRIORITY_RANK[q.priority] || (p.id < q.id ? -1 : 1); });
}

/* ---------- 4. Before and after ---------- */
function beforeAfter(S, T) {
  var L = live(S), res = S.run.res, wl = worklist(S);
  var n = L.length;
  var followIds = {}; wl.forEach(function (g) { if (g.key === 'chase' || g.key === 'alt') g.items.forEach(function (x) { followIds[x.id] = 1; }); });
  var follow = Object.keys(followIds).length;
  var manualMin = n * (T.screenMin + T.pinMin) + follow * T.followMin;
  var deskMin = n * T.reviewMin + follow * T.sendMin;
  var dayMin = Math.max(T.teamHours, 0.1) * 60;
  var withIssue = function (code) { return L.filter(function (a) { return res[a.id].issues.some(function (i) { return i.code === code; }); }).map(function (a) { return a.id; }); };
  var storeClash = withIssue('PIN_HAS_STORE');
  var pinRivals = L.filter(function (a) { return res[a.id].waitReason === 'pin_lost'; }).map(function (a) { return a.id; });
  var mismatch = withIssue('PIN_MISMATCH').concat(withIssue('PIN_OUTSIDE'));
  var contra = withIssue('NOTES_CONFLICT'), exp = withIssue('EXP_CONFLICT');
  return {
    n: n, follow: follow,
    manualHours: manualMin / 60, deskHours: deskMin / 60, savedHours: (manualMin - deskMin) / 60,
    manualDays: n * (T.screenMin + T.pinMin) / dayMin, deskDays: n * T.reviewMin / dayMin,
    caught: [
      { label: 'Pin already has a store', ids: storeClash },
      { label: 'Second applicant on one pin', ids: pinRivals },
      { label: 'Pin does not match the city or territory', ids: mismatch },
      { label: 'Notes contradict the form', ids: contra },
      { label: 'Experience contradicts the business description', ids: exp }
    ]
  };
}

/* ---------- 5. Adoption metrics ---------- */
function newTracker() { return { holdSince: {}, resolved: [], copies: [] }; }
// Call after every recompute: notes when a hold starts and when it clears
function track(S, ev, now) {
  live(S).forEach(function (a) {
    var o = S.run.res[a.id].outcome;
    if (o === 'Hold') { if (ev.holdSince[a.id] == null) ev.holdSince[a.id] = now; }
    else if (ev.holdSince[a.id] != null) { ev.resolved.push({ id: a.id, ms: now - ev.holdSince[a.id], to: o }); delete ev.holdSince[a.id]; }
  });
}
function median(xs) { if (!xs.length) return null; var s = xs.slice().sort(function (a, b) { return a - b; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function adoption(S, ev) {
  var L = live(S), decided = L.length, overrides = L.filter(function (a) { var o = S.run.res[a.id].override; return o && o.applied; }).length;
  var slots = 0, filled = 0; S.ters.forEach(function (t) { slots += t.slots; filled += Math.min(t.slots, S.run.approvedByTer[t.id] || 0); });
  var inPref = ev.copies.filter(function (c) { return c.lang === c.pref; }).length;
  var withPref = L.filter(function (a) { return a.lang; }).length;
  return {
    accepted: { n: decided - overrides, of: decided, overrides: overrides },
    holds: { open: Object.keys(ev.holdSince).length, resolved: ev.resolved.length, medianMin: ev.resolved.length ? median(ev.resolved.map(function (x) { return x.ms; })) / 60000 : null },
    slotFill: { filled: filled, slots: slots },
    language: { inPref: inPref, copies: ev.copies.length, withPref: withPref, of: decided }
  };
}

var api = { DATA_CODES: DATA_CODES, DEFAULT_TIME: DEFAULT_TIME, pipeline: pipeline, worklist: worklist, message: message,
  territoryHealth: territoryHealth, beforeAfter: beforeAfter, newTracker: newTracker, track: track, adoption: adoption };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.DeskOps = api;
})(typeof window !== 'undefined' ? window : globalThis);
