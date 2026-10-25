// Payback band on each record: best, base and worst months to recover the investment. Illustrative, not a forecast.
(function () {
'use strict';
var D = window.__desk, S = D.S, esc = D.esc, PB = window.DeskPayback;
var cfg = JSON.parse(JSON.stringify(PB.DEFAULTS));
function mo(x) { return x == null ? 'never' : x.toFixed(0) + ' months'; }
function inp(k, val, label, unit) { return '<label class="pb-in"><span>' + label + '</span><input type="number" step="0.1" min="0" value="' + val + '" data-pb="' + k + '"><small>' + unit + '</small></label>'; }

window.DeskExt.afterDetail.push(function (a, r) {
  if (r.outcome === 'Reject') return '';
  var floor = r.tier ? S.cfg.floors[r.tier] : null, b = PB.band(a, floor, cfg); if (!b) return '';
  var cal = PB.calibration(cfg);
  return '<h4>Payback band <span class="pb-tag">Illustrative scenario, not a forecast</span></h4>' +
    '<div class="pb"><div><small>Best</small><b>' + mo(b.best) + '</b></div><div class="base"><small>Base</small><b>' + mo(b.base) + '</b></div><div><small>Worst</small><b>' + mo(b.worst) + '</b></div></div>' +
    '<p class="muted sm">To recover Rs ' + b.invest + ' lakh (' + (cfg.invest === 'applicant' ? 'the applicant\'s stated investment' : 'the minimum store investment for a ' + esc(r.tier) + ' city') + ') at Rs ' + cfg.sales.best + ' / ' + cfg.sales.base + ' / ' + cfg.sales.worst + ' lakh monthly sales, ' + Math.round(cfg.margin * 100) + '% gross margin and Rs ' + cfg.running + ' lakh monthly running costs.</p>' +
    '<details class="pb-a"><summary>Change the payback inputs (apply to every applicant)</summary>' +
      '<p class="muted sm">There is no brand data for these. The placeholders were set so that a Rs 25 to 35 lakh store pays back in 12 to 18 months in the base case, the range publicly quoted for a Lenskart-type store (an unofficial, third-party figure). With the current inputs that is ' + mo(cal.low) + ' to ' + mo(cal.high) + '.</p>' +
      '<div class="pb-grid">' + inp('sales.best', cfg.sales.best, 'Monthly sales, best', 'Rs lakh') + inp('sales.base', cfg.sales.base, 'Monthly sales, base', 'Rs lakh') + inp('sales.worst', cfg.sales.worst, 'Monthly sales, worst', 'Rs lakh') +
      inp('margin', Math.round(cfg.margin * 100), 'Gross margin', '%') + inp('running', cfg.running, 'Monthly running costs', 'Rs lakh') +
      '<label class="pb-in"><span>Investment to recover</span><select data-pb="invest"><option value="floor"' + (cfg.invest === 'floor' ? ' selected' : '') + '>Store cost for the tier</option><option value="applicant"' + (cfg.invest === 'applicant' ? ' selected' : '') + '>Applicant\'s stated figure</option></select></label></div></details>';
});

document.addEventListener('change', function (e) {
  var k = e.target.getAttribute && e.target.getAttribute('data-pb'); if (!k) return;
  if (k === 'invest') cfg.invest = e.target.value;
  else {
    var v = parseFloat(e.target.value); if (isNaN(v) || v < 0) return;
    if (k === 'margin') v = Math.min(100, v) / 100;
    var p = k.split('.'), o = cfg; for (var i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = v;
  }
  D.rerender();
  var d = document.querySelector('.pb-a'); if (d) d.open = true;
});

var css = document.createElement('style');
css.textContent = '.pb { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 4px 0 6px; } .pb > div { border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; background: var(--surface2); }' +
  ' .pb > div.base { border-color: var(--accent); } .pb small { display: block; font-size: 12px; color: var(--muted); } .pb b { font-family: var(--display); font-size: 17px; }' +
  ' .pb-tag { font-family: var(--body); font-size: 11.5px; font-weight: 600; color: var(--hold); border: 1px solid var(--hold); border-radius: 4px; padding: 0 6px; margin-left: 6px; vertical-align: 2px; }' +
  ' .pb-a summary { cursor: pointer; font-size: 13px; color: var(--accent); } .pb-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 14px; margin-top: 6px; }' +
  ' .pb-in { display: grid; grid-template-columns: 1fr 72px; gap: 0 8px; align-items: center; font-size: 13px; } .pb-in input, .pb-in select { border: 1px solid var(--line); border-radius: 6px; padding: 3px 6px; background: var(--surface); } .pb-in select { grid-column: 2; width: auto; min-width: 72px; } .pb-in small { grid-column: 1 / -1; color: var(--muted); font-size: 11.5px; }';
document.head.appendChild(css);
})();
