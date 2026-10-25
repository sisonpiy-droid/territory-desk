// Territory levers: for a territory that is not filling (or is over-subscribed), name the lever, the owner and why.
// Deliberately qualitative: no rupee figures. Money appears only if the team types its own cost and value, and then only as a break-even.
(function (root) {
'use strict';
var E = root.Engine || (typeof require !== 'undefined' ? require('../engine.js') : null);

// owner names are assumptions: edit them to the brand's real roles
var LEVERS = {
  holds: { name: 'Clear the holds', owner: 'Expansion team' },
  outreach: { name: 'Local outreach', owner: 'Regional business development' },
  referrals: { name: 'Partner referrals', owner: 'Franchise relations' },
  support: { name: 'Launch support', owner: 'Training team' },
  pins: { name: 'Review the pin list', owner: 'Expansion head' },
  capacity: { name: 'Decide on capacity', owner: 'Expansion head' }
};

// row: one entry of planner.plan(S).rows. Returns [{ key, name, owner, why }] in the order to act.
function levers(S, row, owners) {
  owners = owners || {};
  var out = [], city = row.city, t = S.ters.filter(function (x) { return x.id === row.id; })[0];
  var add = function (key, why) { out.push({ key: key, name: LEVERS[key].name, owner: owners[key] || LEVERS[key].owner, why: why }); };
  var waiting = S.apps.filter(function (a) { var r = S.run.res[a.id]; return !a.withdrawn && r && r.outcome === 'Waitlist' && r.waitReason === 'territory_full' && r.ter && r.ter.id === row.id; });
  if (row.open > 0) {
    if (row.pins.length < row.open) add('pins', 'Only ' + row.pins.length + ' free pin' + (row.pins.length === 1 ? '' : 's') + ' for ' + row.open + ' open slot' + (row.open === 1 ? '' : 's') + ': ask the brand whether the territory can take more pins.');
    if (row.fixable.length) add('holds', row.fixable.join(', ') + ' ' + (row.fixable.length === 1 ? 'is' : 'are') + ' one fix away from approval and would fill ' + Math.min(row.fixable.length, row.open) + ' slot' + (Math.min(row.fixable.length, row.open) === 1 ? '' : 's') + '.');
    if (row.received === 0) {
      add('outreach', 'No application has come from this territory yet.');
      add('referrals', 'Ask partners in neighbouring territories and existing store owners for introductions.');
    } else if (!row.fixable.length) {
      add('outreach', row.received + ' application' + (row.received === 1 ? '' : 's') + ' came in but none can go ahead, so the territory needs more local interest.');
    }
    var hasStore = E.STORES.some(function (s) { return s.city === city; });
    if (!hasStore || (t && t.tier === 'Tier 3')) {
      var mentor = E.NEAREST_CITY[city] || null;
      add('support', (hasStore ? 'A smaller town: ' : 'First store in ' + city + ': ') + 'plan extra launch support' + (mentor ? ' (the nearest trained team is in ' + mentor + ')' : '') + ' to make the first partner confident.');
    }
  } else if (waiting.length) {
    add('capacity', waiting.length + ' eligible applicant' + (waiting.length === 1 ? ' is' : 's are') + ' waitlisted (' + waiting.map(function (a) { return a.id; }).join(', ') + '): decide whether to add a slot or offer alternative pins.');
  }
  return out;
}

// break-even months for an incentive, from numbers the team types. Never filled in by default.
function breakEven(cost, valuePerMonth) {
  cost = parseFloat(cost); valuePerMonth = parseFloat(valuePerMonth);
  if (!(cost > 0) || !(valuePerMonth > 0)) return null;
  return cost / valuePerMonth;
}

var api = { LEVERS: LEVERS, levers: levers, breakEven: breakEven };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.DeskLevers = api;
})(typeof window !== 'undefined' ? window : globalThis);
