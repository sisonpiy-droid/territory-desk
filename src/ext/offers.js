// Offers page: every approval is an offer with a deadline; an offer that is not signed in time lapses and the next
// waitlisted applicant is promoted automatically. Logic in src/modules/offers.js.
(function () {
'use strict';
var D = window.__desk, S = D.S, esc = D.esc, pill = D.pill, OF = window.DeskOffers;
var cfg = JSON.parse(JSON.stringify(OF.DEFAULTS));
var DAY = 86400000;
function clock() { return new Date(Date.now() + (S.clockDays || 0) * DAY); }
function appLink(id) { return '<button class="link" data-act="open-app" data-v="' + esc(id) + '">' + esc(id) + '</button>'; }
function log(kind, id, text) { if (D.log) D.log({ kind: kind, id: id, text: text }); }

window.DeskExt.afterRecompute.push(function (diff, first) {
  if (first) { S.offerAt = {}; S.signed = {}; S.clockDays = 0; }
  OF.sync(S, clock());
});

/* ---------- actions ---------- */
function lapse(ids, reason, kind, text) {
  if (!ids.length) return '';
  var promo = OF.promotedIf(S, ids);
  D.pushUndo();
  ids.forEach(function (id) { var a = D.getApp(id); if (a) { a.withdrawn = true; a.withdrawnReason = reason; } });
  S.cause = { kind: 'Offer', text: text };
  D.recompute(); S.cause = null;
  var dl = new Date(clock().getTime() + cfg.validDays * DAY);
  var html = '<p class="ap">' + esc(text) + '</p>' + (promo.length ? '<p><b>Promoted automatically</b> (new offer, valid until ' + esc(OF.fmt(dl)) + '):</p><ul class="diff">' + promo.map(function (p) { return '<li>' + appLink(p.id) + ' ' + esc(p.name) + ', pin ' + esc(p.pin) + (p.ter ? ' in ' + esc(p.ter) : '') + '</li>'; }).join('') + '</ul>' : '<p class="muted">Nobody is waiting behind ' + (ids.length > 1 ? 'these offers' : 'this offer') + ', so the slot' + (ids.length > 1 ? 's stay' : ' stays') + ' open.</p>');
  S.askLog.push({ who: 'desk', html: html });
  D.rerender();
  return html;
}

/* ---------- page ---------- */
function tabHtml() {
  var now = clock(), rows = OF.list(S, now, cfg), ex = OF.expire(S, now, cfg);
  var n = { Open: 0, 'Due soon': 0, Expired: 0, Signed: 0 }; rows.forEach(function (o) { n[o.status]++; });
  var tile = function (big, label, tone) { return '<div class="of-k ' + (tone || '') + '"><b>' + big + '</b><span>' + label + '</span></div>'; };
  var pillOf = function (o) {
    var c = { Signed: 'ok', Expired: 'no', 'Due soon': 'hold', Open: 'wait' }[o.status];
    return '<span class="pill ' + c + '">' + (o.status === 'Open' || o.status === 'Due soon' ? o.daysLeft + (o.daysLeft === 1 ? ' day left' : ' days left') : o.status) + '</span>';
  };
  var body = rows.map(function (o) {
    var next = o.signed ? '<span class="muted">Signed: pin is held</span>' : o.next.length ? 'Promotes ' + o.next.map(function (p) { return appLink(p.id); }).join(', ') : '<span class="muted">Nobody waiting; slot stays open</span>';
    var acts = o.signed ? '<button class="btn sm" data-act="of-unsign" data-id="' + esc(o.id) + '">Undo signed</button>' :
      (o.status === 'Expired' ? '<button class="btn sm primary" data-act="of-lapse" data-id="' + esc(o.id) + '">Lapse and promote</button> ' : '') +
      '<button class="btn sm" data-act="of-sign" data-id="' + esc(o.id) + '">Mark signed</button> <button class="btn sm" data-act="of-decline" data-id="' + esc(o.id) + '">Declined</button> ' +
      '<button class="btn sm" data-act="of-copy" data-id="' + esc(o.id) + '">Copy offer (' + esc(o.lang) + ')</button>';
    return '<tr><td>' + appLink(o.id) + ' ' + esc(o.name) + '</td><td>' + esc(o.pin) + ' · ' + esc(o.ter) + '</td><td>' + esc(OF.fmt(o.offeredAt)) + '</td><td>' + esc(OF.fmt(o.deadline)) + '</td><td>' + pillOf(o) + '</td><td>' + next + '</td><td class="of-a">' + acts + '</td></tr>';
  }).join('');
  var banner = ex.lapsed.length ? '<div class="of-ban"><div><b>' + ex.lapsed.length + ' offer' + (ex.lapsed.length === 1 ? ' has' : 's have') + ' passed the deadline.</b> Lapsing ' + (ex.lapsed.length === 1 ? 'it releases' : 'them releases') + ' the pin' + (ex.lapsed.length === 1 ? '' : 's') + ' and ' + (ex.promoted.length ? 'promotes ' + ex.promoted.map(function (p) { return esc(p.id) + ' (' + esc(p.pin) + ')'; }).join(', ') : 'frees the slot' + (ex.lapsed.length === 1 ? '' : 's') + ', with nobody waiting') + '.</div><button class="btn primary" data-act="of-lapse-all">Lapse all expired</button></div>' : '';
  var hist = (S.log || []).filter(function (e) { return e.kind === 'Offer'; }).slice(-6).reverse();
  return '<div class="of"><p class="muted sm">Every approval is an offer with a deadline. If it is not signed in time, the pin is released and the next waitlisted applicant is promoted automatically, so a pin is never offered twice.</p>' +
    '<div class="of-tiles">' + tile(n.Open + n['Due soon'], 'open offers') + tile(n['Due soon'], 'due within 2 days', n['Due soon'] ? 'warn' : '') + tile(n.Expired, 'past the deadline', n.Expired ? 'bad' : '') + tile(n.Signed, 'signed', 'good') + '</div>' + banner +
    '<div class="of-clock"><label>Offer window <input type="number" min="1" step="1" value="' + cfg.validDays + '" data-of="validDays"> days</label>' +
      '<span class="of-sep"></span><span>View as of <b>' + esc(OF.fmt(now)) + '</b>' + (S.clockDays ? ' (+' + S.clockDays + ' days)' : '') + '</span><button class="btn sm" data-act="of-day" data-v="1">+1 day</button><button class="btn sm" data-act="of-day" data-v="7">+7 days</button><button class="btn sm" data-act="of-day" data-v="0">Today</button></div>' +
    (rows.length ? '<div class="tscroll"><table class="cmp of-t"><thead><tr><th>Partner</th><th>Pin · territory</th><th>Offered</th><th>Deadline</th><th>Status</th><th>If it lapses</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' : '<p class="muted pad">No approved applicants, so no offers yet.</p>') +
    (hist.length ? '<h4 class="mt">Recent offer activity</h4><ul class="of-h">' + hist.map(function (e) { return '<li>' + esc(e.text) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
}
window.DeskExt.tabs.push({ id: 'offers', label: 'Offers', render: tabHtml, badge: function () { if (!S.run) return ''; var r = OF.list(S, clock(), cfg).filter(function (o) { return o.status === 'Expired' || o.status === 'Due soon'; }).length; return r || ''; } });

// the plan section of a record shows where its offer stands
window.DeskExt.afterDetail.push({ group: 'plan', fn: function (a, r) {
  if (r.outcome !== 'Approve') return '';
  var o = OF.list(S, clock(), cfg).filter(function (x) { return x.id === a.id; })[0]; if (!o) return '';
  return '<h4>Offer</h4><p>' + (o.signed ? 'Signed. The pin is held.' : 'Offered ' + esc(OF.fmt(o.offeredAt)) + '; sign by <b>' + esc(OF.fmt(o.deadline)) + '</b> (' + (o.status === 'Expired' ? 'deadline passed' : o.daysLeft + ' day' + (o.daysLeft === 1 ? '' : 's') + ' left') + ').') + ' <button class="link" data-act="tab" data-v="offers">Open offers</button></p>';
} });

window.DeskExt.exportSheets.push(function () {
  return { name: 'Offers', rows: [['Application', 'Applicant', 'Pin', 'Territory', 'Offered', 'Deadline', 'Status', 'Promotes if it lapses']].concat(OF.list(S, clock(), cfg).map(function (o) { return [o.id, o.name, o.pin, o.ter, OF.fmt(o.offeredAt), OF.fmt(o.deadline), o.status, o.next.map(function (p) { return p.id; }).join(', ')]; })) };
});
window.DeskExt.assumptions.push(function () {
  return [{ area: 'Offers', name: 'Offer window (days to sign)', def: OF.DEFAULTS.validDays + ' days', now: cfg.validDays + ' days', where: 'Offers page', how: 'Median days from approval to signed agreement in the brand\'s last 10 approvals; set the window to the 80th percentile.' }];
});

/* ---------- events ---------- */
document.addEventListener('click', function (e) {
  var el = e.target.closest && e.target.closest('[data-act^="of-"]'); if (!el) return;
  var act = el.getAttribute('data-act'), id = el.getAttribute('data-id'), a = id ? D.getApp(id) : null, now = clock();
  if (act === 'of-day') { var v = +el.getAttribute('data-v'); S.clockDays = v ? (S.clockDays || 0) + v : 0; OF.sync(S, clock()); D.rerender(); }
  else if (act === 'of-sign') { S.signed[id] = true; S.stages[id] = Math.max(S.stages[id] || 0, 2); log('Offer', id, id + ' ' + a.name + ' signed the agreement'); D.rerender(); }
  else if (act === 'of-unsign') { delete S.signed[id]; log('Offer', id, id + ' marked not signed'); D.rerender(); }
  else if (act === 'of-decline') lapse([id], 'Declined the offer', 'Offer', id + ' ' + a.name + ' declined the offer');
  else if (act === 'of-lapse') lapse([id], 'Offer expired on ' + OF.fmt(now), 'Offer', 'Offer to ' + id + ' ' + a.name + ' lapsed after ' + cfg.validDays + ' days');
  else if (act === 'of-lapse-all') { var ex = OF.expire(S, now, cfg); lapse(ex.lapsed, 'Offer expired on ' + OF.fmt(now), 'Offer', ex.lapsed.length + ' expired offer' + (ex.lapsed.length === 1 ? '' : 's') + ' lapsed (' + ex.lapsed.join(', ') + ')'); }
  else if (act === 'of-copy') {
    var o = OF.list(S, now, cfg).filter(function (x) { return x.id === id; })[0], txt = OF.message(S, id, o.deadline), label = el.textContent;
    var done = function () { el.textContent = 'Copied'; setTimeout(function () { el.textContent = label; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, done); else done();
  }
});
document.addEventListener('change', function (e) {
  if (!e.target.getAttribute || e.target.getAttribute('data-of') !== 'validDays') return;
  var v = parseInt(e.target.value, 10); if (isNaN(v) || v < 1) return;
  cfg.validDays = v; D.rerender();
});

var css = document.createElement('style');
css.textContent = [
  '.of-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 10px 0; }',
  '.of-k { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; } .of-k b { font-family: var(--display); font-size: 24px; line-height: 1.1; font-weight: 800; } .of-k span { font-size: 12.5px; color: var(--muted); }',
  '.of-k.warn b { color: var(--hold); } .of-k.bad b { color: var(--no); } .of-k.good b { color: var(--ok); }',
  '.of-ban { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; padding: 10px 14px; border-radius: 10px; background: color-mix(in srgb, var(--no) 9%, var(--surface)); border: 1px solid color-mix(in srgb, var(--no) 30%, transparent); font-size: 14px; }',
  '.of-clock { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 13.5px; } .of-clock input { width: 54px; border: 1px solid var(--line); border-radius: 6px; padding: 3px 6px; background: var(--surface); text-align: right; } .of-sep { width: 1px; height: 18px; background: var(--line); margin: 0 6px; }',
  '.of-t td, .of-t th { text-align: left; vertical-align: top; } .of-a { white-space: normal; } .of-a .btn { margin: 0 4px 4px 0; }',
  '.of-h { padding-left: 18px; font-size: 13.5px; color: var(--muted); } .of h4.mt { font-family: var(--display); font-size: 15px; margin: 18px 0 6px; }',
  '@media (max-width: 720px) { .of-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }'
].join('\n');
document.head.appendChild(css);
})();
