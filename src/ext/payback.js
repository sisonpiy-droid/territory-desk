// Payback band on each record: best, base and worst months to recover the investment. Illustrative, not a forecast.
(function () {
'use strict';
var D = window.__desk, S = D.S, esc = D.esc, PB = window.DeskPayback;
var cfg = JSON.parse(JSON.stringify(PB.DEFAULTS));
var pcts = PB.STRESS_PCTS.slice();   // the sales levels of the bad-six-months test, as a share of base sales
function lakh(x) { return (Math.round(x * 10) / 10).toString(); }
function stressHtml(a, r, b) {
  var floor = r.tier ? S.cfg.floors[r.tier] : null, spare = Math.max(0, (a.invest || 0) - (floor || 0));
  var t = PB.stress(b.invest, spare, cfg, pcts);
  var rows = t.rows.map(function (x) {
    return '<tr><td>' + x.pct + '% of base</td><td>Rs ' + lakh(x.sales) + ' lakh</td><td class="' + (x.monthly < 0 ? 'neg' : '') + '">' + (x.monthly >= 0 ? '+' : '') + lakh(x.monthly) + '</td><td class="' + (x.six < 0 ? 'neg' : '') + '">' + (x.six >= 0 ? '+' : '') + lakh(x.six) + '</td><td>' +
      (x.monthly < 0 ? (x.runway > 0 ? 'Spare capital lasts ' + lakh(x.runway) + ' months' : '<b class="neg">No spare capital to cover the loss</b>') : 'Covers its costs; payback in ' + x.payback.toFixed(0) + ' months') + '</td></tr>';
  }).join('');
  return '<h4>Bad six months <span class="pb-tag">Illustrative, not a forecast</span></h4><table class="cmp pb-t"><thead><tr><th>Sales run at</th><th>Monthly sales</th><th>Monthly result</th><th>Six months</th><th>What it means</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<p class="muted sm">Results in Rs lakh after gross margin and running costs. The store covers its running costs down to Rs ' + lakh(t.breakEvenSales) + ' lakh a month, about ' + t.breakEvenPct + '% of base sales. Spare capital is the applicant\'s stated investment minus the Rs ' + (floor || 0) + ' lakh store cost: Rs ' + lakh(spare) + ' lakh. Check against the first six months of sales at existing stores.</p>';
}
function mo(x) { return x == null ? 'never' : x.toFixed(0) + ' months'; }
function inp(k, val, label, unit) { return '<label class="pb-in"><span>' + label + '</span><input type="number" step="0.1" min="0" value="' + val + '" data-pb="' + k + '"><small>' + unit + '</small></label>'; }

window.DeskExt.afterDetail.push({ group: 'plan', fn: function (a, r) {
  if (r.outcome === 'Reject') return '';
  var floor = r.tier ? S.cfg.floors[r.tier] : null, b = PB.band(a, floor, cfg); if (!b) return '';
  var cal = PB.calibration(cfg);
  return '<h4>Payback band <span class="pb-tag">Illustrative scenario, not a forecast</span></h4>' +
    '<div class="pb"><div><small>Best</small><b>' + mo(b.best) + '</b></div><div class="base"><small>Base</small><b>' + mo(b.base) + '</b></div><div><small>Worst</small><b>' + mo(b.worst) + '</b></div></div>' +
    '<p class="muted sm">To recover Rs ' + b.invest + ' lakh (' + (cfg.invest === 'applicant' ? 'the applicant\'s stated investment' : 'the minimum store investment for a ' + esc(r.tier) + ' city') + ') at Rs ' + cfg.sales.best + ' / ' + cfg.sales.base + ' / ' + cfg.sales.worst + ' lakh monthly sales, ' + Math.round(cfg.margin * 100) + '% gross margin and Rs ' + cfg.running + ' lakh monthly running costs.</p>' +
    stressHtml(a, r, b) +
    '<details class="pb-a"><summary>Change the payback inputs (apply to every applicant)</summary>' +
      '<p class="muted sm">There is no brand data for these. The placeholders were set so that a Rs 25 to 35 lakh store pays back in 12 to 18 months in the base case, the range publicly quoted for a Lenskart-type store (an unofficial, third-party figure). With the current inputs that is ' + mo(cal.low) + ' to ' + mo(cal.high) + '.</p>' +
      '<div class="pb-grid">' + inp('sales.best', cfg.sales.best, 'Monthly sales, best', 'Rs lakh') + inp('sales.base', cfg.sales.base, 'Monthly sales, base', 'Rs lakh') + inp('sales.worst', cfg.sales.worst, 'Monthly sales, worst', 'Rs lakh') +
      inp('margin', Math.round(cfg.margin * 100), 'Gross margin', '%') + inp('running', cfg.running, 'Monthly running costs', 'Rs lakh') +
      inp('stress.0', pcts[0], 'Bad-month sales level 1', '% of base sales') + inp('stress.1', pcts[1], 'Bad-month sales level 2', '% of base sales') + inp('stress.2', pcts[2], 'Bad-month sales level 3', '% of base sales') +
      '<label class="pb-in"><span>Investment to recover</span><select data-pb="invest"><option value="floor"' + (cfg.invest === 'floor' ? ' selected' : '') + '>Store cost for the tier</option><option value="applicant"' + (cfg.invest === 'applicant' ? ' selected' : '') + '>Applicant\'s stated figure</option></select></label></div></details>';
} });

window.DeskExt.assumptions.push(function () {
  var d = PB.DEFAULTS, same = function (a, b) { return String(a) === String(b); };
  return [
    { area: 'Payback and bad six months', name: 'Monthly sales: best / base / worst (Rs lakh)', def: [d.sales.best, d.sales.base, d.sales.worst].join(' / '), now: [cfg.sales.best, cfg.sales.base, cfg.sales.worst].join(' / '), where: 'A record, Plan tab', how: "Set so a Rs 25 to 35 lakh store pays back in 12 to 18 months (public, unofficial quote). Replace with the brand's average monthly sales by tier from existing stores." },
    { area: 'Payback and bad six months', name: 'Gross margin', def: Math.round(d.margin * 100) + '%', now: Math.round(cfg.margin * 100) + '%', where: 'A record, Plan tab', how: "Finance's gross margin on a typical basket at existing stores." },
    { area: 'Payback and bad six months', name: 'Monthly running costs (rent, staff, utilities)', def: 'Rs ' + d.running + ' lakh', now: 'Rs ' + cfg.running + ' lakh', where: 'A record, Plan tab', how: 'Average monthly cost of an existing store, by tier, from the franchise P&L.' },
    { area: 'Payback and bad six months', name: 'Bad-month sales levels', def: PB.STRESS_PCTS.join('%, ') + '% of base', now: pcts.join('%, ') + '% of base', where: 'A record, Plan tab', how: 'Compare with the lowest first-six-month sales at existing stores as a share of their steady-state sales.' },
    { area: 'Payback and bad six months', name: 'Investment to recover', def: 'Store cost for the tier', now: cfg.invest === 'floor' ? 'Store cost for the tier' : "Applicant's stated figure", where: 'A record, Plan tab', how: "Actual fit-out and opening cost of the last stores, by tier." }
  ].map(function (r) { r.changed = !same(r.def, r.now); return r; });
});

document.addEventListener('change', function (e) {
  var k = e.target.getAttribute && e.target.getAttribute('data-pb'); if (!k) return;
  if (k === 'invest') cfg.invest = e.target.value;
  else if (k.indexOf('stress.') === 0) { var sv = parseFloat(e.target.value); if (isNaN(sv) || sv <= 0 || sv > 200) return; pcts[+k.slice(7)] = sv; }
  else {
    var v = parseFloat(e.target.value); if (isNaN(v) || v < 0) return;
    if (k === 'margin') v = Math.min(100, v) / 100;
    var p = k.split('.'), o = cfg; for (var i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = v;
  }
  D.rerender();
  var d = document.querySelector('.pb-a'); if (d) d.open = true;
});

var css = document.createElement('style');
css.textContent = '.pb-t td, .pb-t th { text-align: left; } .pb-t td.neg, b.neg { color: var(--no); }' + '.pb { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 4px 0 6px; } .pb > div { border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; background: var(--surface2); }' +
  ' .pb > div.base { border-color: var(--accent); } .pb small { display: block; font-size: 12px; color: var(--muted); } .pb b { font-family: var(--display); font-size: 17px; }' +
  ' .pb-tag { font-family: var(--body); font-size: 11.5px; font-weight: 600; color: var(--hold); border: 1px solid var(--hold); border-radius: 4px; padding: 0 6px; margin-left: 6px; vertical-align: 2px; }' +
  ' .pb-a summary { cursor: pointer; font-size: 13px; color: var(--accent); } .pb-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 14px; margin-top: 6px; }' +
  ' .pb-in { display: grid; grid-template-columns: 1fr 72px; gap: 0 8px; align-items: center; font-size: 13px; } .pb-in input, .pb-in select { border: 1px solid var(--line); border-radius: 6px; padding: 3px 6px; background: var(--surface); } .pb-in select { grid-column: 2; width: auto; min-width: 72px; } .pb-in small { grid-column: 1 / -1; color: var(--muted); font-size: 11.5px; }';
document.head.appendChild(css);
})();
