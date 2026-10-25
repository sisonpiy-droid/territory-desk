// Charts for the Overview: where the decisions landed, how full each territory is, how score and catchment overlap relate,
// and why applications are held or rejected. Pure read-outs of the live decisions: nothing here changes a decision.
// Inline SVG and HTML only; colours come from the page tokens so light and dark both work.
(function () {
'use strict';
var D = window.__desk, S = D.S, esc = D.esc, Geo = window.DeskGeo, O = window.DeskOps;
var OUT = [['Approve', 'Approved', 'ok'], ['Waitlist', 'Waitlisted', 'wait'], ['Hold', 'On hold', 'hold'], ['Reject', 'Rejected', 'no']];
function live() { return S.apps.filter(function (a) { return !a.withdrawn && S.run.res[a.id]; }); }
function pct(x) { return Math.round(100 * x) + '%'; }

/* 1. decision mix: one bar, 100% of live applications */
function mixHtml() {
  var l = live(), n = l.length || 1, counts = {};
  OUT.forEach(function (o) { counts[o[0]] = 0; });
  l.forEach(function (a) { counts[S.run.res[a.id].outcome]++; });
  var x = 0, W = 400, gap = 2, segs = OUT.filter(function (o) { return counts[o[0]]; }).map(function (o, i, arr) {
    var w = Math.max(4, counts[o[0]] / n * (W - gap * (arr.length - 1))), s = '<rect class="c-' + o[2] + '" x="' + x.toFixed(1) + '" y="0" width="' + w.toFixed(1) + '" height="28" rx="4"><title>' + o[1] + ': ' + counts[o[0]] + ' of ' + l.length + ' (' + pct(counts[o[0]] / n) + ')</title></rect>';
    x += w + gap; return s;
  }).join('');
  var legend = OUT.map(function (o) { return '<li><i class="sw c-' + o[2] + '"></i>' + o[1] + ' <b>' + counts[o[0]] + '</b> <span>' + pct(counts[o[0]] / n) + '</span></li>'; }).join('');
  return '<div class="card ch"><h3>Where the decisions landed</h3><p class="muted sm">All ' + l.length + ' live applications, by outcome.</p>' +
    '<svg class="ch-svg" viewBox="0 0 ' + W + ' 28" role="img" aria-label="Decisions: ' + OUT.map(function (o) { return counts[o[0]] + ' ' + o[1].toLowerCase(); }).join(', ') + '" preserveAspectRatio="none">' + segs + '</svg>' +
    '<ul class="ch-legend">' + legend + '</ul></div>';
}

/* 2. slots by territory: one pip per slot, filled or open */
function slotsHtml() {
  var ters = S.ters, max = 1;
  ters.forEach(function (t) { max = Math.max(max, t.slots); });
  var W = 400, lab = 150, pip = Math.min(18, Math.floor((W - lab - 4) / max) - 4), rowH = 28;
  var rows = ters.map(function (t, i) {
    var f = Math.min(t.slots, S.run.approvedByTer[t.id] || 0), y = i * rowH, pips = '';
    for (var k = 0; k < t.slots; k++) pips += '<rect class="' + (k < f ? 'c-ok' : 'c-open') + '" x="' + (lab + k * (pip + 4)) + '" y="' + (y + (rowH - pip) / 2) + '" width="' + pip + '" height="' + pip + '" rx="3"></rect>';
    return '<g><title>' + esc(t.id + ' ' + t.city + ' (' + t.priority.toLowerCase() + ' priority): ' + f + ' of ' + t.slots + ' slots filled') + '</title>' +
      '<text class="ch-t" x="0" y="' + (y + rowH / 2 + 4) + '">' + esc(t.id) + ' ' + esc(t.city.length > 11 ? t.city.slice(0, 10) + '.' : t.city) + '</text>' + pips +
      '<text class="ch-n" x="' + (lab + t.slots * (pip + 4) + 4) + '" y="' + (y + rowH / 2 + 4) + '">' + f + '/' + t.slots + '</text></g>';
  }).join('');
  return '<div class="card ch"><h3>Slots by territory</h3><p class="muted sm">One square per slot. Green is filled by an approval, empty is still open.</p>' +
    '<svg class="ch-svg" viewBox="0 0 ' + W + ' ' + (ters.length * rowH) + '" role="img" aria-label="Slots filled in each territory">' + rows + '</svg></div>';
}

/* 3. score against catchment overlap, for the applicants where a store would actually open */
function scatterHtml() {
  if (!Geo || !Geo.data || !Geo.applicantOverlap) return '';
  var appr = live().filter(function (a) { return S.run.res[a.id].outcome === 'Approve'; }).map(function (a) { return { id: a.id, pin: a.pin }; });
  var pts = [];
  live().forEach(function (a) {
    var r = S.run.res[a.id]; if (r.outcome !== 'Approve' && r.outcome !== 'Waitlist') return;
    var o = Geo.applicantOverlap(a.pin, appr, Geo.cfg, a.id); if (!o || !o.ok) return;
    pts.push({ a: a, r: r, share: o.share });
  });
  if (!pts.length) return '';
  var W = 420, H = 250, L = 38, B = 28, T = 8, R = 10, pw = W - L - R, ph = H - T - B;
  var X = function (v) { return L + Math.min(1, v) * pw; }, Y = function (v) { return T + (1 - Math.max(0, Math.min(100, v)) / 100) * ph; };
  var grid = [0, 25, 50, 75, 100].map(function (v) { return '<line class="ch-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text class="ch-ax" x="' + (L - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + v + '</text>'; }).join('') +
    [0, .25, .5, .75, 1].map(function (v) { return '<text class="ch-ax" x="' + X(v) + '" y="' + (H - 8) + '" text-anchor="middle">' + pct(v) + '</text>'; }).join('');
  var cfg = Geo.cfg, lines = '';
  [[cfg.flagAt, 'flag', 'Flag'], [cfg.vetoAt, 'veto', 'Suggest hold']].forEach(function (l) {
    if (l[0] == null || l[0] > 1) return;
    lines += '<line class="ch-lim ' + l[1] + '" x1="' + X(l[0]) + '" x2="' + X(l[0]) + '" y1="' + T + '" y2="' + (T + ph) + '"/><text class="ch-ax lim ' + l[1] + '" x="' + (X(l[0]) + 4) + '" y="' + (T + 26) + '">' + l[2] + ' at ' + pct(l[0]) + '</text>';
  });
  var dots = pts.map(function (p) {
    var cls = p.r.outcome === 'Approve' ? 'c-ok' : 'c-wait';
    return '<circle class="ch-dot ' + cls + '" cx="' + X(p.share).toFixed(1) + '" cy="' + Y(p.r.score).toFixed(1) + '" r="6"><title>' + esc(p.a.id + ' ' + p.a.name + ': score ' + p.r.score + ', overlap ' + pct(p.share) + ', ' + p.r.outcome.toLowerCase()) + '</title></circle>';
  }).join('');
  var axisT = '<text class="ch-ax" x="' + (L + pw / 2) + '" y="' + (H + 8) + '" text-anchor="middle"></text>';
  return '<div class="card ch"><h3>Score against catchment overlap</h3><p class="muted sm">Approved and waitlisted applicants. Right means more of the nearby crowd is already reached by another store.</p>' +
    '<svg class="ch-svg sq" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Score against catchment overlap for ' + pts.length + ' applicants">' + grid + lines + dots + axisT + '</svg>' +
    '<ul class="ch-legend"><li><i class="sw c-ok"></i>Approved</li><li><i class="sw c-wait"></i>Waitlisted</li><li class="muted">Up is a higher score, right is more overlap</li></ul></div>';
}

/* 4. why applications drop out: the reasons behind the holds and rejections */
function reasonsHtml() {
  if (!O || !O.pipeline) return '';
  var tally = {};
  O.pipeline(S).slice(1).forEach(function (s) { s.reasons.forEach(function (r) { tally[r.reason] = (tally[r.reason] || 0) + r.n; }); });
  var rows = Object.keys(tally).map(function (k) { return [k, tally[k]]; }).sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); });
  if (!rows.length) return '<div class="card ch"><h3>Why applications drop out</h3><p class="muted sm">Nothing has dropped out of this file.</p></div>';
  var top = rows.slice(0, 6), rest = rows.slice(6).reduce(function (n, r) { return n + r[1]; }, 0), max = top[0][1];
  if (rest) top.push(['Other reasons', rest]);
  max = Math.max.apply(null, top.map(function (r) { return r[1]; }));
  return '<div class="card ch"><h3>Why applications drop out</h3><p class="muted sm">Reasons given for holds and rejections, most common first.</p><ul class="ch-bars">' + top.map(function (r) {
    return '<li><span class="ch-bl">' + esc(r[0].charAt(0).toUpperCase() + r[0].slice(1)) + '</span><span class="ch-bt"><i style="width:' + Math.max(4, r[1] / max * 100).toFixed(1) + '%"></i></span><b>' + r[1] + '</b></li>';
  }).join('') + '</ul></div>';
}

function html() {
  if (!S.run) return '';
  return '<div class="ch-grid2"><div class="ch-col">' + mixHtml() + scatterHtml() + '</div><div class="ch-col">' + slotsHtml() + reasonsHtml() + '</div></div>';
}
window.DeskCharts = { html: html };

var css = document.createElement('style');
css.textContent = [
  '.ch-grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 12px; margin-top: 12px; }',
  '.ch-col { display: grid; gap: 12px; align-content: start; min-width: 0; }',
  '.ch h3 { margin: 0 0 2px; } .ch > p { margin: 0 0 12px; }',
  '.ch-svg { display: block; width: 100%; height: auto; overflow: visible; } .ch-svg.sq { max-height: 260px; }',
  '.ch-svg rect, .ch-svg circle { stroke: var(--surface); stroke-width: 2px; }',
  '.c-ok { fill: var(--ok); background: var(--ok); } .c-wait { fill: var(--wait); background: var(--wait); } .c-hold { fill: var(--hold); background: var(--hold); } .c-no { fill: var(--no); background: var(--no); }',
  '.c-open { fill: var(--surface2); stroke: var(--line) !important; stroke-width: 1.5px !important; }',
  '.ch-t { font-size: 11px; fill: var(--ink); } .ch-n { font-size: 11px; fill: var(--muted); font-variant-numeric: tabular-nums; } .ch-ax { font-size: 11px; fill: var(--muted); font-variant-numeric: tabular-nums; }',
  '.ch-grid { stroke: var(--line2); stroke-width: 1; } .ch-lim { stroke-width: 1.5; stroke-dasharray: 4 3; } .ch-lim.flag, .ch-ax.lim.flag { stroke: var(--hold); } .ch-lim.veto, .ch-ax.lim.veto { stroke: var(--no); }',
  '.ch-ax.lim { stroke: none; } .ch-ax.lim.flag { fill: var(--hold); } .ch-ax.lim.veto { fill: var(--no); font-weight: 600; }',
  '.ch-dot { cursor: default; } .ch-dot:hover { stroke: var(--ink); }',
  '.ch-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; list-style: none; margin: 10px 0 0; padding: 0; font-size: 13px; }',
  '.ch-legend li { display: inline-flex; align-items: center; gap: 6px; } .ch-legend span { color: var(--muted); } .ch-legend b { font-variant-numeric: tabular-nums; }',
  '.sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }',
  '.ch-bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }',
  '.ch-bars li { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) 24px; gap: 10px; align-items: center; font-size: 13px; }',
  '.ch-bl { overflow-wrap: anywhere; } .ch-bt { height: 10px; border-radius: 5px; background: var(--surface2); } .ch-bt i { display: block; height: 100%; border-radius: 5px; background: var(--hold); }',
  '.ch-bars b { text-align: right; font-variant-numeric: tabular-nums; }',
  '@media (max-width: 520px) { .ch-grid2 { grid-template-columns: minmax(0, 1fr); } }'
].join('\n');
document.head.appendChild(css);
})();
