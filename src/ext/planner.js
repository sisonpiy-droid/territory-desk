// Pipeline plan tab: applicants needed to fill the remaining slots, by territory, from this file's placement rate.
// Logic in src/modules/planner.js; outreach pins ranked by the Site finder's crowd estimate when available.
(function () {
'use strict';
var D = window.__desk, S = D.S, esc = D.esc, P = window.DeskPlanner, Geo = window.DeskGeo, LV = window.DeskLevers;
var cfg = JSON.parse(JSON.stringify(P.DEFAULTS));
var owners = {}; Object.keys(LV.LEVERS).forEach(function (k) { owners[k] = LV.LEVERS[k].owner; });
var money = { cost: '', value: '' };   // the team's own numbers; blank until typed
function pct(x) { return Math.round(100 * x) + '%'; }
function crowdAt(p) { return Geo && Geo.data ? Geo.pinCrowd(p, Geo.cfg) : null; }
function inp(k, val, unit, label) { return '<label class="pp-in"><span>' + label + '</span><input type="number" min="0" step="1" value="' + val + '" data-pp="' + k + '"><small>' + unit + '</small></label>'; }

function tabHtml() {
  var p = P.plan(S, cfg, crowdAt), short = p.rows.filter(function (r) { return r.gap > 0; });
  var lo = 0, hi = 0; short.forEach(function (r) { lo += r.range[0] || 0; hi += r.range[1] || 0; });
  var head = '<div class="pp-tiles">' +
    '<div><small>Placement rate in this file</small><b>' + pct(p.rate) + '</b><span>' + p.placed + ' placed of ' + p.received + ' received</span></div>' +
    '<div><small>Open slots left</small><b>' + p.total.open + '</b><span>in ' + short.length + ' territor' + (short.length === 1 ? 'y' : 'ies') + '</span></div>' +
    '<div><small>New applicants needed</small><b>' + p.total.needed + '</b><span>likely range ' + lo + ' to ' + hi + '</span></div></div>' +
    '<p class="pp-warn">Small sample: with ' + p.received + ' applications, the true placement rate could be anywhere from ' + pct(p.ci[0]) + ' to ' + pct(p.ci[1]) + ' (90% range), so the counts below are rough. They firm up as more files come in.</p>';
  var rows = p.rows.map(function (r) {
    var outreach = r.gap > 0 ? r.pins.slice(0, 3).map(function (x) { return '<button class="chip sm" data-act="geo-open" data-v="' + esc(x.pin) + '">' + esc(x.pin) + (x.crowd != null ? ' · ' + Math.round(x.crowd) : '') + '</button>'; }).join(' ') : '';
    return '<tr' + (r.gap > 0 ? '' : ' class="pp-done"') + '><td><b>' + esc(r.id) + '</b> ' + esc(r.city) + '<br><span class="prio p-' + r.priority.toLowerCase().slice(0, 3) + '">' + r.priority + '</span></td>' +
      '<td>' + r.open + ' of ' + r.slots + '</td><td>' + r.received + '</td><td>' + pct(r.rate) + (r.ownRate ? '' : ' <small class="muted">overall</small>') + '</td>' +
      '<td>' + (r.fixable.length ? r.fixable.map(esc).join(', ') + (r.fromHolds ? ' <small class="muted">(' + r.fromHolds + ' counted)</small>' : '') : '–') + '</td>' +
      '<td><b>' + (r.gap > 0 ? (r.needed == null ? '?' : r.needed) : 0) + '</b>' + (r.gap > 0 && r.range[0] != null ? ' <small class="muted">' + r.range[0] + ' to ' + (r.range[1] == null ? 'many' : r.range[1]) + '</small>' : '') + '</td>' +
      '<td>' + (r.gap > 0 ? r.perWeek + '/wk' : '') + '</td><td>' + (outreach || (r.gap > 0 ? '<span class="muted sm">no open pin</span>' : '')) + '</td></tr>';
  }).join('');
  var targets = short.map(function (r) {
    return '<li><b>' + esc(r.id) + ' ' + esc(r.city) + '</b> (' + r.priority.toLowerCase() + ' priority): ' + (r.fixable.length ? 'first chase ' + r.fixable.map(esc).join(', ') + ' (a fixable hold that would take the slot); then ' : '') +
      'recruit about ' + (r.needed == null ? 'an unknown number of' : r.needed) + ' applicant' + (r.needed === 1 ? '' : 's') + (r.pins.length ? ', starting in pin' + (r.pins.length > 1 ? 's ' : ' ') + r.pins.slice(0, 3).map(function (x) { return x.pin; }).join(', ') : '') + '.</li>';
  }).join('');
  var levCards = p.rows.map(function (r) { return { r: r, ls: LV.levers(S, r, owners) }; }).filter(function (x) { return x.ls.length; }).map(function (x) {
    var be = LV.breakEven(money.cost, money.value);
    return '<div class="lv-c"><div class="lv-h"><b>' + esc(x.r.id) + ' ' + esc(x.r.city) + '</b> <span class="prio p-' + x.r.priority.toLowerCase().slice(0, 3) + '">' + x.r.priority + '</span> <span class="muted sm">' + (x.r.open > 0 ? x.r.open + ' open slot' + (x.r.open === 1 ? '' : 's') : 'full, with a waitlist') + '</span></div><ul>' +
      x.ls.map(function (l) { return '<li><b>' + esc(l.name) + '</b> <span class="lv-o">Owner: ' + esc(l.owner) + '</span><div class="muted sm">' + esc(l.why) + '</div></li>'; }).join('') + '</ul>' +
      (be != null && x.r.open > 0 ? '<p class="sm lv-b">With your numbers, an incentive of Rs ' + esc(money.cost) + ' lakh breaks even after ' + (Math.round(be * 10) / 10) + ' month' + (be === 1 ? '' : 's') + ' of a store earning the brand Rs ' + esc(money.value) + ' lakh a month.</p>' : '') + '</div>';
  }).join('');
  return '<div class="pp"><p class="muted sm">How many more applicants each territory needs to fill its open slots, using only this file. Highest-priority territories first.</p>' + head +
    '<div class="tscroll"><table class="cmp pp-t"><thead><tr><th>Territory</th><th>Open slots</th><th>Applied</th><th>Rate used</th><th>Fixable holds</th><th>New applicants needed</th><th>Per week</th><th>Where to recruit (crowd)</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    (levCards ? '<h4 class="mt">Territory levers</h4><p class="muted sm">What to do about each territory that is not filling, and who owns it. No money figures unless you type your own in the assumptions below.</p><div class="lv">' + levCards + '</div>' : '') +
    (targets ? '<h4 class="mt">Outreach targets</h4><ul class="pp-list">' + targets + '</ul>' : '<p>Every territory is full.</p>') +
    '<details class="sf-box"><summary>Assumptions (editable)</summary><div class="pp-grid">' +
      inp('ownRateFrom', cfg.ownRateFrom, 'applications', 'Use a territory\'s own rate from') +
      inp('holdClear', Math.round(cfg.holdClear * 100), '% of fixable holds; default 0 because the file has no history', 'Holds expected to clear') +
      inp('weeks', cfg.weeks, 'weeks', 'Recruit over') + '</div>' +
      '<h4 class="mt">Lever owners</h4><div class="pp-grid">' + Object.keys(LV.LEVERS).map(function (k) { return '<label class="pp-in pp-tx"><span>' + esc(LV.LEVERS[k].name) + '</span><input type="text" value="' + esc(owners[k]) + '" data-lv="' + k + '"></label>'; }).join('') + '</div>' +
      '<h4 class="mt">Incentive break-even (optional, your own numbers)</h4><div class="pp-grid">' +
        '<label class="pp-in"><span>Incentive cost per new partner</span><input type="number" min="0" step="any" value="' + esc(money.cost) + '" data-lvm="cost" placeholder="blank"><small>Rs lakh. No default: the file has no cost data.</small></label>' +
        '<label class="pp-in"><span>Value of one store to the brand per month</span><input type="number" min="0" step="any" value="' + esc(money.value) + '" data-lvm="value" placeholder="blank"><small>Rs lakh a month (fees, royalty, margin). No default.</small></label></div>' +
      '<p class="muted sm">Applicants needed = open slots (minus holds expected to clear) divided by the placement rate, rounded up. The range uses the 90% range of the rate. Crowd next to each pin is the Site finder\'s estimate at the pin centre (0 to 100 within the city).</p></details></div>';
}
window.DeskExt.assumptions.push(function () {
  var d = P.DEFAULTS;
  return [
    { area: 'Pipeline plan', name: "Use a territory's own placement rate from", def: d.ownRateFrom + ' applications', now: cfg.ownRateFrom + ' applications', where: 'Pipeline plan', how: "Compare each territory's rate with the brand's approval-to-placement history; below this sample size the overall rate is used." },
    { area: 'Pipeline plan', name: 'Share of fixable holds expected to clear', def: Math.round(d.holdClear * 100) + '%', now: Math.round(cfg.holdClear * 100) + '%', where: 'Pipeline plan', how: 'Share of held applicants in past files who fixed the gap within 30 days.' },
    { area: 'Pipeline plan', name: 'Recruiting period for a weekly target', def: d.weeks + ' weeks', now: cfg.weeks + ' weeks', where: 'Pipeline plan', how: "The brand's planned recruiting window for the territory." },
    { area: 'Territory levers', name: 'Lever owners', def: 'Named roles', now: Object.keys(owners).map(function (k) { return owners[k]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', '), where: 'Pipeline plan', changed: Object.keys(owners).some(function (k) { return owners[k] !== LV.LEVERS[k].owner; }), how: "Replace with the brand's real roles; each lever needs one named person." },
    { area: 'Territory levers', name: 'Incentive cost and value of a store to the brand', def: 'Blank (no money figures)', now: money.cost && money.value ? 'Rs ' + money.cost + ' lakh cost, Rs ' + money.value + ' lakh a month' : 'Blank', where: 'Pipeline plan', changed: !!(money.cost || money.value), how: 'Finance supplies the cost of an incentive and the monthly fees, royalty and margin of a store; the page shows only the break-even.' }
  ];
});
window.DeskExt.tabs.push({ id: 'pipeplan', label: 'Pipeline plan', render: tabHtml });

function redraw() { var b = document.getElementById('tabbody'); if (b) { b.innerHTML = tabHtml(); var d = b.querySelector('.sf-box'); if (d) d.open = true; } }
document.addEventListener('change', function (e) {
  var lv = e.target.getAttribute && e.target.getAttribute('data-lv'); if (lv) { owners[lv] = e.target.value.trim() || LV.LEVERS[lv].owner; redraw(); return; }
  var lm = e.target.getAttribute && e.target.getAttribute('data-lvm'); if (lm) { money[lm] = e.target.value; redraw(); return; }
  var k = e.target.getAttribute && e.target.getAttribute('data-pp'); if (!k) return;
  var v = parseFloat(e.target.value); if (isNaN(v) || v < 0) return;
  cfg[k] = k === 'holdClear' ? Math.min(100, v) / 100 : v;
  var b = document.getElementById('tabbody'); if (b) { b.innerHTML = tabHtml(); var d = b.querySelector('.sf-box'); if (d) d.open = true; }
});

var css = document.createElement('style');
css.textContent = [
  '.pp h3 { font-family: var(--display); font-size: 16px; font-weight: 800; } .pp h4.mt { font-family: var(--display); font-size: 14px; margin: 18px 0 6px; }',
  '.pp-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0; }',
  '.pp-tiles > div { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; }',
  '.pp-tiles small { font-size: 12px; color: var(--muted); } .pp-tiles b { font-family: var(--display); font-size: 24px; font-weight: 800; line-height: 1.15; } .pp-tiles span { font-size: 12px; color: var(--muted); }',
  '.pp-warn { font-size: 13px; background: color-mix(in srgb, var(--hold) 8%, var(--surface)); border: 1px solid color-mix(in srgb, var(--hold) 28%, transparent); padding: 6px 10px; border-radius: 8px; }',
  '.lv { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; } .lv-c { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; } .lv-c ul { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 14px; } .lv-o { font-size: 12px; color: var(--muted); margin-left: 6px; } .lv-b { margin: 8px 0 0; padding-top: 8px; border-top: 1px dashed var(--line); } .pp-tx { grid-template-columns: 1fr; } .pp-tx input { width: 100%; text-align: left; }',
  '.pp-t td, .pp-t th { text-align: left; vertical-align: top; } .pp-t tr.pp-done td { color: var(--muted); }',
  '.prio.p-med { color: var(--hold); } .prio.p-hig { color: var(--no); }',
  '.pp-list { padding-left: 18px; font-size: 14px; } .pp-list li { margin-bottom: 5px; }',
  '.pp-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 18px; margin: 8px 0; }',
  '.pp-in { display: grid; grid-template-columns: 1fr 64px; gap: 0 8px; align-items: center; font-size: 13px; } .pp-in input { border: 1px solid var(--line); border-radius: 6px; padding: 3px 6px; background: var(--surface); text-align: right; } .pp-in small { grid-column: 1 / -1; color: var(--muted); font-size: 12px; }',
  '@media (max-width: 720px) { .pp-tiles, .pp-grid { grid-template-columns: minmax(0, 1fr); } }'
].join('\n');
document.head.appendChild(css);
})();
