// Vercel function: live map data for any pin code or place in India, for the Site finder.
//   GET /api/place?pin=590002   or   GET /api/place?q=Hosapete
// Location: All India Pincode Directory centres bundled with this function (data.gov.in, Government Open Data Licence - India);
// if a pin is missing there, or a place name is given, OpenStreetMap's Nominatim geocoder.
// Daytime activity: OpenStreetMap places (ODbL) from the Overpass API around that point, on H3 resolution-8 hexagons.
// No key, no login. Responses are cached at the edge for a week, so a repeated lookup costs nothing.
const h3 = require('h3-js');
const PINS = require('./_pins-india.json');
const RES = 8, RINGS = 5, UA = 'territory-desk/1.0 (hackathon site finder; github.com/sisonpiy-droid)';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const KINDS = ['market', 'mall', 'supermarket', 'busStation', 'busStop', 'rail', 'college', 'hospital', 'shops'];
const RANK = { mall: 1, rail: 2, market: 3, busStation: 4, college: 5, hospital: 6, supermarket: 7 };

function km(a, b) { const r = Math.PI / 180, x = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) / 2 * r), y = (b[0] - a[0]) * r; return Math.sqrt(x * x + y * y) * 6371; }
async function get(url, ms, opts) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, Object.assign({ signal: ctl.signal, headers: { 'User-Agent': UA } }, opts || {})); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
async function nominatim(params) {
  const j = await get('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&' + params, 8000);
  return j && j[0] ? { lat: +j[0].lat, lon: +j[0].lon, label: j[0].display_name } : null;
}
function kind(t) {
  if (t.amenity === 'marketplace') return 'market';
  if (t.shop === 'mall') return 'mall';
  if (t.shop === 'supermarket') return 'supermarket';
  if (t.amenity === 'bus_station') return 'busStation';
  if (t.highway === 'bus_stop') return 'busStop';
  if (t.railway === 'station' || t.station === 'subway') return 'rail';
  if (t.amenity === 'college' || t.amenity === 'university') return 'college';
  if (t.amenity === 'hospital') return 'hospital';
  if (t.shop) return 'shops';
  return null;
}
async function overpass(bbox) {
  const b = bbox.join(','), q = '[out:json][timeout:45];(' +
    'nwr["amenity"="marketplace"](' + b + ');nwr["shop"](' + b + ');nwr["amenity"="bus_station"](' + b + ');node["highway"="bus_stop"](' + b + ');' +
    'nwr["railway"="station"](' + b + ');nwr["station"="subway"](' + b + ');nwr["amenity"~"^(college|university|hospital)$"](' + b + '););out center tags qt;';
  // public Overpass servers are often slow (20 to 40 s), so ask all of them at once and take the first answer
  const ctls = OVERPASS.map(() => new AbortController());
  const tries = OVERPASS.map((url, k) => {
    const t = setTimeout(() => ctls[k].abort(), 48000);
    return fetch(url, { method: 'POST', signal: ctls[k].signal, body: 'data=' + encodeURIComponent(q), headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' } })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(j => { ctls.forEach((c, i) => { if (i !== k) c.abort(); }); return j.elements; })
      .finally(() => clearTimeout(t));
  });
  try { return await Promise.any(tries); } catch (e) { throw new Error('no map server answered'); }
}

module.exports = async (req, res) => {
  const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); if (code === 200) res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=86400'); res.end(JSON.stringify(body)); };
  try {
    const url = new URL(req.url, 'http://x'), pinQ = (url.searchParams.get('pin') || '').replace(/\D/g, ''), q = (url.searchParams.get('q') || '').trim().slice(0, 80);
    let centre, pin = null, label, source;
    if (/^\d{6}$/.test(pinQ)) {
      pin = pinQ;
      if (PINS[pin]) { centre = { lat: PINS[pin][0], lon: PINS[pin][1] }; label = PINS[pin][2] + ', ' + PINS[pin][3]; source = 'All India Pincode Directory'; }
      else {
        const g = await nominatim('postalcode=' + pin);
        if (!g) return send(404, { error: 'Pin ' + pin + ' was not found in the pin-code directory or on OpenStreetMap.' });
        centre = g; label = g.label; source = 'OpenStreetMap (Nominatim), pin not in the directory';
      }
    } else if (q.length >= 3) {
      const g = await nominatim('q=' + encodeURIComponent(q));
      if (!g) return send(404, { error: 'No place called "' + q + '" was found in India on OpenStreetMap.' });
      centre = g; label = g.label; source = 'OpenStreetMap (Nominatim)';
    } else return send(400, { error: 'Give a 6-digit pin code or a place name.' });

    // nearby pins: the hexagons are shared out between them, as on the built-in map
    const near = Object.keys(PINS).filter(p => km([PINS[p][0], PINS[p][1]], [centre.lat, centre.lon]) <= 12);
    if (!pin) pin = near.sort((a, b) => km([PINS[a][0], PINS[a][1]], [centre.lat, centre.lon]) - km([PINS[b][0], PINS[b][1]], [centre.lat, centre.lon]))[0] || null;
    const pinLL = {}; near.forEach(p => { pinLL[p] = [PINS[p][0], PINS[p][1]]; });
    if (pin && !pinLL[pin]) pinLL[pin] = [centre.lat, centre.lon];

    const ids = h3.gridDisk(h3.latLngToCell(centre.lat, centre.lon, RES), RINGS).sort(), idx = {};
    ids.forEach((id, i) => { idx[id] = i; });
    const ll = ids.map(id => h3.cellToLatLng(id)), pins = Object.keys(pinLL);
    const pinOf = ll.map(c => { let best = '', bd = 1e9; pins.forEach(p => { const d = km(c, pinLL[p]); if (d < bd) { bd = d; best = p; } }); return best; });
    if (pin) { const own = idx[h3.latLngToCell(pinLL[pin][0], pinLL[pin][1], RES)]; if (own !== undefined) pinOf[own] = pin; }

    const lats = [].concat(...ids.map(id => h3.cellToBoundary(id).map(v => v[0]))), lons = [].concat(...ids.map(id => h3.cellToBoundary(id).map(v => v[1])));
    const els = await overpass([Math.min(...lats), Math.min(...lons), Math.max(...lats), Math.max(...lons)].map(x => x.toFixed(4)));
    const counts = ids.map(() => KINDS.map(() => 0)), marks = ids.map(() => []);
    els.forEach(e => {
      const lat = e.lat || (e.center && e.center.lat), lon = e.lon || (e.center && e.center.lon), t = e.tags || {};
      const k = t.shop === 'mall' || t.shop === 'supermarket' ? kind(t) : kind(t);
      if (lat == null || !k) return;
      const i = idx[h3.latLngToCell(lat, lon, RES)]; if (i === undefined) return;
      counts[i][KINDS.indexOf(k)]++;
      const nm = (t['name:en'] || t.name || '').replace(/["“”]/g, '').trim();
      if (nm && RANK[k]) marks[i].push([RANK[k], nm]);
    });
    const qz = x => Math.round(x * 1e5), name = 'Around ' + (pin || q);
    const area = {
      prefix: pin ? pin.slice(0, 3) : '', centre: [centre.lat, centre.lon], osm: true, residents: false, live: true, label: label, source: source, fetched: new Date().toISOString().slice(0, 10),
      id: ids, lat: ll.map(c => qz(c[0])), lon: ll.map(c => qz(c[1])),
      b: ids.map((id, i) => [].concat(...h3.cellToBoundary(id).map(v => [qz(v[0]) - qz(ll[i][0]), qz(v[1]) - qz(ll[i][1])]))),
      r1: ids.map(id => h3.gridRing(id, 1).map(n => idx[n]).filter(n => n !== undefined)),
      r2: ids.map(id => h3.gridRing(id, 2).map(n => idx[n]).filter(n => n !== undefined)),
      pop: ids.map(() => 0), act: counts, pin: pinOf,
      lm: marks.map(m => [...new Set(m.sort((a, b) => a[0] - b[0]).map(x => x[1]))].slice(0, 3))
    };
    const pinsOut = {}; pins.forEach(p => { pinsOut[p] = { lat: pinLL[p][0], lon: pinLL[p][1], city: name }; });
    send(200, { name: name, pin: pin, area: area, pins: pinsOut, places: els.length });
  } catch (e) {
    send(502, { error: 'The live map service did not answer in time (' + (e.name === 'AbortError' ? 'timeout' : e.message) + '). Try again in a minute.' });
  }
};
