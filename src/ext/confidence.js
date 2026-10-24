// Confidence badge on every decision, the fragile-decisions list, and side-by-side scenario comparison (Scenarios tab).
// Logic lives in src/modules/whatif.js.
(function () {
'use strict';
var D = window.__desk, S = D.S, E = D.E, esc = D.esc, pill = D.pill, W = window.DeskWhatIf;
var LBL = { high: 'High', medium: 'Medium', low: 'Low' };
var cache = { run: null };
var V = { changes: [] };
var FRAG_LIMIT = 300;

function calc() {
  if (cache.run !== S.run) {
    // ponytail: the 10% check re-runs every decision 20 times (about 5 s at 500 applications), so it is skipped on big files; move to a web worker if big files matter
    var n = S.apps.filter(function (a) { return !a.withdrawn; }).length;
    cache.run = S.run; cache.skipped = n > FRAG_LIMIT;
    cache.frag = cache.skipped ? {} : W.fragile(S); cache.conf = W.confidence(S, cache.frag);
  }
  return cache;
}
function appLink(id) { return '<button class="link" data-act="open-app" data-v="' + esc(id) + '">' + esc(id) + '</button>'; }

/* ---------- badge and detail ---------- */
window.DeskExt.rowBadges.push(function (a) {
  var c = calc().conf[a.id]; if (!c) return '';
  return '<span class="conf c-' + c.level + '" title="Confidence: ' + esc(LBL[c.level] + '. ' + c.why.join('. ')) + '"><i></i>' + LBL[c.level] + '</span>';
});
window.DeskExt.afterDetail.push(function (a) {
  var c = calc().conf[a.id]; if (!c) return '';
  return '<h4>Confidence: ' + LBL[c.level].toLowerCase() + '</h4><ul class="trig">' + c.why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>';
});

/* ---------- Scenarios tab ---------- */
function options() {
  return W.THRESHOLDS.map(function (t) { return ['cfg:' + t.path, t.label + ' (' + t.unit + ')']; })
    .concat(S.ters.map(function (t) { return ['slots:' + t.id, 'Open slots in ' + t.id + ' ' + t.city]; }));
}
function current(key) {
  var k = key.split(':');
  if (k[0] === 'slots') return S.ters.filter(function (t) { return t.id === k[1]; })[0].slots;
  var v = W.get(S.cfg, k[1]); return k[1] === 'rejectRatio' ? Math.round(v * 100) : v;
}
function toChanges() {
  return V.changes.map(function (c) {
    var k = c.key.split(':');
    return k[0] === 'slots' ? { kind: 'slots', ter: k[1], value: c.value } : { kind: 'cfg', path: k[1], value: k[1] === 'rejectRatio' ? c.value / 100 : c.value };
  });
}
function describe() {
  var o = {}; options().forEach(function (x) { o[x[0]] = x[1]; });
  return V.changes.map(function (c) { return o[c.key].replace(/ \(.*\)$/, '') + ' ' + current(c.key) + ' to ' + c.value; }).join('; ');
}
function preset(kind) {
  if (kind === 'stricter' || kind === 'looser') {
    var f = kind === 'stricter' ? 1 + W.NUDGE : 1 - W.NUDGE;
    V.changes = W.nudgeAll(S, f).map(function (c) { var v = c.path === 'rejectRatio' ? Math.round(c.value * 100) : Math.round(c.value * 10) / 10; return { key: 'cfg:' + c.path, value: v }; });
  } else {
    var over = window.DeskOps ? window.DeskOps.territoryHealth(S).filter(function (t) { return t.flags.some(function (f) { return f.k === 'over'; }); }) : [];
    V.changes = over.map(function (t) { return { key: 'slots:' + t.id, value: t.slots + 1 }; });
  }
}

function scenHtml() {
  var c = calc(), conf = c.conf, ids = Object.keys(conf);
  var cnt = { high: [], medium: [], low: [] }; ids.forEach(function (id) { cnt[conf[id].level].push(id); });
  var fr = Object.keys(c.frag);
  var tiles = ['high', 'medium', 'low'].map(function (l) {
    return '<button class="ctile c-' + l + '" data-act="conf-ids" data-v="' + l + '" data-ids="' + cnt[l].join(',') + '"><b>' + cnt[l].length + '</b><span><i></i>' + LBL[l] + ' confidence</span></button>';
  }).join('');
  var frag = fr.length ? '<ul class="fraglist">' + fr.map(function (id) {
    var a = D.getApp(id);
    return '<li>' + appLink(id) + ' ' + esc(a.name) + ' ' + pill(S.run.res[id].outcome, true) + '<ul>' + c.frag[id].map(function (f) {
      return '<li>Becomes ' + pill(f.now, true) + ' if ' + esc(f.label.charAt(0).toLowerCase() + f.label.slice(1)) + ' ' + (f.up ? 'rises' : 'falls') + ' from ' + esc(f.from) + ' to ' + esc(f.to) + '</li>';
    }).join('') + '</ul></li>';
  }).join('') + '</ul>' : c.skipped ? '<p class="muted">This file has more than ' + FRAG_LIMIT + ' applications, so the 10% check is switched off to keep the page quick. Confidence uses the margin to the next rival and data flags only.</p>' : '<p class="muted">No decision changes when any one threshold moves 10% either way.</p>';

  var opts = options();
  var rows = V.changes.map(function (ch, i) {
    return '<div class="sc-row"><select data-sc-key="' + i + '" aria-label="What to change">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === ch.key ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' +
      '<span class="muted sm">now ' + esc(current(ch.key)) + ', try</span><input type="number" step="any" data-sc-val="' + i + '" value="' + esc(ch.value) + '" aria-label="New value">' +
      '<button class="link sm" data-act="sc-del" data-v="' + i + '">Remove</button></div>';
  }).join('');
  var result = '';
  if (V.changes.length) {
    var sc = W.scenario(S, toChanges());
    var tbl = ['Approve', 'Waitlist', 'Hold', 'Reject'].map(function (o) {
      var d = sc.after[o] - sc.before[o];
      return '<tr><td>' + pill(o, true) + '</td><td>' + sc.before[o] + '</td><td>' + sc.after[o] + '</td><td class="' + (o !== 'Approve' ? '' : d > 0 ? 'up' : d < 0 ? 'down' : '') + '">' + (d > 0 ? '+' : '') + (d || '–') + '</td></tr>';
    }).join('');
    result = '<div class="sc-out"><table class="cmp"><thead><tr><th>Outcome</th><th>Now</th><th>Scenario</th><th>Change</th></tr></thead><tbody>' + tbl + '</tbody></table>' +
      '<div><h4>Who changes (' + sc.changed.length + ')</h4>' + (sc.changed.length ? '<ul class="diff">' + sc.changed.map(function (x) { return '<li>' + appLink(x.id) + ' ' + esc(x.name) + ' ' + pill(x.from, true) + ' to ' + pill(x.to, true) + '</li>'; }).join('') + '</ul>' : '<p class="muted">Nobody: every decision holds.</p>') +
      '<button class="btn sm primary" data-act="sc-apply">Apply this scenario</button> <span class="muted sm">It goes in the decision log; Undo reverses it.</span></div></div>';
  }
  return '<div class="scen"><h4>How sure is each decision?</h4><p class="muted sm">High: ' + W.CONF.high + '+ points clear of the next rival, or decided on facts in the form. Medium: ' + W.CONF.medium + ' to ' + W.CONF.high + ' points, or a data flag. Low: under ' + W.CONF.medium + ' points, or fragile. Click a tile to see those applications.</p>' +
    '<div class="ctiles">' + tiles + '</div>' +
    '<h4 class="mt">Fragile decisions <span class="muted">' + fr.length + '</span></h4><p class="muted sm">Decisions that change if any one threshold moves ' + Math.round(W.NUDGE * 100) + '% either way. A person should look at these before anything is signed.</p>' + frag +
    '<h4 class="mt">Compare a scenario</h4><p class="muted sm">Change a threshold or add slots and see, side by side, how many decisions move and whose. Nothing changes until you apply it.</p>' +
    '<div class="sc-pre"><button class="btn sm" data-act="sc-pre" data-v="stricter">Every threshold 10% stricter</button><button class="btn sm" data-act="sc-pre" data-v="looser">Every threshold 10% looser</button><button class="btn sm" data-act="sc-pre" data-v="slots">One more slot where oversubscribed</button></div>' +
    rows + '<button class="link sm" data-act="sc-add">' + (V.changes.length ? 'Add another change' : 'Add a change') + '</button>' + result + '</div>';
}
window.DeskExt.tabs.push({ id: 'scen', label: 'Scenarios', render: scenHtml });

/* ---------- Ask the desk ---------- */
window.DeskExt.answerers.push(function (text) {
  var low = text.toLowerCase();
  if (!/(fragile|borderline|close call|confiden|how sure|on the edge|knife.edge)/.test(low)) return null;
  var c = calc(), m = text.match(/\bapp[-\s_]?0*(\d{1,4})\b/i);
  if (m) {
    var n = parseInt(m[1], 10), a = S.apps.filter(function (x) { return parseInt(x.id.replace(/#.*$/, '').replace(/\D/g, ''), 10) === n; })[0];
    if (!a || !c.conf[a.id]) return null;
    var k = c.conf[a.id];
    return '<p><b>' + esc(a.id) + '</b> ' + esc(a.name) + ' ' + pill(S.run.res[a.id].outcome) + ': ' + LBL[k.level].toLowerCase() + ' confidence.</p><ul class="diff">' + k.why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>';
  }
  var fr = Object.keys(c.frag), lowIds = Object.keys(c.conf).filter(function (id) { return c.conf[id].level === 'low'; });
  return '<p>' + lowIds.length + ' decision' + (lowIds.length === 1 ? ' is' : 's are') + ' low confidence; ' + fr.length + ' would flip if one threshold moved 10%:</p><ul class="diff">' +
    fr.map(function (id) { var f = c.frag[id][0]; return '<li>' + appLink(id) + ' ' + pill(S.run.res[id].outcome, true) + ' to ' + pill(f.now, true) + ' if ' + esc(f.label.charAt(0).toLowerCase() + f.label.slice(1)) + ' goes ' + esc(f.from) + ' to ' + esc(f.to) + '</li>'; }).join('') +
    '</ul><button class="link" data-act="tab" data-v="scen">Open Scenarios</button>';
});

/* ---------- events ---------- */
function body() { var b = document.getElementById('tabbody'); if (b && S.tab === 'scen') b.innerHTML = scenHtml(); }
document.addEventListener('click', function (e) {
  var el = e.target.closest && e.target.closest('[data-act^="sc-"],[data-act="conf-ids"]'); if (!el) return;
  var act = el.getAttribute('data-act');
  if (act === 'sc-add') { var k = options()[0][0]; V.changes.push({ key: k, value: current(k) }); body(); }
  else if (act === 'sc-del') { V.changes.splice(+el.getAttribute('data-v'), 1); body(); }
  else if (act === 'sc-pre') { preset(el.getAttribute('data-v')); body(); }
  else if (act === 'sc-apply') {
    var sc = W.scenario(S, toChanges()), what = describe();
    D.pushUndo(); S.cfg = sc.cfg; S.ters = sc.ters;
    S.cause = { kind: 'What-if', text: 'Scenario applied: ' + what };
    var diff = D.recompute(); S.cause = null; V.changes = [];
    S.askLog.push({ who: 'desk', html: '<p class="ap">Scenario applied: ' + esc(what) + '.</p>' + (diff.length ? '<ul class="diff">' + diff.map(function (d) { return '<li>' + appLink(d.id) + ' ' + pill(d.from, true) + ' to ' + pill(d.to, true) + '</li>'; }).join('') + '</ul>' : '<p class="muted">No decision changed.</p>') });
    D.rerender();
  } else if (act === 'conf-ids') {
    var ids = el.getAttribute('data-ids');
    S.filterIds = ids ? ids.split(',') : []; S.filterLabel = el.getAttribute('data-v') + '-confidence decisions'; S.filter = 'all'; S.q = ''; S.tab = 'decisions';
    D.rerender();
  }
});
document.addEventListener('change', function (e) {
  var t = e.target, i = t.getAttribute && (t.getAttribute('data-sc-key') || t.getAttribute('data-sc-val'));
  if (i == null) return;
  if (t.hasAttribute('data-sc-key')) { V.changes[+i] = { key: t.value, value: current(t.value) }; }
  else { var v = parseFloat(t.value); if (isNaN(v)) return; V.changes[+i].value = v; }
  body();
});

var css = document.createElement('style');
css.textContent = [
  '.conf { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600; color: var(--muted); white-space: nowrap; }',
  '.conf i, .ctile i { width: 14px; height: 6px; border-radius: 3px; border: 1px solid currentColor; display: inline-block; background: linear-gradient(90deg, currentColor var(--f), transparent var(--f)); }',
  '.c-high { --f: 100%; } .c-medium { --f: 60%; } .c-low { --f: 25%; }',
  '.conf.c-low { color: var(--no); } .conf.c-medium { color: var(--hold); } .conf.c-high { color: var(--ok); }',
  '.scen h4 { font-family: var(--display); font-size: 15px; } .scen h4.mt { margin: 22px 0 6px; }',
  '.ctiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }',
  '.ctile { display: flex; flex-direction: column; align-items: flex-start; text-align: left; border: 1.5px solid var(--line); border-radius: 10px; background: var(--surface); padding: 10px 12px; }',
  '.ctile:hover { border-color: var(--accent); } .ctile b { font-family: var(--display); font-size: 26px; font-weight: 800; line-height: 1.1; }',
  '.ctile span { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); }',
  '.ctile.c-low b { color: var(--no); } .ctile.c-medium b { color: var(--hold); } .ctile.c-high b { color: var(--ok); }',
  '.fraglist { list-style: none; padding: 0; margin: 6px 0; } .fraglist > li { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; margin-bottom: 6px; font-size: 14px; }',
  '.fraglist ul { margin: 4px 0 0; padding-left: 18px; color: var(--muted); font-size: 13.5px; }',
  '.sc-pre { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 10px; }',
  '.sc-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }',
  '.sc-row select, .sc-row input { border: 1px solid var(--line); border-radius: 8px; padding: 5px 9px; background: var(--surface); font-size: 13.5px; }',
  '.sc-row select { max-width: 100%; } .sc-row input { width: 90px; }',
  '.sc-out { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 18px; margin-top: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }',
  '.sc-out h4 { margin-bottom: 4px; } .sc-out td.up { color: var(--ok); font-weight: 600; } .sc-out td.down { color: var(--no); font-weight: 600; }',
  '@media (max-width: 720px) { .sc-out { grid-template-columns: minmax(0, 1fr); } .ctiles { grid-template-columns: minmax(0, 1fr); } }'
].join('\n');
document.head.appendChild(css);
})();
