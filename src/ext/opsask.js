// Operations questions for Ask the desk: what to do today, slots left, who is next in line, lists by city or language,
// which territories need applicants, which offers are about to expire. Everything is read from the live decisions.
(function () {
'use strict';
var D = window.__desk, S = D.S, E = D.E, esc = D.esc, pill = D.pill, O = window.DeskOps, PN = window.DeskPlanner, OF = window.DeskOffers;
var OUT = { approve: 'Approve', approved: 'Approve', approvals: 'Approve', waitlist: 'Waitlist', waitlisted: 'Waitlist', hold: 'Hold', holds: 'Hold', held: 'Hold', reject: 'Reject', rejected: 'Reject', rejections: 'Reject' };
var OUT_WORD = { Approve: 'approved', Waitlist: 'waitlisted', Hold: 'on hold', Reject: 'rejected' };
function link(id) { return '<button class="link" data-act="open-app" data-v="' + esc(id) + '"><b>' + esc(id) + '</b></button>'; }
function live() { return S.apps.filter(function (a) { return !a.withdrawn && S.run.res[a.id]; }); }
function cityIn(low) {
  var words = low.replace(/[^a-z\s-]/g, ' ').split(/\s+/), hit = null;
  words.forEach(function (w) { if (!hit && w.length > 3) { var c = E.canonCity(w); if (E.CITIES[c]) hit = c; } });
  return hit;
}
function terIn(text) { var m = text.match(/\bter[-\s_]?0*(\d{1,3})\b/i); if (!m) return null; var n = +m[1]; var t = S.ters.filter(function (x) { return parseInt(x.id.replace(/\D/g, ''), 10) === n; })[0]; return t || null; }
function langIn(low) { var m = low.match(/\b(kannada|hindi|english)\b/); return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : null; }
function outIn(low) { var m = low.match(/\b(approved|approvals|approve|waitlisted|waitlist|holds|hold|held|rejected|rejections|reject)\b/); return m ? OUT[m[1]] : null; }
function rowsOf(list) {
  return '<ul class="diff">' + list.map(function (a) { var r = S.run.res[a.id]; return '<li>' + link(a.id) + ' ' + esc(a.name) + ' ' + pill(r.outcome, true) + ' <span class="muted">' + esc(a.city) + ' ' + esc(a.pin) + '</span></li>'; }).join('') + '</ul>';
}
function slotsOf(t) { var f = Math.min(t.slots, S.run.approvedByTer[t.id] || 0); return { filled: f, open: t.slots - f }; }
function terLine(t) { var s = slotsOf(t); return '<li><b>' + esc(t.id) + '</b> ' + esc(t.city) + ' (' + esc(t.priority.toLowerCase()) + '): ' + s.filled + ' of ' + t.slots + ' filled, <b>' + s.open + ' open</b></li>'; }

window.DeskExt.answerers.push(function (text) {
  if (!S.run) return null;
  var low = text.toLowerCase().trim(), city = cityIn(low), t = terIn(text), lang = langIn(low), out = outIn(low);

  // what should we do today
  if (/\b(what should (we|i) do|what needs (attention|doing|a person)|where (do|should) (we|i) start|who should (we|i) (call|contact|chase|message) first|priorit(y|ies)|to.?do|today)\b/.test(low) && O && !/\bAPP-\d/i.test(text) && !city && !t) {
    var groups = O.worklist(S), items = [];
    groups.forEach(function (g) { g.items.forEach(function (i) { items.push({ g: g, i: i }); }); });
    items.sort(function (x, y) { return ({ chase: 0, contest: 1, alt: 2, verify: 3 }[x.g.key]) - ({ chase: 0, contest: 1, alt: 2, verify: 3 }[y.g.key]); });
    var top = items.slice(0, 6);
    if (!top.length) return '<p>Nothing needs a person right now.</p>';
    return '<p>' + items.length + ' things need a person today. Start with these, highest-priority territories first:</p><ul class="diff">' + top.map(function (x) { return '<li>' + link(x.i.id) + ' ' + esc(x.i.title.charAt(0).toUpperCase() + x.i.title.slice(1)) + '</li>'; }).join('') + '</ul><button class="link" data-act="tab" data-v="overview">Open the full worklist</button>';
  }

  // slots left, by territory or city, or overall
  if (/\b(slots?|vacanc\w+|capacity|room)\b/.test(low) && /\b(left|open|remain\w*|available|free|how many|filled|full)\b/.test(low) && !/\bAPP-\d/i.test(text)) {
    var ters = t ? [t] : city ? S.ters.filter(function (x) { return x.city === city; }) : S.ters.filter(function (x) { return slotsOf(x).open > 0; });
    if (!ters.length) return '<p>' + (city ? 'There are no territories in ' + esc(city) + ' in this file.' : 'Every slot is filled.') + '</p>';
    var tot = 0; ters.forEach(function (x) { tot += slotsOf(x).open; });
    return '<p>' + (t || city ? '' : tot + ' slots are still open in ' + ters.length + ' territor' + (ters.length === 1 ? 'y' : 'ies') + ':') + '</p><ul class="diff">' + ters.map(terLine).join('') + '</ul>';
  }

  // who is next in line for a territory or pin
  if (/\b(next in line|next up|waiting for|waitlist for|queue|who(.s| is) waiting|who gets (it|the slot|the pin) next)\b/.test(low) || (/\b(waitlist|waitlisted)\b/.test(low) && (t || /\b\d{6}\b/.test(low)))) {
    var pin = (low.match(/\b(\d{6})\b/) || [])[1];
    if (t || pin) {
      var w = live().filter(function (a) { var r = S.run.res[a.id]; return r.outcome === 'Waitlist' && ((t && r.ter && r.ter.id === t.id) || (pin && a.pin === pin)); }).sort(function (p, q) { return S.run.res[q.id].score - S.run.res[p.id].score; });
      var label = t ? t.id : 'pin ' + pin;
      if (!w.length) return '<p>Nobody is waitlisted for ' + esc(label) + '.</p>';
      return '<p>Waitlist for ' + esc(label) + ', in order of who would be promoted first:</p><ol class="rd">' + w.map(function (a) { var r = S.run.res[a.id]; return '<li>' + link(a.id) + ' ' + esc(a.name) + ' (score ' + r.score + ')</li>'; }).join('') + '</ol>';
    }
  }

  // which territories need more applicants
  if (/\b(which|what)\b.*\b(territor\w+|areas?|cities)\b.*\b(need|short|behind|empty|unfilled|more applicants|recruit)/.test(low) && PN) {
    var plan = PN.plan(S, PN.DEFAULTS), short = plan.rows.filter(function (r) { return r.gap > 0; });
    if (!short.length) return '<p>Every territory has enough eligible applicants for its slots.</p>';
    return '<p>' + short.length + ' territor' + (short.length === 1 ? 'y needs' : 'ies need') + ' more applicants (placement rate ' + Math.round(plan.rate * 100) + '%, from ' + plan.received + ' applications):</p><ul class="diff">' + short.map(function (r) { return '<li><b>' + esc(r.id) + '</b> ' + esc(r.city) + ' (' + esc(r.priority.toLowerCase()) + '): about ' + (r.needed == null ? '?' : r.needed) + ' more for ' + r.open + ' open slot' + (r.open === 1 ? '' : 's') + '</li>'; }).join('') + '</ul><button class="link" data-act="tab" data-v="pipeplan">Open the pipeline plan</button>';
  }

  // offers
  if (/\boffers?\b/.test(low) && /\b(expir\w+|deadline|due|lapse\w*|pending|unsigned|open|signed)\b/.test(low) && OF) {
    var now = new Date(Date.now() + (S.clockDays || 0) * 86400000), rows = OF.list(S, now, OF.DEFAULTS);
    var pend = rows.filter(function (o) { return o.status !== 'Signed'; });
    if (!rows.length) return '<p>There are no offers yet because nobody is approved.</p>';
    return '<p>' + pend.length + ' of ' + rows.length + ' offers are not signed yet:</p><ul class="diff">' + pend.slice(0, 8).map(function (o) { return '<li>' + link(o.id) + ' ' + esc(o.name) + ': ' + (o.status === 'Expired' ? '<b>deadline passed</b>' : o.daysLeft + ' day' + (o.daysLeft === 1 ? '' : 's') + ' left') + (o.next.length ? '; if it lapses, ' + esc(o.next.map(function (p) { return p.id; }).join(', ')) + ' is promoted' : '') + '</li>'; }).join('') + '</ul><button class="link" data-act="tab" data-v="offers">Open offers</button>';
  }

  // lists and counts by city, language or outcome
  var asks = /\b(list|show|which|who|how many|count|all)\b/.test(low) || /\b(applicants?|applications?|partners?)\b/.test(low);
  if (asks && !/\bAPP-\d/i.test(text) && (city || lang) && !t) {
    var l = live().filter(function (a) { return (!city || a.city === city) && (!lang || (a.lang || 'English') === lang) && (!out || S.run.res[a.id].outcome === out); });
    var what = (out ? OUT_WORD[out] + ' ' : '') + 'applicants' + (city ? ' in ' + city : '') + (lang ? ' who prefer ' + lang : '');
    if (/\bhow many\b|\bcount\b/.test(low)) return '<p><b>' + l.length + '</b> ' + esc(what) + '.</p>' + (l.length && l.length <= 12 ? rowsOf(l) : '');
    if (!l.length) return '<p>No ' + esc(what) + '.</p>';
    return '<p>' + l.length + ' ' + esc(what) + ':</p>' + rowsOf(l);
  }
  // a territory by itself
  if (t && /\b(competing|competition|rivals?|applicants|who)\b/.test(low) && !/\bAPP-\d/i.test(text)) {
    var inT = live().filter(function (a) { return t.pins.indexOf(a.pin) >= 0; });
    return '<p><b>' + esc(t.id) + '</b> ' + esc(t.city) + ' has ' + inT.length + ' applicant' + (inT.length === 1 ? '' : 's') + ' for ' + t.slots + ' slot' + (t.slots === 1 ? '' : 's') + ':</p>' + (inT.length ? rowsOf(inT) : '');
  }
  return null;
});
})();
