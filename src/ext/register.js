// Assumptions register: every number the tool depends on, with its default, its current value, where to change it,
// and the real-world check that would confirm it. This is the slide 4 table, kept in step with the live app.
// Other pages add their own rows through DeskExt.assumptions; the core rules and the Site finder are listed here.
(function () {
'use strict';
var D = window.__desk, S = D.S, E = D.E, esc = D.esc, Geo = window.DeskGeo, GL = window.DeskGoLive, WI = window.DeskWhatIf;
var AREA_ORDER = ['Decision rules', 'Scoring', 'Timing and onboarding', 'Offers', 'Pipeline plan', 'Territory levers', 'Site finder', 'Catchment overlap', 'Payback and bad six months', 'Confidence and fragility', 'Time saved'];

function row(area, name, def, now, where, how) { return { area: area, name: name, def: String(def), now: String(now), where: where, how: how }; }
var j = function (a) { return a.join(' / '); };

function coreRows() {
  var d = E.DEFAULT_CFG, c = S.cfg, w = d.weights, cw = c.weights, out = [];
  out.push(row('Decision rules', 'Minimum investment by city tier (Tier 1 / 2 / 3, Rs lakh)', j([d.floors['Tier 1'], d.floors['Tier 2'], d.floors['Tier 3']]), j([c.floors['Tier 1'], c.floors['Tier 2'], c.floors['Tier 3']]), 'Assumptions page',
    "Actual fit-out and opening cost of the brand's last stores in each tier. The public quote of Rs 20 to 35 lakh is third-party and unofficial."));
  out.push(row('Decision rules', 'Reject below this share of the minimum investment', Math.round(d.rejectRatio * 100) + '%', Math.round(c.rejectRatio * 100) + '%', 'Assumptions page', 'Share of held applicants in past files who closed a funding gap within 30 days; below this level, check whether anyone ever did.'));
  out.push(row('Decision rules', 'Minimum space (sq ft)', d.minSpace, c.minSpace, 'Assumptions page', 'Sales per sq ft by size band across existing stores. A public listing quotes 250 to 500 sq ft.'));
  out.push(row('Decision rules', 'Ideal space range (sq ft)', d.idealMin + ' to ' + d.idealMax, c.idealMin + ' to ' + c.idealMax, 'Assumptions page', 'Same check: which size band performs best at existing stores.'));
  out.push(row('Decision rules', 'Upper floors are held; ground floor and mall units pass', 'Fixed rule', 'Fixed rule', 'Engine rule', 'Footfall and sales of existing upper-floor versus ground-floor stores.'));
  out.push(row('Decision rules', 'One store per pin code', 'Fixed rule', 'Fixed rule', 'Engine rule', 'Stated in the brief; confirm with the brand whether very large pin codes can ever take two stores.'));
  out.push(row('Timing and onboarding', 'Earliest realistic opening (weeks), and extra if no space yet', d.earliestWeeks + ' + ' + d.noSpaceExtraWeeks, c.earliestWeeks + ' + ' + c.noSpaceExtraWeeks, 'Assumptions page', 'Time each step (agreement, fit-out, training, opening) for the last 5 stores and use the 80th percentile.'));
  out.push(row('Timing and onboarding', 'First-time retailer if under (years of experience)', d.firstTimerYears, c.firstTimerYears, 'Assumptions page', 'Compare the first 90 days of sales of first-time and experienced retailers at existing stores; set the cut-off where they separate.'));
  if (GL) out.push(row('Timing and onboarding', 'Go-live gates, days before opening (licences, GST, fit-out, training, stock, signage, POS)', GL.GATES.map(function (g) { return g.before; }).join(' / '), GL.GATES.map(function (g) { return g.before; }).join(' / '), 'Source code (golive.js)', 'Actual lead times of each gate at the last stores; move the due dates to match.'));
  out.push(row('Scoring', 'Spacing risk: high within, medium within (pin numbers apart)', d.cannibNear + ' / ' + d.cannibMid, c.cannibNear + ' / ' + c.cannibMid, 'Assumptions page', 'Replace pin-number distance with real distance, then check how much sales fell at the nearest store when a new one opened within 2 km.'));
  out.push(row('Scoring', 'Score weights (capital / experience / space / timeline / spacing / data)', j([w.capital, w.experience, w.space, w.timeline, w.cannibal, w.data]), j([cw.capital, cw.experience, cw.space, cw.timeline, cw.cannibal, cw.data]), 'Assumptions page', 'Back-test: do past applicants who scored higher run better stores (12-month sales)? Re-weight until the ranking matches.'));
  if (WI) {
    out.push(row('Confidence and fragility', 'High / medium confidence cut-offs (points clear of the next rival)', WI.CONF.high + ' / ' + WI.CONF.medium, WI.CONF.high + ' / ' + WI.CONF.medium, 'Source code (whatif.js)', 'Review the low-confidence decisions with the expansion head for a month; widen or narrow the cut-offs to match where people actually disagreed.'));
    out.push(row('Confidence and fragility', 'A decision is fragile if it flips when a threshold moves by', Math.round(WI.NUDGE * 100) + '%', Math.round(WI.NUDGE * 100) + '%', 'Source code (whatif.js)', "Set to the team's real uncertainty about each threshold (for example the spread of fit-out costs across the last stores)."));
  }
  if (Geo && Geo.data) {
    var g = Geo.DEFAULTS, k = Geo.cfg;
    out.push(row('Site finder', 'Crowd blend: share from residents (rest is daytime activity)', Math.round(g.residentShare * 100) + '%', Math.round(k.residentShare * 100) + '%', 'Site finder, Assumptions', 'Back-test against sales by hexagon at existing stores once store addresses are available.'));
    out.push(row('Site finder', 'Weight of the 6 touching and the next 12 hexagons', g.ring1 + ' / ' + g.ring2, k.ring1 + ' / ' + k.ring2, 'Site finder, Assumptions', "Customer home postcodes from billing: how far from the store do customers actually come?"));
    out.push(row('Site finder', 'Activity points per place (market, mall, rail and so on)', Object.keys(g.act).map(function (x) { return g.act[x]; }).join(' / '), Object.keys(k.act).map(function (x) { return k.act[x]; }).join(' / '), 'Site finder, Assumptions', 'Walk-in counts at existing stores near each kind of place.'));
    out.push(row('Catchment overlap', 'Store catchment radius by tier (Tier 1 / 2 / 3, km)', j([g.radius['Tier 1'], g.radius['Tier 2'], g.radius['Tier 3']]), j([k.radius['Tier 1'], k.radius['Tier 2'], k.radius['Tier 3']]), 'Site finder, Assumptions', 'Customer-origin data: the radius that holds 80% of existing stores\' customers. Existing stores overlap each other by under 20% at 2 km.'));
    out.push(row('Catchment overlap', 'Overlap that flags / suggests a hold', Math.round(g.flagAt * 100) + '% / ' + Math.round(g.vetoAt * 100) + '%', Math.round(k.flagAt * 100) + '% / ' + Math.round(k.vetoAt * 100) + '%', 'Site finder, Assumptions', 'Sales change at the nearest store after a new opening, by overlap level.'));
    out.push(row('Site finder', 'Overlap penalty (points per 1% of crowd already reached)', g.penalty, k.penalty, 'Site finder, Assumptions', 'Compare recommended sites with where the brand actually opened its best stores.'));
  }
  return out;
}

function allRows() {
  var rows = coreRows();
  window.DeskExt.assumptions.forEach(function (fn) { try { fn(S).forEach(function (r) { rows.push(r); }); } catch (e) { /* a page without rows is fine */ } });
  rows.forEach(function (r) { if (r.changed === undefined) r.changed = r.def !== r.now; });
  return rows.sort(function (a, b) { var i = AREA_ORDER.indexOf(a.area), k = AREA_ORDER.indexOf(b.area); return (i < 0 ? 99 : i) - (k < 0 ? 99 : k); });
}
function markdown(rows) {
  return '| Assumption | Default | How we would check it |\n|---|---|---|\n' + rows.map(function (r) { return '| ' + [r.name, r.def, r.how].map(function (x) { return String(x).replace(/\|/g, '/'); }).join(' | ') + ' |'; }).join('\n');
}
D.assumptionRows = allRows; D.assumptionMarkdown = function () { return markdown(allRows()); };

function tabHtml() {
  var rows = allRows(), changed = rows.filter(function (r) { return r.changed; }).length, areas = [];
  rows.forEach(function (r) { if (areas.indexOf(r.area) < 0) areas.push(r.area); });
  return '<div class="rg"><p class="muted sm">Every number the tool depends on. Each one is shown on screen, can be edited where it says, and has a real-world check that would confirm or replace it.</p>' +
    '<div class="rg-bar"><span><b>' + rows.length + '</b> assumptions, <b>' + changed + '</b> changed from the default</span><span class="grow"></span><button class="btn sm" data-act="rg-copy">Copy as the slide 4 table</button><button class="btn sm" data-act="rg-dl">Download as a sheet</button></div>' +
    areas.map(function (a) {
      return '<h4>' + esc(a) + '</h4><div class="tscroll"><table class="cmp rg-t"><thead><tr><th>Assumption</th><th>Default</th><th>Now</th><th>Change it</th><th>How we would check it</th></tr></thead><tbody>' +
        rows.filter(function (r) { return r.area === a; }).map(function (r) { return '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.def) + '</td><td class="' + (r.changed ? 'rg-ch' : '') + '">' + esc(r.now) + (r.changed ? ' <small>edited</small>' : '') + '</td><td>' + esc(r.where) + '</td><td>' + esc(r.how) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }).join('') + '</div>';
}
window.DeskExt.tabs.push({ id: 'register', label: 'Assumptions register', render: tabHtml });

window.DeskExt.exportSheets.push(function () {
  return { name: 'Assumptions register', rows: [['Area', 'Assumption', 'Default', 'Now', 'Change it', 'How we would check it']].concat(allRows().map(function (r) { return [r.area, r.name, r.def, r.now, r.where, r.how]; })) };
});

document.addEventListener('click', function (e) {
  var el = e.target.closest && e.target.closest('[data-act="rg-copy"],[data-act="rg-dl"]'); if (!el) return;
  if (el.getAttribute('data-act') === 'rg-copy') {
    var label = el.textContent, done = function () { el.textContent = 'Copied'; setTimeout(function () { el.textContent = label; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(markdown(allRows())).then(done, done); else done();
  } else {
    var wb = XLSX.utils.book_new(), sh = window.DeskExt.exportSheets[window.DeskExt.exportSheets.length - 1](S);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sh.rows), 'Assumptions register'); XLSX.writeFile(wb, 'assumptions-register.xlsx');
  }
});

var css = document.createElement('style');
css.textContent = '.rg h4 { font-family: var(--display); font-size: 14px; margin: 16px 0 6px; } .rg-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 10px 0 4px; font-size: 14px; }' +
  ' .rg-t td, .rg-t th { text-align: left; vertical-align: top; font-size: 13px; } .rg-t td:nth-child(2), .rg-t td:nth-child(3) { white-space: nowrap; } .rg-ch { color: var(--hold); font-weight: 600; } .rg-ch small { font-weight: 500; }';
document.head.appendChild(css);
})();
