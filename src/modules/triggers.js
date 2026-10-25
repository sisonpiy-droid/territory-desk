// For every held or waitlisted application: the events that would make the desk decide it again, and what would happen.
(function (root) {
'use strict';
var TRIG = {
  NO_SPACE: 'The applicant reports a shop space (size and floor)',
  SIZE_MISSING: 'The applicant sends the size of the space',
  SIZE_SMALL: 'The applicant moves to a space of at least {min} sq ft',
  FLOOR_UPPER: 'The applicant moves to a ground-floor or mall space',
  INVEST_GAP: 'Proof of Rs {need} lakh arrives, or a co-investor joins',
  INVEST_MISSING: 'The applicant sends an investment figure',
  NOTES_CONFLICT: 'The applicant confirms whether the form or the notes are right',
  STATE_MISMATCH: 'The applicant corrects the state, city or pin code',
  PIN_BAD: 'The applicant corrects the pin code',
  PIN_MISMATCH: 'The applicant corrects the pin code or the city',
  CITY_UNKNOWN: 'The applicant corrects the city',
  PIN_HAS_STORE: 'The applicant names a pin without a store',
  PIN_OUTSIDE: 'The applicant names a pin inside a territory, or a territory adds pin {pin}'
};
function fill(s, m) { return s.replace(/\{(\w+)\}/g, function (_, k) { return m[k] != null ? m[k] : ''; }); }

function triggers(S) {
  var out = {};
  S.apps.forEach(function (a) {
    var r = S.run.res[a.id]; if (a.withdrawn || !r) return;
    if (r.outcome !== 'Hold' && r.outcome !== 'Waitlist') return;
    var ev = [], then = '';
    if (r.override && r.override.applied) ev.push('The expansion team removes the override');
    else if (r.outcome === 'Hold') {
      r.issues.filter(function (i) { return i.level === 'hold'; }).forEach(function (i) {
        var t = TRIG[i.code]; if (t && ev.indexOf(fill(t, { min: S.cfg.minSpace, need: i.need, pin: a.pin })) < 0) ev.push(fill(t, { min: S.cfg.minSpace, need: i.need, pin: a.pin }));
      });
      var f = r.ifFixed;
      if (f && f.possible) then = f.outcome === 'Approve' ? 'Approved' + (f.pin && f.pin !== a.pin ? ' on pin ' + f.pin : '') : f.outcome === 'Waitlist' ? 'Waitlisted' + (f.winner ? ' behind ' + f.winner : f.beatenBy ? ' behind ' + f.beatenBy.join(', ') : '') : 'Still on hold';
      else if (f && f.why === 'no_free_pin') then = 'Waitlisted: no open pin is left in ' + a.city;
      else if (f) then = 'Decided again once the pin code or city is corrected';
    } else if (r.waitReason === 'pin_lost') {
      ev.push(r.winner + ' withdraws, fails verification or moves to another pin');
      then = 'Approved on pin ' + a.pin;
    } else if (r.waitReason === 'territory_full') {
      ev.push('A slot is added in ' + r.ter.id + ', or ' + (r.beatenBy || []).join(' or ') + ' drops out');
      then = 'Approved on pin ' + a.pin;
    }
    if (r.alternatives && r.alternatives.length && !(r.override && r.override.applied)) ev.push('The applicant accepts open pin ' + r.alternatives.map(function (p) { return p.pin; }).join(' or '));
    out[a.id] = { id: a.id, outcome: r.outcome, events: ev, then: then };
  });
  return out;
}

var api = { triggers: triggers };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.DeskTriggers = api;
})(typeof window !== 'undefined' ? window : globalThis);
