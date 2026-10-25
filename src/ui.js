(function () {
'use strict';
var E = window.Engine, SD = window.SampleData;
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
var OUT = ['Approve', 'Waitlist', 'Hold', 'Reject'];
var OUT_CLASS = { Approve: 'ok', Waitlist: 'wait', Hold: 'hold', Reject: 'no', Withdrawn: 'gone' };

// Extension points so new features can live in their own files (src/modules/*.js load before this file, src/ext/*.js after it)
window.DeskExt = window.DeskExt || {};
['afterSummary', 'tabs', 'afterRender', 'answerers', 'afterDetail', 'afterRecompute', 'exportSheets', 'rowBadges', 'boardTerritory'].forEach(function (k) { window.DeskExt[k] = window.DeskExt[k] || []; });
function extHtml() {
  return window.DeskExt.afterSummary.map(function (fn) { try { return fn(S) || ''; } catch (e) { return '<p class="muted pad">A section failed to load: ' + esc(e.message) + '</p>'; } }).join('');
}
function extTab(id) { return window.DeskExt.tabs.filter(function (t) { return t.id === id; })[0]; }

var S = {
  apps: [], ters: [], cfg: E.clone(E.DEFAULT_CFG), run: null, prevSnap: null, changed: {},
  notices: [], tab: 'decisions', filter: 'all', q: '', open: {}, letterLang: {}, undo: [], label: '',
  exampleApp: null, exampleTer: null, askLog: []
};

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */
function load(appsAoA, tersAoA, label) {
  var apps = E.parseApplications(appsAoA), ters = E.parseTerritories(tersAoA), notices = [];
  S.exampleApp = null; S.exampleTer = null;

  var ex = apps.filter(function (a) { return a.templateExample; })[0];
  if (ex) {
    var twin = apps.filter(function (a) { return a !== ex && a.id.indexOf('APP-001#') === 0; })[0];
    if (twin) {
      apps = apps.filter(function (a) { return a !== ex; }); twin.id = 'APP-001';
      notices.push('Row ' + ex.row + ' was the grey template example (APP-001, Ravi Kumar), so it was left out; the real APP-001 was kept.');
    } else {
      S.exampleApp = ex;
      notices.push('Row ' + ex.row + ' looks like the grey template example (APP-001, Ravi Kumar). It is included as an applicant. <button class="link" data-act="drop-example-app">Leave it out</button>');
    }
  }
  var et = ters.filter(function (t) { return t.templateExample; })[0];
  if (et) {
    var twinT = ters.filter(function (t) { return t !== et && t.id === 'TER-01'; })[0];
    if (twinT) { ters = ters.filter(function (t) { return t !== et; }); notices.push('The template example territory (TER-01, row ' + et.row + ') was left out because the file defines its own TER-01.'); }
    else { S.exampleTer = et; notices.push('Row ' + et.row + ' of Territories looks like the grey template example (TER-01). It is included. <button class="link" data-act="drop-example-ter">Leave it out</button>'); }
  }
  var seenTid = {}; ters.forEach(function (t) { seenTid[t.id] = (seenTid[t.id] || 0) + 1; });
  Object.keys(seenTid).forEach(function (k) { if (seenTid[k] > 1) notices.push('Territory ID ' + esc(k) + ' appears ' + seenTid[k] + ' times; each row is treated as its own territory.'); });
  var tmp = E.run(apps, ters, E.STORES, S.cfg);
  if (tmp.ctx.dupPins.length) notices.push('Pin code' + (tmp.ctx.dupPins.length > 1 ? 's ' : ' ') + tmp.ctx.dupPins.join(', ') + ' appear in more than one territory; the first territory listed owns it.');
  var dupIds = apps.filter(function (a) { return a.id.indexOf('#') > 0; });
  if (dupIds.length) notices.push('Duplicate application IDs were renamed: ' + dupIds.map(function (a) { return esc(a.id); }).join(', ') + '.');

  S.apps = apps; S.ters = ters; S.notices = notices; S.cfg = E.clone(E.DEFAULT_CFG);
  S.undo = []; S.changed = {}; S.open = {}; S.prevSnap = null; S.askLog = []; S.label = label || '';
  S.initial = E.clone({ apps: apps, ters: ters });
  recompute(true);
  S.tab = 'decisions'; S.filter = 'all'; S.q = ''; S.filterIds = null;
  render();
}

function recompute(first) {
  var before = S.run ? snapshot() : null;
  S.run = E.run(S.apps, S.ters, E.STORES, S.cfg);
  var after = snapshot();
  var diff = [];
  if (before && !first) {
    Object.keys(after).forEach(function (id) {
      var b = before[id], a = after[id];
      if (!b) diff.push({ id: id, from: 'New', to: a.outcome });
      else if (b.outcome !== a.outcome) diff.push({ id: id, from: b.outcome, to: a.outcome });
      else if (a.outcome === 'Approve' && b.pin !== a.pin) diff.push({ id: id, from: 'Approve', to: 'Approve', note: 'pin ' + b.pin + ' to ' + a.pin });
    });
    Object.keys(before).forEach(function (id) { if (!after[id]) diff.push({ id: id, from: before[id].outcome, to: 'Withdrawn' }); });
  }
  S.changed = {};
  diff.forEach(function (d) { S.changed[d.id] = d.from; });
  // S.cause says what triggered this ({ kind, text }); set by whoever changed the data
  window.DeskExt.afterRecompute.forEach(function (fn) { try { fn(diff, !!first || !before, S.cause || null); } catch (e) { console.error(e); } });
  return diff;
}
function snapshot() {
  var m = {};
  S.apps.forEach(function (a) {
    var r = S.run.res[a.id];
    m[a.id] = { outcome: a.withdrawn ? 'Withdrawn' : (r ? r.outcome : 'Hold'), pin: a.pin, score: r ? r.score : 0 };
  });
  return m;
}
function getApp(id) { return S.apps.filter(function (a) { return a.id === id; })[0]; }
function pill(o, small) { return '<span class="pill ' + OUT_CLASS[o] + (small ? ' sm' : '') + '">' + esc(o) + '</span>'; }
function fmtDate(d) { return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function addWeeks(w) { var d = new Date(); d.setDate(d.getDate() + w * 7); return d; }

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */
function render() {
  var root = $('#app');
  if (!S.run) { root.innerHTML = emptyState(); return; }
  root.innerHTML =
    '<section class="workspace">' +
      '<div class="primary">' + summaryHtml() + noticesHtml() + extHtml() + tabsHtml() + '<div id="tabbody">' + tabBody() + '</div></div>' +
      '<aside class="ask" id="ask">' + askHtml() + '</aside>' +
    '</section>';
  scrollAskToEnd();
  window.DeskExt.afterRender.forEach(function (fn) { try { fn(S); } catch (e) { console.error(e); } });
}

function emptyState() {
  return '<section class="empty">' +
    '<h1>Every franchise application, decided and explained.</h1>' +
    '<p class="lede">Upload the Applications and Territories workbook. Each partner gets an outcome, the reason, what to do next and a training plan. Pin codes are protected so the brand never opens two stores in one.</p>' +
    '<div class="drop" id="drop"><strong>Drop the .xlsx here</strong><span>or</span>' +
      '<label class="btn primary">Choose a file<input type="file" id="file2" accept=".xlsx,.xls" hidden></label>' +
      '<button class="btn" data-act="sample">Try the sample data</button></div>' +
    '<p class="fine">Nothing is uploaded anywhere: the workbook is read and decided inside your browser. <button class="link" data-act="dl-sample">Download a sample workbook</button> to see the expected layout.</p>' +
  '</section>';
}

function summaryHtml() {
  var counts = { Approve: 0, Waitlist: 0, Hold: 0, Reject: 0 }, gone = 0;
  S.apps.forEach(function (a) { if (a.withdrawn) { gone++; return; } var r = S.run.res[a.id]; if (r) counts[r.outcome]++; });
  var total = counts.Approve + counts.Waitlist + counts.Hold + counts.Reject;
  var slots = 0, filled = 0;
  S.ters.forEach(function (t) { slots += t.slots; filled += Math.min(t.slots, S.run.approvedByTer[t.id] || 0); });
  var locked = 0; S.ters.forEach(function (t) { t.pins.forEach(function (p) { if (S.run.ctx.storeByPin[p]) locked++; }); });
  var bar = OUT.map(function (o) { return counts[o] ? '<i class="seg ' + OUT_CLASS[o] + '" style="flex:' + counts[o] + '" title="' + o + ' ' + counts[o] + '"></i>' : ''; }).join('');
  var legend = OUT.map(function (o) {
    return '<button class="leg" data-act="filter" data-v="' + o + '"><span class="dot ' + OUT_CLASS[o] + '"></span><b>' + counts[o] + '</b> ' + { Approve: 'approved', Waitlist: 'waitlisted', Hold: 'on hold', Reject: 'rejected' }[o] + '</button>';
  }).join('');
  return '<div class="summary">' +
    '<div class="sum-top"><h2>' + total + ' applications' + (S.label ? ' <span class="muted">from ' + esc(S.label) + '</span>' : '') + '</h2>' +
    '<div class="sum-meta">' + filled + ' of ' + slots + ' territory slots filled. ' + locked + ' pin codes locked by existing stores.' + (gone ? ' ' + gone + ' withdrawn.' : '') + '</div></div>' +
    '<div class="bar" role="img" aria-label="Outcome split">' + bar + '</div><div class="legend">' + legend + '</div></div>';
}

function noticesHtml() {
  if (!S.notices.length) return '';
  return '<div class="notices">' + S.notices.map(function (n) { return '<p>' + n + '</p>'; }).join('') + '</div>';
}

function tabsHtml() {
  var t = [['decisions', 'Decisions'], ['board', 'Pin board'], ['assume', 'Assumptions']].concat(window.DeskExt.tabs.map(function (x) { return [x.id, x.label]; }));
  return '<div class="tabs" role="tablist">' + t.map(function (x) {
    return '<button role="tab" class="tab' + (S.tab === x[0] ? ' on' : '') + '" aria-selected="' + (S.tab === x[0]) + '" data-act="tab" data-v="' + x[0] + '">' + x[1] + '</button>';
  }).join('') + '<span class="grow"></span><button class="btn sm" data-act="export">Export decisions</button></div>';
}

function tabBody() {
  var xt = extTab(S.tab); if (xt) return xt.render(S);
  if (S.tab === 'board') return boardHtml();
  if (S.tab === 'assume') return assumeHtml();
  return decisionsHtml();
}

/* ---------- Decisions ---------- */
function decisionsHtml() {
  var q = S.q.trim().toLowerCase();
  var chips = ['all'].concat(OUT).map(function (o) {
    return '<button class="chip' + (S.filter === o ? ' on' : '') + '" data-act="filter" data-v="' + o + '">' + (o === 'all' ? 'All' : o) + '</button>';
  }).join('');
  var rows = S.apps.filter(function (a) {
    var r = S.run.res[a.id], o = a.withdrawn ? 'Withdrawn' : r.outcome;
    if (S.filterIds && S.filterIds.indexOf(a.id) < 0) return false;
    if (S.filter !== 'all' && o !== S.filter) return false;
    if (q && (a.id + ' ' + a.name + ' ' + a.pin + ' ' + a.city).toLowerCase().indexOf(q) < 0) return false;
    return true;
  }).map(rowHtml).join('');
  var only = S.filterIds ? '<p class="only">Showing ' + esc(S.filterLabel || 'a selection') + ' (' + S.filterIds.length + '). <button class="link" data-act="clear-ids">Show all</button></p>' : '';
  return only + '<div class="toolbar"><div class="chips">' + chips + '</div>' +
    '<input id="q" class="search" type="search" placeholder="Search ID, name, pin, city" value="' + esc(S.q) + '" aria-label="Search applications"></div>' +
    '<div class="rows">' + (rows || '<p class="muted pad">No applications match.</p>') + '</div>';
}

function rowHtml(a) {
  var r = S.run.res[a.id];
  if (a.withdrawn) {
    return '<article class="row gone"><div class="row-h"><span class="rid">' + esc(a.id) + '</span><span class="rname">' + esc(a.name) + '</span>' + pill('Withdrawn') + '<span class="rwhy muted">Withdrawn by applicant</span></div></article>';
  }
  var x = E.explain(r, a, { cfg: S.cfg, run: S.run });
  var open = !!S.open[a.id];
  var was = S.changed[a.id] ? '<span class="was">was ' + esc(S.changed[a.id]) + '</span>' : '';
  var score = (r.outcome === 'Approve' || r.outcome === 'Waitlist') ? '<span class="score">' + r.score + '</span>' : '<span class="score off">–</span>';
  return '<article class="row' + (open ? ' open' : '') + '" id="row-' + esc(a.id) + '">' +
    '<button class="row-h" data-act="toggle" data-v="' + esc(a.id) + '" aria-expanded="' + open + '">' +
      '<span class="rid">' + esc(a.id) + '</span>' +
      '<span class="rname">' + esc(a.name) + '<small>' + esc(a.city) + ', ' + esc(a.pin) + '</small></span>' +
      '<span class="rout">' + pill(r.outcome) + was + window.DeskExt.rowBadges.map(function (fn) { try { return fn(a, r, S) || ''; } catch (e) { return ''; } }).join('') + '</span>' + score +
      '<span class="rwhy">' + esc(x.short || x.headline) + '</span>' +
      '<span class="chev" aria-hidden="true"></span></button>' +
    (open ? detailHtml(a, r, x) : '') + '</article>';
}

function detailHtml(a, r, x) {
  var lang = S.letterLang[a.id] || a.lang || 'English';
  var why = x.lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('');
  var next = x.next.length ? '<h4>' + (r.outcome === 'Hold' ? 'What would change this' : r.outcome === 'Waitlist' ? 'What would move this up' : 'Next') + '</h4>' + x.next.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') : '';
  var plan = '';
  if (r.outcome === 'Approve') {
    var p = E.onboardingPlan(r, a, { cfg: S.cfg, run: S.run });
    plan = '<h4>Onboarding plan</h4><p class="muted">' + esc(p.track) + ' training in ' + esc(p.language) + ', shadowing at ' + esc(p.mentor.id) + ' (' + esc(p.mentor.city) + '). Realistic opening ' + fmtDate(addWeeks(p.openWeeks)) + ' if signed this week. ' + esc(p.targetNote) + '</p>' +
      '<ol class="tl">' + p.steps.map(function (s) { return '<li><b>' + esc(s.wk) + '</b> ' + esc(s.title) + '<span>' + esc(s.detail) + '</span></li>'; }).join('') + '</ol>' +
      (p.conditions.length ? '<p class="cond"><b>Conditions to clear:</b> ' + p.conditions.map(esc).join('; ') + '.</p>' : '');
  }
  var bars = Object.keys(r.parts).map(function (k) {
    var p = r.parts[k], w = p.max ? Math.round(100 * p.pts / p.max) : 0;
    return '<div class="bp"><div class="bp-l"><span>' + esc(p.label) + '</span><b>' + (Math.round(p.pts * 10) / 10) + '<small>/' + p.max + '</small></b></div><div class="track"><i style="width:' + w + '%"></i></div><small class="muted">' + esc(p.note) + '</small></div>';
  }).join('');
  var flags = r.issues.length ? r.issues.map(function (i) {
    return '<li class="fl ' + i.level + '"><span class="fdot"></span><span><b>' + esc(i.title) + '.</b> ' + esc(i.detail) + '</span></li>';
  }).join('') : '<li class="fl clean"><span class="fdot"></span><span>No data problems found.</span></li>';
  var msg = E.letter(r, a, lang, S.cfg);
  var langs = [['English', 'EN'], ['Hindi', 'हिं'], ['Kannada', 'ಕನ್ನಡ']].map(function (l) {
    return '<button class="seg-b' + (lang === l[0] ? ' on' : '') + '" data-act="lang" data-id="' + esc(a.id) + '" data-v="' + l[0] + '">' + l[1] + '</button>';
  }).join('');
  var rec = [['Investment', a.invest === null ? 'not given' : 'Rs ' + a.invest + ' lakh'], ['Experience', a.exp === null ? 'not given' : a.exp + ' yrs'], ['Business', a.biz || 'not given'],
    ['Space', a.space + (a.size !== null ? ', ' + a.size + ' sq ft' : '') + ', ' + a.floor.toLowerCase()], ['Target launch', a.launch === null ? 'not given' : a.launch + ' months'], ['Training language', a.lang || 'not given'], ['Notes', a.notes || 'none']]
    .map(function (z) { return '<dt>' + z[0] + '</dt><dd>' + esc(z[1]) + '</dd>'; }).join('');
  var ext = window.DeskExt.afterDetail.map(function (fn) { try { return fn(a, r, S) || ''; } catch (e) { return ''; } }).join('');
  return '<div class="detail"><div class="dcol"><h4>Why</h4>' + why + next + plan + ext + '</div>' +
    '<div class="dcol"><h4>' + (r.outcome === 'Hold' || r.outcome === 'Reject' ? 'Indicative score (not ranked)' : 'Score out of 100') + '</h4>' + bars +
    '<h4>Data flags</h4><ul class="flags">' + flags + '</ul>' +
    '<h4>Message to the applicant</h4><div class="seg-g">' + langs + '</div><p class="letter" lang="' + (lang === 'Hindi' ? 'hi' : lang === 'Kannada' ? 'kn' : 'en') + '">' + esc(msg) + '</p>' +
    '<button class="btn sm" data-act="copy" data-id="' + esc(a.id) + '">Copy message</button>' +
    '<h4>What was submitted</h4><dl class="rec">' + rec + '</dl></div></div>';
}

/* ---------- Pin board ---------- */
function boardHtml() {
  var run = S.run, parts = [];
  var legend = '<div class="b-legend"><span><i class="tile t-store"></i>Existing store, pin locked</span><span><i class="tile t-ok"></i>Approved</span><span><i class="tile t-wait"></i>Eligible applicants queued</span><span><i class="tile t-hold"></i>On hold, targeting this pin</span><span><i class="tile t-open"></i>Open</span></div>';
  S.ters.forEach(function (t) {
    var filled = Math.min(t.slots, run.approvedByTer[t.id] || 0);
    var dots = ''; for (var i = 0; i < t.slots; i++) dots += '<i class="sdot' + (i < filled ? ' on' : '') + '"></i>';
    var tiles = t.pins.map(function (p) {
      var st = run.ctx.storeByPin[p], ap = run.approvedPins[p];
      var here = S.apps.filter(function (a) { return !a.withdrawn && a.pin === p; });
      var queued = here.filter(function (a) { var r = run.res[a.id]; return r.outcome === 'Waitlist'; });
      var holds = here.filter(function (a) { return run.res[a.id].outcome === 'Hold'; });
      var cls = 't-open', lab = 'open', title = p + ': open';
      if (st) { cls = 't-store'; lab = st.id; title = p + ': ' + st.id + ' already open since ' + st.year; }
      else if (ap) { cls = 't-ok'; lab = ap; title = p + ': approved for ' + ap + (queued.length ? ' (' + queued.length + ' waitlisted)' : ''); }
      else if (queued.length) { cls = 't-wait'; lab = queued.length + ' queued'; title = p + ': ' + queued.map(function (a) { return a.id; }).join(', ') + ' waitlisted'; }
      else if (holds.length) { cls = 't-hold'; lab = holds[0].id; title = p + ': ' + holds.map(function (a) { return a.id; }).join(', ') + ' on hold'; }
      var extra = (ap && queued.length) ? '<em>+' + queued.length + '</em>' : '';
      return '<button class="tile ' + cls + '" data-act="pin" data-v="' + p + '" title="' + esc(title) + '"><b>' + p.slice(0, 3) + '<u>' + p.slice(3) + '</u></b><span>' + esc(lab) + '</span>' + extra + '</button>';
    }).join('');
    parts.push('<section class="terr"><header><div><h3>' + esc(t.id) + ' ' + esc(t.city) + '</h3><span class="muted">' + esc(t.tier) + ', ' + esc(t.priority) + ' priority</span></div>' +
      '<div class="slots" title="' + filled + ' of ' + t.slots + ' slots filled"><span class="dots">' + dots + '</span><small>' + filled + ' of ' + t.slots + ' slots</small></div></header><div class="tiles">' + tiles + '</div>' +
      window.DeskExt.boardTerritory.map(function (fn) { try { return fn(t, S) || ''; } catch (e) { return ''; } }).join('') + '</section>');
  });
  var outside = S.apps.filter(function (a) { return !a.withdrawn && !S.run.res[a.id].ter; });
  var out = outside.length ? '<section class="terr"><header><div><h3>Not on the board</h3><span class="muted">Pin code is outside every territory or could not be read</span></div></header><div class="outside">' +
    outside.map(function (a) { return '<button class="chip" data-act="open-app" data-v="' + esc(a.id) + '">' + esc(a.id) + ' ' + esc(a.pin || '?') + '</button>'; }).join('') + '</div></section>' : '';
  return legend + '<div class="board">' + parts.join('') + '</div>' + out;
}

/* ---------- Assumptions ---------- */
function numIn(path, val, step, unit) {
  return '<label class="fld"><input type="number" step="' + (step || 1) + '" value="' + val + '" data-cfg="' + path + '"><span>' + unit + '</span></label>';
}
function assumeHtml() {
  var c = S.cfg, W = c.weights, sum = 0; for (var k in W) sum += W[k];
  return '<div class="assume"><p class="lede sm">Every number the engine uses is here. Change one and all decisions, pins and rankings update immediately.</p>' +
    '<div class="a-grid">' +
    '<section><h4>Minimum investment, Rs lakh</h4>' +
      '<div class="a-row"><span>Tier 1 city</span>' + numIn('floors.Tier 1', c.floors['Tier 1'], 1, 'lakh') + '</div>' +
      '<div class="a-row"><span>Tier 2 city</span>' + numIn('floors.Tier 2', c.floors['Tier 2'], 1, 'lakh') + '</div>' +
      '<div class="a-row"><span>Tier 3 city</span>' + numIn('floors.Tier 3', c.floors['Tier 3'], 1, 'lakh') + '</div>' +
      '<div class="a-row"><span>Reject below</span>' + numIn('rejectRatio', Math.round(c.rejectRatio * 100), 5, '% of floor') + '</div>' +
      '<p class="muted sm">Between the cut-off and the floor the application is held, so a co-investor can close the gap. Anchored to the Rs 20 to 35 lakh range quoted publicly for a Lenskart-type store.</p></section>' +
    '<section><h4>Space</h4>' +
      '<div class="a-row"><span>Hard minimum</span>' + numIn('minSpace', c.minSpace, 10, 'sq ft') + '</div>' +
      '<div class="a-row"><span>Ideal from</span>' + numIn('idealMin', c.idealMin, 10, 'sq ft') + '</div>' +
      '<div class="a-row"><span>Ideal up to</span>' + numIn('idealMax', c.idealMax, 10, 'sq ft') + '</div>' +
      '<p class="muted sm">Upper floors are held; ground floor and mall units pass.</p></section>' +
    '<section><h4>Timing and training</h4>' +
      '<div class="a-row"><span>Earliest opening</span>' + numIn('earliestWeeks', c.earliestWeeks, 1, 'weeks') + '</div>' +
      '<div class="a-row"><span>Extra if no space</span>' + numIn('noSpaceExtraWeeks', c.noSpaceExtraWeeks, 1, 'weeks') + '</div>' +
      '<div class="a-row"><span>First-timer below</span>' + numIn('firstTimerYears', c.firstTimerYears, 1, 'years') + '</div>' +
      '<p class="muted sm">First-timers get the 3-week extended training track.</p></section>' +
    '<section><h4>Spacing from existing stores</h4>' +
      '<div class="a-row"><span>High risk within</span>' + numIn('cannibNear', c.cannibNear, 1, 'pin numbers') + '</div>' +
      '<div class="a-row"><span>Medium risk within</span>' + numIn('cannibMid', c.cannibMid, 1, 'pin numbers') + '</div>' +
      '<p class="muted sm">Pin-number distance is a rough stand-in for real distance. With sales data this becomes a catchment-overlap model.</p></section>' +
    '<section class="wide"><h4>Score weights (total ' + sum + ')</h4><div class="w-grid">' +
      [['capital', 'Capital'], ['experience', 'Experience'], ['space', 'Space'], ['timeline', 'Timeline'], ['cannibal', 'Spacing'], ['data', 'Data confidence']].map(function (w) {
        return '<div class="a-row"><span>' + w[1] + '</span>' + numIn('weights.' + w[0], W[w[0]], 1, 'pts') + '</div>'; }).join('') + '</div></section>' +
    '</div><button class="btn" data-act="reset-cfg">Restore default assumptions</button>' +
    '<h4 class="mt">How a decision is made</h4><ol class="rules">' +
      '<li>Check the data: pin code against the city prefix, against existing stores and against the territories; space against the notes.</li>' +
      '<li>Reject only when it cannot be fixed soon: no territory in the city, or investment far below the floor.</li>' +
      '<li>Hold when something fixable is missing or contradictory, and say exactly what would change the decision.</li>' +
      '<li>Score the rest. One store per pin code: the top score takes the pin. Then each territory keeps its top scorers up to its open slots.</li>' +
      '<li>Everyone eligible who loses a pin or a slot is waitlisted with the reason and the trigger that would promote them.</li></ol></div>';
}

/* ---------- Ask the desk ---------- */
function askHtml() {
  var holdId = S.apps.filter(function (x) { var r = S.run.res[x.id]; return !x.withdrawn && r && r.outcome === 'Hold' && r.ifFixed && r.ifFixed.possible && r.ifFixed.outcome === 'Approve'; }).map(function (x) { return x.id; })[0] || firstOf('Hold');
  var appr = firstOf('Approve'), wl = firstOf('Waitlist');
  var sugg = [];
  if (holdId) sugg.push('Why is ' + holdId + ' on hold?');
  if (holdId) sugg.push('What would it take for ' + holdId + '?');
  if (appr) sugg.push('Who is competing with ' + appr + '?');
  if (holdId) sugg.push(holdId + ' has now found a ground-floor space');
  if (wl) sugg.push('Why is ' + wl + ' waitlisted?');
  sugg.push('Give me a summary');
  var log = S.askLog.map(function (m) {
    return m.who === 'me' ? '<div class="msg me">' + esc(m.text) + '</div>' : '<div class="msg desk">' + m.html + '</div>';
  }).join('');
  return '<div class="ask-in"><header><h2>Ask the desk</h2><p class="muted sm">Ask why, or tell it something new. Decisions update right away.</p></header>' +
    '<div class="log" id="log" aria-live="polite">' + (log || '<div class="msg desk">Try one of these, or type your own question.</div>') + '</div>' +
    '<div class="sugg">' + sugg.slice(0, 5).map(function (s) { return '<button class="chip" data-act="sugg" data-v="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
    '<div class="composer"><input id="askin" type="text" placeholder="e.g. APP-012 has found a 400 sq ft ground-floor shop" autocomplete="off" aria-label="Ask a question or give new information"><button class="btn primary" data-act="ask">Ask</button></div>' +
    '<div class="ask-tools"><button class="link" data-act="undo"' + (S.undo.length ? '' : ' disabled') + '>Undo last change</button><button class="link" data-act="reset-data">Restore uploaded data</button></div></div>';
}
function firstOf(o) { var a = S.apps.filter(function (x) { return !x.withdrawn && S.run.res[x.id] && S.run.res[x.id].outcome === o; })[0]; return a ? a.id : ''; }
function scrollAskToEnd() { var l = $('#log'); if (l) l.scrollTop = l.scrollHeight; }

/* ------------------------------------------------------------------ */
/* Understanding questions and new information                         */
/* ------------------------------------------------------------------ */
var NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, another: 1, a: 1 };

function findIds(text) {
  var ids = [], seen = {};
  (text.match(/\bapp[-\s_]?0*(\d{1,4})\b/gi) || []).forEach(function (m) {
    var n = parseInt(m.replace(/\D/g, ''), 10);
    var a = S.apps.filter(function (x) { return parseInt(x.id.replace(/\D.*$/, '').replace(/\D/g, ''), 10) === n || x.id === 'APP-' + E.pad(n, 3); })[0];
    var id = a ? a.id : 'APP-' + E.pad(n, 3);
    if (!seen[id]) { seen[id] = 1; ids.push(id); }
  });
  if (!ids.length) {
    var low = text.toLowerCase();
    S.apps.forEach(function (a) {
      var first = a.name.toLowerCase().split(/\s+/)[0];
      if (first.length >= 4 && new RegExp('\\b' + first.replace(/[^a-z]/g, '') + '\\b').test(low) && !seen[a.id]) { seen[a.id] = 1; ids.push(a.id); }
    });
  }
  return ids;
}
function findTers(text) {
  var out = [];
  (text.match(/\bter[-\s_]?0*(\d{1,3})\b/gi) || []).forEach(function (m) {
    var n = parseInt(m.replace(/\D/g, ''), 10);
    var t = S.ters.filter(function (x) { return parseInt(x.id.replace(/\D/g, ''), 10) === n; })[0];
    if (t && out.indexOf(t.id) < 0) out.push(t.id);
  });
  return out;
}

function parseFields(low) {
  var f = {};
  var spaceWord = /(space|shop|premises|property|store|unit|showroom|outlet|place|location|building)/.test(low);
  var foundVerb = /(found|got|secured|signed|identified|finali[sz]ed|has (a|the)|have (a|the)|taken|leased|rented|bought|acquired|booked|arranged|moved|shifted|switched|now (has|have|in))/.test(low);
  if (spaceWord && foundVerb) {
    f.spaceFound = true;
    if (/\bown(ed)?\b|bought|purchased/.test(low)) f.space = 'Owned';
    else if (/rent|lease/.test(low)) f.space = 'Rented';
  }
  if (/ground[\s-]?floor|\bground\b/.test(low)) f.floor = 'Ground';
  else if (/\bmall\b/.test(low)) f.floor = 'Mall unit';
  else if (/(upper floor|first floor|1st floor|second floor|2nd floor|terrace)/.test(low)) f.floor = 'Upper';
  var sz = low.match(/(\d{2,4})\s*(sq\.?\s?ft|sqft|square\s?feet|sq\s?feet|sft)/); if (sz) f.size = +sz[1];
  var cr = low.match(/(\d+(?:\.\d+)?)\s*(crore|cr)\b/);
  var lk = low.match(/(\d+(?:\.\d+)?)\s*(lakh|lakhs|lac|lacs|l)\b/);
  if (/(invest|capital|fund|budget|money|raise|put in|afford)/.test(low)) {
    if (cr) f.invest = Math.round(parseFloat(cr[1]) * 100);
    else if (lk) f.invest = parseFloat(lk[1]);
    else { var m2 = low.match(/(?:invest\w*|capital|budget|funds?)\D{0,25}(\d+(?:\.\d+)?)/); if (m2) { var v = parseFloat(m2[1]); f.invest = v > 1000 ? v / 100000 : v; } }
  }
  var ex = low.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/);
  if (ex && /(experience|worked|ran|runs|run a|managed|retail)/.test(low)) f.exp = parseFloat(ex[1]);
  var ln = low.match(/(\d+(?:\.\d+)?)\s*months?/);
  if (ln && /(launch|open|start|ready)/.test(low)) f.launch = parseFloat(ln[1]);
  var pn = low.match(/\b(\d{6})\b/); if (pn) f.pin = pn[1];
  if (/(prefer|language|training in|speaks|switch to)/.test(low)) { if (/kannada/.test(low)) f.lang = 'Kannada'; else if (/hindi/.test(low)) f.lang = 'Hindi'; else if (/english/.test(low)) f.lang = 'English'; }
  if (/(withdr|drop(ped)? out|dropping out|no longer interested|pulled out|backed out|not interested|cancel)/.test(low)) f.withdraw = true;
  return f;
}

function parseTerritoryChange(low) {
  var f = {};
  var sl = low.match(/(\d+|one|two|three|four|five|another)\s*(?:more|extra|additional|new)?\s*slots?/) || low.match(/slots?\D{0,12}(\d+)/);
  if (sl) {
    var n = isNaN(+sl[1]) ? NUMW[sl[1]] : +sl[1];
    f.slots = n; f.add = /(more|extra|additional|another|add|new slot)/.test(low);
  }
  var pr = low.match(/(high|medium|low)\s*priority|priority\D{0,12}(high|medium|low)/);
  if (pr) f.priority = (pr[1] || pr[2]).replace(/^./, function (c) { return c.toUpperCase(); });
  return f;
}

function pushUndo() { S.undo.push({ apps: E.clone(S.apps), ters: E.clone(S.ters), cfg: E.clone(S.cfg) }); if (S.undo.length > 20) S.undo.shift(); }

function applyAppFields(a, f) {
  var did = [];
  if (f.withdraw) { a.withdrawn = true; did.push('withdrawn'); return did; }
  var spaceTouched = false;
  if (f.spaceFound || f.size !== undefined || f.floor !== undefined) {
    if (f.space) a.space = f.space;
    else if (a.space === 'Not yet identified') a.space = 'Rented';
    if (a.space !== 'Not yet identified' && f.spaceFound && !(a.space === 'Owned' || a.space === 'Rented')) a.space = 'Rented';
    if (f.size !== undefined) { a.size = f.size; a.sizeAssumed = false; did.push('space ' + f.size + ' sq ft'); }
    else if (a.size === null) { a.sizeAssumed = true; }
    if (f.floor) { a.floor = f.floor; did.push(f.floor.toLowerCase() + (f.floor === 'Mall unit' ? '' : ' floor')); }
    did.unshift(a.space.toLowerCase() + ' space');
    spaceTouched = true;
  }
  if (f.invest !== undefined) { a.invest = f.invest; did.push('investment Rs ' + f.invest + ' lakh'); }
  if (f.exp !== undefined) { a.exp = f.exp; did.push('experience ' + f.exp + ' years'); }
  if (f.launch !== undefined) { a.launch = f.launch; did.push('target launch ' + f.launch + ' months'); }
  if (f.pin) { a.pin = f.pin; a.pinRaw = f.pin; did.push('pin ' + f.pin); }
  if (f.lang) { a.lang = f.lang; did.push('training language ' + f.lang); S.letterLang[a.id] = f.lang; }
  if (spaceTouched || f.pin) a.notesSuperseded = true;
  return did;
}

function diffHtml(diff) {
  if (!diff.length) return '<p class="muted">No other decisions changed.</p>';
  return '<ul class="diff">' + diff.slice(0, 14).map(function (d) {
    var a = getApp(d.id);
    return '<li><button class="link" data-act="open-app" data-v="' + esc(d.id) + '"><b>' + esc(d.id) + '</b> ' + esc(a ? a.name : '') + '</button> ' + (d.from === d.to ? esc(d.note || 'moved') : pill(d.from, true) + ' to ' + pill(d.to, true)) + '</li>';
  }).join('') + (diff.length > 14 ? '<li class="muted">and ' + (diff.length - 14) + ' more</li>' : '') + '</ul>';
}

function explainCard(id) {
  var a = getApp(id);
  if (!a) return '<p>I cannot find ' + esc(id) + ' in this file.</p>';
  if (a.withdrawn) return '<p><b>' + esc(id) + '</b> ' + esc(a.name) + ' has withdrawn, so it holds no pin and no slot.</p>';
  var r = S.run.res[id], x = E.explain(r, a, { cfg: S.cfg, run: S.run });
  return '<p><b>' + esc(id) + '</b> ' + esc(a.name) + ' ' + pill(r.outcome) + '</p><p><b>' + esc(x.headline) + '.</b></p>' +
    x.lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + x.next.map(function (l) { return '<p class="nx">' + esc(l) + '</p>'; }).join('') +
    '<button class="link" data-act="open-app" data-v="' + esc(id) + '">Open full record</button>';
}

function competitorsCard(id) {
  var a = getApp(id); if (!a || a.withdrawn) return explainCard(id);
  var r = S.run.res[id];
  var rivals = S.apps.filter(function (b) { return b.id !== id && !b.withdrawn && S.run.res[b.id] && (S.run.res[b.id].outcome === 'Approve' || S.run.res[b.id].outcome === 'Waitlist') && (b.pin === a.pin || (r.ter && S.run.res[b.id].ter && S.run.res[b.id].ter.id === r.ter.id)); });
  if (!r.ter) return '<p><b>' + esc(id) + '</b> is not in any territory, so it competes with nobody for a slot.</p>';
  if (!rivals.length) return '<p><b>' + esc(id) + '</b> has no eligible rivals for pin ' + esc(a.pin) + ' or for the slots in ' + esc(r.ter.id) + '.</p>';
  rivals.sort(function (p, q) { return S.run.res[q.id].score - S.run.res[p.id].score; });
  return '<p><b>' + esc(id) + '</b> scores ' + r.score + ' (' + r.outcome.toLowerCase() + '). Eligible rivals for pin ' + esc(a.pin) + ' and the ' + r.ter.slots + ' slot' + (r.ter.slots === 1 ? '' : 's') + ' in ' + esc(r.ter.id) + ':</p>' +
    '<ul class="diff">' + rivals.map(function (b) { var rb = S.run.res[b.id]; return '<li><button class="link" data-act="open-app" data-v="' + esc(b.id) + '"><b>' + esc(b.id) + '</b> ' + esc(b.name) + '</button> ' + pill(rb.outcome, true) + ' score ' + rb.score + ', pin ' + esc(b.pin) + '</li>'; }).join('') + '</ul>';
}

function compareCard(i1, i2) {
  var a = getApp(i1), b = getApp(i2); if (!a || !b) return '<p>I need two application IDs in this file to compare.</p>';
  var r1 = S.run.res[i1], r2 = S.run.res[i2];
  var rows = Object.keys(r1.parts).map(function (k) { return '<tr><td>' + esc(r1.parts[k].label) + '</td><td>' + Math.round(r1.parts[k].pts * 10) / 10 + '</td><td>' + Math.round(r2.parts[k].pts * 10) / 10 + '</td></tr>'; }).join('');
  return '<table class="cmp"><thead><tr><th></th><th>' + esc(i1) + '<br>' + pill(r1.outcome, true) + '</th><th>' + esc(i2) + '<br>' + pill(r2.outcome, true) + '</th></tr></thead><tbody>' + rows +
    '<tr class="tot"><td>Total</td><td>' + r1.score + '</td><td>' + r2.score + '</td></tr></tbody></table>';
}

function territoryCard(tid) {
  var t = S.ters.filter(function (x) { return x.id === tid; })[0]; if (!t) return '<p>Territory not found.</p>';
  var run = S.run, appr = S.apps.filter(function (a) { return !a.withdrawn && t.pins.indexOf(a.pin) >= 0 && run.res[a.id].outcome === 'Approve'; });
  var wl = S.apps.filter(function (a) { return !a.withdrawn && t.pins.indexOf(a.pin) >= 0 && run.res[a.id].outcome === 'Waitlist'; });
  var locked = t.pins.filter(function (p) { return run.ctx.storeByPin[p]; });
  var free = E.freePins(run, t.city).filter(function (p) { return p.ter === tid; });
  return '<p><b>' + esc(t.id) + '</b> ' + esc(t.city) + ', ' + esc(t.tier) + ', ' + esc(t.priority) + ' priority. ' + appr.length + ' of ' + t.slots + ' slots filled.</p>' +
    '<p>Approved: ' + (appr.map(function (a) { return esc(a.id) + ' (' + esc(a.pin) + ')'; }).join(', ') || 'none') + '.</p>' +
    '<p>Waitlisted: ' + (wl.map(function (a) { return esc(a.id); }).join(', ') || 'none') + '.</p>' +
    '<p>Locked by existing stores: ' + (locked.join(', ') || 'none') + '. Open pins: ' + (free.map(function (p) { return p.pin; }).join(', ') || 'none') + '.</p>';
}

function listCard(o) {
  var items = S.apps.filter(function (a) { return !a.withdrawn && S.run.res[a.id].outcome === o; });
  if (!items.length) return '<p>No applications are currently ' + { Approve: 'approved', Waitlist: 'waitlisted', Hold: 'on hold', Reject: 'rejected' }[o] + '.</p>';
  var lbl = { Approve: 'approved', Waitlist: 'waitlisted', Hold: 'on hold', Reject: 'not taken forward' }[o];
  return '<p>' + items.length + ' ' + lbl + ':</p><ul class="diff">' + items.map(function (a) {
    var r = S.run.res[a.id], x = E.explain(r, a, { cfg: S.cfg, run: S.run });
    return '<li><button class="link" data-act="open-app" data-v="' + esc(a.id) + '"><b>' + esc(a.id) + '</b> ' + esc(a.name) + '</button> ' + esc(x.headline) + '</li>';
  }).join('') + '</ul>';
}

function summaryCard() {
  var c = { Approve: 0, Waitlist: 0, Hold: 0, Reject: 0 }, reasons = {};
  S.apps.forEach(function (a) { if (a.withdrawn) return; var r = S.run.res[a.id]; c[r.outcome]++; if (r.outcome === 'Hold') r.issues.filter(function (i) { return i.level === 'hold'; }).forEach(function (i) { reasons[i.title] = (reasons[i.title] || 0) + 1; }); });
  var top = Object.keys(reasons).sort(function (a, b) { return reasons[b] - reasons[a]; }).slice(0, 3);
  var full = S.ters.filter(function (t) { return (S.run.approvedByTer[t.id] || 0) >= t.slots; }).map(function (t) { return t.id; });
  return '<p>' + c.Approve + ' approved, ' + c.Waitlist + ' waitlisted, ' + c.Hold + ' on hold, ' + c.Reject + ' not taken forward.</p>' +
    (top.length ? '<p>Most common reasons for a hold: ' + top.map(function (k) { return k.toLowerCase() + ' (' + reasons[k] + ')'; }).join('; ') + '.</p>' : '') +
    (full.length ? '<p>Territories with every slot filled: ' + full.join(', ') + '.</p>' : '');
}

function helpCard() {
  return '<p>I can answer in plain language, and I can take new information:</p><ul class="diff"><li>Why is APP-007 on hold?</li><li>What would it take for APP-010?</li><li>Who is competing with APP-003?</li><li>Compare APP-001 and APP-002</li><li>Tell me about TER-01</li><li>List all holds</li><li>APP-012 has found a 400 sq ft ground-floor shop</li><li>APP-010 can now invest 30 lakh</li><li>APP-004 withdrew</li><li>TER-02 has one more slot</li></ul>';
}

function answer(text) {
  var low = text.toLowerCase().trim();
  if (!low) return '';
  for (var xi = 0; xi < window.DeskExt.answerers.length; xi++) {
    var xr = window.DeskExt.answerers[xi](text, window.__desk); if (xr) return xr;
  }
  if (/^(undo|revert)\b/.test(low) || /\bundo (that|the last|last)/.test(low)) { return doUndo(true); }
  var ids = findIds(text), tids = findTers(text);
  var infoCue = /\b(now|found|just|updated?|changed?|secured|signed|withdr\w*|dropped|dropping|instead|since)\b/.test(low);
  var questionish = /^(why|how|what|who|which|list|show|explain|compare|tell|give|is|are|can|does|do|summar)/.test(low) && !/\bwhat if\b/.test(low) && !infoCue;
  if (/\b(why|how come|explain|reason|what happened)\b/.test(low) && !infoCue) questionish = true;

  if (/\b(help|what can you do|how do i use)\b/.test(low)) return helpCard();
  if (/\b(summary|summari[sz]e|overview|how are we doing|big picture)\b/.test(low)) return summaryCard();
  var lm = low.match(/\b(list|show|which)\b[^.?]*\b(approved|waitlisted|waitlist|on hold|holds|hold|rejected|reject|approvals)\b/);
  if (lm && !ids.length) { var w = lm[2]; return listCard(/approv/.test(w) ? 'Approve' : /wait/.test(w) ? 'Waitlist' : /hold/.test(w) ? 'Hold' : 'Reject'); }
  if (/\bhow many\b/.test(low) && !ids.length) return summaryCard();

  if (!questionish) {
    // new information about an applicant
    if (ids.length >= 1 && !tids.length) {
      var a = getApp(ids[0]);
      if (a) {
        var f = parseFields(low);
        var keys = Object.keys(f);
        if (keys.length) {
          pushUndo();
          var did = applyAppFields(a, f);
          var diff = recompute();
          render();
          var note = '';
          if (f.spaceFound && a.sizeAssumed) note = '<p class="nx">No size was given, so I assumed it meets the ' + S.cfg.minSpace + ' sq ft minimum and made confirming it a condition of approval.</p>';
          if (f.spaceFound && a.floor === 'Not known') note += '<p class="nx">The floor was not stated, so confirming it is a condition too.</p>';
          return '<p class="ap">Recorded for <b>' + esc(a.id) + '</b> ' + esc(a.name) + ': ' + esc(did.join(', ') || 'update') + '.' + ((f.spaceFound || f.size !== undefined || f.floor !== undefined || f.pin) ? ' Older free-text notes about the space no longer count.' : '') + '</p>' + note +
            '<p><b>What changed</b></p>' + diffHtml(diff) + explainCard(a.id);
        }
      }
    }
    if (tids.length) {
      var t = S.ters.filter(function (x) { return x.id === tids[0]; })[0], tf = parseTerritoryChange(low);
      if (t && (tf.slots !== undefined || tf.priority)) {
        pushUndo();
        var d2 = [];
        if (tf.slots !== undefined) { var nv = tf.add ? t.slots + tf.slots : tf.slots; d2.push('open slots ' + t.slots + ' to ' + nv); t.slots = nv; }
        if (tf.priority) { d2.push('priority ' + t.priority + ' to ' + tf.priority); t.priority = tf.priority; }
        var diff2 = recompute(); render();
        return '<p class="ap">Updated <b>' + esc(t.id) + '</b>: ' + esc(d2.join(', ')) + '.</p><p><b>What changed</b></p>' + diffHtml(diff2) + territoryCard(t.id);
      }
    }
  }
  // what if X ... applies as new information too
  if (/\bwhat if\b/.test(low) && ids.length) {
    var a2 = getApp(ids[0]), f2 = parseFields(low);
    if (a2 && Object.keys(f2).length) { pushUndo(); var did2 = applyAppFields(a2, f2), df = recompute(); render();
      return '<p class="ap">Applied as a scenario for <b>' + esc(a2.id) + '</b>: ' + esc(did2.join(', ')) + '. Use Undo to go back.</p><p><b>What changed</b></p>' + diffHtml(df) + explainCard(a2.id); }
  }

  if (/\bcompar/.test(low) && ids.length >= 2) return compareCard(ids[0], ids[1]);
  if (tids.length && !ids.length) return territoryCard(tids[0]);
  if (ids.length) {
    if (/(compet|rival|against|ahead of|beat|rank|behind)/.test(low)) return competitorsCard(ids[0]);
    return explainCard(ids[0]);
  }
  return '<p>I did not catch which application or territory you mean. Mention an ID like APP-007 or TER-02.</p>' + helpCard();
}

function doUndo(fromChat) {
  var u = S.undo.pop();
  if (!u) return fromChat ? '<p>Nothing to undo.</p>' : '';
  S.apps = u.apps; S.ters = u.ters; S.cfg = u.cfg;
  var c0 = S.cause; S.cause = { kind: 'Undo', text: 'Last change undone' };
  var diff = recompute(); S.cause = c0; render();
  return fromChat ? '<p class="ap">Last change undone.</p>' + diffHtml(diff) : '';
}

function ask(text) {
  text = String(text || '').trim(); if (!text) return;
  S.askLog.push({ who: 'me', text: text });
  var html;
  S.cause = { kind: /\bwhat if\b/i.test(text) ? 'What-if' : 'New information', text: text };
  try { html = answer(text); } catch (e) { html = '<p>Something went wrong reading that: ' + esc(e.message) + '</p>'; }
  S.cause = null;
  S.askLog.push({ who: 'desk', html: html });
  var asideEl = $('#ask'); if (asideEl) asideEl.innerHTML = askHtml();
  scrollAskToEnd();
  var inp = $('#askin'); if (inp) inp.focus();
}

/* ------------------------------------------------------------------ */
/* Workbook reading and writing                                        */
/* ------------------------------------------------------------------ */
function handleFile(file) {
  if (!file) return;
  var rd = new FileReader();
  rd.onerror = function () { showError('The file could not be read.'); };
  rd.onload = function (ev) {
    try {
      var wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
      var sheets = {};
      wb.SheetNames.forEach(function (n) { sheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); });
      var pk = E.pickSheets(sheets);
      if (!E.parseApplications(pk.apps).length) throw new Error('The Applications sheet has a header row but no applications under it.');
      if (!E.parseTerritories(pk.ters).length) throw new Error('The Territories sheet has a header row but no territories under it.');
      load(pk.apps, pk.ters, file.name);
      hideError();
    } catch (e) { showError(e.message || String(e)); }
  };
  rd.readAsArrayBuffer(file);
}
function showError(m) { var b = $('#err'); b.textContent = m; b.hidden = false; }
function hideError() { var b = $('#err'); b.hidden = true; }

function downloadSample() {
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(SD.appsAoA), 'Applications');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(SD.tersAoA), 'Territories');
  var st = [['Store ID', 'City', 'Pin code', 'Opened (year)']].concat(E.STORES.map(function (s) { return [s.id, s.city, +s.pin, s.year]; }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Existing stores - fixed'], st[0]].concat(st.slice(1))), 'Existing stores');
  XLSX.writeFile(wb, 'territory-desk-sample.xlsx');
}

function exportDecisions() {
  if (!S.run) return;
  var rows = [['Application ID', 'Applicant', 'City', 'Pin code', 'Territory', 'Outcome', 'Score', 'Rank on pin', 'Why', 'Next step or what would change this', 'Conditions', 'Training language', 'Training track', 'Mentor store', 'Realistic opening (weeks)', 'Message to applicant']];
  S.apps.forEach(function (a) {
    if (a.withdrawn) { rows.push([a.id, a.name, a.city, a.pin, '', 'Withdrawn', '', '', 'Withdrawn by applicant', '', '', '', '', '', '', '']); return; }
    var r = S.run.res[a.id], x = E.explain(r, a, { cfg: S.cfg, run: S.run }), p = r.outcome === 'Approve' ? E.onboardingPlan(r, a, { cfg: S.cfg, run: S.run }) : null;
    rows.push([a.id, a.name, a.city, a.pin, r.ter ? r.ter.id : '', r.outcome, (r.outcome === 'Approve' || r.outcome === 'Waitlist') ? r.score : '', r.rankPin ? r.rankPin + ' of ' + r.pinN : '',
      [x.headline].concat(x.lines).join(' '), x.next.join(' '), r.conditions && r.outcome === 'Approve' ? r.conditions.join('; ') : '', a.lang || 'English',
      p ? p.track : '', p ? p.mentor.id : '', p ? p.openWeeks : '', E.letter(r, a, a.lang || 'English', S.cfg)]);
  });
  var wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [10, 18, 16, 9, 9, 9, 6, 9, 60, 60, 40, 10, 20, 8, 10, 60].map(function (w) { return { wch: w }; });
  XLSX.utils.book_append_sheet(wb, ws, 'Decisions');
  var brows = [['Territory', 'City', 'Tier', 'Priority', 'Open slots', 'Slots filled', 'Pin code', 'Status']];
  S.ters.forEach(function (t) { t.pins.forEach(function (p) {
    var st = S.run.ctx.storeByPin[p], ap = S.run.approvedPins[p];
    brows.push([t.id, t.city, t.tier, t.priority, t.slots, Math.min(t.slots, S.run.approvedByTer[t.id] || 0), p, st ? 'Locked: ' + st.id : ap ? 'Approved: ' + ap : 'Open']);
  }); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(brows), 'Pin board');
  window.DeskExt.exportSheets.forEach(function (fn) { try { var sh = fn(S); if (sh) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sh.rows), sh.name); } catch (e) { console.error(e); } });
  XLSX.writeFile(wb, 'franchise-decisions.xlsx');
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */
function refreshBody() { var b = $('#tabbody'); if (b) b.innerHTML = tabBody(); }
function setPath(obj, path, val) { var p = path.split('.'), o = obj; for (var i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = val; }

document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]'); if (!el) return;
  var act = el.getAttribute('data-act'), v = el.getAttribute('data-v');
  switch (act) {
    case 'sample': load(SD.appsAoA, SD.tersAoA, 'sample data'); break;
    case 'dl-sample': downloadSample(); break;
    case 'export': exportDecisions(); break;
    case 'tab': S.tab = v; render(); break;
    case 'clear-ids': S.filterIds = null; refreshBody(); break;
    case 'filter': S.filterIds = null; S.filter = v; S.tab = 'decisions'; render(); break;
    case 'toggle': S.open[v] = !S.open[v]; refreshBody(); break;
    case 'lang': S.letterLang[el.getAttribute('data-id')] = v; refreshBody(); break;
    case 'copy': {
      var a = getApp(el.getAttribute('data-id')), r = S.run.res[a.id];
      var txt = E.letter(r, a, S.letterLang[a.id] || a.lang || 'English', S.cfg);
      var done = function () { el.textContent = 'Copied'; setTimeout(function () { el.textContent = 'Copy message'; }, 1400); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, done);
      else { var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (x) {} document.body.removeChild(ta); done(); }
      break; }
    case 'pin': S.filterIds = null; S.tab = 'decisions'; S.filter = 'all'; S.q = v; render(); break;
    case 'open-app': S.filterIds = null; S.tab = 'decisions'; S.filter = 'all'; S.q = ''; S.open[v] = true; render();
      var row = document.getElementById('row-' + v); if (row) row.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
    case 'ask': { var i = $('#askin'); ask(i.value); break; }
    case 'sugg': ask(v); break;
    case 'undo': doUndo(false); break;
    case 'reset-data': if (S.run && S.initial) { pushUndo(); S.apps = E.clone(S.initial.apps); S.ters = E.clone(S.initial.ters); S.cause = { kind: 'Restore', text: 'Uploaded data restored' }; recompute(); S.cause = null; render(); } break;
    case 'reset-cfg': pushUndo(); S.cfg = E.clone(E.DEFAULT_CFG); S.cause = { kind: 'Assumption', text: 'Default assumptions restored' }; recompute(); S.cause = null; render(); break;
    case 'drop-example-app': S.apps = S.apps.filter(function (a) { return !a.templateExample; }); S.notices = S.notices.filter(function (n) { return n.indexOf('drop-example-app') < 0; }); recompute(); render(); break;
    case 'drop-example-ter': S.ters = S.ters.filter(function (t) { return !t.templateExample; }); S.notices = S.notices.filter(function (n) { return n.indexOf('drop-example-ter') < 0; }); recompute(); render(); break;
  }
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target && e.target.id === 'askin') { e.preventDefault(); ask(e.target.value); }
});
document.addEventListener('input', function (e) {
  if (e.target.id === 'q') { S.q = e.target.value; var rows = $('.rows'); var cur = e.target.selectionStart; refreshBody(); var q2 = $('#q'); if (q2) { q2.focus(); q2.setSelectionRange(cur, cur); } }
});
document.addEventListener('change', function (e) {
  var p = e.target.getAttribute && e.target.getAttribute('data-cfg');
  if (p) {
    var val = parseFloat(e.target.value); if (isNaN(val)) return;
    if (p === 'rejectRatio') val = val / 100;
    pushUndo(); setPath(S.cfg, p, val);
    S.cause = { kind: 'Assumption', text: p + ' set to ' + e.target.value };
    var diff = recompute(); S.cause = null; render();
    S.tab = 'assume'; render();
    S.askLog.push({ who: 'desk', html: '<p class="ap">Assumption changed (' + esc(p) + ' = ' + esc(e.target.value) + ').</p><p><b>What changed</b></p>' + diffHtml(diff) });
    var asideEl = $('#ask'); if (asideEl) asideEl.innerHTML = askHtml(); scrollAskToEnd();
  }
  if (e.target.id === 'file' || e.target.id === 'file2') handleFile(e.target.files[0]);
});
['dragover', 'drop'].forEach(function (ev) { document.addEventListener(ev, function (e) {
  e.preventDefault();
  if (ev === 'drop' && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
}); });

render();
window.__desk = { S: S, E: E, ask: ask, load: load, rerender: render, recompute: recompute, getApp: getApp, esc: esc, pill: pill, pushUndo: pushUndo, getRun: function () { return S.run; },
  // used by src/ext/understand.js to read follow-ups more broadly and apply several changes at once
  answer: answer, findIds: findIds, findTers: findTers, parseFields: parseFields, parseTerritoryChange: parseTerritoryChange,
  applyAppFields: applyAppFields, diffHtml: diffHtml, explainCard: explainCard };
})();
