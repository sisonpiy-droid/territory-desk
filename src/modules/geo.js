// Site finder logic: estimated crowd per hexagon, crowd potential, catchment overlap with stores, recommended cells
// inside a pin's area, and a back-test on the existing stores. Pure functions over the static GeoData (src/data/geo.js).
// Every weight and radius below is an assumption the user can edit on screen.
(function (root) {
'use strict';
var G = root.GeoData || (typeof require !== 'undefined' ? require('../data/geo.js') : null);
var E = root.Engine || (typeof require !== 'undefined' ? require('../engine.js') : null);

var DEFAULTS = {
  residentShare: 0.5,                       // crowd = 50% residents + 50% daytime activity
  ring1: 0.5, ring2: 0.25,                  // weight of neighbouring cells in crowd potential
  radius: { 'Tier 1': 2, 'Tier 2': 3, 'Tier 3': 5 },   // store catchment, km: placeholder, to verify with customer-origin data
  penalty: 1,                               // points lost per 1% of the catchment's crowd already within reach of a store
  act: { market: 3, mall: 4, supermarket: 2, busStation: 3, busStop: 0.5, rail: 4, college: 2, hospital: 2, shops: 0.2 }   // activity points per place
};
var KIND_LABEL = { market: 'market', mall: 'mall', supermarket: 'supermarket', busStation: 'bus station', busStop: 'bus stop', rail: 'metro or railway station', college: 'college', hospital: 'hospital', shops: 'shop' };

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function km(a, b) { var r = Math.PI / 180, x = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) / 2 * r), y = (b[0] - a[0]) * r; return Math.sqrt(x * x + y * y) * 6371; }
function pctl(sorted, p) { if (!sorted.length) return 0; return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))]; }

/* ---------- per-city crowd and potential (cached per settings) ---------- */
var cache = {};
function city(name, cfg) {
  cfg = cfg || DEFAULTS;
  var d = G && G.cities[name]; if (!d) return null;
  var key = name + JSON.stringify(cfg);
  if (cache[key]) return cache[key];
  var n = d.id.length, K = G.meta.kinds;
  var ll = d.lat.map(function (v, i) { return [v / 1e5, d.lon[i] / 1e5]; });
  var actRaw = d.act.map(function (c) { var s = 0; c.forEach(function (x, k) { s += x * (cfg.act[K[k]] || 0); }); return s; });
  var scale = function (xs) { var top = pctl(xs.slice().sort(function (a, b) { return a - b; }), 0.95) || 1; return xs.map(function (x) { return Math.min(100, 100 * x / top); }); };
  var res = scale(d.pop), act = d.osm ? scale(actRaw) : res.map(function () { return 0; });
  var share = d.osm ? cfg.residentShare : 1;
  var crowd = res.map(function (r, i) { return share * r + (1 - share) * act[i]; });
  var potRaw = crowd.map(function (c, i) {
    var s = c; d.r1[i].forEach(function (j) { s += cfg.ring1 * crowd[j]; }); d.r2[i].forEach(function (j) { s += cfg.ring2 * crowd[j]; }); return s;
  });
  var maxP = Math.max.apply(null, potRaw) || 1;
  var pins = {}; d.pin.forEach(function (p, i) { if (p) (pins[p] = pins[p] || []).push(i); });
  var c = { name: name, d: d, n: n, ll: ll, res: res, act: act, crowd: crowd, potential: potRaw.map(function (p) { return 100 * p / maxP; }), pins: pins, osm: d.osm,
            tier: E && E.CITIES[name] ? E.CITIES[name].tier : 'Tier 2' };
  cache[key] = c;
  return c;
}
function pinInfo(pin) { return G && G.pins[pin] ? G.pins[pin] : null; }
function cellAt(c, lat, lon) { var best = -1, bd = 1e9; for (var i = 0; i < c.n; i++) { var dd = km(c.ll[i], [lat, lon]); if (dd < bd) { bd = dd; best = i; } } return bd < 1 ? best : -1; }

/* ---------- stores and competition ---------- */
// Existing stores sit at their pin's centre (street addresses are not in the data). Approved applicants likewise.
function sites(extra) {
  var out = [];
  (E ? E.STORES : []).forEach(function (s) { var p = pinInfo(s.pin); if (p) out.push({ id: s.id, pin: s.pin, lat: p.lat, lon: p.lon, kind: 'store', city: p.city }); });
  (extra || []).forEach(function (a) { var p = pinInfo(a.pin); if (p) out.push({ id: a.id, pin: a.pin, lat: p.lat, lon: p.lon, kind: 'approved', city: p.city }); });
  return out;
}
// Share of the crowd within the catchment of cell i that is already within reach of another site.
function overlap(c, i, R, ss, skipId) {
  var tot = 0, cov = 0, near = null;
  ss.forEach(function (s) { if (s.id === skipId || s.city !== c.name) return; var dd = km(c.ll[i], [s.lat, s.lon]); if (!near || dd < near.km) near = { id: s.id, kind: s.kind, km: dd }; });
  for (var j = 0; j < c.n; j++) {
    if (km(c.ll[i], c.ll[j]) > R) continue;
    tot += c.crowd[j];
    if (ss.some(function (s) { return s.id !== skipId && s.city === c.name && km(c.ll[j], [s.lat, s.lon]) <= R; })) cov += c.crowd[j];
  }
  return { share: tot ? cov / tot : 0, nearest: near };
}

/* ---------- recommendations inside a pin's area ---------- */
function recommend(pin, cfg, extraSites, opts) {
  cfg = cfg || DEFAULTS; opts = opts || {};
  var p = pinInfo(pin);
  if (!p) return { pin: pin, ok: false, why: 'Pin ' + pin + ' has no location in the pin-code directory, so it cannot be mapped.' };
  var c = city(p.city, cfg), cells = c.pins[pin];
  if (!cells || !cells.length) return { pin: pin, ok: false, why: 'Pin ' + pin + ' has a location but no hexagon is closer to it than to a neighbouring pin centre, so its area cannot be drawn.' };
  var R = cfg.radius[c.tier] || 3, ss = sites(extraSites);
  var sortedCrowd = cells.map(function (i) { return c.crowd[i]; }).sort(function (a, b) { return a - b; });
  var p75 = pctl(c.crowd.slice().sort(function (a, b) { return a - b; }), 0.75);
  var ranked = cells.map(function (i) {
    var o = overlap(c, i, R, ss, opts.skipId);
    var below = sortedCrowd.filter(function (x) { return x < c.crowd[i]; }).length;
    var strong = c.d.r1[i].filter(function (j) { return c.crowd[j] >= p75; }).length;
    var lms = c.d.lm[i].slice(); c.d.r1[i].forEach(function (j) { c.d.lm[j].forEach(function (m) { if (lms.length < 4 && lms.indexOf(m) < 0) lms.push(m); }); });
    return { i: i, h3: c.d.id[i], lat: c.ll[i][0], lon: c.ll[i][1], crowd: c.crowd[i], residents: c.d.pop[i], potential: c.potential[i],
             overlap: o.share, nearest: o.nearest, score: c.potential[i] - cfg.penalty * 100 * o.share,
             crowdPct: Math.round(100 * below / Math.max(1, cells.length - 1)), strong: strong, landmarks: lms, places: placesIn(c, i) };
  }).sort(function (a, b) { return b.score - a.score || (a.h3 < b.h3 ? -1 : 1); });
  // the three picks should be different places: skip a cell that touches an earlier pick
  var top = [], spread = cells.length >= 7;   // small pins are only a few hexagons, so neighbours are allowed there
  ranked.forEach(function (x) { if (top.length < 3 && !(spread && top.some(function (t) { return c.d.r1[t.i].indexOf(x.i) >= 0; }))) top.push(x); });
  if (top.length < 3) ranked.forEach(function (x) { if (top.length < 3 && top.indexOf(x) < 0) top.push(x); });
  var byPot = cells.slice().sort(function (a, b) { return c.potential[b] - c.potential[a]; });
  top.forEach(function (t, k) { t.rank = k + 1; t.potRank = byPot.indexOf(t.i) + 1; t.reason = reason(t, c, R, cells.length); });
  return { pin: pin, ok: true, city: c.name, tier: c.tier, radius: R, cells: cells, ranked: ranked, top: top, osm: c.osm, sites: ss.filter(function (s) { return s.city === c.name; }) };
}
function placesIn(c, i) {
  var K = G.meta.kinds, a = c.d.act[i], out = [];
  K.forEach(function (k, j) { if (a[j] && k !== 'shops') out.push(a[j] + ' ' + KIND_LABEL[k] + (a[j] > 1 ? (k === 'busStop' ? 's' : k === 'rail' ? 's' : 's') : '')); });
  var shops = a[K.indexOf('shops')]; if (shops) out.push(shops + ' shop' + (shops > 1 ? 's' : '') + ' mapped');
  return out;
}
function reason(t, c, R, nCells) {
  var bits = [];
  bits.push('Crowd potential (this hexagon plus its neighbours) ranks ' + t.potRank + ' of ' + nCells + ' in this pin; the hexagon itself is busier than ' + t.crowdPct + '% of the pin (estimated crowd ' + Math.round(t.crowd) + ' of 100' + (c.osm ? '' : ', residents only') + ').');
  if (t.strong) bits.push(t.strong + ' of its 6 neighbouring hexagons are among the busiest quarter of ' + c.name + '.');
  if (t.nearest) bits.push('Nearest ' + (t.nearest.kind === 'store' ? 'store' : 'approved partner') + ' ' + t.nearest.id + ' is ' + t.nearest.km.toFixed(1) + ' km away; ' + Math.round(100 * t.overlap) + '% of the crowd within ' + R + ' km is already within its reach.');
  else bits.push('No store or approved partner within this city yet, so no catchment overlap.');
  if (t.landmarks.length) bits.push('Near ' + t.landmarks.join(', ') + '.');
  return bits;
}

/* ---------- back-test: where do today's stores sit? ---------- */
function backtest(cfg) {
  cfg = cfg || DEFAULTS;
  return (E ? E.STORES : []).map(function (s) {
    var p = pinInfo(s.pin); if (!p) return { id: s.id, pin: s.pin, ok: false };
    var c = city(p.city, cfg), i = cellAt(c, p.lat, p.lon), cells = c.pins[s.pin] || [];
    if (i < 0) return { id: s.id, pin: s.pin, ok: false };
    var inPin = cells.filter(function (j) { return c.potential[j] > c.potential[i]; }).length + 1;
    var inCity = c.potential.filter(function (v) { return v > c.potential[i]; }).length + 1;
    return { id: s.id, pin: s.pin, city: c.name, ok: true, rankPin: inPin, nPin: cells.length, rankCity: inCity, nCity: c.n,
             topPctCity: Math.round(100 * inCity / c.n), crowd: Math.round(c.crowd[i]) };
  });
}

// Fair comparison for the back-test: the same rank for the centre of every other pin. Post offices sit in busy places,
// so pin centres rank high anyway; stores only say something if they beat this baseline.
function baseline(cfg) {
  cfg = cfg || DEFAULTS;
  var storePins = {}; (E ? E.STORES : []).forEach(function (s) { storePins[s.pin] = 1; });
  var tops = [];
  Object.keys(G.pins).forEach(function (p) {
    if (storePins[p]) return;
    var info = G.pins[p], c = city(info.city, cfg), i = cellAt(c, info.lat, info.lon);
    if (i >= 0) tops.push(Math.round(100 * (c.potential.filter(function (v) { return v > c.potential[i]; }).length + 1) / c.n));
  });
  tops.sort(function (a, b) { return a - b; });
  return { n: tops.length, medianTop: tops.length ? tops[Math.floor((tops.length - 1) / 2)] : null };
}

/* ---------- a plain search brief for the partner ---------- */
function brief(rec, who) {
  if (!rec.ok) return rec.why;
  var lines = ['Where to look for a shop in pin ' + rec.pin + ' (' + rec.city + ')' + (who ? ', for ' + who : ''), ''];
  rec.top.forEach(function (t) {
    lines.push(t.rank + '. Around ' + t.lat.toFixed(4) + ', ' + t.lon.toFixed(4) + (t.landmarks.length ? ' (near ' + t.landmarks.join(', ') + ')' : '') +
      ': https://www.openstreetmap.org/?mlat=' + t.lat.toFixed(5) + '&mlon=' + t.lon.toFixed(5) + '#map=16/' + t.lat.toFixed(5) + '/' + t.lon.toFixed(5));
    t.reason.forEach(function (r) { lines.push('   ' + r); });
  });
  lines.push('', 'Look for a ground-floor or mall unit of 300 to 500 sq ft within about 500 m of these points.',
    'Crowd is an estimate from residents (Kontur Population) and mapped places (OpenStreetMap), not measured footfall.');
  return lines.join('\n');
}

var api = { DEFAULTS: DEFAULTS, clone: clone, km: km, city: city, pinInfo: pinInfo, sites: sites, overlap: overlap, recommend: recommend, backtest: backtest, baseline: baseline, brief: brief, data: G };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.DeskGeo = api;
})(typeof window !== 'undefined' ? window : globalThis);
