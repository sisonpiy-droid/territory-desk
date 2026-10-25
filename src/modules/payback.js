// Payback band: an illustrative range of months to recover the store investment. Not a forecast.
// No brand data exists for sales or costs, so the placeholders below were set (calibrated) so that a typical store
// costing Rs 25 to 35 lakh pays back in 12 to 18 months in the base case: the range publicly quoted, unofficially,
// for a Lenskart-type store (see docs/research-notes.md). Every input is editable on screen.
(function (root) {
'use strict';
var DEFAULTS = {
  sales: { worst: 5.5, base: 6.7, best: 8.0 },   // monthly sales, Rs lakh
  margin: 0.45,                                    // gross margin on sales
  running: 1.0,                                    // monthly running costs (rent, staff, utilities), Rs lakh
  invest: 'floor'                                  // 'floor': the store cost for the city tier; 'applicant': the applicant's stated capacity
};

function months(invest, sales, cfg) {
  var monthly = sales * cfg.margin - cfg.running;
  return monthly > 0 ? invest / monthly : null;   // null: never pays back at these numbers
}
// investment basis for an applicant: the tier's minimum investment (store cost) or their own figure
function band(a, tierFloor, cfg) {
  cfg = cfg || DEFAULTS;
  var inv = cfg.invest === 'applicant' && a.invest ? a.invest : tierFloor;
  if (!inv) return null;
  var m = function (k) { return months(inv, cfg.sales[k], cfg); };
  return { invest: inv, best: m('best'), base: m('base'), worst: m('worst'),
           monthly: { best: cfg.sales.best * cfg.margin - cfg.running, base: cfg.sales.base * cfg.margin - cfg.running, worst: cfg.sales.worst * cfg.margin - cfg.running } };
}
// the calibration claim, checked: base-case months for a Rs 25 and a Rs 35 lakh store
function calibration(cfg) { cfg = cfg || DEFAULTS; return { low: months(25, cfg.sales.base, cfg), high: months(35, cfg.sales.base, cfg) }; }

// The bad-six-months test: what a store does if sales run at a share of the base case for six months.
// spare = money the applicant has beyond the store cost (their stated investment minus the tier floor, from the file).
// Illustrative: it uses the same placeholder sales, margin and running costs as the payback band.
var STRESS_PCTS = [50, 70, 90];
function stress(invest, spare, cfg, pcts) {
  cfg = cfg || DEFAULTS; pcts = pcts || STRESS_PCTS; spare = Math.max(0, spare || 0);
  var breakEven = cfg.running / cfg.margin;   // monthly sales (Rs lakh) at which the store just covers its running costs
  return {
    breakEvenSales: breakEven, breakEvenPct: Math.round(100 * breakEven / cfg.sales.base),
    rows: pcts.map(function (p) {
      var sales = cfg.sales.base * p / 100, monthly = sales * cfg.margin - cfg.running;
      return { pct: p, sales: sales, monthly: monthly, six: monthly * 6, payback: monthly > 0 ? invest / monthly : null, runway: monthly < 0 ? (spare > 0 ? spare / -monthly : 0) : null };
    })
  };
}

var api = { DEFAULTS: DEFAULTS, months: months, band: band, calibration: calibration, stress: stress, STRESS_PCTS: STRESS_PCTS };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.DeskPayback = api;
})(typeof window !== 'undefined' ? window : globalThis);
