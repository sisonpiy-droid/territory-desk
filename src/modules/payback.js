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

var api = { DEFAULTS: DEFAULTS, months: months, band: band, calibration: calibration };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.DeskPayback = api;
})(typeof window !== 'undefined' ? window : globalThis);
