// Reports tab: the question list for applicants (download), one-page decision memos (print), and the weekly summary.
// Logic in src/modules/report.js; memos also reuse the plan, trigger and confidence modules.
(function () {
'use strict';
var D = window.__desk, S = D.S, E = D.E, esc = D.esc, pill = D.pill, R = window.DeskReport;
var O = window.DeskOps, P = window.DeskPlan, TR = window.DeskTriggers, W = window.DeskWhatIf;
var LBL = { high: 'High', medium: 'Medium', low: 'Low' };

function fmt(d) { return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function appLink(id) { return '<button class="link" data-act="open-app" data-v="' + esc(id) + '">' + esc(id) + '</button>'; }
function langAttr(l) { return l === 'Hindi' ? 'hi' : l === 'Kannada' ? 'kn' : 'en'; }

/* ---------- weekly summary ---------- */
function weeklyReport() {
  var now = new Date(), log = S.log || [];
  return R.weekly(S, now, {
    health: O && O.territoryHealth(S), plans: P && P.plans(S, now), fragile: W && W.fragile(S),
    ba: O && O.beforeAfter(S, O.DEFAULT_TIME), questions: R.questions(S).length,
    log: { overrides: log.filter(function (e) { return e.kind === 'Override'; }).length, changes: log.filter(function (e) { return e.kind === 'New information' || e.kind === 'What-if'; }).length }
  });
}
function weeklyHtml(rep) {
  return '<h2 class="wk-t">' + esc(rep.title) + '</h2>' + rep.sections.map(function (s) {
    return '<h4>' + esc(s.h) + '</h4><ul>' + s.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
  }).join('');
}

/* ---------- decision memo ---------- */
function memoHtml(id, conf) {
  var a = D.getApp(id), r = S.run.res[id]; if (!a || !r) return '';
  var x = E.explain(r, a, { cfg: S.cfg, run: S.run }), c = conf && conf[id];
  var lang = a.lang || 'English', scored = r.outcome === 'Approve' || r.outcome === 'Waitlist';
  var facts = [['City and pin', a.city + ', ' + a.pin], ['Territory', r.ter ? r.ter.id + ' (' + r.ter.tier + ', ' + r.ter.priority + ' priority)' : 'none'],
    ['Score', (scored ? r.score + ' of 100' : 'not ranked (' + r.score + ' indicative)') + (r.override && r.override.applied ? '; decided by override' : '')],
    ['Confidence', c ? LBL[c.level] + ': ' + c.why.join('; ') : '–'], ['Investment', a.invest == null ? 'not given' : 'Rs ' + a.invest + ' lakh'],
    ['Space', a.space + (a.size != null ? ', ' + a.size + ' sq ft' : '') + ', ' + a.floor.toLowerCase()], ['Experience', a.exp == null ? 'not given' : a.exp + ' years; ' + (a.biz || 'business not given')]];
  var next = '';
  if (r.outcome === 'Approve' && P) {
    var p = P.plan(a, r, S.cfg, S.loadedAt || new Date(), (S.stages || {})[id] || 0, new Date());
    next = '<p>Sign by <b>' + fmt(p.latestSign) + '</b> to open on <b>' + fmt(p.open) + '</b>. ' + esc(p.basis) + (p.atRisk ? ' <b>At risk:</b> ' + esc(p.risks.join('; ')) + '.' : '') + '</p>' +
      '<table><thead><tr><th>Step</th><th>Owner</th><th>Due</th></tr></thead><tbody>' + p.steps.map(function (s) { return '<tr><td>' + esc(s.title) + '</td><td>' + esc(s.owner) + '</td><td>' + fmt(s.due) + '</td></tr>'; }).join('') + '</tbody></table>' +
      (r.conditions.length ? '<p><b>Conditions to clear before signing:</b> ' + esc(r.conditions.join('; ')) + '.</p>' : '');
  } else {
    var t = TR && TR.triggers(S)[id];
    next = (x.next.length ? '<ul>' + x.next.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' : '') +
      (t && t.events.length ? '<p><b>Decide again when:</b> ' + esc(t.events.join('; or ')) + (t.then ? '. Then: ' + esc(t.then) : '') + '.</p>' : '');
  }
  var qs = R.questions(S).filter(function (g) { return g.id === id; })[0];
  var msg = E.letter(r, a, lang, S.cfg), en = lang === 'English' ? '' : E.letter(r, a, 'English', S.cfg);
  return '<article class="memo"><header><span>Territory Desk · Decision memo</span><span>' + fmt(new Date()) + '</span></header>' +
    '<h1>' + esc(a.id) + ' ' + esc(a.name) + ' <span class="pill ' + { Approve: 'ok', Waitlist: 'wait', Hold: 'hold', Reject: 'no' }[r.outcome] + '">' + esc(r.outcome) + '</span></h1>' +
    '<p class="lead">' + esc(x.headline) + '.</p>' +
    '<dl>' + facts.map(function (f) { return '<dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd>'; }).join('') + '</dl>' +
    '<h3>Why</h3>' + x.lines.filter(function (l) { return !/^(Conditions to clear|Score [\d.]+ out of 100)/.test(l); }).map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') +
    (scored ? '<p class="parts"><b>Score:</b> ' + Object.keys(r.parts).map(function (k) { var pt = r.parts[k]; return esc(pt.label) + ' ' + (Math.round(pt.pts * 10) / 10) + '/' + pt.max + ' <span>(' + esc(pt.note) + ')</span>'; }).join(' · ') + '</p>' : '') +
    '<h3>' + (r.outcome === 'Approve' ? 'Onboarding plan' : 'Next steps') + '</h3>' + next +
    (qs ? '<h3>Questions to ask the applicant</h3><ol>' + qs.items.map(function (i) { return '<li>' + esc(i.text) + (i.blocks ? ' <b>(holds up the decision)</b>' : '') + '</li>'; }).join('') + '</ol>' : '') +
    '<h3>Message to the applicant (' + esc(lang) + ')</h3><p class="msg" lang="' + langAttr(lang) + '">' + esc(msg) + '</p>' + (en ? '<p class="msg en">' + esc(en) + '</p>' : '') +
    '<footer>Reviewed by ____________________ &nbsp; Date ____________ &nbsp; Decision confirmed / changed (reason): ______________________________</footer></article>';
}
function printHtml(html) {
  var box = document.getElementById('print-area');
  if (!box) { box = document.createElement('div'); box.id = 'print-area'; document.body.appendChild(box); }
  box.innerHTML = html;
  setTimeout(function () { window.print(); }, 50);
}
function printMemos(ids) { var conf = W ? W.confidence(S) : null; printHtml(ids.map(function (id) { return memoHtml(id, conf); }).join('')); }
window.addEventListener('afterprint', function () { var b = document.getElementById('print-area'); if (b) b.innerHTML = ''; });

/* ---------- question list download ---------- */
function downloadQuestions() {
  var wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(R.questionRows(S));
  ws['!cols'] = [12, 18, 14, 11, 12, 4, 80, 34, 10].map(function (w) { return { wch: w }; });
  XLSX.utils.book_append_sheet(wb, ws, 'Questions for applicants');
  XLSX.writeFile(wb, 'applicant-questions.xlsx');
}
window.DeskExt.exportSheets.push(function () { return { name: 'Questions for applicants', rows: R.questionRows(S) }; });

/* ---------- Reports tab ---------- */
function reportsHtml() {
  var qs = R.questions(S), nq = 0, nb = 0;
  qs.forEach(function (g) { nq += g.items.length; g.items.forEach(function (i) { if (i.blocks) nb++; }); });
  var ids = S.apps.filter(function (a) { return !a.withdrawn && S.run.res[a.id]; }).map(function (a) { return a.id; });
  var rep = weeklyReport();
  return '<div class="reps">' +
    '<section class="rcard"><div class="rh"><div><h3>Questions for applicants</h3><p class="muted sm">' + nq + ' question' + (nq === 1 ? '' : 's') + ' for ' + qs.length + ' applicant' + (qs.length === 1 ? '' : 's') + '; ' + nb + ' hold up a decision. One sheet, grouped by applicant.</p></div>' +
      '<button class="btn sm primary" data-act="rep-q">Download the list</button></div>' +
      '<ul class="qlist">' + qs.map(function (g) { return '<li>' + appLink(g.id) + ' ' + esc(g.name) + ' ' + pill(g.outcome, true) + ' <span class="muted sm">' + esc(g.lang) + '</span><ol>' + g.items.map(function (i) { return '<li' + (i.blocks ? ' class="blk"' : '') + '>' + esc(i.text) + '</li>'; }).join('') + '</ol></li>'; }).join('') + '</ul></section>' +
    '<section class="rcard"><div class="rh"><div><h3>Decision memos</h3><p class="muted sm">One printable page per applicant: decision, reason, score, next steps with owners and dates, questions, and the message in their language. Save as PDF from the print dialog.</p></div>' +
      '<div class="rb"><select id="memo-one" aria-label="Applicant">' + ids.map(function (id) { return '<option>' + esc(id) + '</option>'; }).join('') + '</select><button class="btn sm" data-act="rep-memo1">Print this memo</button><button class="btn sm primary" data-act="rep-memos">Print all ' + ids.length + '</button></div></div></section>' +
    '<section class="rcard"><div class="rh"><div><h3>Weekly summary for management</h3><p class="muted sm">Written from this file and the decision log. Copy it into an email or print it.</p></div>' +
      '<div class="rb"><button class="btn sm" data-act="rep-copy">Copy as text</button><button class="btn sm" data-act="rep-print">Print</button></div></div>' +
      '<div class="weekly">' + weeklyHtml(rep) + '</div></section></div>';
}
window.DeskExt.tabs.push({ id: 'reports', label: 'Reports', render: reportsHtml });

window.DeskExt.afterDetail.push({ group: 'message', fn: function (a) { return '<button class="btn sm" data-act="rep-memo" data-id="' + esc(a.id) + '">Print decision memo</button>'; } });

document.addEventListener('click', function (e) {
  var el = e.target.closest && e.target.closest('[data-act^="rep-"]'); if (!el) return;
  var act = el.getAttribute('data-act');
  if (act === 'rep-q') downloadQuestions();
  else if (act === 'rep-memo') printMemos([el.getAttribute('data-id')]);
  else if (act === 'rep-memo1') printMemos([document.getElementById('memo-one').value]);
  else if (act === 'rep-memos') printMemos(S.apps.filter(function (a) { return !a.withdrawn && S.run.res[a.id]; }).map(function (a) { return a.id; }));
  else if (act === 'rep-print') printHtml('<article class="memo">' + weeklyHtml(weeklyReport()) + '</article>');
  else if (act === 'rep-copy') {
    var txt = R.asText(weeklyReport()), label = el.textContent, done = function () { el.textContent = 'Copied'; setTimeout(function () { el.textContent = label; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, done); else done();
  }
});

var css = document.createElement('style');
css.textContent = [
  '.reps { display: flex; flex-direction: column; gap: 12px; }',
  '.rcard { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }',
  '.rh { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap; }',
  '.rh h3 { font-family: var(--display); font-size: 16px; font-weight: 800; }',
  '.rb { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; } .rb select { border: 1px solid var(--line); border-radius: 8px; padding: 5px 9px; background: var(--surface); }',
  '.qlist { list-style: none; padding: 0; margin: 10px 0 0; max-height: 420px; overflow-y: auto; }',
  '.qlist > li { padding: 7px 0; border-top: 1px dashed var(--line); font-size: 14px; } .qlist ol { margin: 4px 0 0; padding-left: 20px; color: var(--muted); font-size: 13.5px; } .qlist .blk { color: var(--ink); }',
  '.weekly { margin-top: 10px; font-size: 14.5px; } .weekly .wk-t { font-family: var(--display); font-size: 18px; font-weight: 800; margin-bottom: 6px; }',
  '.weekly h4 { font-family: var(--display); font-size: 14.5px; margin: 12px 0 4px; } .weekly ul { margin: 0; padding-left: 20px; } .weekly li { margin-bottom: 4px; }',
  '#print-area { display: none; }',
  '@media print {',
  '  body > *:not(#print-area) { display: none !important; } #print-area { display: block; } body { background: #fff; color: #111; font-size: 9.5pt; line-height: 1.38; }',
  '  .memo .parts span { color: #555; }',
  '  .memo { page-break-after: always; break-after: page; padding: 0; } .memo:last-child { page-break-after: auto; break-after: auto; }',
  '  .memo header { display: flex; justify-content: space-between; font-size: 9.5pt; color: #555; border-bottom: 1px solid #999; padding-bottom: 4px; margin-bottom: 10px; }',
  '  .memo h1 { font-family: var(--display); font-size: 15pt; margin: 0 0 2px; } .memo h1 .pill { font-size: 9pt; vertical-align: middle; }',
  '  .memo h2 { font-size: 14pt; } .memo h3, .memo h4 { font-size: 10.5pt; margin: 8px 0 3px; border-bottom: 1px solid #ddd; }',
  '  .memo p, .memo li { margin: 0 0 2px; } .memo .lead { font-weight: 600; } .memo ul, .memo ol { margin: 2px 0; padding-left: 18px; }',
  '  .memo dl { display: grid; grid-template-columns: 80px 1fr 80px 1fr; gap: 1px 10px; margin: 6px 0; } .memo dt { color: #555; } .memo dd { margin: 0; }',
  '  .memo table { border-collapse: collapse; width: 100%; font-size: 9pt; } .memo td, .memo th { border-bottom: 1px solid #ddd; padding: 1px 6px; text-align: left; }',
  "  .memo .msg { border: 1px solid #ccc; border-radius: 4px; padding: 5px 8px; } .memo .msg[lang=\"hi\"] { font-family: 'Noto Sans Devanagari', 'Nirmala UI', Mangal, sans-serif; } .memo .msg[lang=\"kn\"] { font-family: 'Noto Sans Kannada', 'Nirmala UI', Tunga, sans-serif; } .memo .msg.en { color: #555; font-size: 8.5pt; }",
  '  .memo footer { margin-top: 10px; font-size: 9pt; color: #333; }',
  '  @page { size: A4; margin: 14mm; }',
  '}'
].join('\n');
document.head.appendChild(css);
})();
