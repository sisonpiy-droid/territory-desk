// Backward planning for approved partners: from the target launch back to the latest signing date,
// with an owner and a due date for every step, and the stage each partner has reached.
// Pure functions; dates are passed in so tests are repeatable. Target launch is months from the upload date (anchor);
// overdue steps are judged against now.
(function (root) {
'use strict';
var DAY = 86400000, MONTH_DAYS = 30.44;
var STAGES = ['Approved', 'Documents verified', 'Agreement signed', 'Fit-out', 'Training', 'Ready to open', 'Open'];
var OWNERS = ['Expansion team', 'Partner', 'Training team', 'Fit-out vendor'];

// days before opening each step is due (based on the 10-week default; capped at the signing date when the lead time is shorter).
// done: the stage index at which the step counts as done
function stepList(a, cfg, firstTimer, lang) {
  var E = cfg.earliestWeeks, extra = a.space === 'Not yet identified' ? cfg.noSpaceExtraWeeks : 0;
  var sign = (E - 1 + extra) * 7;
  var cap = function (d) { return Math.min(d, sign); };
  return [
    { key: 'kyc', title: 'Verify KYC, proof of funds and space documents', owner: 'Expansion team', before: sign + 3, done: 1 },
    { key: 'sign', title: 'Sign the franchise agreement', owner: 'Partner', before: sign, done: 2 },
    { key: 'site', title: 'Site visit; layout and signage approved', owner: 'Expansion team', before: cap(sign - 7), done: 3 },
    { key: 'fitout', title: 'Fit-out complete', owner: 'Fit-out vendor', before: cap(28), done: 4 },
    { key: 'licence', title: 'Shop licence and GST registration in hand', owner: 'Partner', before: cap(28), done: 4 },
    { key: 'train', title: (firstTimer ? 'Extended 3-week' : 'Express 1-week') + ' training in ' + lang + ' complete', owner: 'Training team', before: cap(firstTimer ? 21 : 28), done: 5 },
    { key: 'pos', title: 'First stock delivered; billing and stock system live', owner: 'Expansion team', before: cap(14), done: 5 },
    { key: 'dry', title: 'Mock sales day with the area manager', owner: 'Training team', before: cap(7), done: 5 },
    { key: 'open', title: 'Store opens', owner: 'Partner', before: 0, done: 6 }
  ];
}

function day(d) { d = new Date(d); d.setHours(0, 0, 0, 0); return d.getTime(); }
function plan(a, r, cfg, anchor, stage, now) {
  stage = stage || 0;
  var t0 = day(anchor), tn = day(now || anchor), E = cfg.earliestWeeks, extra = a.space === 'Not yet identified' ? cfg.noSpaceExtraWeeks : 0;
  var earliest = t0 + (E + extra) * 7 * DAY;
  var target = a.launch == null ? null : t0 + Math.round(a.launch * MONTH_DAYS) * DAY;
  var open, basis, risks = [];
  if (target == null) { open = earliest; basis = 'No target given, so planned to the earliest realistic opening.'; }
  else if (target >= earliest) { open = target; basis = 'Planned back from the target of ' + a.launch + ' month' + (a.launch === 1 ? '' : 's') + '.'; }
  else {
    open = earliest; basis = 'Target of ' + a.launch + ' month' + (a.launch === 1 ? '' : 's') + ' is earlier than the earliest realistic opening, so planned to that instead.';
    risks.push('Target launch cannot be met');
  }
  var firstTimer = (a.exp || 0) < cfg.firstTimerYears;
  var steps = stepList(a, cfg, firstTimer, a.lang || 'English').map(function (s) {
    var due = open - s.before * DAY, done = stage >= s.done;
    return { key: s.key, title: s.title, owner: s.owner, due: new Date(due), done: done, overdue: !done && due < tn };
  });
  var signStep = steps.filter(function (s) { return s.key === 'sign'; })[0];
  var slack = Math.round((signStep.due.getTime() - (Math.max(t0, tn) + 7 * DAY)) / DAY);   // a week to verify documents before signing
  if (!signStep.done && slack < 0) risks.push('Less than a week left to verify and sign');
  var overdue = steps.filter(function (s) { return s.overdue; });
  if (overdue.length) risks.push(overdue.length + ' step' + (overdue.length > 1 ? 's' : '') + ' overdue');
  var next = steps.filter(function (s) { return !s.done; })[0] || null;
  return { id: a.id, open: new Date(open), target: target == null ? null : new Date(target), latestSign: signStep.due, slackDays: slack,
           basis: basis, steps: steps, next: next, stage: stage, atRisk: risks.length > 0, risks: risks, conditions: r.conditions };
}

function plans(S, now) {
  return S.apps.filter(function (a) { return !a.withdrawn && S.run.res[a.id] && S.run.res[a.id].outcome === 'Approve'; })
    .map(function (a) { return plan(a, S.run.res[a.id], S.cfg, S.loadedAt || now, (S.stages || {})[a.id] || 0, now); })
    .sort(function (p, q) { return (q.atRisk - p.atRisk) || (p.latestSign - q.latestSign) || (p.id < q.id ? -1 : 1); });
}

var api = { STAGES: STAGES, OWNERS: OWNERS, plan: plan, plans: plans };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.DeskPlan = api;
})(typeof window !== 'undefined' ? window : globalThis);
