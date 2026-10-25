// Data and fairness tab: which fields shape a decision and which never do, the override audit, where the data goes,
// and a descriptive look at outcomes by city tier and by preferred language (with a small-sample warning).
(function () {
'use strict';
var D = window.__desk, S = D.S, esc = D.esc, pill = D.pill;
var OUTS = ['Approve', 'Waitlist', 'Hold', 'Reject'], SMALL = 10;

// Kept in step with evaluateApp in src/engine.js: every field the form has, and exactly how it is used
var FIELDS = [
  ['Pin code and city', 'Yes', 'Territory and slot, one store per pin, pin-city mismatch, distance from existing stores (spacing points).'],
  ['Investment capacity', 'Yes', 'Compared with the minimum for the city tier: hold if slightly short, reject if far short; capital points.'],
  ['Space available, size, floor', 'Yes', 'Hold if no space, too small or upper floor; space points.'],
  ['Retail experience (years)', 'Score only', 'Experience points; first-timers get the extended training track.'],
  ['Current or past business', 'Score only', 'A retail background keeps full experience points (others get 85%); checked against the years given.'],
  ['Target launch', 'Score only', 'Timeline points and the onboarding plan.'],
  ['Notes from applicant', 'Yes', 'Checked for contradictions with the form (a hold) and for a pending loan (a data flag and a condition).'],
  ['Applicant name', 'Barely', 'Only to spot a possible duplicate application: a match costs 2.5 of the 10 data-confidence points and adds a condition. Never used otherwise.'],
  ['Preferred language', 'No', 'Only for the training language and the messages to the applicant.'],
  ['State', 'No', 'Not used.']
];

function groupTable(label, keyOf, groups) {
  var rows = groups.map(function (g) {
    var apps = S.apps.filter(function (a) { return !a.withdrawn && S.run.res[a.id] && keyOf(a) === g; });
    var c = {}; OUTS.forEach(function (o) { c[o] = apps.filter(function (a) { return S.run.res[a.id].outcome === o; }).length; });
    var n = apps.length;
    return '<tr><td>' + esc(g || 'Not given') + '</td><td>' + n + '</td>' + OUTS.map(function (o) { return '<td>' + c[o] + '</td>'; }).join('') +
      '<td>' + (n ? Math.round(100 * c.Approve / n) + '%' : '–') + (n && n < SMALL ? ' <small class="muted">too few to compare</small>' : '') + '</td></tr>';
  }).join('');
  return '<h4 class="mt">By ' + label + '</h4><div class="tscroll"><table class="cmp fr-t"><thead><tr><th>' + label.charAt(0).toUpperCase() + label.slice(1) + '</th><th>Applications</th>' + OUTS.map(function (o) { return '<th>' + pill(o, true) + '</th>'; }).join('') + '<th>Approval rate</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function tabHtml() {
  var res = S.run.res;
  var ovr = S.apps.filter(function (a) { return res[a.id] && res[a.id].override; });
  var audit = ovr.length ? '<ul class="fr-l">' + ovr.map(function (a) {
    var o = res[a.id].override; return '<li><b>' + esc(a.id) + '</b> ' + esc(a.name) + ': ' + (o.applied ? 'set to ' + esc(o.to) : 'override to ' + esc(o.to) + ' refused (' + esc(o.refused) + ')') + '. Reason given: ' + esc(o.reason || 'none') + '.</li>';
  }).join('') + '</ul><p class="muted sm">Every override, with its time, is also in the Decision log and the export.</p>' : '<p class="muted sm">No overrides in this session. Any override is logged with its reason and time in the Decision log and the export.</p>';
  var tiers = ['Tier 1', 'Tier 2', 'Tier 3', null], langs = ['Kannada', 'Hindi', 'English', ''];
  var tierOf = function (a) { var r = res[a.id]; return r && r.tier ? r.tier : null; };
  return '<div class="fr"><p class="muted sm">Which fields shape a decision, who changed what, where the data goes, and how outcomes split by group.</p>' +
    '<h4 class="mt">What shapes a decision</h4><div class="tscroll"><table class="cmp fr-t"><thead><tr><th>Field in the form</th><th>Can change the outcome?</th><th>How it is used</th></tr></thead><tbody>' +
      FIELDS.map(function (f) { return '<tr><td>' + esc(f[0]) + '</td><td>' + esc(f[1]) + '</td><td>' + esc(f[2]) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<p class="muted sm">The form collects nothing about gender, age, religion or caste, so none of it can enter a decision. The Site finder\'s crowd estimate is not used for decisions either; its overlap check only adds a flag and a suggestion.</p>' +
    '<h4 class="mt">Override audit</h4>' + audit +
    '<h4 class="mt">Where the data goes</h4><ul class="fr-l"><li>The uploaded workbook is read and decided inside this browser. It is not sent anywhere and is gone when the page is closed.</li>' +
      '<li>The only network requests are Site finder lookups for pins or places outside the built-in map. They send just that pin code or place name to this site\'s server and on to OpenStreetMap; no applicant details.</li>' +
      '<li>Exports and printed memos are created on this computer.</li></ul>' +
    '<h4 class="mt">Outcomes by group (descriptive only)</h4><p class="fr-warn">These counts describe this file; they do not show cause. Differences come from the inputs (investment, space, territory slots), since tier sets the investment minimum and language is never scored. Groups under ' + SMALL + ' applications are too small to compare.</p>' +
    groupTable('city tier', tierOf, tiers) + groupTable('preferred language', function (a) { return a.lang || ''; }, langs) + '</div>';
}
window.DeskExt.tabs.push({ id: 'fair', label: 'Data and fairness', render: tabHtml });

var css = document.createElement('style');
css.textContent = '.fr h3 { font-family: var(--display); font-size: 17px; font-weight: 800; } .fr h4.mt { font-family: var(--display); font-size: 15px; margin: 18px 0 6px; }' +
  ' .fr-t td, .fr-t th { text-align: left; vertical-align: top; } .fr-l { padding-left: 18px; font-size: 14px; } .fr-l li { margin-bottom: 4px; }' +
  ' .fr-warn { font-size: 13.5px; border-left: 3px solid var(--hold); background: var(--surface); padding: 6px 10px; border-radius: 4px; }';
document.head.appendChild(css);
})();
