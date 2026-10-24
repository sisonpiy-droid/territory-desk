// Offline step: builds the hexagon data the Site finder uses and writes src/data/geo.js (no hexagon library needed in the page).
//   node scripts/build-geo.js --wanted   -> scripts/out/wanted-cells.txt (the cells to pull from Kontur)
//   python scripts/kontur-extract.py     -> scripts/out/kontur-cells.tsv
//   node scripts/osm-fetch.js            -> scripts/raw/osm-<prefix>.json (optional; without it, residents only)
//   node scripts/build-geo.js            -> src/data/geo.js
// Sources: Kontur Population (CC BY 4.0), OpenStreetMap contributors (ODbL), All India Pincode Directory (Government Open Data Licence - India).
const fs = require('fs'), path = require('path'), h3 = require('h3-js'), CITIES = require('./cities');
const RES = 8, OUT = path.join(__dirname, 'out');
const pinsAll = JSON.parse(fs.readFileSync(path.join(OUT, 'pins.json'), 'utf8'));
function km(a, b) { const r = Math.PI / 180, x = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) / 2 * r), y = (b[0] - a[0]) * r; return Math.sqrt(x * x + y * y) * 6371; }

// cells whose centre lies within the city's radius
function cityCells(c) {
  const k = Math.ceil(c.radius / 0.8) + 2;
  return h3.gridDisk(h3.latLngToCell(c.lat, c.lon, RES), k).filter(id => km(h3.cellToLatLng(id), [c.lat, c.lon]) <= c.radius).sort();
}
if (process.argv[2] === '--wanted') {
  const all = [].concat(...Object.values(CITIES).map(cityCells));
  fs.writeFileSync(path.join(OUT, 'wanted-cells.txt'), all.join('\n'));
  console.log('wanted cells: ' + all.length);
  process.exit(0);
}

const pop = {};
fs.readFileSync(path.join(OUT, 'kontur-cells.tsv'), 'utf8').split('\n').forEach(l => { const [id, p] = l.split('\t'); if (id) pop[id] = Math.round(+p); });

const KINDS = ['market', 'mall', 'supermarket', 'busStation', 'busStop', 'rail', 'college', 'hospital', 'shops'];
const LANDMARK_RANK = { mall: 1, rail: 2, market: 3, busStation: 4, college: 5, hospital: 6, supermarket: 7 };
function kind(t) {
  if (t.amenity === 'marketplace') return 'market';
  if (t.shop === 'mall') return 'mall';
  if (t.shop === 'supermarket') return 'supermarket';
  if (t.amenity === 'bus_station') return 'busStation';
  if (t.highway === 'bus_stop') return 'busStop';
  if (t.railway === 'station' || t.station === 'subway') return 'rail';
  if (t.amenity === 'college' || t.amenity === 'university') return 'college';
  if (t.amenity === 'hospital') return 'hospital';
  return null;
}

const out = { meta: { res: RES, built: new Date().toISOString().slice(0, 10), kinds: KINDS, osm: {}, sources: [
  'Kontur Population: Global Population Density for 400m H3 Hexagons, India, 2023-11-01 (CC BY 4.0, via HDX)',
  'OpenStreetMap contributors (ODbL), fetched once through the Overpass API',
  'All India Pincode Directory, Department of Posts via data.gov.in (Government Open Data Licence - India)'] }, cities: {}, pins: {} };

Object.keys(CITIES).forEach(name => {
  const c = CITIES[name], ids = cityCells(c), idx = {};
  ids.forEach((id, i) => { idx[id] = i; });
  const centres = ids.map(id => h3.cellToLatLng(id));
  // pins of this city: right prefix and centre inside the modelled area (plus a margin)
  const pins = Object.keys(pinsAll).filter(p => p.startsWith(c.prefix) && km([pinsAll[p].lat, pinsAll[p].lon], [c.lat, c.lon]) <= c.radius + 3);
  const pinOf = centres.map(ll => { let best = -1, bd = 1e9; pins.forEach((p, j) => { const d = km(ll, [pinsAll[p].lat, pinsAll[p].lon]); if (d < bd) { bd = d; best = j; } }); return best; });
  // every pin keeps at least the hexagon its own centre falls in (otherwise a pin squeezed between neighbours gets none)
  pins.forEach((p, j) => { const i = idx[h3.latLngToCell(pinsAll[p].lat, pinsAll[p].lon, RES)]; if (i !== undefined && !pinOf.some((x, k) => x === j && k !== i) ) pinOf[i] = j; });
  const counts = ids.map(() => KINDS.map(() => 0)), marks = ids.map(() => []);
  const osmFile = path.join(__dirname, 'raw', 'osm-' + c.prefix + '.json');
  let hasOsm = false;
  if (fs.existsSync(osmFile)) {
    hasOsm = true;
    const o = JSON.parse(fs.readFileSync(osmFile, 'utf8'));
    o.places.forEach(e => {
      const lat = e.lat || (e.center && e.center.lat), lon = e.lon || (e.center && e.center.lon), t = e.tags || {}, k = kind(t);
      if (lat == null || !k) return;
      const i = idx[h3.latLngToCell(lat, lon, RES)]; if (i === undefined) return;
      counts[i][KINDS.indexOf(k)]++;
      const nm = (t['name:en'] || t.name || '').replace(/["“”]/g, '').trim();
      if (nm && LANDMARK_RANK[k]) marks[i].push([LANDMARK_RANK[k], nm.trim()]);
    });
    o.shops.forEach(ll => { if (ll[0] == null) return; const i = idx[h3.latLngToCell(ll[0], ll[1], RES)]; if (i !== undefined) counts[i][KINDS.indexOf('shops')]++; });
    out.meta.osm[name] = o.fetched.slice(0, 10);
  }
  const q = x => Math.round(x * 1e5);
  out.cities[name] = {
    prefix: c.prefix, centre: [c.lat, c.lon], osm: hasOsm,
    id: ids,
    lat: centres.map(ll => q(ll[0])), lon: centres.map(ll => q(ll[1])),
    // boundary as 6 vertex offsets from the centre, in 1e-5 degrees
    b: ids.map((id, i) => [].concat(...h3.cellToBoundary(id).map(v => [q(v[0]) - q(centres[i][0]), q(v[1]) - q(centres[i][1])]))),
    r1: ids.map(id => h3.gridRing(id, 1).map(n => idx[n]).filter(n => n !== undefined)),
    r2: ids.map(id => h3.gridRing(id, 2).map(n => idx[n]).filter(n => n !== undefined)),
    pop: ids.map(id => pop[id] || 0),
    act: counts,
    pin: pinOf.map(j => j < 0 ? '' : pins[j]),
    lm: marks.map(m => [...new Set(m.sort((a, b) => a[0] - b[0]).map(x => x[1]))].slice(0, 3))
  };
  pins.forEach(p => { out.pins[p] = { lat: pinsAll[p].lat, lon: pinsAll[p].lon, city: name }; });
  const withPop = ids.filter(id => pop[id]).length;
  console.log(name + ': ' + ids.length + ' cells, ' + withPop + ' with residents (' + Object.values(pop).length + ' total), ' + pins.length + ' pins, OpenStreetMap ' + (hasOsm ? 'yes' : 'no'));
});

fs.mkdirSync(path.join(__dirname, '..', 'src', 'data'), { recursive: true });
const js = '// Generated by scripts/build-geo.js on ' + out.meta.built + '. Do not edit by hand.\n' +
  '(function (root) { var d = ' + JSON.stringify(out) + ';\nif (typeof module !== \'undefined\' && module.exports) module.exports = d; root.GeoData = d; })(typeof window !== \'undefined\' ? window : globalThis);\n';
fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'geo.js'), js);
console.log('src/data/geo.js: ' + Math.round(js.length / 1024) + ' KB');
