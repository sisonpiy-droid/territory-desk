// Site finder tab: where inside a pin's area to look for a shop, on a hexagon map drawn in SVG (no map tiles, no remote images).
// Logic in src/modules/geo.js, data in src/data/geo.js (built offline by scripts/build-geo.js).
(function () {
'use strict';
var D = window.__desk, S = D.S, E = D.E, esc = D.esc, pill = D.pill, Geo = window.DeskGeo;
if (!Geo || !Geo.data) return;
var V = { pin: '', query: '', who: null };
var live = {};   // live lookups in progress or failed, by pin or place name

// Pins and places outside the built-in data are looked up through api/place.js (hosted page only).
function canFetch() { return typeof fetch === 'function' && /^https?:$/.test(location.protocol); }
function lookup(key, isPin, then) {
  if (live[key] && live[key].state === 'loading') return;
  live[key] = { state: 'loading' };
  fetch('api/place?' + (isPin ? 'pin=' : 'q=') + encodeURIComponent(key))
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (x) {
      if (!x.ok || !x.j.area) live[key] = { state: 'error', msg: x.j.error || 'The live map lookup failed.' };
      else { Geo.addArea(x.j); delete live[key]; if (!isPin && V.query === key) { V.pin = x.j.pin; V.query = ''; } }
      if (then) then(x.ok ? x.j : null, x.j.error); body();
    })
    .catch(function (e) { live[key] = { state: 'error', msg: 'The live map lookup failed (' + e.message + ').' }; if (then) then(null, live[key].msg); body(); });
}

function approvedSites(skipId) {
  if (!S.run) return [];
  return S.apps.filter(function (a) { return !a.withdrawn && a.id !== skipId && S.run.res[a.id] && S.run.res[a.id].outcome === 'Approve'; }).map(function (a) { return { id: a.id, pin: a.pin }; });
}
function rec(pin, skipId) { return Geo.recommend(pin, Geo.cfg, approvedSites(skipId), { skipId: skipId }); }
function noSpace(a, r) { return r.outcome === 'Hold' && a.space === 'Not yet identified'; }
function fallback() { return '<p class="muted sm">Until then, the partner proposes a space and the desk checks it against the rules: pin code, size, floor, and distance from existing stores by pin number.</p>'; }

/* ---------- map ---------- */
function mapSvg(r) {
  var c = Geo.city(r.city, Geo.cfg), inPin = {}; r.cells.forEach(function (i) { inPin[i] = 1; });
  var la = r.cells.map(function (i) { return c.ll[i][0]; }), lo = r.cells.map(function (i) { return c.ll[i][1]; });
  var pad = 0.014, box = [Math.min.apply(null, la) - pad, Math.max.apply(null, la) + pad, Math.min.apply(null, lo) - pad, Math.max.apply(null, lo) + pad];
  var lat0 = (box[0] + box[1]) / 2, kx = Math.cos(lat0 * Math.PI / 180), W = 560;
  var spanX = (box[3] - box[2]) * kx, spanY = box[1] - box[0], sc = W / Math.max(spanX, spanY * 1.0), H = Math.round(spanY * sc);
  var X = function (lon) { return ((lon - box[2]) * kx * sc).toFixed(1); }, Y = function (lat) { return ((box[1] - lat) * sc).toFixed(1); };
  var cells = [];
  for (var i = 0; i < c.n; i++) {
    var p = c.ll[i]; if (p[0] < box[0] || p[0] > box[1] || p[1] < box[2] || p[1] > box[3]) continue;
    var b = c.d.b[i], pts = [];
    for (var k = 0; k < b.length; k += 2) pts.push(X(p[1] + b[k + 1] / 1e5) + ',' + Y(p[0] + b[k] / 1e5));
    cells.push('<polygon points="' + pts.join(' ') + '" class="hx' + (inPin[i] ? ' in' : '') + '" style="fill-opacity:' + (0.06 + 0.84 * c.crowd[i] / 100).toFixed(2) + '"><title>' + esc((c.d.pin[i] || '') + ': estimated crowd ' + Math.round(c.crowd[i]) + ' of 100, about ' + c.d.pop[i] + ' residents' + (c.d.lm[i].length ? '; ' + c.d.lm[i].join(', ') : '')) + '</title></polygon>');
  }
  var kmPx = sc / 111;
  var sites = r.sites.map(function (s) {
    var x = X(s.lon), y = Y(s.lat), inside = s.lat > box[0] - 0.05 && s.lat < box[1] + 0.05 && s.lon > box[2] - 0.05 && s.lon < box[3] + 0.05;
    if (!inside) return '';
    return '<circle cx="' + x + '" cy="' + y + '" r="' + (r.radius * kmPx).toFixed(1) + '" class="catch ' + s.kind + '"/>' +
      (s.kind === 'store' ? '<rect x="' + (x - 6) + '" y="' + (y - 6) + '" width="12" height="12" class="mk store"/>' : '<circle cx="' + x + '" cy="' + y + '" r="6" class="mk approved"/>') +
      '<text x="' + (+x + 9) + '" y="' + (+y + 4) + '" class="lbl">' + esc(s.id) + '</text>';
  }).join('');
  var picks = r.top.map(function (t) { return '<circle cx="' + X(t.lon) + '" cy="' + Y(t.lat) + '" r="11" class="pick"/><text x="' + X(t.lon) + '" y="' + (+Y(t.lat) + 4.5) + '" class="pickn">' + t.rank + '</text>'; }).join('');
  return '<svg class="hexmap" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Hexagon map of pin ' + esc(r.pin) + ' and its surroundings"><g>' + cells.join('') + '</g>' + sites + picks + '</svg>' +
    '<div class="maplg"><span><i class="lg-heat"></i>Estimated crowd, darker is busier</span><span><i class="lg-in"></i>Pin ' + esc(r.pin) + ' (approximate area)</span><span><i class="lg-store"></i>Existing store</span><span><i class="lg-appr"></i>Approved this session</span><span><i class="lg-catch"></i>' + r.radius + ' km catchment</span><span><i class="lg-pick"></i>Recommended</span></div>';
}

/* ---------- panels ---------- */
function picksHtml(r) {
  return r.top.map(function (t) {
    var name = t.landmarks.length ? 'Near ' + t.landmarks[0] : 'Around ' + t.lat.toFixed(4) + ', ' + t.lon.toFixed(4);
    return '<li><h4><span class="pickn2">' + t.rank + '</span>' + esc(name) + '</h4>' +
      '<p class="muted sm">Score ' + Math.round(t.score) + ' = crowd potential ' + Math.round(t.potential) + ' minus ' + Math.round(Geo.cfg.penalty * 100 * t.overlap) + ' for overlap with existing catchments.</p>' +
      '<ul>' + t.reason.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      (t.places.length ? '<p class="muted sm">Mapped here: ' + esc(t.places.join(', ')) + '.</p>' : '') + '</li>';
  }).join('');
}
function num(path, val, step, unit) { return '<label class="sf-in"><span>' + unit[0] + '</span><input type="number" step="' + step + '" min="0" value="' + val + '" data-geo="' + path + '"><small>' + unit[1] + '</small></label>'; }
function assumptionsHtml() {
  var c = Geo.cfg;
  return '<details class="sf-box"><summary>Assumptions (all editable; placeholders until checked against real customer data)</summary><div class="sf-grid">' +
    num('residentShare', Math.round(c.residentShare * 100), 5, ['Residents in the crowd blend', '% (rest is daytime activity)']) +
    num('ring1', c.ring1, 0.05, ['Weight of the 6 touching hexagons', 'x']) + num('ring2', c.ring2, 0.05, ['Weight of the next 12 hexagons', 'x']) +
    num('radius.Tier 1', c.radius['Tier 1'], 0.5, ['Catchment, Tier 1 city', 'km, assumption to verify with customer-origin data']) +
    num('radius.Tier 2', c.radius['Tier 2'], 0.5, ['Catchment, Tier 2 city', 'km, assumption']) + num('radius.Tier 3', c.radius['Tier 3'], 0.5, ['Catchment, Tier 3 city', 'km, assumption']) +
    num('penalty', c.penalty, 0.1, ['Overlap penalty', 'points per 1% of crowd already in a store\'s reach']) +
    num('flagAt', Math.round(c.flagAt * 100), 5, ['Cannibalisation flag at', '% overlap, assumption']) + num('vetoAt', Math.round(c.vetoAt * 100), 5, ['Suggest a hold at', '% overlap, assumption']) +
    Object.keys(c.act).map(function (k) { return num('act.' + k, c.act[k], 0.1, ['Activity points per ' + { market: 'market', mall: 'mall', supermarket: 'supermarket', busStation: 'bus station', busStop: 'bus stop', rail: 'metro or railway station', college: 'college', hospital: 'hospital', shops: 'mapped shop' }[k], 'pts']); }).join('') +
    '</div><button class="btn sm" data-act="geo-reset">Restore defaults</button></details>';
}
function sanityHtml() {
  var bt = Geo.backtest(Geo.cfg).filter(function (b) { return b.ok; });
  var med = bt.map(function (b) { return b.topPctCity; }).sort(function (a, b) { return a - b; });
  var m = med.length ? med[Math.floor((med.length - 1) / 2)] : 0, base = Geo.baseline(Geo.cfg);
  var pinMed = bt.map(function (b) { return Math.round(100 * b.rankPin / b.nPin); }).sort(function (a, b) { return a - b; });
  return '<details class="sf-box"><summary>Sanity check: where today\'s 10 stores rank</summary><p class="muted sm">If the crowd estimate means anything, the brand\'s existing stores should sit in busy hexagons. Each store is placed at its pin\'s centre (street addresses are not in the data), and ranked on crowd potential without any spacing penalty.</p>' +
    '<ul class="sm"><li>Median store: top ' + m + '% of its city. For comparison, the centre of a typical other pin ranks top ' + base.medianTop + '% (' + base.n + ' pins), because post offices sit in busy places. So stores beat the baseline, but most of the high rank comes from where pin centres are, and 10 stores is a small sample.</li>' +
    '<li>Inside their own pin, stores rank in the middle (median at ' + pinMed[Math.floor((pinMed.length - 1) / 2)] + '% down the list). This does not test the within-pin choice: without street addresses we cannot tell which hexagon a store is really in.</li>' +
    '<li>To validate properly: geocode the 10 store addresses and compare against customer-origin data from their billing systems.</li></ul>' +
    '<table class="cmp sf-t"><thead><tr><th>Store</th><th>Pin</th><th>City</th><th>Rank in its pin</th><th>Rank in its city</th></tr></thead><tbody>' +
    bt.map(function (b) { return '<tr><td>' + esc(b.id) + '</td><td>' + esc(b.pin) + '</td><td>' + esc(b.city) + '</td><td>' + b.rankPin + ' of ' + b.nPin + '</td><td>' + b.rankCity + ' of ' + b.nCity + ' (top ' + b.topPctCity + '%)</td></tr>'; }).join('') + '</tbody></table></details>';
}
function sourcesHtml() {
  var m = Geo.data.meta, osm = Object.keys(m.osm);
  return '<details class="sf-box"><summary>Data sources and limits</summary><ul class="sm">' +
    '<li>Residents: Kontur Population, India, 1 Nov 2023, on H3 hexagons (resolution 8, about 0.9 km across). Licence CC BY 4.0.</li>' +
    '<li>Daytime activity: places from OpenStreetMap contributors (ODbL), fetched once on ' + esc(osm.length ? m.osm[osm[0]] : 'n/a') + ': markets, malls, supermarkets, bus stations and stops, metro and railway stations, colleges, hospitals, and a count of mapped shops. ' + (osm.length < 7 ? 'Loaded for ' + esc(osm.join(', ')) + ' only; other cities use residents only.' : 'Loaded for all 7 cities.') + '</li>' +
    '<li>Pin centres: All India Pincode Directory, Department of Posts via data.gov.in (Government Open Data Licence - India), mean of each pin\'s post offices after dropping misplaced ones.</li>' +
    '<li>Crowd is an estimate built from residents and mapped places. It is not measured footfall.</li>' +
    '<li>Pin areas are approximate: each hexagon goes to the nearest pin centre. Real pin boundaries are not published as open data.</li>' +
    '<li>The 7 cities are precomputed and need no connection. Any other pin or place is looked up live through this site\'s own server: location from the pin directory (or OpenStreetMap\'s Nominatim if the pin is missing), places from OpenStreetMap through Overpass. Live areas have no residents data, so their crowd is daytime activity only. Each lookup is cached for a week.</li></ul></details>';
}
function chipsHtml() {
  if (!S.run) return '';
  var zones = S.apps.filter(function (a) { var r = S.run.res[a.id]; return r && !a.withdrawn && (noSpace(a, r) || r.outcome === 'Approve') && Geo.pinInfo(a.pin); });
  return zones.length ? '<div class="sf-chips"><span class="muted sm">Search zones:</span>' + zones.map(function (a) { return '<button class="chip" data-act="geo-app" data-v="' + esc(a.id) + '">' + esc(a.id) + ' ' + esc(a.pin) + ' ' + (S.run.res[a.id].outcome === 'Approve' ? '(approved)' : '(needs a space)') + '</button>'; }).join('') + '</div>' : '';
}
function tabHtml() {
  var head = '<div class="sf-head"><div><h3>Site finder</h3><p class="muted sm">Enter any pin code or place in India to see where inside it to look for a shop, and why.</p></div>' +
    '<div class="sf-q"><input id="geo-pin" maxlength="60" placeholder="Pin or place, e.g. 575002 or Hosapete" value="' + esc(V.query || V.pin) + '" aria-label="Pin code or place"><button class="btn sm primary" data-act="geo-go">Find sites</button></div></div>' + chipsHtml();
  var body = '', lv = V.query ? live[V.query] : V.pin ? live[V.pin] : null;
  if (lv && lv.state === 'loading') body = '<div class="sf-box sf-wait"><p><b>Looking up ' + esc(V.query || 'pin ' + V.pin) + ' on the live map (OpenStreetMap).</b></p><p class="muted sm">The first lookup of a place can take up to a minute because the public map servers are busy; after that it is instant.</p></div>';
  else if (lv && lv.state === 'error') body = '<div class="sf-box"><p><b>' + esc(lv.msg) + '</b></p>' + fallback() + '<button class="btn sm" data-act="geo-retry">Try again</button></div>';
  else if (V.pin) {
    var r = rec(V.pin, V.who);
    if (!r.ok && !Geo.pinInfo(V.pin) && canFetch()) { lookup(V.pin, true); return tabHtml(); }
    if (!r.ok) body = '<div class="sf-box"><p><b>' + esc(r.why) + '</b></p>' + (canFetch() ? '' : '<p class="muted sm">Pins outside the 7 built-in cities are looked up live on the hosted page.</p>') + fallback() + '</div>';
    else body = (r.live ? '<p class="sf-live"><b>Live map data</b> for ' + esc(r.label) + '. Location from ' + esc(r.source) + '; places from OpenStreetMap, fetched ' + esc(Geo.data.cities[r.city].fetched) + '. Crowd here is daytime activity only: residents data covers the 7 built-in cities. Catchment uses the Tier 2 setting.</p>' : '') +
      '<div class="sf-main"><div class="sf-map">' + mapSvg(r) + '</div><div class="sf-side"><p class="sf-sub">' + (V.who ? esc(V.who) + ': ' : '') + 'pin ' + esc(r.pin) + ', ' + esc(r.live ? r.label.split(',').slice(-4, -2).join(',') || r.city : r.city) + ' (' + esc(r.tier) + '), ' + r.cells.length + ' hexagons' + (r.basis ? '. <b>' + esc(r.basis.charAt(0).toUpperCase() + r.basis.slice(1)) + '</b>' : '') + '.</p><ol class="sf-picks">' + picksHtml(r) + '</ol>' +
      '<button class="btn sm" data-act="geo-brief">Copy search brief</button></div></div>';
  } else body = '<p class="muted pad">Pick a search zone above, or type any pin code or place in India.</p>';
  return '<div class="sf">' + head + body + assumptionsHtml() + sanityHtml() + sourcesHtml() + '</div>';
}
window.DeskExt.tabs.push({ id: 'sites', label: 'Site finder', render: tabHtml });

/* ---------- entry points elsewhere ---------- */
window.DeskExt.afterDetail.push(function (a, r) {
  if (!(noSpace(a, r) || r.outcome === 'Approve')) return '';
  var x = rec(a.pin, a.id);
  var h = '<h4>' + (r.outcome === 'Approve' ? 'Recommended search zone' : 'Where to look for a shop') + '</h4>';
  if (!x.ok) return h + '<p class="muted sm">' + esc(x.why) + '</p>' + fallback();
  var t = x.top[0];
  return h + '<p>Best hexagon in pin ' + esc(a.pin) + ': ' + esc(t.landmarks[0] ? 'near ' + t.landmarks[0] : 'around ' + t.lat.toFixed(4) + ', ' + t.lon.toFixed(4)) + ' (crowd potential ' + Math.round(t.potential) + ', ' + Math.round(100 * t.overlap) + '% overlap with existing catchments).</p>' +
    '<p><button class="btn sm" data-act="geo-app" data-v="' + esc(a.id) + '">Open in Site finder</button></p>';
});
window.DeskExt.boardTerritory.push(function (t) {
  var open = t.pins.filter(function (p) { return !S.run.ctx.storeByPin[p] && !S.run.approvedPins[p]; });
  if (!open.length) return '';
  return '<div class="sf-board"><span class="muted sm">Find a site:</span>' + open.map(function (p) { return '<button class="chip sm" data-act="geo-open" data-v="' + p + '"' + (Geo.pinInfo(p) ? '' : ' title="No location for this pin"') + '>' + p + '</button>'; }).join('') + '</div>';
});
window.DeskExt.answerers.push(function (text) {
  var low = text.toLowerCase();
  if (!/\b(where|site|location|spot|place to|look for|search zone|which part|best area|open a store|open in)\b/.test(low)) return null;
  var pm = text.match(/\b(\d{6})\b/), idm = text.match(/\bAPP-\d+/i), a = idm ? D.getApp(D.findIds(text)[0]) : null;
  var pin = pm ? pm[1] : a ? a.pin : null;
  var place = !pin && (text.match(/\b(?:in|at|near|around)\s+([A-Za-z][A-Za-z .'-]{2,40}?)\s*\??$/) || [])[1];
  if (!pin && !place) return null;
  if (place || !Geo.pinInfo(pin)) {
    if (!canFetch()) return pin ? '<p>' + esc(rec(pin).why) + '</p>' + fallback() : null;
    lookup(place || pin, !place, function (res, err) {
      S.askLog.push({ who: 'desk', html: res ? answerFor(res.pin, a) : '<p>' + esc(err || 'The live lookup failed.') + '</p>' + fallback() });
      D.rerender();
    });
    return '<p>Looking up ' + esc(place || 'pin ' + pin) + ' on the live map (OpenStreetMap). The first lookup of a place can take up to a minute; the answer will appear here.</p>';
  }
  return answerFor(pin, a);
});
function answerFor(pin, a) {
  var r = rec(pin, a ? a.id : null);
  if (!r.ok) return '<p>' + esc(r.why) + '</p>' + fallback();
  return '<p>Where to look in pin <b>' + esc(pin) + '</b> (' + esc(r.live ? r.label.split(',').slice(0, 3).join(',') : r.city) + ')' + (a ? ' for ' + esc(a.id) + ' ' + esc(a.name) : '') + ':</p><ol class="diff">' +
    r.top.map(function (t) { return '<li><b>' + t.rank + '.</b> ' + esc(t.landmarks[0] ? 'Near ' + t.landmarks[0] : t.lat.toFixed(4) + ', ' + t.lon.toFixed(4)) + ': crowd potential ' + Math.round(t.potential) + ', ' + Math.round(100 * t.overlap) + '% overlap' + (t.nearest ? ', ' + esc(t.nearest.id) + ' ' + t.nearest.km.toFixed(1) + ' km away' : '') + '</li>'; }).join('') +
    '</ol>' + (r.live ? '<p class="nx">Live map data: daytime activity from OpenStreetMap only.</p>' : '') + '<button class="link" data-act="' + (a ? 'geo-app" data-v="' + esc(a.id) : 'geo-open" data-v="' + esc(pin)) + '">Open in Site finder</button>';
}

/* ---------- events ---------- */
function show(pin, who) { V.pin = pin; V.who = who || null; S.tab = 'sites'; D.rerender(); var t = document.querySelector('.tabs'); if (t && t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function body() { var b = document.getElementById('tabbody'); if (b && S.tab === 'sites') b.innerHTML = tabHtml(); }
document.addEventListener('click', function (e) {
  var el = e.target.closest && e.target.closest('[data-act^="geo-"]'); if (!el) return;
  var act = el.getAttribute('data-act'), v = el.getAttribute('data-v');
  if (act === 'geo-go') go(document.getElementById('geo-pin').value);
  else if (act === 'geo-retry') { var k = V.query || V.pin; delete live[k]; if (V.query) lookup(V.query, false); body(); }
  else if (act === 'geo-open') show(v, null);
  else if (act === 'geo-app') { var a = D.getApp(v); if (a) show(a.pin, a.id); }
  else if (act === 'geo-reset') { Object.assign(Geo.cfg, Geo.clone(Geo.DEFAULTS)); body(); }
  else if (act === 'geo-brief') {
    var who = V.who ? V.who + ' ' + D.getApp(V.who).name : null, txt = Geo.brief(rec(V.pin, V.who), who), label = el.textContent;
    var done = function () { el.textContent = 'Copied'; setTimeout(function () { el.textContent = label; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, done); else done();
  }
});
document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.id === 'geo-pin') go(e.target.value); });
// a 6-digit pin goes straight in; anything else is a place name, looked up live
function go(text) {
  var t = String(text || '').trim(), pin = t.replace(/\D/g, '');
  V.who = null;
  if (/^\d{6}$/.test(pin) && pin.length === t.replace(/\s/g, '').length) { V.pin = pin; V.query = ''; }
  else if (t.length >= 3) { V.query = t; V.pin = ''; if (canFetch()) lookup(t, false); else live[t] = { state: 'error', msg: 'Place names are looked up live on the hosted page; here, type a pin code from the 7 built-in cities.' }; }
  body();
}
document.addEventListener('change', function (e) {
  var path = e.target.getAttribute && e.target.getAttribute('data-geo'); if (!path) return;
  var v = parseFloat(e.target.value); if (isNaN(v) || v < 0) return;
  if (path === 'residentShare' || path === 'flagAt' || path === 'vetoAt') v = Math.min(100, v) / 100;
  var p = path.split('.'), o = Geo.cfg; for (var i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = v;
  if (S.tab === 'sites') { body(); var d = document.querySelector('.sf-box'); if (d) d.open = true; } else D.rerender();
});

var css = document.createElement('style');
css.textContent = [
  '.sf h3 { font-family: var(--display); font-size: 17px; font-weight: 800; }',
  '.sf-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }',
  '.sf-q { display: flex; gap: 6px; } .sf-q input { width: 170px; border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; background: var(--surface); }',
  '.sf-chips, .sf-board { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 6px 0 10px; } .chip.sm { font-size: 12.5px; padding: 2px 9px; }',
  '.sf-board { margin: 10px 0 0; }',
  '.sf-main { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 14px; align-items: start; }',
  '.sf-map { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 8px; }',
  '.hexmap { width: 100%; height: auto; display: block; --heat: #d9480f; }',
  '.hx { fill: var(--heat); stroke: var(--line); stroke-width: .6; } .hx.in { stroke: var(--ink); stroke-width: 1.4; }',
  '.catch { fill: none; stroke: var(--muted); stroke-dasharray: 4 3; stroke-width: 1; } .catch.approved { stroke: var(--ok); }',
  '.mk.store { fill: var(--surface); stroke: var(--ink); stroke-width: 2; } .mk.approved { fill: var(--ok); stroke: var(--surface); stroke-width: 2; }',
  '.lbl { font-size: 11px; font-weight: 600; fill: var(--ink); paint-order: stroke; stroke: var(--surface); stroke-width: 3px; }',
  '.pick { fill: var(--accent); stroke: var(--surface); stroke-width: 2.5; } .pickn { fill: var(--accent-ink); font-size: 12px; font-weight: 800; text-anchor: middle; }',
  '.maplg { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--muted); margin-top: 6px; } .maplg i { display: inline-block; width: 12px; height: 12px; margin-right: 5px; vertical-align: -2px; border-radius: 3px; }',
  '.lg-heat { background: linear-gradient(90deg, rgba(217,72,15,.1), rgba(217,72,15,.9)); } .lg-in { border: 1.5px solid var(--ink); } .lg-store { border: 2px solid var(--ink); border-radius: 1px !important; }',
  '.lg-appr { background: var(--ok); border-radius: 50% !important; } .lg-catch { border: 1px dashed var(--muted); border-radius: 50% !important; } .lg-pick { background: var(--accent); border-radius: 50% !important; }',
  '.sf-side { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }',
  '.sf-sub { font-size: 13.5px; } .sf-picks { list-style: none; padding: 0; margin: 6px 0 10px; } .sf-picks > li { border-top: 1px solid var(--line); padding: 8px 0; }',
  '.sf-picks h4 { font-family: var(--display); font-size: 14.5px; display: flex; align-items: center; gap: 8px; } .sf-picks ul { margin: 4px 0; padding-left: 18px; font-size: 13.5px; }',
  '.pickn2 { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--accent); color: var(--accent-ink); font-size: 12px; font-weight: 800; flex: none; }',
  '.sf-box { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; margin-top: 10px; } .sf-box summary { cursor: pointer; font-weight: 600; font-size: 14px; }',
  '.sf-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; margin: 8px 0; }',
  '.sf-in { display: grid; grid-template-columns: 1fr 70px; gap: 0 8px; align-items: center; font-size: 13px; } .sf-in input { border: 1px solid var(--line); border-radius: 6px; padding: 3px 6px; background: var(--surface); text-align: right; } .sf-in small { grid-column: 1 / -1; color: var(--muted); font-size: 11.5px; }',
  '.sf-t td, .sf-t th { text-align: left; }',
  '@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .hexmap { --heat: #ff8a4c; } } :root[data-theme="dark"] .hexmap { --heat: #ff8a4c; }',
  '@media (max-width: 1060px) { .sf-main { grid-template-columns: minmax(0, 1fr); } }',
  '@media (max-width: 720px) { .sf-grid { grid-template-columns: minmax(0, 1fr); } .sf-q input { width: 140px; } }'
].join('\n');
document.head.appendChild(css);
})();
