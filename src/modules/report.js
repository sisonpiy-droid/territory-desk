// Extras 4 and 6: every question the expansion team must ask applicants, and a short weekly summary for management.
// Pure functions of the app state S; other modules (ops, plan, whatif) are used when loaded.
(function (root) {
'use strict';
var E = root.Engine || require('../engine.js');

/* ---------- questions to ask applicants ---------- */
function q(i, a, r, S) {
  var alt = (r.alternatives || []).map(function (p) { return p.pin; }).join(', ');
  switch (i.code) {
    case 'PIN_BAD': return 'What is the correct 6-digit pin code of the shop?';
    case 'PIN_MISMATCH': return 'Pin ' + a.pin + ' does not match ' + a.city + '. Which is right, the pin code or the city?';
    case 'CITY_UNKNOWN': return 'Which city is the shop in?';
    case 'PIN_HAS_STORE': return 'We already have a store in pin ' + a.pin + '. Can you find a space in another pin code' + (alt ? ' (open: ' + alt + ')' : '') + '?';
    case 'PIN_OUTSIDE': return 'Pin ' + a.pin + ' is outside our expansion areas. Can you find a space in one of them' + (alt ? ' (open: ' + alt + ')' : '') + '?';
    case 'INVEST_MISSING': return 'How much can you invest in total, in Rs lakh?';
    case 'INVEST_GAP': return 'Can you show Rs ' + i.need + ' lakh of funds, or bring in a co-investor? (you gave Rs ' + a.invest + ' lakh)';
    case 'NO_SPACE': return 'Have you found a shop space? If so: owned or rented, size in sq ft, and which floor.';
    case 'SIZE_MISSING': return 'What is the size of the space in sq ft?';
    case 'SIZE_SMALL': return 'Your space is ' + a.size + ' sq ft. Can you find one of at least ' + S.cfg.minSpace + ' sq ft?';
    case 'FLOOR_UPPER': return 'Is a ground-floor or mall space possible? Upper floors get too few customers.';
    case 'NOTES_CONFLICT': return 'Your form says the space is "' + (a.spaceRaw || a.space) + '", but your notes say "' + a.notes + '". Which is right?';
    case 'EXP_CONFLICT': return 'Please confirm your years of retail experience (the form says ' + a.exp + '; business: "' + a.biz + '").';
    case 'LOAN': return 'Has the loan been sanctioned? Please share the sanction letter.';
    case 'DUP_APPLICANT': return 'Is this your only application with us? Another application has the same name.';
    case 'LAUNCH_SOON': return 'Your target is ' + a.launch + ' month(s); the earliest realistic opening is about ' + r.feasible.toFixed(1) + ' months. Does that work?';
    case 'LANG_MISSING': return 'Which language would you like for training: Kannada, Hindi or English?';
  }
  return null;
}
function questions(S) {
  var out = [];
  S.apps.forEach(function (a) {
    var r = S.run.res[a.id]; if (a.withdrawn || !r || r.outcome === 'Reject') return;
    var list = [];
    r.issues.forEach(function (i) { var t = q(i, a, r, S); if (t) list.push({ text: t, why: i.title, blocks: i.level === 'hold' }); });
    if (r.outcome === 'Approve') {
      if (a.sizeAssumed) list.push({ text: 'Please confirm the size of the space in sq ft (it must be at least ' + S.cfg.minSpace + ').', why: 'Condition of approval', blocks: false });
      if (a.floor === 'Not known' && a.space !== 'Not yet identified') list.push({ text: 'Which floor is the space on?', why: 'Condition of approval', blocks: false });
    }
    list.sort(function (x, y) { return y.blocks - x.blocks; });
    if (list.length) out.push({ id: a.id, name: a.name, city: a.city, lang: a.lang || 'English', outcome: r.outcome, items: list });
  });
  return out;
}
function questionRows(S) {
  var rows = [['Application ID', 'Applicant', 'City', 'Decision now', 'Preferred language', '#', 'Question to ask', 'Why we ask', 'Holds up the decision']];
  questions(S).forEach(function (g) {
    g.items.forEach(function (it, k) { rows.push([k ? '' : g.id, k ? '' : g.name, k ? '' : g.city, k ? '' : g.outcome, k ? '' : g.lang, k + 1, it.text, it.why, it.blocks ? 'Yes' : 'No']); });
    rows.push([]);
  });
  return rows;
}

/* ---------- weekly summary for management ---------- */
function weekly(S, now, extra) {
  extra = extra || {};
  var res = S.run.res, live = S.apps.filter(function (a) { return !a.withdrawn && res[a.id]; });
  var c = { Approve: 0, Waitlist: 0, Hold: 0, Reject: 0 };
  live.forEach(function (a) { c[res[a.id].outcome]++; });
  var slots = 0, filled = 0; S.ters.forEach(function (t) { slots += t.slots; filled += Math.min(t.slots, S.run.approvedByTer[t.id] || 0); });
  var holdWhy = {}; live.forEach(function (a) { if (res[a.id].outcome === 'Hold') res[a.id].issues.forEach(function (i) { if (i.level === 'hold') holdWhy[i.title] = (holdWhy[i.title] || 0) + 1; }); });
  var topHold = Object.keys(holdWhy).sort(function (x, y) { return holdWhy[y] - holdWhy[x]; }).slice(0, 3);
  var pct = function (x, y) { return y ? Math.round(100 * x / y) + '%' : '–'; };
  var d = new Date(now), wk = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  var s = [];

  s.push({ h: 'This week', items: [
    live.length + ' applications decided' + (S.apps.length > live.length ? ' (' + (S.apps.length - live.length) + ' withdrawn)' : '') + ': ' + c.Approve + ' approved, ' + c.Waitlist + ' waitlisted, ' + c.Hold + ' on hold, ' + c.Reject + ' not taken forward.',
    filled + ' of ' + slots + ' territory slots filled (' + pct(filled, slots) + ').',
    topHold.length ? 'Main reasons for holds: ' + topHold.map(function (k) { return k.toLowerCase() + ' (' + holdWhy[k] + ')'; }).join(', ') + '.' : 'No applications on hold.'
  ] });

  var dec = [], under = [];
  if (extra.health) extra.health.forEach(function (t) {
    t.flags.forEach(function (f) {
      if (f.k === 'over') {
        var wait = live.filter(function (a) { var r = res[a.id]; return r.outcome === 'Waitlist' && r.waitReason === 'territory_full' && r.ter && r.ter.id === t.id; });
        if (wait.length) dec.push('Add a slot in ' + t.id + ' ' + t.city + '? ' + wait.map(function (a) { return a.id + ' (score ' + res[a.id].score + ')'; }).join(', ') + ' is eligible and waiting.');
      }
      if (f.k === 'under') {
        var m = f.text.match(/\((.*) could, once fixed\)/);
        under.push(t.id + ' ' + t.city + ' (' + t.open + (m ? '; ' + m[1] + ' could fill it once the hold is cleared' : '') + ')');
      }
    });
  });
  if (under.length) dec.push('Open slots with no eligible applicant on a free pin, so local outreach is needed: ' + under.join(', ') + '.');
  if (dec.length) s.push({ h: 'Decisions for management', items: dec });

  var watch = [];
  if (extra.plans) { var risk = extra.plans.filter(function (p) { return p.atRisk; }); if (risk.length) watch.push(risk.length + ' of ' + extra.plans.length + ' approved partners are at risk on their launch date: ' + risk.map(function (p) { return p.id + ' (' + p.risks[0].toLowerCase() + ')'; }).join('; ') + '.'); }
  if (extra.fragile) { var fr = Object.keys(extra.fragile); if (fr.length) watch.push(fr.length + ' decision' + (fr.length === 1 ? ' is' : 's are') + ' close to a threshold and would flip if it moved 10%: ' + fr.join(', ') + '. These get a second look before signing.'); }
  var ovr = live.filter(function (a) { return res[a.id].override && res[a.id].override.applied; });
  if (ovr.length) watch.push(ovr.length + ' decision' + (ovr.length === 1 ? ' was' : 's were') + ' overridden by the team: ' + ovr.map(function (a) { return a.id + ' (' + res[a.id].override.reason + ')'; }).join('; ') + '.');
  if (watch.length) s.push({ h: 'Watch', items: watch });

  var eff = [];
  if (extra.ba) eff.push('About ' + Math.round(extra.ba.savedHours * 10) / 10 + ' hours of screening saved on this file (' + Math.round(extra.ba.manualHours * 10) / 10 + ' by hand against ' + Math.round(extra.ba.deskHours * 10) / 10 + ' with the desk, using the minutes set on the Before and after panel).');
  if (extra.questions) eff.push(extra.questions + ' applicant' + (extra.questions === 1 ? '' : 's') + ' to contact for missing or contradictory details; the questions are drafted.');
  if (extra.log && (extra.log.overrides || extra.log.changes)) eff.push(extra.log.overrides + ' override' + (extra.log.overrides === 1 ? '' : 's') + ' and ' + extra.log.changes + ' update' + (extra.log.changes === 1 ? '' : 's') + ' from new information recorded in the decision log.');
  if (eff.length) s.push({ h: 'Team effort', items: eff });

  return { title: 'Franchise expansion: week of ' + wk, sections: s };
}
function asText(rep) {
  return rep.title + '\n\n' + rep.sections.map(function (s) { return s.h + '\n' + s.items.map(function (i) { return '- ' + i; }).join('\n'); }).join('\n\n');
}

var api = { questions: questions, questionRows: questionRows, weekly: weekly, asText: asText };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.DeskReport = api;
})(typeof window !== 'undefined' ? window : globalThis);
