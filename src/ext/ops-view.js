// Operations view shown above the decisions list: pipeline and leakage, today's worklist, territory health,
// before and after, adoption metrics. Logic lives in src/modules/ops.js.
(function () {
'use strict';
var O = window.DeskOps, D = window.__desk, S = D.S, esc = D.esc;
var T = JSON.parse(JSON.stringify(O.DEFAULT_TIME));
var ev = O.newTracker(), seen = null;
var V = { open: true, more: {} };
var PCLASS = { High: 'p-high', Medium: 'p-med', Low: 'p-low' };

function n1(x) { return (Math.round(x * 10) / 10).toString(); }
function pct(a, b) { return b ? Math.round(100 * a / b) + '%' : '–'; }
function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
function appLink(id) { return '<button class="link" data-act="open-app" data-v="' + esc(id) + '">' + esc(id) + '</button>'; }

/* ---------- pipeline ---------- */
function pipeHtml() {
  var p = O.pipeline(S), total = p[0].n, out = [];
  p.forEach(function (s, i) {
    if (i) {
      var lk = s.leakIds.length;
      out.push('<div class="leak' + (lk ? '' : ' none') + '">' + (lk ?
        '<button class="leak-n" data-act="ops-ids" data-ids="' + s.leakIds.join(',') + '" data-label="applications that dropped out before ' + esc(s.label.toLowerCase()) + '">−' + lk + '</button>' +
        '<ul>' + s.reasons.slice(0, 3).map(function (r) { return '<li>' + esc(r.reason) + (r.n > 1 ? ' <b>' + r.n + '</b>' : '') + '</li>'; }).join('') + (s.reasons.length > 3 ? '<li class="muted">and ' + (s.reasons.length - 3) + ' more</li>' : '') + '</ul>'
        : '<span class="muted">no drop-out</span>') + '</div>');
    }
    out.push('<button class="step s-' + s.key + '" data-act="ops-ids" data-ids="' + s.ids.join(',') + '" data-label="applications that reached ' + esc(s.label.toLowerCase()) + '">' +
      '<span>' + esc(s.label) + '</span><b>' + s.n + '</b><small>' + (i ? pct(s.n, total) + ' of received' : 'applications') + '</small></button>');
  });
  return '<div class="card pipe-card"><h3>Pipeline and where applications drop out</h3><p class="muted sm">Click a step or a drop-out to see those applications in the list below.</p><div class="pipe">' + out.join('') + '</div></div>';
}

/* ---------- worklist ---------- */
function copyBtn(m, many) {
  var a = D.getApp(m.id), lang = a.lang || 'English';
  return '<button class="btn sm" data-act="ops-copy" data-id="' + esc(m.id) + '" data-kind="' + m.kind + '" data-alt="' + esc(m.alt || '') + '">Copy message' + (many ? ' to ' + esc(m.id) : '') + ' (' + lang + ')</button>';
}
function workHtml() {
  var groups = O.worklist(S), total = 0;
  groups.forEach(function (g) { total += g.items.length; });
  var body = groups.filter(function (g) { return g.items.length; }).map(function (g) {
    var all = !!V.more[g.key], items = all ? g.items : g.items.slice(0, 3);
    return '<details class="wg"' + (g.key === 'verify' && !all ? '' : ' open') + '><summary><span>' + esc(g.label) + '</span><b>' + g.items.length + '</b></summary><ul class="wl">' + items.map(function (x) {
      return '<li><div class="wl-h">' + (x.priority ? '<span class="prio ' + PCLASS[x.priority] + '">' + x.priority + '</span>' : '<span class="prio">No territory</span>') +
        (x.name ? appLink(x.id) + ' <span>' + esc(x.name) + '</span>' : '') + '</div>' +
        '<p class="wl-t">' + esc(x.title.charAt(0).toUpperCase() + x.title.slice(1)) + '</p><p class="muted sm">' + esc(x.detail) + '</p>' +
        '<div class="wl-b">' + x.msgs.map(function (m) { return copyBtn(m, x.msgs.length > 1 || m.id !== x.id); }).join('') + '</div></li>';
    }).join('') + '</ul>' + (g.items.length > 3 ? '<button class="link sm" data-act="ops-more" data-v="' + g.key + '">' + (all ? 'Show fewer' : 'Show all ' + g.items.length) + '</button>' : '') + '</details>';
  }).join('');
  return '<div class="card"><h3>Worklist for today <span class="count">' + total + '</span></h3><p class="muted sm">What needs a person, highest-priority territory first, then by score. Messages are drafted in each applicant\'s language.</p>' +
    (body || '<p>Nothing needs a person right now.</p>') + '</div>';
}

/* ---------- territory health ---------- */
var FLAG = { over: 'Oversubscribed', under: 'Undersubscribed', short: 'Short of pins', locked: 'Pins locked' };
function healthHtml() {
  var rows = O.territoryHealth(S).map(function (t) {
    var dots = ''; for (var i = 0; i < t.slots; i++) dots += '<i class="sdot' + (i < t.filled ? ' on' : '') + '"></i>';
    return '<li><div class="th-h"><b>' + esc(t.id) + '</b> <span>' + esc(t.city) + '</span><span class="prio ' + PCLASS[t.priority] + '">' + t.priority + '</span>' +
      '<span class="grow"></span><span class="dots" title="' + t.filled + ' of ' + t.slots + ' slots filled">' + dots + '</span><small class="muted">' + t.filled + ' filled, ' + t.open + ' open, ' + t.locked + ' blocked</small></div>' +
      (t.flags.length ? '<ul class="tf">' + t.flags.map(function (f) { return '<li class="f-' + f.k + '"><span>' + FLAG[f.k] + '</span> ' + esc(f.text.replace(/^[^:]+: /, '')) + '</li>'; }).join('') + '</ul>' : '<p class="muted sm">Balanced: every slot has a partner.</p>') + '</li>';
  }).join('');
  return '<div class="card"><h3>Territory health</h3><p class="muted sm">Slots filled, open and blocked per territory. Blocked means a pin with an existing store.</p><ul class="th">' + rows + '</ul></div>';
}

/* ---------- before and after ---------- */
function tIn(k, label) { return '<label class="ba-in"><span>' + label + '</span><input type="number" min="0" step="1" value="' + T[k] + '" data-ops-t="' + k + '"></label>'; }
function baHtml() {
  var b = O.beforeAfter(S, T), caught = 0;
  b.caught.forEach(function (c) { caught += c.ids.length; });
  return '<div class="card"><h3>Before and after, for this file</h3>' +
    '<div class="ba-out">' +
      '<div><small>Team hours on this file</small><b>' + n1(b.manualHours) + ' <i>→</i> ' + n1(b.deskHours) + '</b><span>' + n1(b.savedHours) + ' hours saved</span></div>' +
      '<div><small>Time to decide the whole file</small><b>' + n1(b.manualDays) + ' <i>→</i> ' + n1(b.deskDays) + '</b><span>working days</span></div>' +
      '<div><small>Problems caught before signing</small><b>' + caught + '</b><span>pin conflicts and contradictions</span></div>' +
    '</div>' +
    '<p class="muted sm">By hand: ' + b.n + ' applications × (' + T.screenMin + ' + ' + T.pinMin + ' min) + ' + plural(b.follow, 'follow-up') + ' × ' + T.followMin + ' min. ' +
      'With the desk: ' + b.n + ' × ' + T.reviewMin + ' min review + ' + b.follow + ' × ' + T.sendMin + ' min to send. Days assume ' + T.teamHours + ' hours of screening a day.</p>' +
    '<ul class="caught">' + b.caught.filter(function (c) { return c.ids.length; }).map(function (c) { return '<li>' + esc(c.label) + ': ' + c.ids.map(appLink).join(', ') + '</li>'; }).join('') + '</ul>' +
    '<details class="ba-a"><summary>Assumptions (minutes, our estimates; change them to match your team)</summary><div class="ba-grid">' +
      tIn('screenMin', 'Screen one application by hand') + tIn('pinMin', 'Cross-check one pin by hand') + tIn('followMin', 'Write one follow-up by hand') +
      tIn('reviewMin', 'Review one decision with the desk') + tIn('sendMin', 'Send one drafted message') + tIn('teamHours', 'Screening hours a day') +
    '</div></details></div>';
}

/* ---------- adoption ---------- */
function adoptHtml() {
  var a = O.adoption(S, ev);
  var tile = function (lbl, big, sub) { return '<div><small>' + lbl + '</small><b>' + big + '</b><span>' + sub + '</span></div>'; };
  return '<div class="card"><h3>Adoption metrics</h3><p class="muted sm">Counted live in this session. In a pilot these come from the decision log, week by week.</p><div class="ba-out ad">' +
    tile('Decisions accepted without override', pct(a.accepted.n, a.accepted.of), a.accepted.n + ' of ' + a.accepted.of + (a.accepted.overrides ? ', ' + plural(a.accepted.overrides, 'override') : ', no overrides')) +
    tile('Time to resolve a hold', a.holds.medianMin == null ? '–' : a.holds.medianMin < 1 ? 'under 1 min' : n1(a.holds.medianMin) + ' min', a.holds.resolved + ' resolved, ' + a.holds.open + ' still open') +
    tile('Slot-fill rate', pct(a.slotFill.filled, a.slotFill.slots), a.slotFill.filled + ' of ' + a.slotFill.slots + ' slots') +
    tile('Messaged in their own language', a.language.copies ? pct(a.language.inPref, a.language.copies) : '–', a.language.inPref + ' of ' + plural(a.language.copies, 'message') + ' copied; ' + a.language.withPref + ' of ' + a.language.of + ' gave a language') +
    '</div></div>';
}

// note when holds start and clear; safe to call on every render
function sync() {
  if (!S.run) return;
  if (seen !== S.initial) { seen = S.initial; ev = O.newTracker(); }
  O.track(S, ev, Date.now());
}

function view() {
  if (!S.run) return '';
  sync();
  return '<section class="ops" aria-label="Operations view"><header class="ops-h"><h2>Operations view</h2><button class="link sm" data-act="ops-toggle">' + (V.open ? 'Hide' : 'Show') + '</button></header>' +
    (V.open ? pipeHtml() + '<div class="ops-grid">' + workHtml() + healthHtml() + '</div><div class="ops-grid">' + baHtml() + adoptHtml() + '</div>' : '') + '</section>';
}

window.DeskExt.afterSummary.push(view);
window.DeskExt.afterRender.push(sync);

function copy(text, el) {
  var label = el.textContent, done = function () { el.textContent = 'Copied'; setTimeout(function () { el.textContent = label; }, 1400); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
  else { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (x) {} document.body.removeChild(ta); done(); }
}
function logCopy(id, lang) {
  var a = D.getApp(id); if (!a) return;
  ev.copies.push({ id: id, lang: lang, pref: a.lang || 'English' });
  var card = document.querySelector('.ops .ad'); if (card) card.parentNode.outerHTML = adoptHtml();
}

// row "Copy message" in the decisions list counts toward the language metric too
document.addEventListener('click', function (e) {
  var el = e.target.closest && e.target.closest('[data-act="copy"]'); if (!el) return;
  var id = el.getAttribute('data-id'), a = D.getApp(id);
  if (a) logCopy(id, S.letterLang[id] || a.lang || 'English');
}, true);

document.addEventListener('click', function (e) {
  var el = e.target.closest && e.target.closest('[data-act^="ops-"]'); if (!el) return;
  var act = el.getAttribute('data-act');
  if (act === 'ops-toggle') { V.open = !V.open; D.rerender(); }
  else if (act === 'ops-more') { var k = el.getAttribute('data-v'); V.more[k] = !V.more[k]; D.rerender(); }
  else if (act === 'ops-copy') {
    var id = el.getAttribute('data-id'), a = D.getApp(id), lang = a.lang || 'English';
    copy(O.message(S, { id: id, kind: el.getAttribute('data-kind'), alt: el.getAttribute('data-alt') }, lang), el);
    logCopy(id, lang);
  } else if (act === 'ops-ids') {
    var ids = el.getAttribute('data-ids');
    S.filterIds = ids ? ids.split(',') : []; S.filterLabel = el.getAttribute('data-label'); S.filter = 'all'; S.q = ''; S.tab = 'decisions';
    D.rerender();
    var tabs = document.querySelector('.tabs'); if (tabs && tabs.scrollIntoView) tabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});
document.addEventListener('change', function (e) {
  var k = e.target.getAttribute && e.target.getAttribute('data-ops-t'); if (!k) return;
  var v = parseFloat(e.target.value); if (isNaN(v) || v < 0) return;
  T[k] = v; D.rerender();
  var d = document.querySelector('.ba-a'); if (d) d.open = true;
});

var css = document.createElement('style');
css.textContent = [
  '.ops { margin-bottom: 16px; }',
  '.ops-h { display: flex; align-items: baseline; justify-content: space-between; margin: 4px 2px 10px; }',
  '.ops-h h2 { font-family: var(--display); font-size: 19px; font-weight: 800; letter-spacing: -0.01em; }',
  '.ops .card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; min-width: 0; }',
  '.ops h3 { font-family: var(--display); font-size: 16px; font-weight: 800; margin-bottom: 2px; display: flex; align-items: center; gap: 8px; }',
  '.ops .count { font-family: var(--body); font-size: 12.5px; font-weight: 600; background: var(--ink); color: var(--bg); border-radius: 999px; padding: 0 8px; }',
  '.ops-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 12px; margin-top: 12px; align-items: start; }',
  '.pipe { display: grid; grid-template-columns: minmax(0,.8fr) minmax(0,1.3fr) minmax(0,.8fr) minmax(0,1.3fr) minmax(0,.8fr) minmax(0,1.3fr) minmax(0,.8fr); gap: 6px; margin-top: 10px; align-items: stretch; }',
  '.step { display: flex; flex-direction: column; align-items: flex-start; gap: 0; text-align: left; border: 1.5px solid var(--line); border-radius: 10px; background: var(--surface2); padding: 9px 11px; }',
  '.step:hover, .leak-n:hover { border-color: var(--accent); }',
  '.step span { font-size: 13px; font-weight: 600; color: var(--muted); }',
  '.step b { font-family: var(--display); font-size: 28px; font-weight: 800; line-height: 1.1; }',
  '.step small { font-size: 12px; color: var(--muted); }',
  '.step.s-placed { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 10%, var(--surface)); } .step.s-placed b { color: var(--ok); }',
  '.leak { font-size: 12.5px; padding: 4px 2px; border-top: 2px dashed color-mix(in srgb, var(--hold) 55%, transparent); align-self: center; }',
  '.leak.none { border-top-color: var(--line); }',
  '.leak ul { list-style: none; margin: 4px 0 0; padding: 0; color: var(--muted); line-height: 1.35; }',
  '.leak li { margin-bottom: 2px; } .leak li b { color: var(--ink); }',
  '.leak-n { border: 1px solid color-mix(in srgb, var(--hold) 45%, transparent); background: color-mix(in srgb, var(--hold) 10%, var(--surface)); color: var(--hold); font-weight: 700; border-radius: 999px; padding: 0 9px; font-size: 13px; }',
  '.wg { margin-top: 10px; border-top: 1px solid var(--line); padding-top: 8px; }',
  '.wg summary { display: flex; justify-content: space-between; font-weight: 600; font-size: 14px; cursor: pointer; list-style: none; }',
  '.wg summary::-webkit-details-marker { display: none; }',
  '.wg summary::before { content: "\\25B8"; color: var(--muted); margin-right: 6px; } .wg[open] summary::before { content: "\\25BE"; }',
  '.wg summary span { flex: 1; } .wg summary b { color: var(--muted); font-weight: 600; }',
  '.wl { list-style: none; padding: 0; margin: 6px 0 4px; }',
  '.wl li { padding: 8px 0; border-bottom: 1px dashed var(--line); } .wl li:last-child { border-bottom: 0; }',
  '.wl-h { display: flex; align-items: center; gap: 8px; font-size: 13.5px; flex-wrap: wrap; } .wl-h .link { font-weight: 600; }',
  '.wl-t { font-size: 14px; margin: 3px 0 1px; } .wl li .sm { margin-bottom: 6px; }',
  '.wl-b { display: flex; gap: 6px; flex-wrap: wrap; }',
  '.prio { font-size: 11.5px; font-weight: 600; border-radius: 4px; padding: 0 6px; border: 1px solid var(--line); color: var(--muted); }',
  '.prio.p-high { color: var(--no); border-color: color-mix(in srgb, var(--no) 40%, transparent); }',
  '.prio.p-med { color: var(--hold); border-color: color-mix(in srgb, var(--hold) 40%, transparent); }',
  '.th { list-style: none; padding: 0; margin: 8px 0 0; }',
  '.th > li { padding: 8px 0; border-bottom: 1px solid var(--line); } .th > li:last-child { border-bottom: 0; }',
  '.th-h { display: flex; align-items: center; gap: 8px; font-size: 14px; flex-wrap: wrap; } .th-h small { font-size: 12.5px; }',
  '.tf { list-style: none; padding: 0; margin: 4px 0 0; font-size: 12.5px; color: var(--muted); }',
  '.tf li { margin-top: 2px; } .tf li span { font-weight: 600; }',
  '.tf .f-over span { color: var(--wait); } .tf .f-under span { color: var(--hold); } .tf .f-short span { color: var(--no); } .tf .f-locked span { color: var(--muted); }',
  '.ba-out { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0; }',
  '.ba-out.ad { grid-template-columns: repeat(2, minmax(0, 1fr)); }',
  '.ba-out > div { background: var(--surface2); border: 1px solid var(--line); border-radius: 10px; padding: 9px 11px; display: flex; flex-direction: column; }',
  '.ba-out small { font-size: 12px; color: var(--muted); line-height: 1.3; }',
  '.ba-out b { font-family: var(--display); font-size: 22px; font-weight: 800; line-height: 1.2; margin-top: 2px; } .ba-out b i { font-style: normal; color: var(--muted); font-weight: 600; }',
  '.ba-out span { font-size: 12.5px; color: var(--muted); }',
  '.caught { margin: 4px 0 8px; padding-left: 18px; font-size: 13.5px; }',
  '.ba-a summary { cursor: pointer; font-size: 13.5px; font-weight: 600; color: var(--accent); }',
  '.ba-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 16px; margin-top: 8px; }',
  '.ba-in { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; }',
  '.ba-in input { width: 64px; padding: 4px 7px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); text-align: right; }',
  '.only { font-size: 13.5px; background: color-mix(in srgb, var(--accent) 8%, var(--surface)); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); border-radius: 8px; padding: 7px 12px; }',
  '@media (max-width: 1060px) { .ops-grid { grid-template-columns: minmax(0, 1fr); } }',
  '@media (max-width: 720px) {',
  '  .pipe { grid-template-columns: minmax(0, 1fr); }',
  '  .step { flex-direction: row; align-items: baseline; gap: 10px; } .step b { order: -1; font-size: 24px; }',
  '  .leak { border-top: 0; border-left: 2px dashed color-mix(in srgb, var(--hold) 55%, transparent); padding: 2px 0 2px 12px; margin-left: 14px; display: flex; gap: 10px; align-items: flex-start; }',
  '  .leak.none { border-left-color: var(--line); } .leak ul { margin: 0; }',
  '  .ba-out { grid-template-columns: minmax(0, 1fr); } .ba-out.ad { grid-template-columns: repeat(2, minmax(0, 1fr)); } .ba-grid { grid-template-columns: minmax(0, 1fr); }',
  '}'
].join('\n');
document.head.appendChild(css);
})();
