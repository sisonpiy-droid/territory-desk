// Broader follow-ups in the Ask box: typos, other ways of naming IDs, several changes in one sentence,
// "Would ... if ...?" previews, and an "I read this as ..." check before anything uncertain is applied.
// Text handling is in src/modules/understand.js; every change goes through the same functions as the Ask box (ui.js).
(function () {
'use strict';
var D = window.__desk, S = D.S, E = D.E, esc = D.esc, pill = D.pill, U = window.DeskUnderstand;
var busy = false, pending = {}, seq = 0;
var QUESTION = /^(why|how|who|which|list|show|explain|compare|tell|give|is|are|does|do|summar|what(?!\s+if)|whats|status|reason)/i;
var INFO_CUE = /\b(now|found|has|have|got|just|updated?|changed?|secured|signed|withdr\w*|moved|rented|bought|raised|can|will)\b/i;

function appLink(id) { return '<button class="link" data-act="open-app" data-v="' + esc(id) + '">' + esc(id) + '</button>'; }
function mentionsId(t) { return /\b(APP|TER)-\d+/i.test(t); }

/* ---------- turning a clause into a planned change ---------- */
function planFor(clause) {
  var low = clause.toLowerCase(), tids = D.findTers(clause), ids = D.findIds(clause);
  if (tids.length && !/\bAPP-\d/i.test(clause)) {
    var tf = D.parseTerritoryChange(low), t = S.ters.filter(function (x) { return x.id === tids[0]; })[0];
    if (!t) return { clause: clause, problem: 'I cannot find ' + tids[0] + ' in this file.' };
    if (tf.slots === undefined && !tf.priority) return null;
    return { clause: clause, kind: 'ter', id: t.id, tf: tf, checks: [] };
  }
  if (!ids.length) return null;
  var a = D.getApp(ids[0]);
  if (!a) return { clause: clause, problem: 'I cannot find ' + ids[0] + ' in this file.' };
  var f = D.parseFields(low), rel = U.relativeInvest(clause);
  if (rel != null) f.invest = Math.round(((a.invest || 0) + rel) * 100) / 100;
  if (!Object.keys(f).length) return null;
  var p = { clause: clause, kind: 'app', id: a.id, f: f, rel: rel, checks: [] };
  if (!/\bAPP-\d/i.test(clause)) p.checks.push('No ID was given, so I matched the name to ' + a.id + ' ' + a.name + (ids.length > 1 ? ' (also possible: ' + ids.slice(1).join(', ') + ')' : '') + '.');
  if (f.invest !== undefined && (f.invest > 200 || f.invest <= 0)) p.checks.push('Rs ' + f.invest + ' lakh is unusual for one store; is the figure right?');
  if (f.size !== undefined && (f.size < 100 || f.size > 3000)) p.checks.push(f.size + ' sq ft is unusual for a store; is the size right?');
  if (f.launch !== undefined && f.launch > 36) p.checks.push('A target launch of ' + f.launch + ' months is unusual; is it right?');
  if (f.exp !== undefined && f.exp > 45) p.checks.push(f.exp + ' years of experience is unusual; is it right?');
  if (f.pin) { var c = E.CITIES[a.city]; if (c && f.pin.indexOf(c.prefix) !== 0) p.checks.push('Pin ' + f.pin + ' is not in ' + a.city + ' (pins there start with ' + c.prefix + ').'); }
  if (/ground/.test(low) && /(first|1st|second|2nd|upper|terrace)\s+floor/.test(low)) p.checks.push('Both a ground floor and an upper floor are mentioned; I took ground floor.');
  return p;
}
function describe(p) {
  if (p.kind === 'ter') {
    var t = S.ters.filter(function (x) { return x.id === p.id; })[0], bits = [];
    if (p.tf.slots !== undefined) bits.push('open slots ' + t.slots + ' to ' + (p.tf.add ? t.slots + p.tf.slots : p.tf.slots));
    if (p.tf.priority) bits.push('priority ' + t.priority + ' to ' + p.tf.priority);
    return '<b>' + esc(p.id) + '</b>: ' + esc(bits.join(', '));
  }
  var f = p.f, a = D.getApp(p.id), b = [];
  if (f.withdraw) b.push('has withdrawn');
  if (f.spaceFound) b.push('has found ' + (f.space ? 'an ' + f.space.toLowerCase() : 'a') + ' space');
  if (f.size !== undefined) b.push(f.size + ' sq ft');
  if (f.floor) b.push(f.floor === 'Mall unit' ? 'in a mall' : f.floor.toLowerCase() + ' floor');
  if (f.invest !== undefined) b.push('investment Rs ' + f.invest + ' lakh' + (p.rel != null ? ' (Rs ' + (a.invest || 0) + ' + ' + p.rel + ')' : ''));
  if (f.exp !== undefined) b.push(f.exp + ' years of retail experience');
  if (f.launch !== undefined) b.push('target launch ' + f.launch + ' months');
  if (f.pin) b.push('pin ' + f.pin);
  if (f.lang) b.push('prefers ' + f.lang);
  return '<b>' + esc(p.id) + '</b> ' + esc(a.name) + ': ' + esc(b.join(', '));
}
function applyTo(plans, apps, ters) {
  plans.forEach(function (p) {
    if (p.kind === 'app') { var a = apps.filter(function (x) { return x.id === p.id; })[0]; if (a) D.applyAppFields(a, JSON.parse(JSON.stringify(p.f))); }
    else { var t = ters.filter(function (x) { return x.id === p.id; })[0]; if (t) { if (p.tf.slots !== undefined) t.slots = p.tf.add ? t.slots + p.tf.slots : p.tf.slots; if (p.tf.priority) t.priority = p.tf.priority; } }
  });
}

/* ---------- applying, previewing, confirming ---------- */
function apply(plans, text, kind) {
  var lines = plans.map(describe);   // before the change, so "from" values are the old ones
  D.pushUndo();
  applyTo(plans, S.apps, S.ters);
  S.cause = { kind: kind || 'New information', text: text };
  var diff = D.recompute(); S.cause = null;
  D.rerender();
  var appIds = plans.filter(function (p) { return p.kind === 'app'; }).map(function (p) { return p.id; });
  return '<p class="ap">' + (plans.length > 1 ? 'Recorded ' + plans.length + ' changes:' : 'Recorded:') + '</p><ol class="rd">' + lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ol>' +
    '<p><b>What changed</b></p>' + D.diffHtml(diff) + (appIds.length === 1 ? D.explainCard(appIds[0]) : '') + '<p class="nx">Undo reverses all of this in one step.</p>';
}
function preview(plans) {
  var apps = E.clone(S.apps), ters = E.clone(S.ters), keepLang = E.clone(S.letterLang);
  applyTo(plans, apps, ters);
  S.letterLang = keepLang;
  var r2 = E.run(apps, ters, E.STORES, S.cfg), moves = [];
  apps.forEach(function (a) {
    var now = r2.res[a.id] ? r2.res[a.id].outcome : 'Withdrawn';
    if (S.run.res[a.id] && S.run.res[a.id].outcome !== now) moves.push({ id: a.id, from: S.run.res[a.id].outcome, to: now });
  });
  var k = remember(plans, 'Applied from a question: ' + plans.map(function (p) { return p.clause; }).join('; '), 'What-if');
  return '<p class="ap">If that happened:</p><ol class="rd">' + plans.map(function (p) { return '<li>' + describe(p) + '</li>'; }).join('') + '</ol>' +
    (moves.length ? '<ul class="diff">' + moves.map(function (m) { return '<li>' + appLink(m.id) + ' would move ' + pill(m.from, true) + ' to ' + pill(m.to, true) + '</li>'; }).join('') + '</ul>' : '<p>No decision would change.</p>') +
    '<p class="nx">Nothing has changed yet.</p>' + buttons(k, 'Apply it', 'Leave it');
}
function remember(plans, text, kind) { var k = 'u' + (++seq); pending[k] = { plans: plans, text: text, kind: kind }; return k; }
function buttons(k, yes, no) { return '<div class="rd-b"><button class="btn sm primary" data-act="und-yes" data-k="' + k + '">' + yes + '</button><button class="btn sm" data-act="und-no" data-k="' + k + '">' + no + '</button></div>'; }
function confirmCard(plans, n, text) {
  var checks = []; plans.forEach(function (p) { (p.checks || []).forEach(function (c) { checks.push(c); }); });
  var k = remember(plans, text, 'New information');
  return '<p class="ap">I read this as:</p><ol class="rd">' + plans.map(function (p) { return '<li>' + describe(p) + '</li>'; }).join('') + '</ol>' +
    (n.fixes.length ? '<p class="nx">Spelling read as: ' + n.fixes.map(function (f) { return '“' + esc(f[0]) + '” as “' + esc(f[1]) + '”'; }).join(', ') + '.</p>' : '') +
    checks.map(function (c) { return '<p class="nx">' + esc(c) + '</p>'; }).join('') +
    '<p>Is that right? Nothing has changed yet.</p>' + buttons(k, 'Yes, apply', 'No');
}
function readAs(n, html) { return '<p class="nx">I read this as “' + esc(n.text) + '”.</p>' + html; }

/* ---------- the answerer, tried before the standard one ---------- */
window.DeskExt.answerers.unshift(function (text) {
  if (busy || !S.run) return null;
  var n = U.normalize(text), t = n.text, low = t.toLowerCase().trim();
  if (/^(undo|revert)\b/.test(low)) return null;
  var changed = t !== text;
  var hyp = U.isHypothetical(t);
  var asks = QUESTION.test(low) && !hyp;
  var plans = [], problems = [];
  if (!asks || hyp) U.split(t).forEach(function (c) { var p = planFor(c); if (!p) return; if (p.problem) problems.push(p.problem); else plans.push(p); });

  if (hyp && plans.length) return (n.fixes.length ? '<p class="nx">I read this as “' + esc(t) + '”.</p>' : '') + preview(plans);
  if (problems.length && !plans.length && mentionsId(t)) return '<p>' + problems.map(esc).join(' ') + '</p>';
  var uncertain = n.fixes.length || problems.length || plans.some(function (p) { return p.checks.length; });
  if (plans.length >= 2 || (plans.length === 1 && (uncertain || plans[0].rel != null))) {
    if (problems.length) plans.forEach(function (p) { p.checks = (p.checks || []).concat(problems); });
    return uncertain ? confirmCard(plans, n, text) : apply(plans, text, /\bwhat if\b/i.test(t) ? 'What-if' : 'New information');
  }
  // nothing to change but the wording was cleaned up: answer the cleaned-up text
  if (changed && !plans.length) {
    if (!asks && mentionsId(t) && INFO_CUE.test(low) && !/\?$/.test(low)) return noFields(t);
    busy = true; try { return readAs(n, D.answer(t)); } finally { busy = false; }
  }
  if (changed && plans.length === 1) { busy = true; try { return D.answer(t); } finally { busy = false; } }   // e.g. "application 12 found a shop"
  // an ID and news, but nothing the desk can record
  if (!plans.length && !asks && mentionsId(t) && INFO_CUE.test(low) && !/\?$/.test(low) && !/\b(what if|override|anyway|approve|reject|waitlist|hold|remove|undo)\b/.test(low)) return noFields(t);
  return null;
});
function noFields(t) {
  var id = (D.findIds(t)[0] || D.findTers(t)[0] || '');
  return '<p>I could not tell what changed' + (id ? ' for <b>' + esc(id) + '</b>' : '') + ', so nothing was updated.</p><p class="nx">I can record a space (size and floor), investment, years of experience, target launch, pin code, preferred language, a withdrawal, or a territory\'s open slots and priority. For example: “' + esc(id || 'APP-012') + ' has found a 400 sq ft ground-floor shop”.</p>';
}

document.addEventListener('click', function (e) {
  var el = e.target.closest && e.target.closest('[data-act="und-yes"],[data-act="und-no"]'); if (!el) return;
  var k = el.getAttribute('data-k'), p = pending[k];
  if (!p) return;
  delete pending[k];
  var html = el.getAttribute('data-act') === 'und-yes' ? apply(p.plans, p.text, p.kind) : '<p>Okay, nothing changed.</p>';
  S.askLog.push({ who: 'desk', html: html });
  D.rerender();
});

var css = document.createElement('style');
css.textContent = '.rd { margin: 4px 0 6px; padding-left: 20px; font-size: 14px; } .rd li { margin-bottom: 2px; } .rd-b { display: flex; gap: 6px; margin-top: 6px; }';
document.head.appendChild(css);
})();
