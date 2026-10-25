// Phase 2: overrides with a reason, backward onboarding plans and a stage board, the decision log, re-run triggers.
// Logic lives in engine.js (overrides in allocation), src/modules/plan.js and src/modules/triggers.js.
(function () {
'use strict';
var D = window.__desk, S = D.S, E = D.E, esc = D.esc, pill = D.pill, P = window.DeskPlan, TR = window.DeskTriggers, GL = window.DeskGoLive;
var OUTS = ['Approve', 'Waitlist', 'Hold', 'Reject'];
S.log = []; S.stages = {};

function fmt(d) { return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtT(d) { return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function appLink(id) { return '<button class="link" data-act="open-app" data-v="' + esc(id) + '">' + esc(id) + '</button>'; }
function short(id) { var a = D.getApp(id), r = S.run.res[id]; return a && r ? E.explain(r, a, { cfg: S.cfg, run: S.run }).short || '' : ''; }
function log(e) { e.at = new Date(); S.log.push(e); }
D.log = log;   // other pages add to the decision log through this

/* ---------- decision log: every decision, override, what-if and change ---------- */
window.DeskExt.afterRecompute.push(function (diff, first, cause) {
  if (first) {
    S.log = []; S.stages = {}; S.gates = {}; S.loadedAt = new Date();
    var n = S.apps.filter(function (a) { return !a.withdrawn; }).length;
    log({ kind: 'Upload', text: 'Decided ' + n + ' applications' + (S.label ? ' from ' + S.label : '') });
    S.apps.forEach(function (a) { var r = S.run.res[a.id]; if (r) log({ kind: 'Decision', id: a.id, to: r.outcome, text: short(a.id) }); });
    return;
  }
  log({ kind: cause ? cause.kind : 'Change', text: (cause ? cause.text : 'Data updated') + (diff.length ? '' : ' (no decision changed)') });
  diff.forEach(function (d) { log({ kind: 'Decision', id: d.id, from: d.from, to: d.to, text: d.to === 'Withdrawn' ? 'Withdrawn by applicant' : d.note || short(d.id) }); });
});

/* ---------- overrides ---------- */
function setOverride(id, to, reason) {
  var a = D.getApp(id); if (!a) return '<p>I cannot find ' + esc(id) + ' in this file.</p>';
  D.pushUndo();
  var prev = a.override;
  a.override = to ? { to: to, reason: reason, at: Date.now() } : null;
  S.cause = { kind: 'Override', text: to ? id + ' set to ' + to + ': ' + reason : 'Override removed from ' + id + (prev ? ' (was ' + prev.to + ')' : '') };
  var diff = D.recompute(); S.cause = null;
  var r = S.run.res[id], msg;
  if (to && r.override && !r.override.applied) {
    msg = '<p class="ap"><b>Override refused for ' + esc(id) + '.</b> ' + esc(r.override.refused.charAt(0).toUpperCase() + r.override.refused.slice(1)) + '. The decision stays ' + pill(r.outcome, true) + '. The override is kept on record and takes effect if that changes.</p>';
    log({ kind: 'Override refused', id: id, text: r.override.refused });
  } else msg = '<p class="ap">' + (to ? 'Override recorded for <b>' + esc(id) + '</b>: ' + esc(to) + '. Reason: ' + esc(reason) + '.' : 'Override removed from <b>' + esc(id) + '</b>.') + '</p>';
  msg += diff.length ? '<ul class="diff">' + diff.map(function (d) { return '<li>' + appLink(d.id) + ' ' + (d.from === d.to ? esc(d.note || '') : pill(d.from, true) + ' to ' + pill(d.to, true)) + '</li>'; }).join('') + '</ul>' : '<p class="muted">No decision changed.</p>';
  S.askLog.push({ who: 'desk', html: msg });
  D.rerender();
  return msg;
}

function overrideHtml(a, r) {
  var ov = r.override, opts = OUTS.filter(function (o) { return o !== r.outcome || (ov && ov.applied); });
  var now = ov ? '<p class="ovr-now ' + (ov.applied ? 'on' : 'refused') + '">' + (ov.applied ? 'Override in place: ' + esc(ov.to) + '. Reason: ' + esc(ov.reason) + '.' : 'Override to ' + esc(ov.to) + ' refused: ' + esc(ov.refused) + '.') +
    ' <button class="link" data-act="ovr-clear" data-id="' + esc(a.id) + '">Remove override</button></p>' : '';
  return '<h4>Override this decision</h4>' + now +
    '<div class="ovr"><select data-ovr-to="' + esc(a.id) + '" aria-label="New outcome">' + opts.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select>' +
    '<input type="text" data-ovr-why="' + esc(a.id) + '" placeholder="Reason (required)" aria-label="Reason for the override">' +
    '<button class="btn sm" data-act="ovr-set" data-id="' + esc(a.id) + '">Apply override</button></div>' +
    '<p class="muted sm ovr-err" data-ovr-err="' + esc(a.id) + '">An approval by override still respects one store per pin code and the territory\'s open slots.</p>';
}

/* ---------- row detail additions ---------- */
window.DeskExt.afterDetail.push({ group: 'plan', fn: function (a, r) {
  if (r.outcome !== 'Approve') return '';
  var p = P.plan(a, r, S.cfg, S.loadedAt || new Date(), S.stages[a.id] || 0, new Date());
  return '<h4>Plan back from the target</h4><p>Sign by <b>' + fmt(p.latestSign) + '</b> to open on <b>' + fmt(p.open) + '</b>. ' + esc(p.basis) + '</p>' +
    (p.atRisk ? '<p class="risk">At risk: ' + esc(p.risks.join('; ')) + '.</p>' : '') +
    '<p class="muted sm">Stage: ' + esc(P.STAGES[p.stage]) + '. Next: ' + esc(p.next ? p.next.title + ' (' + p.next.owner + ', due ' + fmt(p.next.due) + ')' : 'none') + '. <button class="link" data-act="tab" data-v="onboard">Open the stage board</button></p>';
} });
window.DeskExt.afterDetail.push(function (a) {
  var t = TR.triggers(S)[a.id];
  return t && t.events.length ? '<h4>Decide again when</h4><ul class="trig">' + t.events.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' + (t.then ? '<p class="muted sm">Then: ' + esc(t.then) + '.</p>' : '') : '';
});
window.DeskExt.afterDetail.push({ group: 'actions', fn: function (a, r) { return overrideHtml(a, r); } });

/* ---------- Onboarding tab: stage board and backward plans ---------- */
function onboardHtml() {
  var today = new Date(), ps = P.plans(S, today);
  if (!ps.length) return '<p class="muted pad">No approved partners yet.</p>';
  var risk = ps.filter(function (p) { return p.atRisk; }).length;
  var soon = {}; P.OWNERS.forEach(function (o) { soon[o] = []; });
  var horizon = today.getTime() + 14 * 86400000;
  ps.forEach(function (p) { p.steps.forEach(function (s) { if (!s.done && s.due.getTime() <= horizon) soon[s.owner].push({ id: p.id, s: s }); }); });
  var cols = P.STAGES.map(function (st, i) {
    var cards = ps.filter(function (p) { return p.stage === i; }).map(function (p) {
      var a = D.getApp(p.id);
      return '<div class="card-s' + (p.atRisk ? ' risk' : '') + '"><div class="cs-h">' + appLink(p.id) + ' <span>' + esc(a.name) + '</span></div>' +
        '<small>' + esc(a.city) + ', ' + esc(a.pin) + ' · opens ' + fmt(p.open) + '</small>' +
        (p.next ? '<p>' + esc(p.next.title) + '<br><span class="muted">' + esc(p.next.owner) + ', due ' + fmt(p.next.due) + (p.next.overdue ? ' (overdue)' : '') + '</span></p>' : '<p>Open</p>') +
        (p.atRisk ? '<p class="risk">' + esc(p.risks.join('; ')) + '</p>' : '') + gateBadge(p) +
        '<div class="cs-b"><button class="btn sm" data-act="stage" data-id="' + esc(p.id) + '" data-v="-1"' + (i ? '' : ' disabled') + ' aria-label="Move back">‹</button>' +
        '<button class="btn sm" data-act="stage" data-id="' + esc(p.id) + '" data-v="1"' + (i < P.STAGES.length - 1 && !(i === P.STAGES.length - 2 && !gateState(p).ready) ? '' : ' disabled title="Every go-live gate must be green first"') + '>Mark ' + esc((P.STAGES[i + 1] || 'done').toLowerCase()) + ' ›</button></div></div>';
    }).join('');
    return '<section class="col"><h4>' + esc(st) + ' <span class="muted">' + ps.filter(function (p) { return p.stage === i; }).length + '</span></h4>' + cards + '</section>';
  }).join('');
  var owners = P.OWNERS.map(function (o) {
    return '<div><b>' + esc(o) + '</b> <span class="muted">' + soon[o].length + '</span><ul>' + (soon[o].map(function (x) { return '<li>' + appLink(x.id) + ' ' + esc(x.s.title) + ' <span class="muted">by ' + fmt(x.s.due) + '</span></li>'; }).join('') || '<li class="muted">Nothing due</li>') + '</ul></div>';
  }).join('');
  var plans = ps.map(function (p) {
    var a = D.getApp(p.id);
    return '<details class="pl"><summary>' + esc(p.id) + ' ' + esc(a.name) + ': sign by ' + fmt(p.latestSign) + ', open ' + fmt(p.open) + (p.atRisk ? ' <span class="risk">at risk</span>' : '') + '</summary>' +
      '<p class="muted sm">' + esc(p.basis) + (p.conditions.length ? ' Conditions: ' + esc(p.conditions.join('; ')) + '.' : '') + '</p>' +
      '<table class="cmp"><thead><tr><th>Step</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead><tbody>' +
      p.steps.map(function (s) { return '<tr><td>' + esc(s.title) + '</td><td>' + esc(s.owner) + '</td><td>' + fmt(s.due) + '</td><td>' + (s.done ? 'Done' : s.overdue ? '<span class="risk">Overdue</span>' : 'To do') + '</td></tr>'; }).join('') +
      '</tbody></table></details>';
  }).join('');
  return '<div class="onb"><p class="lede sm">' + ps.length + ' approved partner' + (ps.length === 1 ? '' : 's') + ', ' + risk + ' at risk. Each plan runs back from the target launch to the latest date the agreement can be signed; every step has an owner and a due date.</p>' +
    '<div class="sboard">' + cols + '</div>' + gatesHtml(ps) + '<h4 class="mt">Due in the next 14 days, by owner</h4><div class="owners">' + owners + '</div>' +
    '<h4 class="mt">Plans</h4>' + plans + '</div>';
}

/* ---------- go-live gates (src/modules/golive.js) ---------- */
function gateState(p) { return GL ? GL.gates(p.open, (S.gates || {})[p.id], new Date()) : { ready: true, done: 0, total: 0, list: [] }; }
function gateBadge(p) {
  if (!GL) return '';
  var g = gateState(p);
  return '<div class="gbar' + (g.ready ? ' ok' : g.overdue ? ' late' : '') + '" title="Go-live gates: ' + g.done + ' of ' + g.total + ' green"><i style="width:' + Math.round(100 * g.readiness) + '%"></i></div>' +
    '<small>Go-live ' + Math.round(100 * g.readiness) + '% (' + g.done + ' of ' + g.total + ')' + (g.overdue ? ', ' + g.overdue + ' overdue' : '') + '</small>';
}
function gatesHtml(ps) {
  if (!GL) return '';
  var head = GL.GATES.map(function (g) { return '<th title="' + esc(g.title) + '">' + esc(g.short) + '<br><small class="muted">' + esc(g.owner) + '</small></th>'; }).join('');
  var rows = ps.map(function (p) {
    var g = gateState(p), a = D.getApp(p.id);
    return '<tr><td>' + appLink(p.id) + ' ' + esc(a.name) + '<br><small class="muted">' + Math.round(100 * g.readiness) + '% ready' + (g.ready ? '' : ', next: ' + esc(g.next.title.toLowerCase()) + ' by ' + fmt(g.next.due)) + '</small></td>' +
      g.list.map(function (x) { return '<td class="' + (x.done ? 'g-ok' : x.overdue ? 'g-late' : '') + '"><label><input type="checkbox" data-act="gate" data-id="' + esc(p.id) + '" data-v="' + x.key + '"' + (x.done ? ' checked' : '') + '> ' + fmt(x.due).replace(/ \d{4}$/, '') + '</label></td>'; }).join('') + '</tr>';
  }).join('');
  return '<h4 class="mt">Go-live gates</h4><p class="muted sm">A store can be marked open only when every gate is green. Due dates count back from the planned opening; tick a gate when it is done.</p>' +
    '<div class="tscroll"><table class="cmp gates"><thead><tr><th>Partner</th>' + head + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

/* ---------- Decision log tab ---------- */
function logHtml() {
  var tr = TR.triggers(S), ids = Object.keys(tr);
  var waiting = ids.length ? '<ul class="waitlist-ul">' + ids.map(function (id) {
    var t = tr[id]; return '<li>' + appLink(id) + ' ' + pill(t.outcome, true) + ' <span>' + esc(t.events.join('; or ') || 'No trigger: needs a person') + '</span>' + (t.then ? ' <span class="muted">Then: ' + esc(t.then) + '.</span>' : '') + '</li>';
  }).join('') + '</ul>' : '<p class="muted">Nothing is waiting.</p>';
  var rows = S.log.slice().reverse().map(function (e) {
    return '<tr><td class="muted">' + fmtT(e.at) + '</td><td><span class="kind k-' + esc(e.kind.split(' ')[0].toLowerCase()) + '">' + esc(e.kind) + '</span></td><td>' + (e.id ? appLink(e.id) : '') + '</td><td>' +
      (e.to ? (e.from ? pill(e.from, true) + ' to ' : '') + pill(e.to, true) + ' ' : '') + esc(e.text || '') + '</td></tr>';
  }).join('');
  return '<div class="logv"><h4>Decide again when</h4><p class="muted sm">For every held or waitlisted application, the event that would change the decision. Tell the desk when it happens and everything is decided again.</p>' + waiting +
    '<h4 class="mt">Decision log <span class="muted">' + S.log.length + ' entries, included in the export</span></h4><div class="tscroll"><table class="cmp lg"><tbody>' + rows + '</tbody></table></div></div>';
}

window.DeskExt.tabs.push({ id: 'onboard', label: 'Onboarding', render: onboardHtml });
window.DeskExt.tabs.push({ id: 'log', label: 'Decision log', render: logHtml });

/* ---------- export ---------- */
window.DeskExt.exportSheets.push(function () {
  return { name: 'Decision log', rows: [['Time', 'Type', 'Application', 'From', 'To', 'Detail']].concat(S.log.map(function (e) { return [e.at.toISOString(), e.kind, e.id || '', e.from || '', e.to || '', e.text || '']; })) };
});
window.DeskExt.exportSheets.push(function () {
  var rows = [['Application', 'Applicant', 'Stage', 'Planned opening', 'Latest signing', 'At risk', 'Step', 'Owner', 'Due', 'Status']];
  P.plans(S, new Date()).forEach(function (p) {
    var a = D.getApp(p.id);
    p.steps.forEach(function (s) { rows.push([p.id, a.name, P.STAGES[p.stage], fmt(p.open), fmt(p.latestSign), p.atRisk ? p.risks.join('; ') : '', s.title, s.owner, fmt(s.due), s.done ? 'Done' : s.overdue ? 'Overdue' : 'To do']); });
  });
  return { name: 'Onboarding plan', rows: rows };
});
window.DeskExt.exportSheets.push(function () {
  var tr = TR.triggers(S);
  return { name: 'Decide again when', rows: [['Application', 'Outcome', 'Decide again when (any of)', 'Then']].concat(Object.keys(tr).map(function (id) { var t = tr[id]; return [id, t.outcome, t.events.join('; or '), t.then]; })) };
});

/* ---------- Ask the desk: overrides in plain language ---------- */
function idIn(text) {
  var m = text.match(/\bapp[-\s_]?0*(\d{1,4})\b/i); if (!m) return null;
  var n = parseInt(m[1], 10), a = S.apps.filter(function (x) { return parseInt(x.id.replace(/#.*$/, '').replace(/\D/g, ''), 10) === n; })[0];
  return a ? a.id : 'APP-' + E.pad(n, 3);
}
window.DeskExt.answerers.push(function (text) {
  var low = text.toLowerCase(), id = idIn(text);
  if (!id || /^\s*(why|how|what|who|which|is|are|can|does|do)\b/.test(low)) return null;
  if (/\b(remove|cancel|clear|drop|undo|lift)\b[^.]*\boverride\b/.test(low)) return fromChat(id, null, '');
  var vm = low.match(/\b(approve|reject|waitlist|hold)\b/);
  if (!vm || !(/\b(override|anyway|regardless|manually|force)\b/.test(low) || /^\s*(please\s+)?(approve|reject|waitlist|put|move|place|keep|hold)\b/.test(low))) return null;
  var to = { approve: 'Approve', reject: 'Reject', waitlist: 'Waitlist', hold: 'Hold' }[vm[1]];
  var rm = text.match(/\b(?:because|since|as|reason:?|due to)\s+(.{3,})$/i);
  if (!rm) return '<p>To override ' + esc(id) + ' I need a reason, so it goes in the log. For example: "' + esc(to === 'Approve' ? 'Approve' : to) + ' ' + esc(id) + ' anyway because the partner already runs two of our kiosks".</p>';
  return fromChat(id, to, rm[1].replace(/[.\s]+$/, ''));
});
function fromChat(id, to, why) { var html = setOverride(id, to, why); S.askLog.pop(); return html; }   // ask() adds the answer itself

/* ---------- events ---------- */
document.addEventListener('click', function (e) {
  var el = e.target.closest && e.target.closest('[data-act="ovr-set"],[data-act="ovr-clear"],[data-act="stage"],[data-act="gate"]'); if (!el) return;
  var act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
  if (act === 'gate') {
    var k = el.getAttribute('data-v'); S.gates[id] = S.gates[id] || {}; S.gates[id][k] = el.checked;
    var gt = GL.GATES.filter(function (g) { return g.key === k; })[0];
    log({ kind: 'Go-live gate', id: id, text: gt.title + (el.checked ? ': green' : ': not done') });
    D.rerender(); return;
  }
  if (act === 'ovr-clear') setOverride(id, null, '');
  else if (act === 'ovr-set') {
    var to = document.querySelector('[data-ovr-to="' + id + '"]').value, why = document.querySelector('[data-ovr-why="' + id + '"]').value.trim();
    if (!why) { var er = document.querySelector('[data-ovr-err="' + id + '"]'); er.textContent = 'Give a reason first: it goes in the decision log.'; er.classList.add('bad'); return; }
    setOverride(id, to, why);
  } else if (act === 'stage') {
    var cur = S.stages[id] || 0, nx = Math.max(0, Math.min(P.STAGES.length - 1, cur + parseInt(el.getAttribute('data-v'), 10)));
    var pl = P.plans(S, new Date()).filter(function (x) { return x.id === id; })[0];
    if (P.STAGES[nx] === 'Open' && pl && !gateState(pl).ready) { S.askLog.push({ who: 'desk', html: '<p>' + esc(id) + ' cannot be marked open yet: ' + gateState(pl).list.filter(function (g) { return !g.done; }).map(function (g) { return esc(g.title.toLowerCase()); }).join('; ') + '.</p>' }); D.rerender(); return; }
    S.stages[id] = nx; log({ kind: 'Stage', id: id, text: 'Moved to ' + P.STAGES[nx] });
    D.rerender();
  }
});

var css = document.createElement('style');
css.textContent = [
  '.ovr { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }',
  '.ovr select, .ovr input { border: 1px solid var(--line); border-radius: 8px; padding: 5px 9px; background: var(--surface); font-size: 13px; }',
  '.ovr input { flex: 1; min-width: 160px; }',
  '.ovr-err { margin-top: 6px; } .ovr-err.bad { color: var(--no); }',
  '.ovr-now { font-size: 13px; border-radius: 6px; padding: 6px 10px; border: 1px solid var(--line); background: var(--surface2); }',
  '.ovr-now.refused { border-color: color-mix(in srgb, var(--no) 40%, transparent); background: color-mix(in srgb, var(--no) 8%, var(--surface)); }',
  '.risk { color: var(--no); font-weight: 600; }',
  'p.risk { font-size: 13px; }',
  '.trig { margin: 4px 0; padding-left: 18px; font-size: 14px; }',
  '.sboard { display: grid; grid-template-columns: repeat(7, 196px); gap: 8px; overflow-x: auto; padding-bottom: 6px; }',
  '.sboard .col { background: var(--surface2); border: 1px solid var(--line); border-radius: 10px; padding: 8px; min-height: 120px; }',
  '.sboard .col h4 { font-family: var(--display); font-size: 13px; margin: 0 0 8px; }',
  '.card-s { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 8px 9px; margin-bottom: 6px; font-size: 13px; }',
  '.card-s.risk { border-color: var(--no); font-weight: 400; color: var(--ink); }',
  '.card-s p { margin: 4px 0; font-size: 12px; line-height: 1.35; } .card-s small { color: var(--muted); font-size: 12px; }',
  '.cs-h { font-weight: 600; } .cs-h span { font-weight: 500; }',
  '.cs-b { display: flex; gap: 4px; margin-top: 6px; } .cs-b .btn { padding: 2px 8px; font-size: 12px; }',
  '.owners { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }',
  '.owners > div { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font-size: 13px; }',
  '.owners ul { list-style: none; padding: 0; margin: 6px 0 0; } .owners li { margin-bottom: 4px; font-size: 13px; }',
  '.onb h4.mt, .logv h4.mt { margin: 20px 0 8px; } .onb h4, .logv h4 { font-family: var(--display); font-size: 14px; }',
  '.pl { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; margin-bottom: 6px; }',
  '.pl summary { cursor: pointer; font-weight: 600; font-size: 14px; } .pl .cmp { margin-top: 6px; }',
  '.pl .cmp th, .pl .cmp td { text-align: left; }',
  '.waitlist-ul { list-style: none; padding: 0; margin: 6px 0; } .waitlist-ul li { padding: 6px 0; border-bottom: 1px dashed var(--line); font-size: 14px; }',
  '.tscroll { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 4px 8px; }',
  '.cmp.lg td { text-align: left; vertical-align: top; } .cmp.lg td:nth-child(-n+3) { white-space: nowrap; }',
  '.kind { font-size: 12px; font-weight: 600; border: 1px solid var(--line); border-radius: 4px; padding: 0 6px; white-space: nowrap; }',
  '.kind.k-override { color: var(--accent); border-color: var(--accent); } .kind.k-what-if { color: var(--wait); border-color: var(--wait); }',
  '.gbar { height: 5px; border-radius: 3px; background: var(--surface2); border: 1px solid var(--line); margin-top: 6px; overflow: hidden; } .gbar i { display: block; height: 100%; background: var(--accent); } .gbar.ok i { background: var(--ok); } .gbar.late i { background: var(--no); }',
  '.gates td, .gates th { text-align: left; vertical-align: top; white-space: nowrap; font-size: 12px; } .gates td:first-child { white-space: normal; min-width: 150px; } .gates .g-ok { color: var(--ok); } .gates .g-late { color: var(--no); font-weight: 600; }',
  '@media (max-width: 1060px) { .owners { grid-template-columns: repeat(2, minmax(0, 1fr)); } }',
  '@media (max-width: 720px) { .owners { grid-template-columns: minmax(0, 1fr); } .sboard { grid-template-columns: repeat(7, 78vw); } }'
].join('\n');
document.head.appendChild(css);
})();
